
import { Router } from "express";
import { z } from "zod";

import { USER_ROLES } from "../../config/constants";
import { saveExamMarks, getExamMarks, getExamResults, getExamDashboard, transitionExamWorkflow } from "./exam-mark.controller";
import { examMarksParamsSchema, examMarksQuerySchema, saveExamMarksSchema } from "./exam-mark.validation";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  createExam,
  deleteExam,
  getExamById,
  getExams,
  updateExam,
} from "./exams.controller";

import {
  createExamSchema,
  examIdSchema,
  getExamsSchema,
  updateExamSchema,
} from "./exams.validation";

const router = Router();

const examManagementRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
];

const examTeacherRoles = [...examManagementRoles, USER_ROLES.TEACHER];

const examReadRoles = [
  ...examManagementRoles,
  USER_ROLES.TEACHER,
];

router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

router.get("/dashboard/summary", authorize(...examReadRoles), getExamDashboard);
router.patch("/:examId/workflow/:action", authorize(...examTeacherRoles), validate({ params: examMarksParamsSchema.extend({ action: z.enum(["submit", "verify", "approve", "publish"]) }) }), transitionExamWorkflow);

// Marks entry and published result access.
router.get(
  "/:examId/marks",
  authorize(...examReadRoles),
  validate({ params: examMarksParamsSchema, query: examMarksQuerySchema }),
  getExamMarks
);

router.put(
  "/:examId/marks",
  authorize(...examTeacherRoles),
  validate({ params: examMarksParamsSchema, body: saveExamMarksSchema }),
  saveExamMarks
);

router.get(
  "/:examId/results",
  authorize(...examManagementRoles),
  validate({ params: examMarksParamsSchema }),
  getExamResults
);


// Create exam
router.post(
  "/",
  authorize(...examManagementRoles),
  validate(createExamSchema),
  createExam
);

// Get all exams
router.get(
  "/",
  authorize(...examReadRoles),
  validate(getExamsSchema),
  getExams
);

// Get exam by ID
router.get(
  "/:id",
  authorize(...examReadRoles),
  validate(examIdSchema),
  getExamById
);

// Update exam
router.patch(
  "/:id",
  authorize(...examManagementRoles),
  validate(updateExamSchema),
  updateExam
);

// Delete exam
router.delete(
  "/:id",
  authorize(...examManagementRoles),
  validate(examIdSchema),
  deleteExam
);

export default router;
