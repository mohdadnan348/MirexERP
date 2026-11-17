
import { Router } from "express";
import { z } from "zod";

import {
  createTimetable,
  getTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  getClassTimetable,
  getTeacherTimetable,
  getMyTimetable,
  getSubjectTimetable,
} from "./timetable.controller";

import {
  createTimetableSchema,
  updateTimetableSchema,
  timetableIdSchema,
  getTimetablesSchema,
  classTimetableSchema,
  teacherTimetableSchema,
} from "./timetable.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";
import * as advanced from "./timetable-advanced.controller";
import { createVersionSchema, periodSchema, roomSchema, conflictSchema, idSchema } from "./timetable-advanced.validation";

const router = Router();

const {
  SUPER_ADMIN,
  SCHOOL_ADMIN,
  PRINCIPAL,
  TEACHER,
  RECEPTIONIST,
} = USER_ROLES;

// All routes require authentication and school tenant context.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Authenticated self timetable for teacher, student and linked parent.
router.get("/me", authorize(TEACHER, "STUDENT", "PARENT"), getMyTimetable);

// Advanced timetable lifecycle, period/room setup and conflict validation.
router.post("/versions", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(createVersionSchema), advanced.createVersion);
router.post("/versions/:id/publish", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(idSchema), advanced.publishVersion);
router.post("/versions/:id/archive", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(idSchema), advanced.archiveVersion);
router.get("/versions/:id/pdf", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST), validate(idSchema), advanced.printVersion);
router.get("/versions/:id/history", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(idSchema), advanced.versionHistory);
router.post("/check-conflicts", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(conflictSchema), advanced.checkConflicts);
router.get("/periods", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST), advanced.getPeriods);
router.post("/periods", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(periodSchema), advanced.createPeriod);
router.put("/periods/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate({params:idSchema.shape.params,body:periodSchema.shape.body}), advanced.updatePeriod);
router.delete("/periods/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(idSchema), advanced.deletePeriod);
router.get("/rooms", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST), advanced.getRooms);
router.post("/rooms", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(roomSchema), advanced.createRoom);
router.put("/rooms/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate({params:idSchema.shape.params,body:roomSchema.shape.body}), advanced.updateRoom);
router.delete("/rooms/:id", authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL), validate(idSchema), advanced.deleteRoom);

// Create timetable.
router.post(
  "/",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL),
  validate(createTimetableSchema),
  createTimetable
);

// Get all timetables.
router.get(
  "/",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST),
  validate(getTimetablesSchema),
  getTimetables
);

// Get class timetable.
router.get(
  "/class/:classId",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST),
  validate(classTimetableSchema),
  getClassTimetable
);

// Get subject timetable.
router.get(
  "/subject/:subjectId",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST),
  validate({params: z.object({subjectId: z.string().regex(/^[0-9a-fA-F]{24}$/)}), query: z.object({sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()})}),
  getSubjectTimetable
);

// Get teacher timetable.
router.get(
  "/teacher/:teacherId",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST),
  validate(teacherTimetableSchema),
  getTeacherTimetable
);

// Get timetable by ID.
router.get(
  "/:id",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, RECEPTIONIST),
  validate(timetableIdSchema),
  getTimetableById
);

// Update timetable.
router.patch(
  "/:id",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL),
  validate(updateTimetableSchema),
  updateTimetable
);

// Delete timetable.
router.delete(
  "/:id",
  authorize(SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL),
  validate(timetableIdSchema),
  deleteTimetable
);

export default router;
