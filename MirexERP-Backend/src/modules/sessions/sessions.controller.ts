
import { Request, Response } from "express";
import mongoose from "mongoose";

import Session from "./sessions.model";
import { createAcademicSession, updateAcademicSession, activateAcademicSession } from "./sessions-advanced.service";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Student from "../students/students.model";
import StudentEnrollment from "../class-section/student-enrollment.model";
import { FeeStructure } from "../fees/fees.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";

import {
  sendCreated,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";

import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import { getValidatedData } from "../../middleware/validate";

interface SessionBody {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  description?: string;
  isActive?: boolean;
}

interface SessionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface SessionUpdateBody {
  name?: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

// CREATE ACADEMIC SESSION
export const createSession = asyncHandler(
  async (req: Request, res: Response) => {
    const input = getValidatedData<SessionBody>(res, "body");
    const schoolId = req.user?.schoolId;
    const userId = req.user?.userId;
    if (!schoolId || !userId) throw new AppError("Authenticated school user is required", 401);
    const result = await createAcademicSession(input, {
      userId, schoolId, role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_"),
    });
    return sendCreated(res, "Academic session created successfully", result);
  }
);

// GET ALL ACADEMIC SESSIONS
export const getAllSessions = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      throw new AppError("School context is required", 400);
    }

    const query = getValidatedData<SessionListQuery>(
      res,
      "query"
    );

    const { page, limit, skip } = getPagination({
      page: query.page,
      limit: query.limit,
    });

    const filter: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      isDeleted: false,
    };

    if (query.status === "ACTIVE") filter.isActive = true;
    else if (query.status === "INACTIVE") filter.isActive = false;
    else if (query.status === "CLOSED") filter.isClosed = true;
    else if (query.status === "DRAFT" || query.status === "UPCOMING") filter.status = query.status;

    if (query.search?.trim()) {
      const search = query.search.trim();

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

    const pagination = createPaginationMeta(
      page,
      limit,
      total
    );

    return sendPaginatedSuccess(
      res,
      "Academic sessions fetched successfully",
      sessions,
      pagination
    );
  }
);

// GET SESSION BY ID
export const getSessionById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid session ID", 400);
    }

    if (!schoolId) {
      throw new AppError("School context is required", 400);
    }

    const session = await Session.findOne({
      _id: id,
      schoolId,
      isDeleted: false,
    }).lean();

    if (!session) {
      throw new AppError("Academic session not found", 404);
    }

    return sendSuccess(
      res,
      "Academic session fetched successfully",
      session
    );
  }
);

// UPDATE ACADEMIC SESSION
export const updateSession = asyncHandler(
  async (req: Request, res: Response) => {
    const input = getValidatedData<SessionUpdateBody>(res, "body");
    const schoolId = req.user?.schoolId;
    const userId = req.user?.userId;
    if (!schoolId || !userId) throw new AppError("Authenticated school user is required", 401);
    const result = await updateAcademicSession(req.params.id, input, {
      userId, schoolId, role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_"),
    });
    return sendSuccess(res, "Academic session updated successfully", result);
  }
);

// SET ACTIVE ACADEMIC SESSION
export const setActiveSession = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.userId;
    if (!schoolId || !userId) throw new AppError("Authenticated school user is required", 401);
    const result = await activateAcademicSession(req.params.id, String(req.body?.confirmation || ""), {
      userId, schoolId, role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_"),
    });
    return sendSuccess(res, "Active academic session updated successfully", result);
  }
);

// GET CURRENT ACTIVE SESSION
export const getActiveSession = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      throw new AppError("School context is required", 400);
    }

    const session = await Session.findOne({
      schoolId,
      isActive: true,
      isClosed: { $ne: true },
      isDeleted: false,
    }).lean();

    if (!session) {
      throw new AppError(
        "No active academic session found",
        404
      );
    }

    return sendSuccess(
      res,
      "Active academic session fetched successfully",
      session
    );
  }
);

// SOFT DELETE ACADEMIC SESSION
export const deleteSession = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid session ID", 400);
    }

    if (!schoolId) {
      throw new AppError("School context is required", 400);
    }

    const session = await Session.findOne({
      _id: id,
      schoolId,
      isDeleted: false,
    });

    if (!session) {
      throw new AppError("Academic session not found", 404);
    }

    if (session.isActive || session.isClosed) {
      throw new AppError("Active or closed academic sessions cannot be deleted", 400);
    }
    const [classCount, sectionCount, studentCount, enrollmentCount, feeCount] = await Promise.all([
      Class.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }),
      Section.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }),
      Student.countDocuments({ schoolId, sessionId: session._id, isDeleted: { $ne: true } }),
      StudentEnrollment.countDocuments({ schoolId, sessionId: session._id }),
      FeeStructure.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }),
    ]);
    if (classCount || sectionCount || studentCount || enrollmentCount || feeCount) {
      throw new AppError("This session contains academic or fee history and cannot be deleted. Close it to preserve its records.", 409);
    }

    session.isDeleted = true;
    session.deletedAt = new Date();

    session.updatedBy = req.user?.userId
      ? new mongoose.Types.ObjectId(req.user.userId)
      : null;

    await session.save();

    return sendSuccess(
      res,
      "Academic session deleted successfully",
      {
        sessionId: session._id,
        deletedAt: session.deletedAt,
      }
    );
  }
);
