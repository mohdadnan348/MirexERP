
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  createTransportService,
  getTransportsService,
  getTransportByIdService,
  updateTransportService,
  deleteTransportService,
  assignStudentTransportService,
  removeStudentTransportService,
  getStudentTransportService,
} from "./transport.service";

const getActor = (req: Request) => {
  if (!req.user?.id || !req.user.schoolId) {
    throw new AppError("Authenticated school user not found", 401);
  }

  return {
    userId: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid transport ID is required", 400);
  }

  return id;
};

/**
 * Create transport record
 * POST /api/transport
 */
export const createTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const transport = await createTransportService(
      actor,
      req.body
    );

    return sendCreated(
      res,
      "Transport record created successfully",
      transport
    );
  }
);

/**
 * Get all transport records
 * GET /api/transport
 */
export const getTransports = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const result = await getTransportsService(
      actor.schoolId,
      {
        page,
        limit,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
        routeId:
          typeof req.query.routeId === "string"
            ? req.query.routeId
            : undefined,
      }
    );

    const items = Array.isArray(result)
      ? result
      : result.items;

    const total = Array.isArray(result)
      ? result.length
      : result.total;

    const totalPages = Math.ceil(total / limit);

    return sendPaginatedSuccess(
      res,
      "Transport records fetched successfully",
      items,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    );
  }
);

/**
 * Get transport by ID
 * GET /api/transport/:id
 */
export const getTransportById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const transport = await getTransportByIdService(
      actor.schoolId,
      getId(req)
    );

    return sendSuccess(
      res,
      "Transport record fetched successfully",
      transport
    );
  }
);

/**
 * Update transport
 * PATCH /api/transport/:id
 */
export const updateTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const transport = await updateTransportService(
      actor.schoolId,
      getId(req),
      {
        ...req.body,
        updatedBy: actor.userId,
      }
    );

    return sendSuccess(
      res,
      "Transport record updated successfully",
      transport
    );
  }
);

/**
 * Delete transport
 * DELETE /api/transport/:id
 */
export const deleteTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteTransportService(
      actor.schoolId,
      getId(req)
    );

    return sendDeleted(
      res,
      "Transport record deleted successfully"
    );
  }
);

/**
 * Assign transport to student
 * POST /api/transport/:id/assign
 */
export const assignStudentTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const result = await assignStudentTransportService(
      actor.schoolId,
      getId(req),
      req.body.studentId,
      req.body.stopId,
      actor.userId
    );

    return sendSuccess(
      res,
      "Student transport assigned successfully",
      result
    );
  }
);

/**
 * Remove student transport
 * DELETE /api/transport/:id/assign/:studentId
 */
export const removeStudentTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const studentId = req.params.studentId;

    if (
      typeof studentId !== "string" ||
      !studentId.trim()
    ) {
      throw new AppError("Valid student ID is required", 400);
    }

    await removeStudentTransportService(
      actor.schoolId,
      getId(req),
      studentId
    );

    return sendSuccess(
      res,
      "Student transport assignment removed successfully",
      null
    );
  }
);

/**
 * Get student's transport details
 * GET /api/transport/student/:studentId
 */
export const getStudentTransport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const studentId = req.params.studentId;

    if (
      typeof studentId !== "string" ||
      !studentId.trim()
    ) {
      throw new AppError("Valid student ID is required", 400);
    }

    const transport = await getStudentTransportService(
      actor.schoolId,
      studentId
    );

    return sendSuccess(
      res,
      "Student transport details fetched successfully",
      transport
    );
  }
);
