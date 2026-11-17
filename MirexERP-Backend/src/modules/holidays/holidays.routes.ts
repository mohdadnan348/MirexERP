
import { Router } from "express";

import {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  updateHoliday,
  updateHolidayStatus,
  deleteHoliday,
  getHolidayCalendar,
  getHolidaySummary,
} from "./holidays.controller";

import {
  createHolidaySchema,
  updateHolidaySchema,
  holidayIdParamSchema,
  holidayListQuerySchema,
  updateHolidayStatusSchema,
  holidayCalendarQuerySchema,
} from "./holidays.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

import {
  tenantContext,
  requireTenant,
} from "../../middleware/tenantContext";

import { validate } from "../../middleware/validate";
import { USER_ROLES } from "../../config/constants";

const router = Router();

// Authentication and tenant security.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Roles allowed to manage holidays.
const holidayManagers = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL
);

// Get holiday calendar.
router.get(
  "/calendar",
  validate({
    query: holidayCalendarQuerySchema,
  }),
  getHolidayCalendar
);

// Get holiday summary.
router.get(
  "/summary",
  holidayManagers,
  getHolidaySummary
);

// Get all holidays.
router.get(
  "/",
  validate({
    query: holidayListQuerySchema,
  }),
  getAllHolidays
);

// Create holiday.
router.post(
  "/",
  holidayManagers,
  validate({
    body: createHolidaySchema,
  }),
  createHoliday
);

// Update holiday status.
router.patch(
  "/:id/status",
  holidayManagers,
  validate({
    params: holidayIdParamSchema,
    body: updateHolidayStatusSchema,
  }),
  updateHolidayStatus
);

// Update holiday.
router.patch(
  "/:id",
  holidayManagers,
  validate({
    params: holidayIdParamSchema,
    body: updateHolidaySchema,
  }),
  updateHoliday
);

// Get holiday details.
router.get(
  "/:id",
  validate({
    params: holidayIdParamSchema,
  }),
  getHolidayById
);

// Delete holiday.
router.delete(
  "/:id",
  holidayManagers,
  validate({
    params: holidayIdParamSchema,
  }),
  deleteHoliday
);

export default router;