
import { Router } from "express";

import {
  createParent,
  getParents,
  getParentById,
  updateParent,
  deleteParent,
  getParentStudents,
} from "./parents.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { Parent } from "./parents.model";
import Student from "../students/students.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import mongoose from "mongoose";
import ParentChildRelationship from "./parent-child-relationship.model";
import ParentEngagement from "./parent-engagement.model";
import User from "../auth/auth.model";

import {
  createParentSchema,
  updateParentSchema,
  getParentsSchema,
  parentIdSchema,
} from "./parents.validation";

const router = Router();

// Authentication and school tenant protection
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Create Parent
router.post(
  "/",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"),
  validate({ body: createParentSchema }),
  createParent
);

// Get All Parents
router.get(
  "/",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"),
  validate({ query: getParentsSchema }),
  getParents
);

// Link a pre-provisioned JWT user account to a parent record; password setup remains in existing Auth flows.
router.post("/link-account", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const { parentId, userId } = req.body || {}, schoolId = req.user?.schoolId;
  if (!mongoose.isValidObjectId(parentId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(schoolId)) throw new AppError("Valid parentId and userId are required", 400);
  const [parent, user, conflict] = await Promise.all([
    Parent.findOne({ _id: parentId, schoolId, isActive: true }),
    User.findOne({ _id: userId, schoolId, role: "PARENT", isActive: true }).select("_id"),
    Parent.findOne({ schoolId, userId, _id: { $ne: parentId } }).select("_id"),
  ]);
  if (!parent || !user) throw new AppError("Parent profile or active parent login not found", 404);
  if (conflict) throw new AppError("This login is already linked to another parent", 409);
  parent.userId = new mongoose.Types.ObjectId(userId);
  parent.updatedBy = new mongoose.Types.ObjectId(String(req.user?.userId || req.user?.id));
  await parent.save();
  res.json({ success: true, message: "Parent login linked. Existing password reset/setup flow can now be used.", data: { parentId: parent._id, userId: parent.userId } });
}));

router.get("/me/profile", authorize("PARENT"), asyncHandler(async (req, res) => {
  const parent = await Parent.findOne({ schoolId: req.user?.schoolId, userId: req.user?.userId, isActive: true }).select("-createdBy -updatedBy").lean();
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  res.json({ success: true, data: parent });
}));
router.patch("/me/profile", authorize("PARENT"), asyncHandler(async (req, res) => {
  const allowed = ["alternatePhone", "occupation", "address", "emergencyContact", "notificationPreferences"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) update[key] = req.body[key];
  const parent = await Parent.findOneAndUpdate({ schoolId: req.user?.schoolId, userId: req.user?.userId, isActive: true }, { $set: update }, { new: true, runValidators: true }).select("-createdBy -updatedBy");
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  res.json({ success: true, message: "Parent profile updated", data: parent });
}));

// Parent can manage the homework notification opt-out for this account.
router.get("/me/notification-preferences", authorize("PARENT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  const userId = req.user?.userId;
  if (!schoolId || !userId || !mongoose.isValidObjectId(userId)) throw new AppError("Parent account context is invalid", 400);
  const parent = await Parent.findOne({ schoolId, userId: new mongoose.Types.ObjectId(userId), isActive: true }).select("notificationPreferences").lean();
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  res.json({ success: true, data: { homework: parent.notificationPreferences?.homework !== false } });
}));
router.patch("/me/notification-preferences", authorize("PARENT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  const userId = req.user?.userId;
  if (!schoolId || !userId || !mongoose.isValidObjectId(userId)) throw new AppError("Parent account context is invalid", 400);
  if (typeof req.body?.homework !== "boolean") throw new AppError("homework must be a boolean", 400);
  const parent = await Parent.findOneAndUpdate(
    { schoolId, userId: new mongoose.Types.ObjectId(userId), isActive: true },
    { $set: { "notificationPreferences.homework": req.body.homework } },
    { new: true, runValidators: true }
  ).select("notificationPreferences");
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  res.json({ success: true, message: "Notification preferences updated", data: { homework: parent.notificationPreferences?.homework !== false } });
}));

// Parent self-service: resolve children from the authenticated parent account.
router.get("/me/children", authorize("PARENT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  if (!schoolId || !req.user?.userId || !mongoose.isValidObjectId(req.user.userId)) throw new AppError("Parent account context is invalid", 400);
  const parent = await Parent.findOne({ schoolId, userId: new mongoose.Types.ObjectId(req.user.userId), isActive: true }).select("studentIds").lean();
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  const allRelationships = await ParentChildRelationship.find({ schoolId, parentId: parent._id }).lean();
  const relationships = (allRelationships as any[]).filter((item: any) => item.status === "ACTIVE");
  const mappedIds = new Set((allRelationships as any[]).map((item: any) => String(item.studentId)));
  const relationshipIds = relationships.map((item: any) => item.studentId);
  const legacyIds = parent.studentIds.filter((id: any) => !mappedIds.has(String(id)));
  const children = await Student.find({ schoolId, _id: { $in: [...relationshipIds, ...legacyIds] }, isDeleted: false })
    .select("firstName lastName admissionNumber rollNumber classId sectionId status profileImage")
    .populate("classId", "name").populate("sectionId", "name").lean();
  const byId = new Map<string, any>(relationships.map((item: any) => [String(item.studentId), item]));
  res.json({ success: true, data: children.map((child: any) => {
    const relationship = byId.get(String(child._id));
    return { ...child, guardianPermissions: relationship?.permissions || { attendance: true, timetable: true, homework: true, results: true, fees: true, communication: true }, isPrimaryGuardian: relationship?.isPrimaryGuardian ?? false, isEmergencyContact: relationship?.isEmergencyContact ?? false };
  }) });
}));

router.get("/relationships", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  const filter: Record<string, unknown> = { schoolId };
  if (req.query.parentId) {
    if (!mongoose.isValidObjectId(req.query.parentId)) throw new AppError("Invalid parent ID", 400);
    filter.parentId = req.query.parentId;
  }
  if (req.query.studentId) {
    if (!mongoose.isValidObjectId(req.query.studentId)) throw new AppError("Invalid student ID", 400);
    filter.studentId = req.query.studentId;
  }
  const items = await ParentChildRelationship.find(filter).populate("parentId", "firstName lastName phone email").populate("studentId", "firstName lastName admissionNumber").sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: items });
}));

router.get("/engagement", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  const filter: Record<string, unknown> = { schoolId };
  if (req.query.type && ["FEEDBACK","COMPLAINT","MEETING"].includes(String(req.query.type))) filter.type = req.query.type;
  if (req.query.status) filter.status = String(req.query.status);
  const items = await ParentEngagement.find(filter).populate("parentId", "firstName lastName phone").populate("studentId", "firstName lastName admissionNumber").sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: items });
}));

// Create or update a guardian-to-child relationship. Only school staff can change access.
router.post("/relationships", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  const { parentId, studentId, relationship, isPrimaryGuardian, isEmergencyContact, permissions } = req.body || {};
  if (isPrimaryGuardian !== undefined && typeof isPrimaryGuardian !== "boolean") throw new AppError("isPrimaryGuardian must be boolean", 400);
  if (isEmergencyContact !== undefined && typeof isEmergencyContact !== "boolean") throw new AppError("isEmergencyContact must be boolean", 400);
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(parentId) || !mongoose.isValidObjectId(studentId)) throw new AppError("Valid parent and student IDs are required", 400);
  const [parent, student] = await Promise.all([
    Parent.findOne({ _id: parentId, schoolId, isActive: true }).select("_id studentIds"),
    Student.findOne({ _id: studentId, schoolId, isDeleted: false }).select("_id parentId"),
  ]);
  if (!parent || !student) throw new AppError("Parent or student not found in this school", 404);
  const permissionKeys = ["attendance", "timetable", "homework", "results", "fees", "communication"];
  const safePermissions: Record<string, boolean> = {};
  for (const key of permissionKeys) if (permissions?.[key] !== undefined) {
    if (typeof permissions[key] !== "boolean") throw new AppError(`permissions.${key} must be boolean`, 400);
    safePermissions[key] = permissions[key];
  }
  const relationshipUpdate: Record<string, unknown> = {
    relationship: relationship || "GUARDIAN",
    isPrimaryGuardian: Boolean(isPrimaryGuardian),
    isEmergencyContact: Boolean(isEmergencyContact),
    status: "ACTIVE",
    changedBy: userId,
  };
  for (const [key, value] of Object.entries(safePermissions)) relationshipUpdate[`permissions.${key}`] = value;
  const relationshipRecord = await ParentChildRelationship.findOneAndUpdate(
    { schoolId, parentId, studentId },
    { $set: relationshipUpdate },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await Parent.updateOne({ _id: parentId, schoolId }, { $addToSet: { studentIds: studentId } });
  // Preserve legacy primary-parent linkage only when no parent has yet been assigned.
  if (!student.parentId) await Student.updateOne({ _id: studentId, schoolId, parentId: { $in: [null] } }, { $set: { parentId, updatedBy: userId } });
  res.status(201).json({ success: true, message: "Guardian relationship saved", data: relationshipRecord });
}));

router.patch("/relationships/:id/revoke", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const { id } = req.params, schoolId = req.user?.schoolId, userId = req.user?.userId;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Invalid relationship context", 400);
  const item = await ParentChildRelationship.findOneAndUpdate({ _id: id, schoolId, status: "ACTIVE" }, { $set: { status: "REVOKED", changedBy: userId } }, { new: true });
  if (!item) throw new AppError("Active guardian relationship not found", 404);
  res.json({ success: true, message: "Guardian access revoked", data: item });
}));

// Parent self-service feedback, complaints and meeting requests.
router.post("/me/engagement", authorize("PARENT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  const { type, studentId, subject, message, category, priority, requestedAt, requestedTime } = req.body || {};
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Parent context is invalid", 400);
  if (!["FEEDBACK", "COMPLAINT", "MEETING"].includes(type)) throw new AppError("Invalid engagement type", 400);
  if (typeof subject !== "string" || !subject.trim() || typeof message !== "string" || !message.trim()) throw new AppError("Subject and message are required", 400);
  const parent = await Parent.findOne({ schoolId, userId, isActive: true }).select("_id");
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  let linkedStudentId = null;
  if (studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError("Invalid student ID", 400);
    const relationship = await ParentChildRelationship.findOne({ schoolId, parentId: parent._id, studentId, status: "ACTIVE", "permissions.communication": true }).select("_id");
    const legacy = relationship ? true : await Parent.exists({ _id: parent._id, studentIds: studentId });
    if (!legacy) throw new AppError("You do not have communication access for this child", 403);
    linkedStudentId = new mongoose.Types.ObjectId(studentId);
  }
  const meetingDate = requestedAt ? new Date(requestedAt) : null;
  if (type === "MEETING" && (!meetingDate || !Number.isFinite(meetingDate.getTime()) || meetingDate < new Date())) throw new AppError("A valid future meeting date is required", 400);
  const doc = await ParentEngagement.create({ schoolId, parentId: parent._id, studentId: linkedStudentId, type, subject: subject.trim(), message: message.trim(), category, priority: ["LOW","NORMAL","HIGH","URGENT"].includes(priority) ? priority : "NORMAL", status: type === "MEETING" ? "REQUESTED" : "SUBMITTED", requestedAt: meetingDate, requestedTime });
  res.status(201).json({ success: true, message: "Request submitted", data: doc });
}));

router.get("/me/engagement", authorize("PARENT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  const parent = await Parent.findOne({ schoolId, userId, isActive: true }).select("_id");
  if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
  const items = await ParentEngagement.find({ schoolId, parentId: parent._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: items });
}));

router.patch("/engagement/:id/status", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  const { id } = req.params, schoolId = req.user?.schoolId;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(schoolId)) throw new AppError("Invalid engagement ID", 400);
  const item = await ParentEngagement.findOne({ _id: id, schoolId });
  if (!item) throw new AppError("Parent request not found", 404);
  const transitions: Record<string, string[]> = {
    FEEDBACK: ["UNDER_REVIEW", "RESOLVED", "REJECTED"],
    COMPLAINT: ["UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "REJECTED"],
    MEETING: ["APPROVED", "REJECTED"],
  };
  if (!(transitions[item.type] || []).includes(req.body?.status)) throw new AppError("Invalid status transition for this request type", 409);
  item.status = req.body.status;
  if (typeof req.body.response === "string") item.response = req.body.response.slice(0,3000);
  if (typeof req.body.resolution === "string") item.resolution = req.body.resolution.slice(0,3000);
  if (mongoose.isValidObjectId(req.body.assignedTo)) item.assignedTo = new mongoose.Types.ObjectId(req.body.assignedTo);
  await item.save();
  res.json({ success: true, data: item });
}));

// Get Parent By ID
router.get(
  "/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"),
  validate({ params: parentIdSchema }),
  getParentById
);

// Get Students Linked To Parent
router.get(
  "/:id/students",
  authorize(
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "RECEPTIONIST",
    "TEACHER"
  ),
  validate({ params: parentIdSchema }),
  getParentStudents
);

// Update Parent
router.patch(
  "/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"),
  validate({
    params: parentIdSchema,
    body: updateParentSchema,
  }),
  updateParent
);

// Delete Parent
router.delete(
  "/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ params: parentIdSchema }),
  deleteParent
);

export default router;
