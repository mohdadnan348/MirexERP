
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

import {
  createSectionSchema,
  updateSectionSchema,
  sectionIdParamSchema,
  sectionListQuerySchema,
  updateSectionStatusSchema,
  assignSectionTeacherSchema,
} from "./sections.validation";

import {
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  updateSectionStatus,
  assignSectionTeacher,
  deleteSection,
  getSectionSummary,
} from "./sections.controller";

const router = Router();

const sectionManagementRoles = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
] as const;

// All section routes require authentication and school tenant context.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// GET /api/v1/sections/summary
router.get(
  "/summary",
  authorize(...sectionManagementRoles),
  validate({ query: sectionListQuerySchema }),
  getSectionSummary
);

// GET /api/v1/sections
router.get(
  "/",
  authorize(...sectionManagementRoles),
  validate({ query: sectionListQuerySchema }),
  getAllSections
);

// POST /api/v1/sections
router.post(
  "/",
  authorize(...sectionManagementRoles),
  validate({ body: createSectionSchema }),
  createSection
);

// GET /api/v1/sections/:id
router.get(
  "/:id",
  authorize(...sectionManagementRoles),
  validate({ params: sectionIdParamSchema }),
  getSectionById
);

// PATCH /api/v1/sections/:id
router.patch(
  "/:id",
  authorize(...sectionManagementRoles),
  validate({
    params: sectionIdParamSchema,
    body: updateSectionSchema,
  }),
  updateSection
);

// PATCH /api/v1/sections/:id/status
router.patch(
  "/:id/status",
  authorize(...sectionManagementRoles),
  validate({
    params: sectionIdParamSchema,
    body: updateSectionStatusSchema,
  }),
  updateSectionStatus
);

// PUT /api/v1/sections/:id/teacher
router.put(
  "/:id/teacher",
  authorize(...sectionManagementRoles),
  validate({
    params: sectionIdParamSchema,
    body: assignSectionTeacherSchema,
  }),
  assignSectionTeacher
);

// DELETE /api/v1/sections/:id
router.delete(
  "/:id",
  authorize(...sectionManagementRoles),
  validate({ params: sectionIdParamSchema }),
  deleteSection
);

export default router;
