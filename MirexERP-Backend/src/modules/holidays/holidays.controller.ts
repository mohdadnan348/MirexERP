
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { getValidatedData } from "../../utils/validate";

import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  createHolidayService,
  getAllHolidaysService,
  getHolidayByIdService,
  updateHolidayService,
  updateHolidayStatusService,
  deleteHolidayService,
  getHolidayCalendarService,
  getHolidaySummaryService,
  HolidayActor,
} from "./holidays.service";

import {
  CreateHolidayInput,
  UpdateHolidayInput,
  HolidayListQuery,
  UpdateHolidayStatusInput,
  HolidayCalendarQuery,
} from "./holidays.validation";

// Get authenticated school user.
const getActor = (req: Request): HolidayActor => {
  if (!req.user?.userId || !req.user.schoolId) {
    throw new AppError(
      "Authenticated school user is required",
      401
    );
  }

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
  };
};

// Safely get holiday ID from route parameters.
const getHolidayId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid holiday ID is required", 400);
  }

  return id;
};

// Create holiday.
export const createHoliday = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateHolidayInput>(
      res,
      "body"
    );

    const holiday = await createHolidayService(
      data,
      actor
    );

    return sendCreated(
      res,
      "Holiday created successfully",
      holiday
    );
  }
);

// Get all holidays.
export const getAllHolidays = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<HolidayListQuery>(
      res,
      "query"
    );

    const result = await getAllHolidaysService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Holidays fetched successfully",
      result.holidays,
      result.pagination
    );
  }
);

// Get holiday by ID.
export const getHolidayById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const holidayId = getHolidayId(req);

    const holiday = await getHolidayByIdService(
      holidayId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Holiday details fetched successfully",
      holiday
    );
  }
);

// Update holiday.
export const updateHoliday = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const holidayId = getHolidayId(req);

    const data = getValidatedData<UpdateHolidayInput>(
      res,
      "body"
    );

    const holiday = await updateHolidayService(
      holidayId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Holiday updated successfully",
      holiday
    );
  }
);

// Activate or deactivate holiday.
export const updateHolidayStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const holidayId = getHolidayId(req);

    const data =
      getValidatedData<UpdateHolidayStatusInput>(
        res,
        "body"
      );

    const holiday = await updateHolidayStatusService(
      holidayId,
      data,
      actor
    );

    return sendSuccess(
      res,
      `Holiday ${data.isActive ? "activated" : "deactivated"} successfully`,
      holiday
    );
  }
);

// Delete holiday.
export const deleteHoliday = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const holidayId = getHolidayId(req);

    await deleteHolidayService(holidayId, actor);

    return sendDeleted(
      res,
      "Holiday deleted successfully"
    );
  }
);

// Get academic holiday calendar.
export const getHolidayCalendar = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query =
      getValidatedData<HolidayCalendarQuery>(
        res,
        "query"
      );

    const calendar = await getHolidayCalendarService(
      query,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Holiday calendar fetched successfully",
      calendar
    );
  }
);

// Get holiday summary.
export const getHolidaySummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const sessionId = req.query.sessionId;

    if (
      typeof sessionId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(sessionId)
    ) {
      throw new AppError(
        "Valid academic session ID is required",
        400
      );
    }

    const summary = await getHolidaySummaryService(
      sessionId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Holiday summary fetched successfully",
      summary
    );
  }
);