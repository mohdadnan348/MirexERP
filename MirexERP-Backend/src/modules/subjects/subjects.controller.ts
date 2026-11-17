
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
  createSubjectService,
  getAllSubjectsService,
  getSubjectByIdService,
  updateSubjectService,
  updateSubjectStatusService,
  updateSubjectTypeService,
  deleteSubjectService,
  getSubjectSummaryService,
} from "./subjects.service";

import {
  CreateSubjectInput,
  UpdateSubjectInput,
  SubjectListQuery,
  UpdateSubjectStatusInput,
  UpdateSubjectTypeInput,
} from "./subjects.validation";

interface SubjectActor {
  userId: string;
  schoolId: string;
}

const getActor = (req: Request): SubjectActor => {
  const user = req.user;

  if (!user?.userId || !user.schoolId) {
    throw new AppError(
      "Authenticated school user is required",
      401
    );
  }

  return {
    userId: user.userId,
    schoolId: user.schoolId,
  };
};

const getSubjectId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid subject ID is required", 400);
  }

  return id;
};

// Create subject
export const createSubject = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateSubjectInput>(
      res,
      "body"
    );

    const subject = await createSubjectService(
      data,
      actor
    );

    return sendCreated(
      res,
      "Subject created successfully",
      subject
    );
  }
);

// Get all subjects
export const getAllSubjects = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<SubjectListQuery>(
      res,
      "query"
    );

    const result = await getAllSubjectsService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Subjects fetched successfully",
      result.subjects,
      result.pagination
    );
  }
);

// Get subject by ID
export const getSubjectById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const subjectId = getSubjectId(req);

    const subject = await getSubjectByIdService(
      subjectId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Subject fetched successfully",
      subject
    );
  }
);

// Update subject
export const updateSubject = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const subjectId = getSubjectId(req);

    const data = getValidatedData<UpdateSubjectInput>(
      res,
      "body"
    );

    const subject = await updateSubjectService(
      subjectId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Subject updated successfully",
      subject
    );
  }
);

// Update subject status
export const updateSubjectStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const subjectId = getSubjectId(req);

    const data = getValidatedData<UpdateSubjectStatusInput>(
      res,
      "body"
    );

    const subject = await updateSubjectStatusService(
      subjectId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Subject status updated successfully",
      subject
    );
  }
);

// Update subject type
export const updateSubjectType = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const subjectId = getSubjectId(req);

    const data = getValidatedData<UpdateSubjectTypeInput>(
      res,
      "body"
    );

    const subject = await updateSubjectTypeService(
      subjectId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Subject type updated successfully",
      subject
    );
  }
);

// Delete subject
export const deleteSubject = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const subjectId = getSubjectId(req);

    await deleteSubjectService(subjectId, actor);

    return sendDeleted(
      res,
      "Subject deleted successfully"
    );
  }
);

// Get subject summary
export const getSubjectSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const summary = await getSubjectSummaryService(
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Subject summary fetched successfully",
      summary
    );
  }
);
