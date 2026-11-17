
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { getValidatedData } from "../../utils/validate";

import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  createLeaveService,
  getAllLeavesService,
  getLeaveByIdService,
  updateLeaveService,
  reviewLeaveService,
  approveLeaveService,
  rejectLeaveService,
  cancelLeaveService,
  deleteLeaveService,
  getLeaveSummaryService,
  LeaveActor,
} from "./leaves.service";

import {
  CreateLeaveInput,
  UpdateLeaveInput,
  LeaveListQuery,
  ReviewLeaveInput,
  ApproveLeaveInput,
  RejectLeaveInput,
  CancelLeaveInput,
  LeaveSummaryQuery,
} from "./leaves.validation";

// Get authenticated school user.
const getActor = (req: Request): LeaveActor => {
  if (!req.user?.userId || !req.user.schoolId) {
    throw new AppError(
      "Authenticated school user is required",
      401
    );
  }

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
  };
};

// Safely get leave ID from route parameters.
const getLeaveId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid leave ID is required", 400);
  }

  return id;
};

// Create leave application.
export const createLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateLeaveInput>(
      res,
      "body"
    );

    const leave = await createLeaveService(data, actor);

    return sendCreated(
      res,
      "Leave application submitted successfully",
      leave
    );
  }
);

// Get all leave applications.
export const getAllLeaves = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<LeaveListQuery>(
      res,
      "query"
    );

    const result = await getAllLeavesService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Leave applications fetched successfully",
      result.leaves,
      result.pagination
    );
  }
);

// Get leave application by ID.
export const getLeaveById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const leave = await getLeaveByIdService(
      leaveId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Leave application fetched successfully",
      leave
    );
  }
);

// Update pending leave application.
export const updateLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const data = getValidatedData<UpdateLeaveInput>(
      res,
      "body"
    );

    const leave = await updateLeaveService(
      leaveId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Leave application updated successfully",
      leave
    );
  }
);

// Review leave application.
export const reviewLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const data = getValidatedData<ReviewLeaveInput>(
      res,
      "body"
    );

    const leave = await reviewLeaveService(
      leaveId,
      data.reviewRemarks,
      actor
    );

    return sendSuccess(
      res,
      "Leave application reviewed successfully",
      leave
    );
  }
);

// Approve leave application.
export const approveLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const data = getValidatedData<ApproveLeaveInput>(
      res,
      "body"
    );

    const leave = await approveLeaveService(
      leaveId,
      data.reviewRemarks,
      actor
    );

    return sendSuccess(
      res,
      "Leave application approved successfully",
      leave
    );
  }
);

// Reject leave application.
export const rejectLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const data = getValidatedData<RejectLeaveInput>(
      res,
      "body"
    );

    const leave = await rejectLeaveService(
      leaveId,
      data.rejectionReason,
      actor
    );

    return sendSuccess(
      res,
      "Leave application rejected successfully",
      leave
    );
  }
);

// Cancel leave application.
export const cancelLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    const data = getValidatedData<CancelLeaveInput>(
      res,
      "body"
    );

    const leave = await cancelLeaveService(
      leaveId,
      data.cancellationReason,
      actor
    );

    return sendSuccess(
      res,
      "Leave application cancelled successfully",
      leave
    );
  }
);

// Delete leave application.
export const deleteLeave = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const leaveId = getLeaveId(req);

    await deleteLeaveService(leaveId, actor);

    return sendDeleted(
      res,
      "Leave application deleted successfully"
    );
  }
);

// Get leave summary.
export const getLeaveSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<LeaveSummaryQuery>(
      res,
      "query"
    );

    const summary = await getLeaveSummaryService(
      query,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Leave summary fetched successfully",
      summary
    );
  }
);
