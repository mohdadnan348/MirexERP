
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  createClassSchema,
  updateClassSchema,
  classIdParamSchema,
  classListQuerySchema,
  updateClassStatusSchema,
  assignClassSubjectsSchema,
} from "./classes.validation";

import {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  updateClassStatus,
  assignClassSubjects,
  deleteClass,
  getClassSummary,
} from "./classes.controller";

import { USER_ROLES } from "../../config/constants";

const router = Router();

const classManagementRoles = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
] as const;

// All class routes require authentication and a valid school tenant.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// GET /api/v1/classes/summary
router.get(
  "/summary",
  authorize(...classManagementRoles),
  validate({ query: classListQuerySchema }),
  getClassSummary
);

// GET /api/v1/classes
router.get(
  "/",
  authorize(...classManagementRoles),
  validate({ query: classListQuerySchema }),
  getAllClasses
);

// POST /api/v1/classes
router.post(
  "/",
  authorize(...classManagementRoles),
  validate({ body: createClassSchema }),
  createClass
);

// GET /api/v1/classes/:id
router.get(
  "/:id",
  authorize(...classManagementRoles),
  validate({ params: classIdParamSchema }),
  getClassById
);

// PATCH /api/v1/classes/:id
router.patch(
  "/:id",
  authorize(...classManagementRoles),
  validate({
    params: classIdParamSchema,
    body: updateClassSchema,
  }),
  updateClass
);

// PATCH /api/v1/classes/:id/status
router.patch(
  "/:id/status",
  authorize(...classManagementRoles),
  validate({
    params: classIdParamSchema,
    body: updateClassStatusSchema,
  }),
  updateClassStatus
);

// PUT /api/v1/classes/:id/subjects
router.put(
  "/:id/subjects",
  authorize(...classManagementRoles),
  validate({
    params: classIdParamSchema,
    body: assignClassSubjectsSchema,
  }),
  assignClassSubjects
);

// DELETE /api/v1/classes/:id
router.delete(
  "/:id",
  authorize(...classManagementRoles),
  validate({ params: classIdParamSchema }),
  deleteClass
);

export default router;
