
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
  createSectionService,
  getAllSectionsService,
  getSectionByIdService,
  updateSectionService,
  updateSectionStatusService,
  assignSectionTeacherService,
  deleteSectionService,
  getSectionSummaryService,
} from "./sections.service";

import {
  CreateSectionInput,
  UpdateSectionInput,
  SectionListQuery,
  UpdateSectionStatusInput,
  AssignSectionTeacherInput,
} from "./sections.validation";

interface SectionActor {
  userId: string;
  schoolId: string;
}

const getActor = (req: Request): SectionActor => {
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

const getSectionId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid section ID is required", 400);
  }

  return id;
};

// Create section
export const createSection = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateSectionInput>(
      res,
      "body"
    );

    const section = await createSectionService(data, actor);

    return sendCreated(
      res,
      "Section created successfully",
      section
    );
  }
);

// Get all sections
export const getAllSections = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<SectionListQuery>(
      res,
      "query"
    );

    const result = await getAllSectionsService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Sections fetched successfully",
      result.sections,
      result.pagination
    );
  }
);

// Get section summary
export const getSectionSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<SectionListQuery>(
      res,
      "query"
    );

    const summary = await getSectionSummaryService(
      actor.schoolId,
      query.sessionId,
      query.classId
    );

    return sendSuccess(
      res,
      "Section summary fetched successfully",
      summary
    );
  }
);

// Get section by ID
export const getSectionById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const sectionId = getSectionId(req);

    const section = await getSectionByIdService(
      sectionId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Section fetched successfully",
      section
    );
  }
);

// Update section
export const updateSection = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const sectionId = getSectionId(req);

    const data = getValidatedData<UpdateSectionInput>(
      res,
      "body"
    );

    const section = await updateSectionService(
      sectionId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Section updated successfully",
      section
    );
  }
);

// Update section status
export const updateSectionStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const sectionId = getSectionId(req);

    const data = getValidatedData<UpdateSectionStatusInput>(
      res,
      "body"
    );

    const section = await updateSectionStatusService(
      sectionId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Section status updated successfully",
      section
    );
  }
);

// Assign or remove section teacher
export const assignSectionTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const sectionId = getSectionId(req);

    const data = getValidatedData<AssignSectionTeacherInput>(
      res,
      "body"
    );

    const section = await assignSectionTeacherService(
      sectionId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Section teacher assigned successfully",
      section
    );
  }
);

// Soft delete section
export const deleteSection = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const sectionId = getSectionId(req);

    await deleteSectionService(sectionId, actor);

    return sendDeleted(
      res,
      "Section deleted successfully"
    );
  }
);
