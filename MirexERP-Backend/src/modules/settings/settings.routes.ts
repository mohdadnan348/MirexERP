
import { Router } from "express";
import { getSettingsDashboard, getSettingsUsers, getSecurityPolicy, updateSecurityPolicy, getActiveSessions, revokeActiveSession, revokeUserSessions, getSchoolAuditLogs } from "./settings-advanced.controller";

import {
  getSettings,
  updateSettings,
  getAcademicSettings,
  updateAcademicSettings,
  getAttendanceSettings,
  updateAttendanceSettings,
  getFeeSettings,
  updateFeeSettings,
  getNotificationSettings,
  updateNotificationSettings,
} from "./settings.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  updateSettingsSchema,
  updateAcademicSettingsSchema,
  updateAttendanceSettingsSchema,
  updateFeeSettingsSchema,
  updateNotificationSettingsSchema,
} from "./settings.validation";

const router = Router();

// Authentication and school tenant protection
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);


// Security and administration extensions (all school-scoped).
router.get("/dashboard", authorize("SCHOOL_ADMIN", "PRINCIPAL"), getSettingsDashboard);
router.get("/users", authorize("SCHOOL_ADMIN"), getSettingsUsers);
router.get("/security-policy", authorize("SCHOOL_ADMIN"), getSecurityPolicy);
router.patch("/security-policy", authorize("SCHOOL_ADMIN"), updateSecurityPolicy);
router.get("/sessions", authorize("SCHOOL_ADMIN"), getActiveSessions);
router.delete("/sessions/:sessionId", authorize("SCHOOL_ADMIN"), revokeActiveSession);
router.delete("/users/:userId/sessions", authorize("SCHOOL_ADMIN"), revokeUserSessions);
router.get("/audit-logs", authorize("SCHOOL_ADMIN", "PRINCIPAL"), getSchoolAuditLogs);

// General School Settings
router.get(
  "/",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  getSettings
);

router.patch(
  "/",
  authorize("SCHOOL_ADMIN"),
  validate({ body: updateSettingsSchema }),
  updateSettings
);

// Academic Settings
router.get(
  "/academic",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  getAcademicSettings
);

router.patch(
  "/academic",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ body: updateAcademicSettingsSchema }),
  updateAcademicSettings
);

// Attendance Settings
router.get(
  "/attendance",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  getAttendanceSettings
);

router.patch(
  "/attendance",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ body: updateAttendanceSettingsSchema }),
  updateAttendanceSettings
);

// Fee Settings
router.get(
  "/fees",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  getFeeSettings
);

router.patch(
  "/fees",
  authorize("SCHOOL_ADMIN", "ACCOUNTANT"),
  validate({ body: updateFeeSettingsSchema }),
  updateFeeSettings
);

// Notification Settings
router.get(
  "/notifications",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  getNotificationSettings
);

router.patch(
  "/notifications",
  authorize("SCHOOL_ADMIN"),
  validate({ body: updateNotificationSettingsSchema }),
  updateNotificationSettings
);

export default router;
