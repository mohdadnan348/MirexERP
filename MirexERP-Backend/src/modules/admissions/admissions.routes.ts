
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

import {
  createAdmission,
  getAllAdmissions,
  getAdmissionById,
  updateAdmission,
  reviewAdmission,
  approveAdmission,
  registerApprovedAdmission,
  rejectAdmission,
  cancelAdmission,
  deleteAdmission,
  getAdmissionSummary,
  addAdmissionFollowUp,
} from "./admissions.controller";

import {
  createAdmissionSchema,
  updateAdmissionSchema,
  admissionIdParamSchema,
  admissionListQuerySchema,
  reviewAdmissionSchema,
  approveAdmissionSchema,
  approveDecisionSchema,
  rejectAdmissionSchema,
  cancelAdmissionSchema,
  createAdmissionFollowUpSchema,
} from "./admissions.validation";

const router = Router();

// All admission routes require authentication.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Roles allowed to manage admissions.
const admissionManagementRoles = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.RECEPTIONIST,
];

// GET /api/v1/admissions/summary
router.get(
  "/summary",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL
  ),
  validate(admissionListQuerySchema),
  getAdmissionSummary
);

// GET /api/v1/admissions
router.get(
  "/",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL,
    USER_ROLES.RECEPTIONIST
  ),
  validate(admissionListQuerySchema),
  getAllAdmissions
);

// POST /api/v1/admissions
router.post(
  "/",
  authorize(...admissionManagementRoles),
  validate(createAdmissionSchema),
  createAdmission
);

// PDF blueprint-compatible aliases. Enquiries and applications share the existing Admission collection and lifecycle.
router.get("/enquiries", authorize(...admissionManagementRoles), validate(admissionListQuerySchema), getAllAdmissions);
router.post("/enquiries", authorize(...admissionManagementRoles), validate(createAdmissionSchema), createAdmission);
router.post("/enquiries/:id/follow-ups", authorize(...admissionManagementRoles), validate(admissionIdParamSchema), validate(createAdmissionFollowUpSchema), addAdmissionFollowUp);
router.get("/applications", authorize(...admissionManagementRoles), validate(admissionListQuerySchema), getAllAdmissions);
router.post("/applications", authorize(...admissionManagementRoles), validate(createAdmissionSchema), createAdmission);
router.post("/applications/:id/approve", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate(admissionIdParamSchema), validate(approveDecisionSchema), approveAdmission);
router.post("/applications/:id/register", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate(admissionIdParamSchema), validate(approveAdmissionSchema), registerApprovedAdmission);
router.post("/applications/:id/reject", authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate(admissionIdParamSchema), validate(rejectAdmissionSchema), rejectAdmission);

// GET /api/v1/admissions/:id
router.get(
  "/:id",
  authorize(...admissionManagementRoles),
  validate(admissionIdParamSchema),
  getAdmissionById
);

// PATCH /api/v1/admissions/:id
router.patch(
  "/:id",
  authorize(...admissionManagementRoles),
  validate(admissionIdParamSchema),
  validate(updateAdmissionSchema),
  updateAdmission
);

// PATCH /api/v1/admissions/:id/review
router.patch(
  "/:id/review",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL,
    USER_ROLES.RECEPTIONIST
  ),
  validate(admissionIdParamSchema),
  validate(reviewAdmissionSchema),
  reviewAdmission
);

// POST /api/v1/admissions/:id/follow-ups
router.post(
  "/:id/follow-ups",
  authorize(...admissionManagementRoles),
  validate(admissionIdParamSchema),
  validate(createAdmissionFollowUpSchema),
  addAdmissionFollowUp
);

// PATCH /api/v1/admissions/:id/approve
router.patch(
  "/:id/approve",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL
  ),
  validate(admissionIdParamSchema),
  validate(approveAdmissionSchema),
  approveAdmission
);

// POST /api/v1/admissions/:id/register
router.post(
  "/:id/register",
  authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL),
  validate(admissionIdParamSchema),
  validate(approveAdmissionSchema),
  registerApprovedAdmission
);

// PATCH /api/v1/admissions/:id/reject
router.patch(
  "/:id/reject",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL
  ),
  validate(admissionIdParamSchema),
  validate(rejectAdmissionSchema),
  rejectAdmission
);

// PATCH /api/v1/admissions/:id/cancel
router.patch(
  "/:id/cancel",
  authorize(
    ...admissionManagementRoles
  ),
  validate(admissionIdParamSchema),
  validate(cancelAdmissionSchema),
  cancelAdmission
);

// DELETE /api/v1/admissions/:id
router.delete(
  "/:id",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL
  ),
  validate(admissionIdParamSchema),
  deleteAdmission
);

export default router;
