
import { FilterQuery, Types } from "mongoose";

import Holiday, {
  IHolidayDocument,
} from "./holidays.model";

import Session from "../sessions/sessions.model";

import { AppError } from "../../utils/AppError";

import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateHolidayInput,
  UpdateHolidayInput,
  HolidayListQuery,
  UpdateHolidayStatusInput,
  HolidayCalendarQuery,
} from "./holidays.validation";

export interface HolidayActor {
  userId: string;
  schoolId: string;
}

const getObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid ID provided", 400);
  }

  return new Types.ObjectId(id);
};

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const calculateTotalDays = (
  startDate: Date,
  endDate: Date
): number => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  return (
    Math.floor(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
};

const validateDateRange = (
  startDate: Date,
  endDate: Date
): void => {
  if (normalizeDate(endDate) < normalizeDate(startDate)) {
    throw new AppError(
      "Holiday end date cannot be before start date",
      400
    );
  }
};

const validateActiveSession = async (
  sessionId: string,
  schoolId: string
): Promise<void> => {
  const session = await Session.findOne({
    _id: getObjectId(sessionId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
    isClosed: { $ne: true },
  }).select("_id isActive isClosed");

  if (!session) {
    throw new AppError("Academic session not found", 404);
  }

  if (!session.isActive) {
    throw new AppError(
      "Holidays can only be managed in an active academic session",
      400
    );
  }
};

const getHolidayById = async (
  holidayId: string,
  schoolId: string
): Promise<IHolidayDocument> => {
  const holiday = await Holiday.findOne({
    _id: getObjectId(holidayId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  });

  if (!holiday) {
    throw new AppError("Holiday not found", 404);
  }

  return holiday;
};

// Check duplicate holiday name and date range.
const checkDuplicateHoliday = async (
  name: string,
  startDate: Date,
  endDate: Date,
  schoolId: string,
  sessionId: string,
  excludeHolidayId?: string
): Promise<void> => {
  const filter: FilterQuery<IHolidayDocument> = {
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(sessionId),
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
    isDeleted: false,
  };

  if (excludeHolidayId) {
    filter._id = {
      $ne: getObjectId(excludeHolidayId),
    };
  }

  const existing = await Holiday.findOne(filter).select("_id");

  if (existing) {
    throw new AppError(
      "A holiday with this name already exists in this academic session",
      409
    );
  }

  const overlappingHoliday = await Holiday.findOne({
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(sessionId),
    isDeleted: false,
    startDate: { $lte: normalizeDate(endDate) },
    endDate: { $gte: normalizeDate(startDate) },
    ...(excludeHolidayId
      ? { _id: { $ne: getObjectId(excludeHolidayId) } }
      : {}),
  }).select("_id");

  if (overlappingHoliday) {
    throw new AppError(
      "Another holiday already exists during the selected date range",
      409
    );
  }
};

// Create holiday.
export const createHolidayService = async (
  data: CreateHolidayInput,
  actor: HolidayActor
) => {
  await validateActiveSession(
    data.sessionId,
    actor.schoolId
  );

  validateDateRange(data.startDate, data.endDate);

  await checkDuplicateHoliday(
    data.name,
    data.startDate,
    data.endDate,
    actor.schoolId,
    data.sessionId
  );

  const holiday = await Holiday.create({
    schoolId: getObjectId(actor.schoolId),
    sessionId: getObjectId(data.sessionId),

    name: data.name,
    description: data.description,

    holidayType: data.holidayType,
    applicableTo: data.applicableTo,

    startDate: normalizeDate(data.startDate),
    endDate: normalizeDate(data.endDate),

    totalDays: calculateTotalDays(
      data.startDate,
      data.endDate
    ),

    isOptional: data.isOptional,
    isRecurring: data.isRecurring,

    recurringMonth: data.isRecurring
      ? data.recurringMonth ?? null
      : null,

    recurringDay: data.isRecurring
      ? data.recurringDay ?? null
      : null,

    isActive: data.isActive,

    createdBy: getObjectId(actor.userId),
  });

  return holiday;
};

// Get all holidays with pagination and filters.
export const getAllHolidaysService = async (
  query: HolidayListQuery,
  schoolId: string
) => {
  const { page, limit } = getPagination({
    page: query.page,
    limit: query.limit,
  });

  const filter: FilterQuery<IHolidayDocument> = {
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.search) {
    filter.name = {
      $regex: query.search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      ),
      $options: "i",
    };
  }

  if (query.holidayType) {
    filter.holidayType = query.holidayType;
  }

  if (query.applicableTo) {
    filter.applicableTo = query.applicableTo;
  }

  if (query.isOptional !== undefined) {
    filter.isOptional = query.isOptional;
  }

  if (query.isRecurring !== undefined) {
    filter.isRecurring = query.isRecurring;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.startDate || query.endDate) {
    filter.startDate = {};
    filter.endDate = {};

    if (query.startDate) {
      filter.endDate.$gte = normalizeDate(query.startDate);
    }

    if (query.endDate) {
      filter.startDate.$lte = normalizeDate(query.endDate);
    }
  }

  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const sort: Record<string, 1 | -1> = {
    [query.sortBy]: sortOrder,
  };

  const [holidays, total] = await Promise.all([
    Holiday.find(filter)
      .populate("sessionId", "name code")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Holiday.countDocuments(filter),
  ]);

  return {
    holidays,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// Get holiday details.
export const getHolidayByIdService = async (
  holidayId: string,
  schoolId: string
) => {
  const holiday = await Holiday.findOne({
    _id: getObjectId(holidayId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  })
    .populate("sessionId", "name code startDate endDate")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!holiday) {
    throw new AppError("Holiday not found", 404);
  }

  return holiday;
};

// Update holiday.
export const updateHolidayService = async (
  holidayId: string,
  data: UpdateHolidayInput,
  actor: HolidayActor
) => {
  const holiday = await getHolidayById(
    holidayId,
    actor.schoolId
  );

  const startDate = data.startDate ?? holiday.startDate;
  const endDate = data.endDate ?? holiday.endDate;

  validateDateRange(startDate, endDate);

  const name = data.name ?? holiday.name;

  await checkDuplicateHoliday(
    name,
    startDate,
    endDate,
    actor.schoolId,
    holiday.sessionId.toString(),
    holidayId
  );

  if (data.name !== undefined) {
    holiday.name = data.name;
  }

  if (data.description !== undefined) {
    holiday.description = data.description;
  }

  if (data.holidayType !== undefined) {
    holiday.holidayType = data.holidayType;
  }

  if (data.applicableTo !== undefined) {
    holiday.applicableTo = data.applicableTo;
  }

  if (data.startDate !== undefined) {
    holiday.startDate = normalizeDate(data.startDate);
  }

  if (data.endDate !== undefined) {
    holiday.endDate = normalizeDate(data.endDate);
  }

  if (data.isOptional !== undefined) {
    holiday.isOptional = data.isOptional;
  }

  if (data.isActive !== undefined) {
    holiday.isActive = data.isActive;
  }

  if (data.isRecurring !== undefined) {
    holiday.isRecurring = data.isRecurring;

    if (!data.isRecurring) {
      holiday.recurringMonth = null;
      holiday.recurringDay = null;
    }
  }

  if (data.recurringMonth !== undefined) {
    holiday.recurringMonth = data.recurringMonth;
  }

  if (data.recurringDay !== undefined) {
    holiday.recurringDay = data.recurringDay;
  }

  holiday.totalDays = calculateTotalDays(
    startDate,
    endDate
  );

  holiday.updatedBy = getObjectId(actor.userId);

  await holiday.save();

  return holiday;
};

// Activate or deactivate holiday.
export const updateHolidayStatusService = async (
  holidayId: string,
  data: { isActive: boolean },
  actor: HolidayActor
) => {
  const holiday = await getHolidayById(
    holidayId,
    actor.schoolId
  );

  holiday.isActive = data.isActive;
  holiday.updatedBy = getObjectId(actor.userId);

  await holiday.save();

  return holiday;
};

// Delete holiday (soft delete).
export const deleteHolidayService = async (
  holidayId: string,
  actor: HolidayActor
) => {
  const holiday = await getHolidayById(
    holidayId,
    actor.schoolId
  );

  holiday.isDeleted = true;
  holiday.deletedAt = new Date();
  holiday.updatedBy = getObjectId(actor.userId);

  await holiday.save();

  return {
    id: holiday._id,
    deleted: true,
  };
};

// Get holidays for academic calendar.
export const getHolidayCalendarService = async (
  query: HolidayCalendarQuery,
  schoolId: string
) => {
  await validateActiveSession(
    query.sessionId,
    schoolId
  );

  const yearStart = new Date(query.year, 0, 1);
  const yearEnd = new Date(query.year, 11, 31, 23, 59, 59, 999);

  const filter: FilterQuery<IHolidayDocument> = {
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(query.sessionId),
    isActive: true,
    isDeleted: false,
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart },
  };

  if (query.applicableTo) {
    filter.applicableTo = {
      $in:
        query.applicableTo === "BOTH"
          ? ["BOTH"]
          : [query.applicableTo, "BOTH"],
    } as never;
  }

  if (query.month) {
    const monthStart = new Date(
      query.year,
      query.month - 1,
      1
    );

    const monthEnd = new Date(
      query.year,
      query.month,
      0,
      23,
      59,
      59,
      999
    );

    filter.startDate = { $lte: monthEnd };
    filter.endDate = { $gte: monthStart };
  }

  const holidays = await Holiday.find(filter)
    .sort({ startDate: 1 })
    .select(
      "name description holidayType applicableTo startDate endDate totalDays isOptional isRecurring"
    )
    .lean();

  return {
    year: query.year,
    month: query.month ?? null,
    totalHolidays: holidays.length,
    holidays,
  };
};

// Get holiday summary.
export const getHolidaySummaryService = async (
  sessionId: string,
  schoolId: string
) => {
  await validateActiveSession(sessionId, schoolId);

  const [total, active, optional, typeCounts, totalHolidayDays] =
    await Promise.all([
      Holiday.countDocuments({
        schoolId: getObjectId(schoolId),
        sessionId: getObjectId(sessionId),
        isDeleted: false,
      }),

      Holiday.countDocuments({
        schoolId: getObjectId(schoolId),
        sessionId: getObjectId(sessionId),
        isActive: true,
        isDeleted: false,
      }),

      Holiday.countDocuments({
        schoolId: getObjectId(schoolId),
        sessionId: getObjectId(sessionId),
        isOptional: true,
        isActive: true,
        isDeleted: false,
      }),

      Holiday.aggregate([
        {
          $match: {
            schoolId: getObjectId(schoolId),
            sessionId: getObjectId(sessionId),
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$holidayType",
            count: { $sum: 1 },
          },
        },
      ]),

      Holiday.aggregate([
        {
          $match: {
            schoolId: getObjectId(schoolId),
            sessionId: getObjectId(sessionId),
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: "$totalDays" },
          },
        },
      ]),
    ]);

  return {
    totalHolidays: total,
    activeHolidays: active,
    optionalHolidays: optional,
    inactiveHolidays: total - active,
    totalHolidayDays: totalHolidayDays[0]?.totalDays ?? 0,
    holidayTypeBreakdown: typeCounts.map((item) => ({
      type: item._id,
      count: item.count,
    })),
  };
};