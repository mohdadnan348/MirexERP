
import { Router } from "express";

import {
  createSchool,
  getAllSchools,
  getSchoolById,
  updateSchool,
  updateSchoolStatus,
  deleteSchool,
} from "./schools.controller";

import {
  createSchoolSchema,
  updateSchoolSchema,
  updateSchoolStatusSchema,
  schoolIdParamSchema,
  schoolListQuerySchema,
} from "./schools.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

const router = Router();

// All school management routes require authentication.
router.use(authenticate);

// Only Super Admin can create a school.
router.post(
  "/",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(createSchoolSchema),
  createSchool
);

// Only Super Admin can view all registered schools.
router.get(
  "/",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(schoolListQuerySchema),
  getAllSchools
);

// Super Admin can view a school by ID.
router.get(
  "/:id",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(schoolIdParamSchema),
  getSchoolById
);

// Super Admin can update school details.
router.patch(
  "/:id",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(updateSchoolSchema),
  updateSchool
);

// Only Super Admin can activate, suspend or deactivate a school.
router.patch(
  "/:id/status",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(updateSchoolStatusSchema),
  updateSchoolStatus
);

// Only Super Admin can soft-delete a school.
router.delete(
  "/:id",
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(schoolIdParamSchema),
  deleteSchool
);

export default router;
