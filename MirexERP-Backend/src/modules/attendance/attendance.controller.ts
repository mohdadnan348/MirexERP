
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";

import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import { getValidatedData } from "../../utils/validate";

import {
  createAttendanceService,
  bulkMarkAttendanceService,
  getAllAttendanceService,
  getAttendanceByIdService,
  updateAttendanceService,
  updateAttendanceStatusService,
  deleteAttendanceService,
  getAttendanceSummaryService,
  getPersonDailyAttendanceService,
  requestAttendanceCorrectionService,
  reviewAttendanceCorrectionService,
  listAttendanceCorrectionsService,
  getAttendanceDefaultersService,
} from "./attendance.service";

import {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AttendanceListQuery,
  BulkAttendanceInput,
  UpdateAttendanceStatusInput,
  AttendanceSummaryQuery,
} from "./attendance.validation";

import {
  AttendanceType,
} from "./attendance.model";

import {
  AttendanceActor,
} from "./attendance.service";

const getActor = (req: Request): AttendanceActor => {
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

const getAttendanceId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid attendance ID is required", 400);
  }

  return id;
};

// Create single attendance.
export const createAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateAttendanceInput>(
      res,
      "body"
    );

    const attendance = await createAttendanceService(
      data,
      actor
    );

    return sendCreated(
      res,
      "Attendance marked successfully",
      attendance
    );
  }
);

// Bulk mark attendance.
export const bulkMarkAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<BulkAttendanceInput>(
      res,
      "body"
    );

    const result = await bulkMarkAttendanceService(
      data,
      actor
    );

    return sendSuccess(
      res,
      "Bulk attendance processed successfully",
      result
    );
  }
);

// Get attendance list.
export const getAllAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<AttendanceListQuery>(
      res,
      "query"
    );

    const result = await getAllAttendanceService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Attendance records fetched successfully",
      result.attendance,
      result.pagination
    );
  }
);

// Get attendance by ID.
export const getAttendanceById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const attendanceId = getAttendanceId(req);

    const attendance = await getAttendanceByIdService(
      attendanceId,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Attendance record fetched successfully",
      attendance
    );
  }
);

// Update attendance record.
export const updateAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const attendanceId = getAttendanceId(req);

    const data = getValidatedData<UpdateAttendanceInput>(
      res,
      "body"
    );

    const attendance = await updateAttendanceService(
      attendanceId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Attendance updated successfully",
      attendance
    );
  }
);

// Update attendance status.
export const updateAttendanceStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const attendanceId = getAttendanceId(req);

    const data =
      getValidatedData<UpdateAttendanceStatusInput>(
        res,
        "body"
      );

    const attendance = await updateAttendanceStatusService(
      attendanceId,
      data.status,
      data.remarks,
      actor
    );

    return sendSuccess(
      res,
      "Attendance status updated successfully",
      attendance
    );
  }
);

// Delete attendance record.
export const deleteAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const attendanceId = getAttendanceId(req);

    await deleteAttendanceService(attendanceId, actor);

    return sendDeleted(
      res,
      "Attendance record deleted successfully"
    );
  }
);

// Get attendance summary.
export const getAttendanceSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query =
      getValidatedData<AttendanceSummaryQuery>(
        res,
        "query"
      );

    const summary = await getAttendanceSummaryService(
      query,
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Attendance summary fetched successfully",
      summary
    );
  }
);

// Get a student's or employee's attendance for a particular date.
export const getPersonDailyAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const personId = req.params.personId;

    if (
      typeof personId !== "string" ||
      !personId.trim()
    ) {
      throw new AppError("Valid person ID is required", 400);
    }

    const attendanceType = req.query.attendanceType;

    if (
      attendanceType !== "STUDENT" &&
      attendanceType !== "EMPLOYEE"
    ) {
      throw new AppError(
        "Attendance type must be STUDENT or EMPLOYEE",
        400
      );
    }

    const dateValue = req.query.date;
    const sessionId = req.query.sessionId;

    if (
      typeof dateValue !== "string" ||
      Number.isNaN(Date.parse(dateValue))
    ) {
      throw new AppError("Valid attendance date is required", 400);
    }

    if (
      typeof sessionId !== "string" ||
      !sessionId.trim()
    ) {
      throw new AppError("Academic session ID is required", 400);
    }

    const attendance = await getPersonDailyAttendanceService(
      personId,
      attendanceType as AttendanceType,
      new Date(dateValue),
      actor.schoolId,
      sessionId
    );

    return sendSuccess(
      res,
      "Daily attendance fetched successfully",
      attendance
    );
  }
);


export const requestAttendanceCorrection = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const id = getAttendanceId(req);
  const body = getValidatedData<{ requestedStatus: import("./attendance.model").AttendanceStatus; reason: string }>(res, "body");
  const result = await requestAttendanceCorrectionService(id, body.requestedStatus, body.reason, actor);
  return sendCreated(res, "Attendance correction submitted for approval", result);
});

export const listAttendanceCorrections = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const decision = req.query.decision;
  const result = await listAttendanceCorrectionsService(actor.schoolId,
    decision === "PENDING" || decision === "APPROVED" || decision === "REJECTED" ? decision : undefined);
  return sendSuccess(res, "Attendance correction requests fetched", result);
});

export const reviewAttendanceCorrection = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const correctionId = req.params.correctionId;
  if (typeof correctionId !== "string" || !correctionId.trim()) throw new AppError("Valid correction ID is required", 400);
  const body = getValidatedData<{ decision: "APPROVED" | "REJECTED"; reviewRemarks?: string }>(res, "body");
  const result = await reviewAttendanceCorrectionService(correctionId, body.decision, body.reviewRemarks, actor);
  return sendSuccess(res, `Attendance correction ${body.decision.toLowerCase()}`, result);
});


export const getAttendanceDefaulters = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const { sessionId, classId, sectionId, startDate, endDate, threshold } = req.query;
  if (typeof sessionId !== "string" || typeof startDate !== "string" || typeof endDate !== "string" ||
      Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
    throw new AppError("sessionId, startDate and endDate are required valid filters", 400);
  }
  const limit = threshold === undefined ? 75 : Number(threshold);
  if (!Number.isFinite(limit) || limit < 0 || limit > 100) throw new AppError("Threshold must be between 0 and 100", 400);
  const result = await getAttendanceDefaultersService({
    sessionId, classId: typeof classId === "string" ? classId : undefined,
    sectionId: typeof sectionId === "string" ? sectionId : undefined,
    startDate: new Date(startDate), endDate: new Date(endDate), threshold: limit,
  }, actor.schoolId);
  return sendSuccess(res, "Attendance defaulters fetched successfully", result);
});
