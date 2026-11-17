
import mongoose, { FilterQuery, Types } from "mongoose";

import Session, { ISession } from "./sessions.model";
import { AppError } from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

export interface CreateSessionData {
  name: string;
  code: string;
  startDate: Date | string;
  endDate: Date | string;
  description?: string;
}

export interface UpdateSessionData {
  name?: string;
  code?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  description?: string;
}

export interface SessionListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "DRAFT" | "UPCOMING" | "CLOSED";
}

const ensureValidId = (id: string): void => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid session ID", 400);
  }
};

const ensureValidDateRange = (
  startDate: Date,
  endDate: Date
): void => {
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate >= endDate
  ) {
    throw new AppError(
      "Session end date must be after start date",
      400
    );
  }
};

const findSessionOrFail = async (
  id: string,
  schoolId: string
): Promise<ISession> => {
  ensureValidId(id);

  const session = await Session.findOne({
    _id: id,
    schoolId,
    isDeleted: false,
  });

  if (!session) {
    throw new AppError("Academic session not found", 404);
  }

  return session;
};

// CREATE SESSION
export const createSessionService = async (
  data: CreateSessionData,
  schoolId: string,
  userId?: string
): Promise<ISession> => {
  if (!mongoose.isValidObjectId(schoolId)) {
    throw new AppError("Invalid school ID", 400);
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  ensureValidDateRange(startDate, endDate);

  const normalizedCode = data.code.trim().toUpperCase();
  const normalizedName = data.name.trim();

  const existingSession = await Session.findOne({
    schoolId,
    isDeleted: false,
    $or: [
      { code: normalizedCode },
      { name: normalizedName },
    ],
  }).lean();

  if (existingSession) {
    throw new AppError(
      "A session with this name or code already exists",
      409
    );
  }

  try {
    return await Session.create({
      ...data,
      name: normalizedName,
      code: normalizedCode,
      startDate,
      endDate,
      schoolId: new Types.ObjectId(schoolId),
      isActive: false,
      isDeleted: false,
      createdBy: userId
        ? new Types.ObjectId(userId)
        : null,
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      throw new AppError(
        "Session name or code already exists",
        409
      );
    }

    throw error;
  }
};

// GET ALL SESSIONS
export const getAllSessionsService = async (
  schoolId: string,
  options: SessionListOptions
) => {
  if (!mongoose.isValidObjectId(schoolId)) {
    throw new AppError("Invalid school ID", 400);
  }

  const { page, limit, skip } = getPagination({
    page: options.page,
    limit: options.limit,
  });

  const filter: FilterQuery<ISession> = {
    schoolId: new Types.ObjectId(schoolId),
    isDeleted: false,
  };

  if (options.status === "ACTIVE") {
    filter.isActive = true;
  } else if (options.status === "INACTIVE") {
    filter.isActive = false;
  }

  if (options.search?.trim()) {
    const search = options.search.trim();

    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const [sessions, total] = await Promise.all([
    Session.find(filter)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Session.countDocuments(filter),
  ]);

  return {
    sessions,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// GET SESSION BY ID
export const getSessionByIdService = async (
  id: string,
  schoolId: string
): Promise<ISession> => {
  return findSessionOrFail(id, schoolId);
};

// UPDATE SESSION
export const updateSessionService = async (
  id: string,
  schoolId: string,
  data: UpdateSessionData,
  userId?: string
): Promise<ISession> => {
  const session = await findSessionOrFail(id, schoolId);

  const startDate = data.startDate
    ? new Date(data.startDate)
    : session.startDate;

  const endDate = data.endDate
    ? new Date(data.endDate)
    : session.endDate;

  ensureValidDateRange(startDate, endDate);

  const duplicateConditions: Record<string, unknown>[] = [];

  if (data.code) {
    duplicateConditions.push({
      code: data.code.trim().toUpperCase(),
    });
  }

  if (data.name) {
    duplicateConditions.push({
      name: data.name.trim(),
    });
  }

  if (duplicateConditions.length > 0) {
    const duplicate = await Session.findOne({
      _id: { $ne: session._id },
      schoolId,
      isDeleted: false,
      $or: duplicateConditions,
    }).lean();

    if (duplicate) {
      throw new AppError(
        "Session name or code is already in use",
        409
      );
    }
  }

  if (data.name !== undefined) {
    session.name = data.name.trim();
  }

  if (data.code !== undefined) {
    session.code = data.code.trim().toUpperCase();
  }

  session.startDate = startDate;
  session.endDate = endDate;

  if (data.description !== undefined) {
    session.description = data.description;
  }

  session.updatedBy = userId
    ? new Types.ObjectId(userId)
    : null;

  await session.save();

  return session;
};

// SET ACTIVE SESSION
export const setActiveSessionService = async (
  id: string,
  schoolId: string,
  userId?: string
): Promise<ISession> => {
  const session = await findSessionOrFail(id, schoolId);

  const currentDate = new Date();

  if (
    currentDate < session.startDate ||
    currentDate > session.endDate
  ) {
    throw new AppError(
      "Only a session within its configured date range can be activated",
      400
    );
  }

  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.withTransaction(async () => {
      await Session.updateMany(
        {
          schoolId,
          _id: { $ne: session._id },
          isDeleted: false,
          isActive: true,
        },
        {
          $set: {
            isActive: false,
          },
        },
        {
          session: mongoSession,
        }
      );

      session.isActive = true;
      session.updatedBy = userId
        ? new Types.ObjectId(userId)
        : null;

      await session.save({
        session: mongoSession,
      });
    });
  } finally {
    await mongoSession.endSession();
  }

  return session;
};

// GET ACTIVE SESSION
export const getActiveSessionService = async (
  schoolId: string
): Promise<ISession> => {
  if (!mongoose.isValidObjectId(schoolId)) {
    throw new AppError("Invalid school ID", 400);
  }

  const session = await Session.findOne({
    schoolId,
    isActive: true,
    isClosed: { $ne: true },
    isDeleted: false,
  });

  if (!session) {
    throw new AppError(
      "No active academic session found",
      404
    );
  }

  return session;
};

// DELETE SESSION (SOFT DELETE)
export const deleteSessionService = async (
  id: string,
  schoolId: string,
  userId?: string
): Promise<{
  sessionId: string;
  deletedAt: Date;
}> => {
  const session = await findSessionOrFail(id, schoolId);

  if (session.isActive) {
    throw new AppError(
      "Active academic session cannot be deleted",
      400
    );
  }

  const deletedAt = new Date();

  session.isDeleted = true;
  session.deletedAt = deletedAt;

  session.updatedBy = userId
    ? new Types.ObjectId(userId)
    : null;

  await session.save();

  return {
    sessionId: session._id.toString(),
    deletedAt,
  };
};
