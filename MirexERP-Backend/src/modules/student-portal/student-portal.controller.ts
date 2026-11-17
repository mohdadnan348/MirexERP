
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  sendSuccess,
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
} from "../../utils/apiResponse";
import { createPaginationMeta } from "../../utils/pagination";

import { getHomeworksService } from "../homework/homework.service";
import {
  createStudentService,
  getStudentsService,
  getStudentByIdService,
  updateStudentService,
  deleteStudentService,
} from "../students/students.service";

interface StudentActor {
  userId: string;
  schoolId: string;
  role: string;
  email?: string;
}

const getActor = (req: Request): StudentActor => {
  const user = req.user;

  if (!user) {
    throw new AppError("Authentication required", 401);
  }

  if (!user.id || !user.schoolId || !user.role) {
    throw new AppError("Invalid user session", 401);
  }

  return {
    userId: String(user.id),
    schoolId: String(user.schoolId),
    role: String(user.role),
    email: user.email,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid student ID is required", 400);
  }

  return id;
};

const getBody = (req: Request): Record<string, unknown> => {
  return req.body as Record<string, unknown>;
};

// CREATE STUDENT
export const createStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const student = await createStudentService(
      getBody(req),
      actor
    );

    return sendCreated(
      res,
      "Student created successfully",
      student
    );
  }
);

// GET ALL STUDENTS
export const getStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const result = await getStudentsService(
      actor,
      req.query as Record<string, unknown>
    );

    const items = Array.isArray(result)
      ? result
      : result.items;

    const total = Array.isArray(result)
      ? result.length
      : result.total;

    const pagination = createPaginationMeta(
      page,
      limit,
      total
    );

    return sendPaginatedSuccess(
      res,
      "Students fetched successfully",
      items,
      pagination
    );
  }
);

// GET STUDENT BY ID
export const getStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const student = await getStudentByIdService(
      getId(req),
      actor
    );

    return sendSuccess(
      res,
      "Student fetched successfully",
      student
    );
  }
);

// UPDATE STUDENT
export const updateStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const student = await updateStudentService(
      getId(req),
      getBody(req),
      actor
    );

    return sendSuccess(
      res,
      "Student updated successfully",
      student
    );
  }
);

// DELETE STUDENT
export const deleteStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteStudentService(
      getId(req),
      actor
    );

    return sendDeleted(
      res,
      "Student deleted successfully"
    );
  }
);

// Student/parent academic homework view delegates to the same tenant-scoped
// Module 11 service used by the Homework API.
export const getPortalHomework = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const result = await getHomeworksService(actor, req.query);
  return sendPaginatedSuccess(res, "Portal homework fetched successfully", result.items, result.pagination);
});
