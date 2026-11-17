
import { Router } from "express";

import {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeave,
  reviewLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  deleteLeave,
  getLeaveSummary,
} from "./leaves.controller";

import {
  createLeaveSchema,
  updateLeaveSchema,
  leaveIdParamSchema,
  leaveListQuerySchema,
  reviewLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  cancelLeaveSchema,
  leaveSummaryQuerySchema,
} from "./leaves.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

import {
  tenantContext,
  requireTenant,
} from "../../middleware/tenantContext";

import { validate } from "../../middleware/validate";
import { USER_ROLES } from "../../config/constants";
import Employee from "../employees/employees.model";
import Leave from "./leaves.model";
import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { createLeaveService } from "./leaves.service";
import LeavePolicy from "./leave-policy.model";
import Session from "../sessions/sessions.model";

const router = Router();

// Authentication and tenant protection.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Roles allowed to manage leave applications.
const leaveManagers = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL
);

// Roles allowed to submit leave applications.
const leaveApplicants = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL
);

// Employee self-service. Employee identity is derived from the authenticated account.
router.get("/me", authorize("TEACHER"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Employee account context is invalid", 401);
  const employee = await Employee.findOne({ schoolId, userId, isActive: true }).select("_id");
  if (!employee) throw new AppError("Employee profile is not linked to this login", 404);
  const items = await Leave.find({ schoolId, applicantType: "EMPLOYEE", employeeId: employee._id, isDeleted: false }).sort({ startDate: -1 }).limit(100).lean();
  res.json({ success: true, data: items });
}));
router.post("/me", authorize("TEACHER"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Employee account context is invalid", 401);
  const employee = await Employee.findOne({ schoolId, userId, isActive: true }).select("_id");
  if (!employee) throw new AppError("Employee profile is not linked to this login", 404);
  const { sessionId, leaveType, startDate, endDate, reason, supportingDocument } = req.body || {};
  if (!mongoose.isValidObjectId(sessionId)) throw new AppError("Valid academic session ID is required", 400);
  if (!["CASUAL","SICK","EARNED","UNPAID","MATERNITY","PATERNITY","OTHER"].includes(leaveType)) throw new AppError("Invalid leave type", 400);
  const start = new Date(startDate), end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new AppError("Valid start and end dates are required", 400);
  if (typeof reason !== "string" || !reason.trim()) throw new AppError("Leave reason is required", 400);
  if (supportingDocument !== undefined && (typeof supportingDocument !== "string" || supportingDocument.length > 2048)) throw new AppError("Invalid supporting document reference", 400);
  const leave = await createLeaveService({ applicantType: "EMPLOYEE", employeeId: String(employee._id), sessionId, leaveType, startDate: start, endDate: end, reason: reason.trim(), supportingDocument } as any, { userId: String(userId), schoolId: String(schoolId) });
  res.status(201).json({ success: true, message: "Leave application submitted", data: leave });
}));

// Configurable school/session leave policy and derived balance view.
router.get("/policies", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { schoolId: req.user?.schoolId, status: "ACTIVE" };
  if (req.query.sessionId) {
    if (!mongoose.isValidObjectId(req.query.sessionId)) throw new AppError("Invalid session ID", 400);
    filter.sessionId = req.query.sessionId;
  }
  const items = await LeavePolicy.find(filter).sort({ leaveType: 1 }).lean();
  res.json({ success: true, data: items });
}));
router.post("/policies", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const { sessionId, leaveType, annualEntitlement, isPaid = true, carryForward = false } = req.body || {};
  const schoolId = req.user?.schoolId, userId = req.user?.userId;
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(sessionId)) throw new AppError("Valid school, user and session context is required", 400);
  if (!["CASUAL","SICK","EARNED","UNPAID","MATERNITY","PATERNITY","OTHER"].includes(leaveType)) throw new AppError("Invalid leave type", 400);
  if (isPaid !== undefined && typeof isPaid !== "boolean") throw new AppError("isPaid must be boolean", 400);
  if (carryForward !== undefined && typeof carryForward !== "boolean") throw new AppError("carryForward must be boolean", 400);
  const session = await Session.findOne({ _id: sessionId, schoolId, isDeleted: false }).select("_id");
  if (!session) throw new AppError("Academic session not found in this school", 404);
  const days = Number(annualEntitlement);
  if (!Number.isFinite(days) || days < 0 || days > 366) throw new AppError("Annual entitlement must be between 0 and 366", 400);
  const policy = await LeavePolicy.findOneAndUpdate({ schoolId, sessionId, leaveType }, { $set: { annualEntitlement: days, isPaid: leaveType === "UNPAID" ? false : isPaid !== false, carryForward: Boolean(carryForward), status: "ACTIVE", updatedBy: userId }, $setOnInsert: { createdBy: userId } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  res.status(201).json({ success: true, data: policy });
}));
router.get("/balances", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId;
  let employeeId = req.query.employeeId ? String(req.query.employeeId) : "";
  if (String(req.user?.role).toUpperCase() === "TEACHER") {
    const employee = await Employee.findOne({ schoolId, userId: req.user?.userId, isActive: true }).select("_id");
    if (!employee) throw new AppError("Employee profile is not linked to this login", 404);
    if (employeeId && employeeId !== String(employee._id)) throw new AppError("You can only view your own leave balance", 403);
    employeeId = String(employee._id);
  }
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(req.query.sessionId)) throw new AppError("Employee ID and session ID are required", 400);
  const employee = await Employee.findOne({ _id: employeeId, schoolId }).select("_id");
  if (!employee) throw new AppError("Employee not found", 404);
  const [policies, approved] = await Promise.all([
    LeavePolicy.find({ schoolId, sessionId: req.query.sessionId, status: "ACTIVE" }).lean(),
    Leave.find({ schoolId, sessionId: req.query.sessionId, employeeId, applicantType: "EMPLOYEE", status: "APPROVED", isDeleted: false }).select("leaveType startDate endDate").lean(),
  ]);
  const used = new Map<string, number>();
  for (const item of approved as any[]) {
    const start = new Date(item.startDate), end = new Date(item.endDate);
    let workingDays = 0;
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) if (day.getDay() !== 0 && day.getDay() !== 6) workingDays++;
    used.set(item.leaveType, (used.get(item.leaveType) || 0) + workingDays);
  }
  res.json({ success: true, data: policies.map((policy: any) => ({ leaveType: policy.leaveType, annualEntitlement: policy.annualEntitlement, isPaid: policy.isPaid, carryForward: policy.carryForward, usedDays: used.get(policy.leaveType) || 0, remainingDays: policy.isPaid ? Math.max(0, policy.annualEntitlement - (used.get(policy.leaveType) || 0)) : null })) });
}));

// Get leave summary.
router.get(
  "/summary",
  leaveManagers,
  validate({
    query: leaveSummaryQuerySchema,
  }),
  getLeaveSummary
);

// Get all leave applications.
router.get(
  "/",
  leaveManagers,
  validate({
    query: leaveListQuerySchema,
  }),
  getAllLeaves
);

// Submit leave application.
router.post(
  "/",
  leaveApplicants,
  validate({
    body: createLeaveSchema,
  }),
  createLeave
);

// Review leave application.
router.patch(
  "/:id/review",
  leaveManagers,
  validate({
    params: leaveIdParamSchema,
    body: reviewLeaveSchema,
  }),
  reviewLeave
);

// Approve leave application.
router.patch(
  "/:id/approve",
  leaveManagers,
  validate({
    params: leaveIdParamSchema,
    body: approveLeaveSchema,
  }),
  approveLeave
);

// Reject leave application.
router.patch(
  "/:id/reject",
  leaveManagers,
  validate({
    params: leaveIdParamSchema,
    body: rejectLeaveSchema,
  }),
  rejectLeave
);

// Cancel leave application.
router.patch(
  "/:id/cancel",
  leaveApplicants,
  validate({
    params: leaveIdParamSchema,
    body: cancelLeaveSchema,
  }),
  cancelLeave
);

// Update pending leave application.
router.patch(
  "/:id",
  leaveApplicants,
  validate({
    params: leaveIdParamSchema,
    body: updateLeaveSchema,
  }),
  updateLeave
);

// Get leave application details.
router.get(
  "/:id",
  leaveManagers,
  validate({
    params: leaveIdParamSchema,
  }),
  getLeaveById
);

// Delete leave application.
router.delete(
  "/:id",
  leaveManagers,
  validate({
    params: leaveIdParamSchema,
  }),
  deleteLeave
);

export default router;
