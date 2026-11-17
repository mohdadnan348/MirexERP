
import { Router } from "express";
import { getAcademicCalendar } from "./events-calendar.controller";
import { getEventHistory } from "./events-operations.controller";

import { USER_ROLES } from "../../config/constants";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  createEvent,
  deleteEvent,
  getEventById,
  getEvents,
  updateEvent,
} from "./events.controller";

import {
  createEventSchema,
  eventIdSchema,
  getEventsSchema,
  updateEventSchema,
} from "./events.validation";

const router = Router();

const eventManagementRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
];

const eventReadRoles = [
  ...eventManagementRoles,
  USER_ROLES.TEACHER,
];
const calendarReadRoles = [...eventReadRoles, USER_ROLES.PARENT, USER_ROLES.STUDENT];

router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Consolidated calendar reuses existing Events, Holidays and Exams records.
router.get("/calendar", authorize(...calendarReadRoles), getAcademicCalendar);

// Event audit history is available to school event managers and teachers.
router.get("/:id/history", authorize(...eventReadRoles), getEventHistory);

// Create event
router.post(
  "/",
  authorize(...eventManagementRoles),
  validate(createEventSchema),
  createEvent
);

// Get all events
router.get(
  "/",
  authorize(...eventReadRoles),
  validate(getEventsSchema),
  getEvents
);

// Get event by ID
router.get(
  "/:id",
  authorize(...eventReadRoles),
  validate(eventIdSchema),
  getEventById
);

// Update event
router.patch(
  "/:id",
  authorize(...eventManagementRoles),
  validate(updateEventSchema),
  updateEvent
);

// Delete event
router.delete(
  "/:id",
  authorize(...eventManagementRoles),
  validate(eventIdSchema),
  deleteEvent
);

export default router;
