
import { Request, Response } from "express";
import {
  createParentService,
  getParentsService,
  getParentByIdService,
  updateParentService,
  deleteParentService,
  getParentStudentsService,
} from "./parents.service";

import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

interface ParentActor {
  userId: string;
  schoolId: string;
  role: string;
}

const getActor = (req: Request): ParentActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return {
    userId: String(req.user._id),
    schoolId: String(req.user.schoolId),
    role: req.user.role,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid parent ID is required", 400);
  }

  return id;
};

// CREATE PARENT
export const createParent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const parent = await createParentService(req.body, actor);

    return sendCreated(res, "Parent created successfully", parent);
  }
);

// GET ALL PARENTS
export const getParents = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const result = await getParentsService(
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
      },
      actor
    );

    const totalPages = Math.ceil(
      result.total / result.limit
    );

    return sendPaginatedSuccess(
      res,
      "Parents fetched successfully",
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      }
    );
  }
);

// GET PARENT BY ID
export const getParentById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const parent = await getParentByIdService(
      getId(req),
      actor
    );

    return sendSuccess(
      res,
      "Parent details fetched successfully",
      parent
    );
  }
);

// UPDATE PARENT
export const updateParent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const parent = await updateParentService(
      getId(req),
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "Parent updated successfully",
      parent
    );
  }
);

// DELETE PARENT
export const deleteParent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteParentService(getId(req), actor);

    return sendDeleted(res, "Parent deleted successfully");
  }
);

// GET STUDENTS LINKED TO PARENT
export const getParentStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const students = await getParentStudentsService(
      getId(req),
      actor
    );

    return sendSuccess(
      res,
      "Parent students fetched successfully",
      students
    );
  }
);