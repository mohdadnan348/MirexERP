
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";

import { getValidatedData } from "../../middleware/validate";

import {
  createAdmissionService,
  getAllAdmissionsService,
  getAdmissionByIdService,
  updateAdmissionService,
  reviewAdmissionService,
  approveAdmissionService,
  registerApprovedAdmissionService,
  rejectAdmissionService,
  cancelAdmissionService,
  deleteAdmissionService,
  getAdmissionSummaryService,
  addAdmissionFollowUpService,
} from "./admissions.service";

import {
  CreateAdmissionInput,
  UpdateAdmissionInput,
  AdmissionListQuery,
  ReviewAdmissionInput,
  ApproveAdmissionInput,
  RejectAdmissionInput,
  CancelAdmissionInput,
  CreateAdmissionFollowUpInput,
} from "./admissions.validation";

interface AdmissionActor {
  userId: string;
  schoolId: string;
}

const getActor = (req: Request): AdmissionActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
  };
};

// Express 5 params can be string | string[].
const getAdmissionId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid admission ID is required", 400);
  }

  return id;
};

// CREATE ADMISSION
export const createAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateAdmissionInput>(
      res,
      "body"
    );

    const admission = await createAdmissionService(data, actor);

    return sendCreated(
      res,
      "Admission application submitted successfully",
      admission
    );
  }
);

// GET ALL ADMISSIONS
export const getAllAdmissions = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<AdmissionListQuery>(
      res,
      "query"
    );

    const result = await getAllAdmissionsService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Admission applications fetched successfully",
      result.admissions,
      result.pagination
    );
  }
);

// GET ADMISSION BY ID
export const getAdmissionById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const admission = await getAdmissionByIdService(
      getAdmissionId(req),
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Admission application fetched successfully",
      admission
    );
  }
);

// UPDATE ADMISSION
export const updateAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<UpdateAdmissionInput>(
      res,
      "body"
    );

    const admission = await updateAdmissionService(
      getAdmissionId(req),
      data,
      actor
    );

    return sendSuccess(
      res,
      "Admission application updated successfully",
      admission
    );
  }
);

// REVIEW ADMISSION
export const reviewAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<ReviewAdmissionInput>(
      res,
      "body"
    );

    const admission = await reviewAdmissionService(
      getAdmissionId(req),
      data,
      actor
    );

    return sendSuccess(
      res,
      "Admission application moved to review successfully",
      admission
    );
  }
);

// APPROVE ADMISSION AND CREATE STUDENT
export const approveAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<{ remarks?: string }>(res, "body");

    const result = await approveAdmissionService(
      getAdmissionId(req),
      data,
      actor
    );

    return sendSuccess(
      res,
      "Admission approved. Complete registration to create the student record.",
      result
    );
  }
);

// REGISTER AN APPROVED APPLICATION AS A STUDENT
export const registerApprovedAdmission = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const data = getValidatedData<ApproveAdmissionInput>(res, "body");
  const result = await registerApprovedAdmissionService(getAdmissionId(req), data, actor);
  return sendSuccess(res, "Student registered successfully", result);
});

// REJECT ADMISSION
export const rejectAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<RejectAdmissionInput>(
      res,
      "body"
    );

    const admission = await rejectAdmissionService(
      getAdmissionId(req),
      data,
      actor
    );

    return sendSuccess(
      res,
      "Admission application rejected successfully",
      admission
    );
  }
);

// CANCEL ADMISSION
export const cancelAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CancelAdmissionInput>(
      res,
      "body"
    );

    const admission = await cancelAdmissionService(
      getAdmissionId(req),
      data,
      actor
    );

    return sendSuccess(
      res,
      "Admission application cancelled successfully",
      admission
    );
  }
);

// DELETE ADMISSION
export const deleteAdmission = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const result = await deleteAdmissionService(
      getAdmissionId(req),
      actor
    );

    return sendDeleted(res, result.message);
  }
);

// GET ADMISSION SUMMARY
export const getAdmissionSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<AdmissionListQuery>(
      res,
      "query"
    );

    const summary = await getAdmissionSummaryService(
      actor.schoolId,
      query.sessionId
    );

    return sendSuccess(
      res,
      "Admission summary fetched successfully",
      summary
    );
  }
);


export const addAdmissionFollowUp = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const data = getValidatedData<CreateAdmissionFollowUpInput>(res, "body");
    const admission = await addAdmissionFollowUpService(getAdmissionId(req), data, actor);
    return sendSuccess(res, "Admission follow-up added successfully", admission);
  }
);
