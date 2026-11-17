
import { Router } from "express";

import {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  setActiveSession,
  getActiveSession,
  deleteSession,
} from "./sessions.controller";

import {
  createSessionSchema,
  updateSessionSchema,
  sessionIdParamSchema,
  sessionListQuerySchema,
  setActiveSessionSchema,
  deleteSessionSchema,
} from "./sessions.validation";

import { authenticate } from "../../middleware/authenticate";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";
import * as advanced from "./sessions-advanced.controller";
import {
  closeSessionSchema, prepareClassesSchema, cloneFeesSchema, activateFeeStructureSchema,
  sessionIdSchema, reportQuerySchema, historyQuerySchema, promotionPreviewSchema,
  eligibleQuerySchema, promoteStudentsSchema, promoteIndividualStudentSchema,
} from "./sessions-advanced.validation";

const router = Router();

// All session routes require authentication.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Session read, lifecycle, promotion and fee-preparation permissions are separated.
const sessionViewers = authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.ACCOUNTANT, USER_ROLES.TEACHER, USER_ROLES.RECEPTIONIST);
const sessionManagers = authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL);
const feePreparationManagers = authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.ACCOUNTANT);


// MODULE 6 — Academic session lifecycle and preparation.
router.get("/dashboard", sessionViewers, advanced.dashboard);
router.get("/reports", sessionViewers, validate(reportQuerySchema), advanced.reports);
router.get("/previous", sessionViewers, advanced.previous);
router.get("/history", sessionViewers, validate(historyQuerySchema), advanced.history);
router.get("/promotion/preview", authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.TEACHER), validate(promotionPreviewSchema), advanced.promotionPreview);
router.get("/:id/detained", sessionManagers, validate(sessionIdSchema), advanced.detained);
router.get("/promotion/eligible", authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL, USER_ROLES.TEACHER), validate(eligibleQuerySchema), advanced.eligibleStudents);
router.post("/promotion/individual", sessionManagers, validate(promoteIndividualStudentSchema), advanced.promote);
router.post("/promotion/execute", sessionManagers, validate(promoteStudentsSchema), advanced.promote);
router.post("/prepare/classes", sessionManagers, validate(prepareClassesSchema), advanced.prepareClasses);
router.post("/prepare/fees", feePreparationManagers, validate(cloneFeesSchema), advanced.cloneFees);
router.patch("/prepare/fees/:feeStructureId/activate", feePreparationManagers, validate(activateFeeStructureSchema), advanced.activateFeeStructure);
router.get("/:id/preparation", sessionViewers, validate(sessionIdSchema), advanced.preparationStatus);
router.get("/:id/details", sessionViewers, validate(sessionIdSchema), advanced.details);
router.patch("/:id/close", sessionManagers, validate(closeSessionSchema), advanced.close);

// GET CURRENT ACTIVE SESSION
// GET /api/v1/sessions/active
router.get(
  "/active",
  sessionViewers,
  getActiveSession
);

// GET ALL SESSIONS
// GET /api/v1/sessions
router.get(
  "/",
  sessionViewers,
  validate(sessionListQuerySchema),
  getAllSessions
);

// CREATE SESSION
// POST /api/v1/sessions
router.post(
  "/",
  sessionManagers,
  validate(createSessionSchema),
  createSession
);

// GET SESSION BY ID
// GET /api/v1/sessions/:id
router.get(
  "/:id",
  sessionViewers,
  validate(sessionIdParamSchema),
  getSessionById
);

// UPDATE SESSION
// PATCH /api/v1/sessions/:id
router.patch(
  "/:id",
  sessionManagers,
  validate(updateSessionSchema),
  updateSession
);

// SET ACTIVE SESSION
// PATCH /api/v1/sessions/:id/activate
router.patch(
  "/:id/activate",
  sessionManagers,
  validate(setActiveSessionSchema),
  advanced.activate
);

// DELETE SESSION
// DELETE /api/v1/sessions/:id
router.delete(
  "/:id",
  sessionManagers,
  validate(deleteSessionSchema),
  deleteSession
);

export default router;
