import { Router, Request } from "express";
import mongoose from "mongoose";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import Student from "../students/students.model";
import StudentPortal from "./student-portal.model";
import StudyMaterial from "./study-material.model";
import Employee from "../employees/employees.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import User from "../auth/auth.model";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Subject from "../subjects/subjects.model";
import { createStudent, getStudents, getStudentById, updateStudent, deleteStudent, getPortalHomework } from "./student-portal.controller";
import {
  getStudentDashboardService, getStudentProfileService, getStudentAttendanceService,
  getStudentFeesService, getStudentResultsService, getStudentTimetableService,
} from "./student-portal.service";

const router = Router();
router.use(authenticate, tenantContext, requireTenant);

const resolveStudentActor = async (req: Request) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Student account context is invalid", 401);
  let portal = await StudentPortal.findOne({ schoolId, userId }).select("studentId").lean();
  if (!portal && req.user?.email) {
    const matches = await Student.find({ schoolId, email: String(req.user.email).toLowerCase(), isDeleted: false, isActive: true, status: "ACTIVE" }).limit(2).select("_id").lean();
    if (matches.length === 1) {
      portal = await StudentPortal.findOneAndUpdate({ schoolId, studentId: matches[0]._id }, { $set: { userId: new mongoose.Types.ObjectId(String(userId)) } }, { new: true, upsert: true, setDefaultsOnInsert: true }).select("studentId").lean() as any;
    }
  }
  if (!portal?.studentId) throw new AppError("Student profile is not linked to this account. Ask school administration to link your student login.", 403);
  const student = await Student.findOne({ _id: portal.studentId, schoolId, isDeleted: false, isActive: true, status: "ACTIVE" }).select("_id").lean();
  if (!student) throw new AppError("Student account is inactive or the student record is unavailable", 403);
  return { userId: String(userId), schoolId: String(schoolId), role: String(req.user?.role || "STUDENT"), studentId: String(portal.studentId) };
};

router.post("/link-account", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const { studentId, userId } = req.body || {}, schoolId = req.user?.schoolId;
  if (!mongoose.isValidObjectId(studentId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(schoolId)) throw new AppError("Valid studentId and userId are required", 400);
  const [student, user] = await Promise.all([
    Student.findOne({ _id: studentId, schoolId, isDeleted: false }).select("_id"),
    User.findOne({ _id: userId, schoolId, role: "STUDENT", isDeleted: false, isActive: true }).select("_id"),
  ]);
  if (!student || !user) throw new AppError("Student record or active STUDENT login not found in this school", 404);
  const existing = await StudentPortal.findOne({ schoolId, userId, studentId: { $ne: studentId } }).select("_id");
  if (existing) throw new AppError("This login is already linked to another student", 409);
  const portal = await StudentPortal.findOneAndUpdate({ schoolId, studentId }, { $set: { userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.status(200).json({ success: true, message: "Student login linked", data: { studentId: portal.studentId, userId: portal.userId } });
}));

router.get("/me/dashboard", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentDashboardService(await resolveStudentActor(req)) })));
router.get("/me/profile", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentProfileService(await resolveStudentActor(req)) })));
router.get("/me/attendance", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentAttendanceService(await resolveStudentActor(req), req.query) })));
router.get("/me/timetable", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentTimetableService(await resolveStudentActor(req), req.query) })));
router.get("/me/homework", authorize("STUDENT"), getPortalHomework);
router.get("/homework", authorize("STUDENT", "PARENT"), getPortalHomework);
router.get("/me/results", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentResultsService(await resolveStudentActor(req), req.query) })));
router.get("/me/fees", authorize("STUDENT"), asyncHandler(async (req, res) => res.json({ success: true, data: await getStudentFeesService(await resolveStudentActor(req), req.query) })));

router.get("/me/notification-preferences", authorize("STUDENT"), asyncHandler(async (req, res) => {
  const actor = await resolveStudentActor(req);
  const portal = await StudentPortal.findOne({ schoolId: actor.schoolId, studentId: actor.studentId }).select("preferences").lean();
  res.json({ success: true, data: { notificationsEnabled: portal?.preferences?.notificationsEnabled !== false } });
}));
router.patch("/me/notification-preferences", authorize("STUDENT"), asyncHandler(async (req, res) => {
  const actor = await resolveStudentActor(req);
  if (typeof req.body?.notificationsEnabled !== "boolean") throw new AppError("notificationsEnabled must be a boolean", 400);
  const portal = await StudentPortal.findOneAndUpdate({ schoolId: actor.schoolId, studentId: actor.studentId }, { $set: { "preferences.notificationsEnabled": req.body.notificationsEnabled } }, { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true });
  res.json({ success: true, message: "Notification preferences updated", data: { notificationsEnabled: portal.preferences.notificationsEnabled } });
}));

// Student-facing materials are scoped to the active student's current class and section.
router.get("/me/materials", authorize("STUDENT"), asyncHandler(async (req, res) => {
  const actor = await resolveStudentActor(req);
  const student = await Student.findOne({ _id: actor.studentId, schoolId: actor.schoolId }).select("classId sectionId sessionId").lean();
  if (!student) throw new AppError("Student not found", 404);
  const materials = await StudyMaterial.find({ schoolId: actor.schoolId, sessionId: student.sessionId, classId: student.classId, status: "ACTIVE", $or: [{ sectionIds: { $size: 0 } }, { sectionIds: student.sectionId }] })
    .populate("subjectId", "name code").populate("uploadedBy", "name email").sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: materials });
}));

// Staff material management. File storage URL is supplied by the existing upload/storage layer.
router.post("/materials", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const { sessionId, classId, sectionIds = [], subjectId, title, description, fileUrl, fileName, mimeType } = req.body || {};
  const schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  for (const [name, value] of Object.entries({ sessionId, classId, subjectId })) if (!mongoose.isValidObjectId(value)) throw new AppError(`Valid ${name} is required`, 400);
  if (!Array.isArray(sectionIds) || sectionIds.some((id: unknown) => !mongoose.isValidObjectId(id))) throw new AppError("sectionIds must contain valid IDs", 400);
  if (typeof title !== "string" || !title.trim() || typeof fileUrl !== "string" || !fileUrl.trim() || typeof fileName !== "string" || !fileName.trim() || typeof mimeType !== "string") throw new AppError("Title and file metadata are required", 400);
  if (!/^https:\/\//i.test(fileUrl) && !fileUrl.startsWith("/uploads/")) throw new AppError("Material file must use an approved storage URL", 400);
  const [session, klass, subject] = await Promise.all([
    Session.findOne({ _id: sessionId, schoolId, isDeleted: false }).select("_id"),
    Class.findOne({ _id: classId, schoolId, sessionId, isDeleted: false, isActive: true }).select("_id subjects"),
    Subject.findOne({ _id: subjectId, schoolId, isDeleted: false, isActive: true }).select("_id"),
  ]);
  if (!session || !klass || !subject) throw new AppError("Session, class and subject must belong to this school", 400);
  if (Array.isArray((klass as any).subjects) && !(klass as any).subjects.some((id: any) => String(id) === String(subjectId))) throw new AppError("Subject is not mapped to the selected class", 400);
  if (sectionIds.length) {
    const sections = await Section.find({ _id: { $in: sectionIds }, schoolId, classId, sessionId, isDeleted: false, isActive: true }).select("_id");
    if (sections.length !== sectionIds.length) throw new AppError("One or more sections do not belong to this class/session", 400);
  }
  if (String(req.user?.role).toUpperCase() === "TEACHER") {
    const employee = await Employee.findOne({ schoolId, userId, isActive: true, status: "ACTIVE", isDeleted: false }).select("_id");
    if (!employee) throw new AppError("Teacher employee profile is not linked", 403);
    const assignments = await SubjectTeacherAssignment.find({ schoolId, sessionId, classId, subjectId, teacherId: employee._id, isActive: true, $or: [{ sectionId: null }, ...(sectionIds.length ? [{ sectionId: { $in: sectionIds } }] : [])] }).select("sectionId").lean();
    if (!assignments.length) throw new AppError("You are not assigned to this class and subject", 403);
    if (sectionIds.length) {
      const hasGeneral = (assignments as any[]).some((item) => !item.sectionId);
      const allowedSections = new Set((assignments as any[]).map((item) => String(item.sectionId)));
      if (!hasGeneral && sectionIds.some((id: string) => !allowedSections.has(String(id)))) throw new AppError("You are not assigned to every selected section", 403);
    }
  }
  const material = await StudyMaterial.create({ schoolId, sessionId, classId, sectionIds, subjectId, title: title.trim(), description, fileUrl, fileName, mimeType, uploadedBy: userId });
  res.status(201).json({ success: true, data: material });
}));
router.get("/materials", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const teacherScope = String(req.user?.role).toUpperCase() === "TEACHER" ? { uploadedBy: req.user?.userId || req.user?.id } : {};
  const items = await StudyMaterial.find({ schoolId: req.user?.schoolId, ...teacherScope }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: items });
}));
router.patch("/materials/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Invalid material ID", 400);
  const allowed: Record<string, unknown> = {};
  for (const key of ["title","description","status","fileUrl","fileName","mimeType"]) if (req.body?.[key] !== undefined) allowed[key] = req.body[key];
  const ownership = String(req.user?.role).toUpperCase() === "TEACHER" ? { uploadedBy: req.user?.userId || req.user?.id } : {};
  const item = await StudyMaterial.findOneAndUpdate({ _id: req.params.id, schoolId: req.user?.schoolId, ...ownership }, { $set: allowed }, { new: true, runValidators: true });
  if (!item) throw new AppError("Study material not found", 404);
  res.json({ success: true, data: item });
}));
router.delete("/materials/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Invalid material ID", 400);
  const item = await StudyMaterial.findOneAndUpdate({ _id: req.params.id, schoolId: req.user?.schoolId }, { $set: { status: "INACTIVE" } }, { new: true });
  if (!item) throw new AppError("Study material not found", 404);
  res.json({ success: true, message: "Study material archived", data: item });
}));

// Student records remain staff-managed; students and parents cannot call CRUD routes.
router.post("/", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), createStudent);
router.get("/", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), getStudents);
router.get("/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), getStudentById);
router.patch("/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL"), updateStudent);
router.delete("/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL"), deleteStudent);

export default router;
