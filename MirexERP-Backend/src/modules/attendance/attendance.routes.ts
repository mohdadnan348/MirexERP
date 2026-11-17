
import { Router } from "express";

import {
  createAttendance,
  bulkMarkAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
  updateAttendanceStatus,
  deleteAttendance,
  getAttendanceSummary,
  getPersonDailyAttendance,
  requestAttendanceCorrection,
  listAttendanceCorrections,
  reviewAttendanceCorrection,
  getAttendanceDefaulters,
} from "./attendance.controller";

import {
  createAttendanceSchema,
  updateAttendanceSchema,
  attendanceIdParamSchema,
  attendanceListQuerySchema,
  bulkAttendanceSchema,
  updateAttendanceStatusSchema,
  attendanceSummaryQuerySchema,
  attendanceCorrectionRequestSchema,
  attendanceCorrectionReviewSchema,
  attendanceCorrectionIdParamSchema,
} from "./attendance.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import {
  tenantContext,
  requireTenant,
} from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

const router = Router();

// Authentication and school tenant security.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Roles allowed to manage attendance.
const attendanceManagers = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.TEACHER
);

// Attendance listing and reports.
router.get("/reports/defaulters", attendanceManagers, getAttendanceDefaulters);
router.get(
  "/",
  attendanceManagers,
  validate({
    query: attendanceListQuerySchema,
  }),
  getAllAttendance
);

// Attendance summary.
router.get(
  "/summary",
  attendanceManagers,
  validate({
    query: attendanceSummaryQuerySchema,
  }),
  getAttendanceSummary
);

// Get daily attendance of a student or employee.
router.get(
  "/person/:personId/daily",
  attendanceManagers,
  getPersonDailyAttendance
);

// Bulk attendance marking.
router.post(
  "/bulk",
  attendanceManagers,
  validate({
    body: bulkAttendanceSchema,
  }),
  bulkMarkAttendance
);

// Create single attendance record.
router.post(
  "/",
  attendanceManagers,
  validate({
    body: createAttendanceSchema,
  }),
  createAttendance
);

// Attendance correction workflow. Teachers may request; only school leadership may approve/reject.
router.get("/corrections", attendanceManagers, listAttendanceCorrections);
router.post("/:id/corrections", attendanceManagers,
  validate({ params: attendanceIdParamSchema, body: attendanceCorrectionRequestSchema }),
  requestAttendanceCorrection
);
router.patch("/corrections/:correctionId/review",
  authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL),
  validate({ params: attendanceCorrectionIdParamSchema, body: attendanceCorrectionReviewSchema }),
  reviewAttendanceCorrection
);

// Update attendance status.
router.patch(
  "/:id/status",
  authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL),
  validate({
    params: attendanceIdParamSchema,
    body: updateAttendanceStatusSchema,
  }),
  updateAttendanceStatus
);

// Update complete attendance record.
router.patch(
  "/:id",
  authorize(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL),
  validate({
    params: attendanceIdParamSchema,
    body: updateAttendanceSchema,
  }),
  updateAttendance
);

// Get attendance by ID.
router.get(
  "/:id",
  attendanceManagers,
  validate({
    params: attendanceIdParamSchema,
  }),
  getAttendanceById
);

// Delete attendance record.
router.delete(
  "/:id",
  authorize(
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL
  ),
  validate({
    params: attendanceIdParamSchema,
  }),
  deleteAttendance
);

export default router;
