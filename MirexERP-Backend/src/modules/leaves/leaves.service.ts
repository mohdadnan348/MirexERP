
import { FilterQuery, Types } from "mongoose";

import Leave, {
  ILeaveDocument,
  LeaveStatus,
} from "./leaves.model";

import Session from "../sessions/sessions.model";
import Student from "../students/students.model";
import Employee from "../employees/employees.model";
import LeavePolicy from "./leave-policy.model";

import { AppError } from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateLeaveInput,
  UpdateLeaveInput,
  LeaveListQuery,
  LeaveSummaryQuery,
} from "./leaves.validation";

export interface LeaveActor {
  userId: string;
  schoolId: string;
}

const getObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid ID provided", 400);
  }

  return new Types.ObjectId(id);
};

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getInclusiveLeaveDays = (
  startDate: Date,
  endDate: Date
): number => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  return (
    Math.floor(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
};

const getWorkingLeaveDays = (startDate: Date, endDate: Date): number => {
  let total = 0;
  for (const day = normalizeDate(startDate); day <= normalizeDate(endDate); day.setDate(day.getDate() + 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) total++;
  }
  return total;
};

const validateDateRange = (
  startDate: Date,
  endDate: Date
): void => {
  if (normalizeDate(endDate) < normalizeDate(startDate)) {
    throw new AppError(
      "Leave end date cannot be before start date",
      400
    );
  }
};

const validateActiveSession = async (
  sessionId: string,
  schoolId: string
): Promise<void> => {
  const session = await Session.findOne({
    _id: getObjectId(sessionId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  }).select("_id isActive");

  if (!session) {
    throw new AppError("Academic session not found", 404);
  }

  if (!session.isActive) {
    throw new AppError(
      "Leave application requires an active academic session",
      400
    );
  }
};

const validateApplicant = async (
  applicantType: "STUDENT" | "EMPLOYEE",
  applicantId: string,
  schoolId: string,
  sessionId: string
): Promise<void> => {
  if (applicantType === "STUDENT") {
    const student = await Student.findOne({
      _id: getObjectId(applicantId),
      schoolId: getObjectId(schoolId),
      sessionId: getObjectId(sessionId),
      isDeleted: false,
    }).select("_id");

    if (!student) {
      throw new AppError(
        "Student not found in this school and academic session",
        404
      );
    }

    return;
  }

  const employee = await Employee.findOne({
    _id: getObjectId(applicantId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  }).select("_id");

  if (!employee) {
    throw new AppError(
      "Employee not found in this school",
      404
    );
  }
};

const getApplicantId = (
  leave: {
    studentId?: Types.ObjectId | null;
    employeeId?: Types.ObjectId | null;
  }
): Types.ObjectId => {
  const applicantId = leave.studentId || leave.employeeId;

  if (!applicantId) {
    throw new AppError("Leave applicant not found", 400);
  }

  return applicantId;
};

const checkOverlappingLeave = async (
  applicantType: "STUDENT" | "EMPLOYEE",
  applicantId: string,
  startDate: Date,
  endDate: Date,
  schoolId: string,
  sessionId: string,
  excludeLeaveId?: string
): Promise<void> => {
  const applicantFilter =
    applicantType === "STUDENT"
      ? { studentId: getObjectId(applicantId) }
      : { employeeId: getObjectId(applicantId) };

  const filter: FilterQuery<ILeaveDocument> = {
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(sessionId),
    applicantType,
    ...applicantFilter,
    status: { $in: ["PENDING", "APPROVED"] },
    isDeleted: false,
    startDate: { $lte: normalizeDate(endDate) },
    endDate: {
      $gte: normalizeDate(startDate),
    },
  };

  if (excludeLeaveId) {
    filter._id = {
      $ne: getObjectId(excludeLeaveId),
    };
  }

  const overlappingLeave = await Leave.findOne(filter).select("_id");

  if (overlappingLeave) {
    throw new AppError(
      "An overlapping pending or approved leave already exists",
      409
    );
  }
};

const getLeaveById = async (
  leaveId: string,
  schoolId: string
): Promise<ILeaveDocument> => {
  const leave = await Leave.findOne({
    _id: getObjectId(leaveId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  });

  if (!leave) {
    throw new AppError("Leave application not found", 404);
  }

  return leave;
};

// Create leave application.
export const createLeaveService = async (
  data: CreateLeaveInput,
  actor: LeaveActor
) => {
  await validateActiveSession(data.sessionId, actor.schoolId);

  validateDateRange(data.startDate, data.endDate);

  const applicantId =
    data.applicantType === "STUDENT"
      ? data.studentId
      : data.employeeId;

  if (!applicantId) {
    throw new AppError("Leave applicant ID is required", 400);
  }

  await validateApplicant(
    data.applicantType,
    applicantId,
    actor.schoolId,
    data.sessionId
  );

  await checkOverlappingLeave(
    data.applicantType,
    applicantId,
    data.startDate,
    data.endDate,
    actor.schoolId,
    data.sessionId
  );

  const leave = await Leave.create({
    schoolId: getObjectId(actor.schoolId),
    sessionId: getObjectId(data.sessionId),

    applicantType: data.applicantType,

    studentId:
      data.applicantType === "STUDENT"
        ? getObjectId(applicantId)
        : null,

    employeeId:
      data.applicantType === "EMPLOYEE"
        ? getObjectId(applicantId)
        : null,

    leaveType: data.leaveType,

    startDate: normalizeDate(data.startDate),
    endDate: normalizeDate(data.endDate),

    totalDays: getInclusiveLeaveDays(
      data.startDate,
      data.endDate
    ),

    reason: data.reason,
    supportingDocument: data.supportingDocument ?? null,

    status: "PENDING",
    appliedAt: new Date(),

    createdBy: getObjectId(actor.userId),
  });

  return leave;
};

// Get all leave applications.
export const getAllLeavesService = async (
  query: LeaveListQuery,
  schoolId: string
) => {
  const { page, limit } = getPagination({
    page: query.page,
    limit: query.limit,
  });

  const filter: FilterQuery<ILeaveDocument> = {
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.applicantType) {
    filter.applicantType = query.applicantType;
  }

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.employeeId) {
    filter.employeeId = getObjectId(query.employeeId);
  }

  if (query.leaveType) {
    filter.leaveType = query.leaveType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.startDate || query.endDate) {
    filter.startDate = {};
    filter.endDate = {};

    if (query.startDate) {
      filter.endDate.$gte = normalizeDate(query.startDate);
    }

    if (query.endDate) {
      filter.startDate.$lte = normalizeDate(query.endDate);
    }
  }

  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const sort: Record<string, 1 | -1> = {
    [query.sortBy]: sortOrder,
  };

  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .populate(
        "studentId",
        "firstName lastName admissionNumber"
      )
      .populate(
        "employeeId",
        "firstName lastName employeeId designation"
      )
      .populate("reviewedBy", "name email")
      .populate("createdBy", "name email")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Leave.countDocuments(filter),
  ]);

  return {
    leaves,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// Get leave application by ID.
export const getLeaveByIdService = async (
  leaveId: string,
  schoolId: string
) => {
  const leave = await Leave.findOne({
    _id: getObjectId(leaveId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  })
    .populate(
      "studentId",
      "firstName lastName admissionNumber classId sectionId"
    )
    .populate(
      "employeeId",
      "firstName lastName employeeId designation department"
    )
    .populate("reviewedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!leave) {
    throw new AppError("Leave application not found", 404);
  }

  return leave;
};

// Update pending leave application.
export const updateLeaveService = async (
  leaveId: string,
  data: UpdateLeaveInput,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (leave.status !== "PENDING") {
    throw new AppError(
      "Only pending leave applications can be updated",
      400
    );
  }

  const startDate = data.startDate ?? leave.startDate;
  const endDate = data.endDate ?? leave.endDate;

  validateDateRange(startDate, endDate);

  await checkOverlappingLeave(
    leave.applicantType,
    getApplicantId(leave).toString(),
    startDate,
    endDate,
    actor.schoolId,
    leave.sessionId.toString(),
    leaveId
  );

  if (data.leaveType !== undefined) {
    leave.leaveType = data.leaveType;
  }

  if (data.startDate !== undefined) {
    leave.startDate = normalizeDate(data.startDate);
  }

  if (data.endDate !== undefined) {
    leave.endDate = normalizeDate(data.endDate);
  }

  if (data.reason !== undefined) {
    leave.reason = data.reason;
  }

  if (data.supportingDocument !== undefined) {
    leave.supportingDocument = data.supportingDocument;
  }

  leave.totalDays = getInclusiveLeaveDays(
    startDate,
    endDate
  );

  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return leave;
};

// Review leave application.
export const reviewLeaveService = async (
  leaveId: string,
  reviewRemarks: string | undefined,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (leave.status !== "PENDING") {
    throw new AppError(
      "Only pending leave applications can be reviewed",
      400
    );
  }

  leave.reviewRemarks = reviewRemarks;
  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return leave;
};

// Approve leave application.
export const approveLeaveService = async (
  leaveId: string,
  reviewRemarks: string | undefined,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (leave.status !== "PENDING") {
    throw new AppError(
      "Only pending leave applications can be approved",
      400
    );
  }

  leave.status = "APPROVED";
  leave.reviewedBy = getObjectId(actor.userId);
  leave.reviewedAt = new Date();
  leave.reviewRemarks = reviewRemarks;

  if (leave.applicantType === "EMPLOYEE") {
    const policy = await LeavePolicy.findOne({
      schoolId: leave.schoolId, sessionId: leave.sessionId, leaveType: leave.leaveType, status: "ACTIVE",
    }).lean();
    if (policy?.isPaid) {
      const previous = await Leave.find({
        _id: { $ne: leave._id }, schoolId: leave.schoolId, sessionId: leave.sessionId,
        employeeId: leave.employeeId, applicantType: "EMPLOYEE", leaveType: leave.leaveType,
        status: "APPROVED", isDeleted: false,
      }).select("startDate endDate").lean();
      const used = (previous as any[]).reduce((sum, item) => sum + getWorkingLeaveDays(item.startDate, item.endDate), 0);
      const requested = getWorkingLeaveDays(leave.startDate, leave.endDate);
      if (used + requested > policy.annualEntitlement) {
        throw new AppError(`Insufficient ${leave.leaveType.toLowerCase()} leave balance`, 409);
      }
    }
  }

  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return leave;
};

// Reject leave application.
export const rejectLeaveService = async (
  leaveId: string,
  rejectionReason: string,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (leave.status !== "PENDING") {
    throw new AppError(
      "Only pending leave applications can be rejected",
      400
    );
  }

  leave.status = "REJECTED";
  leave.rejectionReason = rejectionReason;
  leave.reviewedBy = getObjectId(actor.userId);
  leave.reviewedAt = new Date();

  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return leave;
};

// Cancel leave application.
export const cancelLeaveService = async (
  leaveId: string,
  cancellationReason: string | undefined,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (
    leave.status !== "PENDING" &&
    leave.status !== "APPROVED"
  ) {
    throw new AppError(
      "This leave application cannot be cancelled",
      400
    );
  }

  leave.status = "CANCELLED";
  leave.cancelledAt = new Date();
  leave.cancellationReason = cancellationReason;

  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return leave;
};

// Delete leave application (soft delete).
export const deleteLeaveService = async (
  leaveId: string,
  actor: LeaveActor
) => {
  const leave = await getLeaveById(
    leaveId,
    actor.schoolId
  );

  if (leave.status === "APPROVED") {
    throw new AppError(
      "Approved leave applications cannot be deleted",
      400
    );
  }

  leave.isDeleted = true;
  leave.deletedAt = new Date();
  leave.updatedBy = getObjectId(actor.userId);

  await leave.save();

  return {
    id: leave._id,
    deleted: true,
  };
};

// Get leave summary.
export const getLeaveSummaryService = async (
  query: LeaveSummaryQuery,
  schoolId: string
) => {
  const filter: FilterQuery<ILeaveDocument> = {
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.applicantType) {
    filter.applicantType = query.applicantType;
  }

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.employeeId) {
    filter.employeeId = getObjectId(query.employeeId);
  }

  if (query.leaveType) {
    filter.leaveType = query.leaveType;
  }

  if (query.startDate || query.endDate) {
    filter.startDate = {};
    filter.endDate = {};

    if (query.startDate) {
      filter.endDate.$gte = normalizeDate(query.startDate);
    }

    if (query.endDate) {
      filter.startDate.$lte = normalizeDate(query.endDate);
    }
  }

  const [statusCounts, totalApplications, leaveDays] =
    await Promise.all([
      Leave.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      Leave.countDocuments(filter),

      Leave.aggregate([
        {
          $match: {
            ...filter,
            status: "APPROVED",
          },
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: "$totalDays" },
          },
        },
      ]),
    ]);

  const summary: Record<LeaveStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  };

  statusCounts.forEach(
    (item: { _id: LeaveStatus; count: number }) => {
      summary[item._id] = item.count;
    }
  );

  return {
    totalApplications,
    summary,
    totalApprovedLeaveDays: leaveDays[0]?.totalDays ?? 0,
  };
};
