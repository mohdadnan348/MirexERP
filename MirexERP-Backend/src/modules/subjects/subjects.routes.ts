
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

import {
  createSubjectSchema,
  updateSubjectSchema,
  subjectIdParamSchema,
  subjectListQuerySchema,
  updateSubjectStatusSchema,
  updateSubjectTypeSchema,
} from "./subjects.validation";

import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  updateSubjectStatus,
  updateSubjectType,
  deleteSubject,
  getSubjectSummary,
} from "./subjects.controller";

const router = Router();

const subjectManagementRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
] as const;

// All subject routes require authentication and school tenant context.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// GET /api/v1/subjects/summary
router.get(
  "/summary",
  authorize(...subjectManagementRoles),
  getSubjectSummary
);

// GET /api/v1/subjects
router.get(
  "/",
  authorize(...subjectManagementRoles),
  validate({ query: subjectListQuerySchema }),
  getAllSubjects
);

// POST /api/v1/subjects
router.post(
  "/",
  authorize(...subjectManagementRoles),
  validate({ body: createSubjectSchema }),
  createSubject
);

// GET /api/v1/subjects/:id
router.get(
  "/:id",
  authorize(...subjectManagementRoles),
  validate({ params: subjectIdParamSchema }),
  getSubjectById
);

// PATCH /api/v1/subjects/:id
router.patch(
  "/:id",
  authorize(...subjectManagementRoles),
  validate({
    params: subjectIdParamSchema,
    body: updateSubjectSchema,
  }),
  updateSubject
);

// PATCH /api/v1/subjects/:id/status
router.patch(
  "/:id/status",
  authorize(...subjectManagementRoles),
  validate({
    params: subjectIdParamSchema,
    body: updateSubjectStatusSchema,
  }),
  updateSubjectStatus
);

// PATCH /api/v1/subjects/:id/type
router.patch(
  "/:id/type",
  authorize(...subjectManagementRoles),
  validate({
    params: subjectIdParamSchema,
    body: updateSubjectTypeSchema,
  }),
  updateSubjectType
);

// DELETE /api/v1/subjects/:id
router.delete(
  "/:id",
  authorize(...subjectManagementRoles),
  validate({ params: subjectIdParamSchema }),
  deleteSubject
);

export default router;
