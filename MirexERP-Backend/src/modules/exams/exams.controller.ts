
import type { Request, Response } from "express";

import { USER_ROLES } from "../../config/constants";
import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { createPaginationMeta } from "../../utils/pagination";

import {
  createExamService,
  deleteExamService,
  getExamByIdService,
  getExamsService,
  updateExamService,
} from "./exams.service";

const getRouteParam = (req: Request, key: string): string => {
  const value = req.params[key];
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0];
  throw new AppError(`Invalid or missing route parameter: ${key}`, 400);
};

interface ExamActor {
  id: string;
  schoolId: string | null;
  role: string;
}

const getActor = (req: Request): ExamActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    !req.user.schoolId
  ) {
    throw new AppError("School context is required", 400);
  }

  return {
    id: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

export const createExam = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const exam = await createExamService(actor, req.body);

    return sendCreated(res, "Exam created successfully", exam);
  }
);

export const getExams = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId && actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new AppError("School context is required", 400);
    }

    const query = req.query;

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const result = await getExamsService(actor.schoolId, {
      page,
      limit,
      search:
        typeof query.search === "string"
          ? query.search
          : undefined,
      classId:
        typeof query.classId === "string"
          ? query.classId
          : undefined,
      sessionId:
        typeof query.sessionId === "string"
          ? query.sessionId
          : undefined,
      status:
        typeof query.status === "string"
          ? query.status
          : undefined,
    });

    return sendPaginatedSuccess(
      res,
      "Exams fetched successfully",
      result.items,
      createPaginationMeta(
        result.page,
        result.limit,
        result.total
      )
    );
  }
);

export const getExamById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId && actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new AppError("School context is required", 400);
    }

    const exam = await getExamByIdService(
      actor.schoolId,
      getRouteParam(req, "id")
    );

    return sendSuccess(res, "Exam fetched successfully", exam);
  }
);

export const updateExam = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    const exam = await updateExamService(
      actor.schoolId,
      getRouteParam(req, "id"),
      {
        ...req.body,
        updatedBy: actor.id,
      }
    );

    return sendSuccess(res, "Exam updated successfully", exam);
  }
);

export const deleteExam = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    await deleteExamService(actor.schoolId, getRouteParam(req, "id"));

    return sendDeleted(res, "Exam deleted successfully");
  }
);
