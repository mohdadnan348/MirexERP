
import { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { getValidatedData } from "../../middleware/validate";

import {
  createClassService,
  getAllClassesService,
  getClassByIdService,
  updateClassService,
  updateClassStatusService,
  assignClassSubjectsService,
  deleteClassService,
  getClassSummaryService,
} from "./classes.service";

import {
  CreateClassInput,
  UpdateClassInput,
  ClassListQuery,
  UpdateClassStatusInput,
  AssignClassSubjectsInput,
} from "./classes.validation";

interface ClassActor {
  userId: string;
  schoolId: string;
}

const getActor = (req: Request): ClassActor => {
  const user = req.user;

  if (!user?.userId || !user.schoolId) {
    throw new AppError("Authenticated school user is required", 401);
  }

  return {
    userId: user.userId,
    schoolId: user.schoolId,
  };
};

const getClassId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid class ID is required", 400);
  }

  return id;
};

export const createClass = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const data = getValidatedData<CreateClassInput>(res, "body");

    const classRecord = await createClassService(data, actor);

    return sendCreated(
      res,
      "Class created successfully",
      classRecord
    );
  }
);

export const getAllClasses = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const query = getValidatedData<ClassListQuery>(res, "query");

    const result = await getAllClassesService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Classes fetched successfully",
      result.classes,
      result.pagination
    );
  }
);

export const getClassById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = getClassId(req);

    const classRecord = await getClassByIdService(
      classId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Class fetched successfully",
      classRecord
    );
  }
);

export const updateClass = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = getClassId(req);
    const data = getValidatedData<UpdateClassInput>(res, "body");

    const classRecord = await updateClassService(
      classId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Class updated successfully",
      classRecord
    );
  }
);

export const updateClassStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = getClassId(req);

    const data = getValidatedData<UpdateClassStatusInput>(
      res,
      "body"
    );

    const classRecord = await updateClassStatusService(
      classId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Class status updated successfully",
      classRecord
    );
  }
);

export const assignClassSubjects = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = getClassId(req);

    const data = getValidatedData<AssignClassSubjectsInput>(
      res,
      "body"
    );

    const classRecord = await assignClassSubjectsService(
      classId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Class subjects assigned successfully",
      classRecord
    );
  }
);

export const deleteClass = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = getClassId(req);

    await deleteClassService(classId, actor);

    return sendDeleted(
      res,
      "Class deleted successfully"
    );
  }
);

export const getClassSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const query = getValidatedData<ClassListQuery>(res, "query");

    const summary = await getClassSummaryService(
      actor.schoolId,
      query.sessionId
    );

    return sendSuccess(
      res,
      "Class summary fetched successfully",
      summary
    );
  }
);
