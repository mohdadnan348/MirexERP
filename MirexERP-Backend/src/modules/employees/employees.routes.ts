import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import EmployeePerformance from "./employee-performance.model";
import Employee from "./employees.model";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { employeeDocumentUploader, employeePhotoUploader } from "../../utils/fileStorage";
import { USER_ROLES } from "../../config/constants";
import * as advanced from "./employees-advanced.controller";
import {
  createEmployeeSchema, updateEmployeeSchema, employeeIdParamSchema,
  employeeListQuerySchema, updateEmployeeStatusSchema, assignEmployeeUserSchema,
} from "./employees.validation";
import {
  createEmployee, getAllEmployees, getEmployeeById, updateEmployee,
  updateEmployeeStatus, assignEmployeeUser, deleteEmployee, getEmployeeSummary,
} from "./employees.controller";

const router = Router();
const employeeManagementRoles = [USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL] as const;
const salaryRoles = [USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.ACCOUNTANT] as const;
const employeeViewRoles = [...employeeManagementRoles, USER_ROLES.ACCOUNTANT] as const;
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const qualificationSchema = z.object({
  qualificationName:z.string().trim().min(1).max(120), degree:z.string().max(120).optional(),
  institution:z.string().max(180).optional(), specialization:z.string().max(120).optional(),
  passingYear:z.coerce.number().int().min(1900).max(2100).optional(), grade:z.string().max(40).optional(),
  documentUrl:z.string().max(500).optional(), remarks:z.string().max(500).optional(),
});
const experienceSchema = z.object({
  organization:z.string().trim().min(1).max(180), designation:z.string().trim().min(1).max(120),
  employmentType:z.enum(["PERMANENT","CONTRACT","PART_TIME","TEMPORARY","SUBSTITUTE"]).optional(),
  startDate:z.coerce.date(), endDate:z.coerce.date().nullable().optional(), current:z.boolean().optional(),
  responsibilities:z.string().max(2000).optional(), certificateUrl:z.string().max(500).optional(), remarks:z.string().max(500).optional(),
});

router.use(authenticate, tenantContext, requireTenant);

// Dashboard, employee self-service, configuration and teacher coverage.
router.get("/my-profile", authorize(USER_ROLES.TEACHER), advanced.ownProfile);
router.get("/dashboard/summary", authorize(...employeeManagementRoles), advanced.dashboard);
router.get("/departments", authorize(...employeeManagementRoles), advanced.departments);
router.post("/departments", authorize(...employeeManagementRoles), validate({body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),description:z.string().max(500).optional(),isActive:z.boolean().optional()})}), advanced.createDepartment);
router.put("/departments/:departmentId", authorize(...employeeManagementRoles), validate({params:z.object({departmentId:objectId}),body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),description:z.string().max(500).optional(),isActive:z.boolean().optional()})}), advanced.updateDepartment);
router.patch("/departments/:departmentId", authorize(...employeeManagementRoles), validate({params:z.object({departmentId:objectId}),body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),description:z.string().max(500).optional(),isActive:z.boolean().optional()})}), advanced.updateDepartment);
router.get("/designations", authorize(...employeeManagementRoles), advanced.designations);
router.post("/designations", authorize(...employeeManagementRoles), validate({body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),department:z.string().trim().max(100).optional(),isActive:z.boolean().optional()})}), advanced.createDesignation);
router.put("/designations/:designationId", authorize(...employeeManagementRoles), validate({params:z.object({designationId:objectId}),body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),department:z.string().trim().max(100).optional(),isActive:z.boolean().optional()})}), advanced.updateDesignation);
router.patch("/designations/:designationId", authorize(...employeeManagementRoles), validate({params:z.object({designationId:objectId}),body:z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(20),department:z.string().trim().max(100).optional(),isActive:z.boolean().optional()})}), advanced.updateDesignation);
router.get("/substitute-assignments", authorize(...employeeManagementRoles), advanced.substitutes);
router.patch("/substitute-assignments/:id", authorize(...employeeManagementRoles), validate({params:z.object({id:objectId}),body:z.object({substituteTeacherId:objectId.optional(),date:z.coerce.date().optional(),period:z.coerce.number().int().min(1).optional(),reason:z.string().trim().min(3).max(500).optional(),status:z.enum(["ACTIVE","CANCELLED","COMPLETED"]).optional()})}), advanced.updateSubstitute);
router.post("/substitute-assignments", authorize(...employeeManagementRoles), validate({body:z.object({
  sessionId:objectId,classId:objectId,sectionId:objectId,subjectId:objectId.optional(),
  regularTeacherId:objectId,substituteTeacherId:objectId,date:z.coerce.date(),period:z.coerce.number().int().min(1),
  reason:z.string().trim().min(3).max(500),
})}), advanced.createSubstitute);
router.get("/class-teachers", authorize(...employeeManagementRoles), advanced.classTeachers);
router.post("/class-teachers", authorize(...employeeManagementRoles), validate({body:z.object({sessionId:objectId,classId:objectId,teacherId:objectId})}), advanced.classTeacher);
router.patch("/class-teachers/:id", authorize(...employeeManagementRoles), validate({params:z.object({id:objectId}),body:z.object({sessionId:objectId,classId:objectId,teacherId:objectId})}), advanced.classTeacher);
router.post("/class-teacher", authorize(...employeeManagementRoles), validate({body:z.object({sessionId:objectId,classId:objectId,teacherId:objectId})}), advanced.classTeacher);

// Employee-level subresources.
router.get("/:id/qualifications", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.qualifications);
router.put("/:id/qualifications", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema,body:z.object({qualifications:z.array(qualificationSchema)})}), advanced.saveQualifications);
router.get("/:id/experience", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.experience);
router.put("/:id/experience", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema,body:z.object({experience:z.array(experienceSchema)})}), advanced.saveExperience);
router.get("/:id/salary", authorize(...salaryRoles), validate({params:employeeIdParamSchema}), advanced.salary);
router.put("/:id/salary", authorize(...salaryRoles), validate({params:employeeIdParamSchema,body:z.object({
  basic:z.coerce.number().min(0),hra:z.coerce.number().min(0).optional(),allowances:z.coerce.number().min(0).optional(),
  deductions:z.coerce.number().min(0).optional(),effectiveDate:z.coerce.date(),
  paymentFrequency:z.enum(["MONTHLY","WEEKLY","DAILY"]).optional(),remarks:z.string().max(500).optional(),
})}), advanced.saveSalary);
router.get("/:id/assignments", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.assignments);
router.get("/:id/attendance-summary", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.attendanceSummary);
router.post("/:id/documents", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), employeeDocumentUploader.single("file"), advanced.uploadDocument);
router.get("/:id/documents/:documentIndex/download", authorize(...employeeManagementRoles), advanced.downloadDocument);
router.put("/:id/documents/:documentIndex", authorize(...employeeManagementRoles), employeeDocumentUploader.single("file"), advanced.replaceDocument);
router.delete("/:id/documents/:documentIndex", authorize(...employeeManagementRoles), advanced.deleteDocument);
router.post("/:id/photo", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), employeePhotoUploader.single("file"), advanced.uploadProfilePhoto);
router.get("/:id/id-card", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.idCard);
router.post("/:id/exit", authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate({params:employeeIdParamSchema,body:z.object({
  exitDate:z.coerce.date(),reason:z.enum(["RESIGNATION","RETIREMENT","TERMINATION","CONTRACT_EXPIRY","OTHER"]),
  remarks:z.string().max(1000).optional(),handoverNotes:z.string().max(2000).optional(),
})}), advanced.exitEmployee);
router.get("/:id/exit-history", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.exitHistory);
router.get("/:id/audit-history", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), advanced.auditHistory);

// Employee performance reviews (school-scoped, reviewer is always the authenticated user).
router.get("/performance", authorize(...employeeManagementRoles), asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { schoolId: req.user?.schoolId };
  if (req.query.employeeId) {
    if (!mongoose.isValidObjectId(req.query.employeeId)) throw new AppError("Invalid employee ID", 400);
    filter.employeeId = req.query.employeeId;
  }
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    EmployeePerformance.find(filter).populate("employeeId", "employeeId firstName lastName designation").populate("reviewerId", "name email").sort({ reviewPeriodStart: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EmployeePerformance.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));
router.post("/performance", authorize(...employeeManagementRoles), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  const { employeeId, reviewPeriodStart, reviewPeriodEnd, rating, feedback = "", strengths = [], improvements = [], status = "DRAFT" } = req.body || {};
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(employeeId)) throw new AppError("Valid employee is required", 400);
  const employee = await Employee.findOne({ _id: employeeId, schoolId }).select("_id");
  if (!employee) throw new AppError("Employee not found in this school", 404);
  const start = new Date(reviewPeriodStart), end = new Date(reviewPeriodEnd), score = Number(rating);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new AppError("Invalid review period", 400);
  if (!Number.isFinite(score) || score < 1 || score > 5) throw new AppError("Rating must be between 1 and 5", 400);
  if (!Array.isArray(strengths) || !Array.isArray(improvements) || [...strengths, ...improvements].some((v) => typeof v !== "string" || v.length > 300)) throw new AppError("Strengths and improvement areas must be short text arrays", 400);
  const record = await EmployeePerformance.create({ schoolId, employeeId, reviewPeriodStart: start, reviewPeriodEnd: end, rating: score, feedback: String(feedback).slice(0,3000), strengths, improvements, status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT", reviewerId: userId });
  res.status(201).json({ success: true, data: record });
}));

// Existing employee APIs remain intact.
router.get("/summary", authorize(...employeeManagementRoles), getEmployeeSummary);
router.get("/", authorize(...employeeViewRoles), validate({query:employeeListQuerySchema}), getAllEmployees);
router.post("/", authorize(...employeeManagementRoles), validate({body:createEmployeeSchema}), createEmployee);
router.get("/:id", authorize(...employeeViewRoles), validate({params:employeeIdParamSchema}), getEmployeeById);
router.patch("/:id", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema,body:updateEmployeeSchema}), updateEmployee);
router.patch("/:id/status", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema,body:updateEmployeeStatusSchema}), updateEmployeeStatus);
router.put("/:id/user-account", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema,body:assignEmployeeUserSchema}), assignEmployeeUser);
router.delete("/:id", authorize(...employeeManagementRoles), validate({params:employeeIdParamSchema}), deleteEmployee);

export default router;
