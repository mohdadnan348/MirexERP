
import { Types, FilterQuery } from "mongoose";

import Attendance, {
  IAttendanceDocument,
  AttendanceStatus,
  AttendanceType,
} from "./attendance.model";

import Session from "../sessions/sessions.model";
import Student from "../students/students.model";
import Employee from "../employees/employees.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Timetable, { DayOfWeek } from "../timetable/timetable.model";
import Holiday from "../holidays/holidays.model";

import { AppError } from "../../utils/AppError";
import {
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AttendanceListQuery,
  BulkAttendanceInput,
  AttendanceSummaryQuery,
} from "./attendance.validation";

export interface AttendanceActor {
  userId: string;
  schoolId: string;
}

const getObjectId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid ID provided", 400);
  }

  return new Types.ObjectId(id);
};

const getDayRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const normalizeAttendanceDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const assertNotSchoolHoliday = async (date: Date, sessionId: string, schoolId: string, attendanceType: "STUDENT" | "EMPLOYEE"): Promise<void> => {
  const day = normalizeAttendanceDate(date);
  const applicableTo = attendanceType === "STUDENT" ? ["STUDENTS", "BOTH"] : ["EMPLOYEES", "BOTH"];
  const holiday = await Holiday.findOne({
    schoolId: getObjectId(schoolId), sessionId: getObjectId(sessionId),
    isDeleted: false, isActive: true, applicableTo: { $in: applicableTo },
    startDate: { $lte: new Date(day.getTime() + 86399999) }, endDate: { $gte: day },
  }).select("name startDate endDate").lean();
  if (holiday) throw new AppError(`Attendance cannot be marked on school holiday: ${holiday.name}`, 409);
};

const validateActiveSession = async (
  sessionId: string,
  schoolId: string
): Promise<void> => {
  const session = await Session.findOne({
    _id: getObjectId(sessionId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
    isClosed: { $ne: true },
  }).select("_id isActive isClosed");

  if (!session) {
    throw new AppError("Academic session not found", 404);
  }

  if (!session.isActive) {
    throw new AppError(
      "Attendance can only be marked for an active academic session",
      400
    );
  }
};

const validateStudent = async (
  studentId: string,
  schoolId: string,
  sessionId: string
): Promise<void> => {
  const student = await Student.findOne({
    _id: getObjectId(studentId),
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
};

const validateEmployee = async (
  employeeId: string,
  schoolId: string
): Promise<void> => {
  const employee = await Employee.findOne({
    _id: getObjectId(employeeId),
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

const validateClassAndSection = async (
  classId: string,
  sectionId: string,
  schoolId: string,
  sessionId: string
): Promise<void> => {
  const [classRecord, sectionRecord] = await Promise.all([
    Class.findOne({
      _id: getObjectId(classId),
      schoolId: getObjectId(schoolId),
      sessionId: getObjectId(sessionId),
      isDeleted: false,
    }).select("_id"),

    Section.findOne({
      _id: getObjectId(sectionId),
      schoolId: getObjectId(schoolId),
      sessionId: getObjectId(sessionId),
      classId: getObjectId(classId),
      isDeleted: false,
    }).select("_id"),
  ]);

  if (!classRecord) {
    throw new AppError("Class not found", 404);
  }

  if (!sectionRecord) {
    throw new AppError(
      "Section not found in the selected class",
      404
    );
  }
};

const validateAttendanceReferences = async (
  data: CreateAttendanceInput,
  schoolId: string
): Promise<void> => {
  await validateActiveSession(data.sessionId, schoolId);

  if (data.attendanceType === "STUDENT") {
    if (
      !data.studentId ||
      !data.classId ||
      !data.sectionId
    ) {
      throw new AppError(
        "Student, class and section are required",
        400
      );
    }

    await Promise.all([
      validateStudent(data.studentId, schoolId, data.sessionId),
      validateClassAndSection(
        data.classId,
        data.sectionId,
        schoolId,
        data.sessionId
      ),
    ]);
  }

  if (data.attendanceType === "EMPLOYEE") {
    if (!data.employeeId) {
      throw new AppError("Employee ID is required", 400);
    }

    await validateEmployee(data.employeeId, schoolId);
  }
};

const buildAttendanceFilter = (
  query: AttendanceListQuery,
  schoolId: string
): FilterQuery<IAttendanceDocument> => {
  const filter: FilterQuery<IAttendanceDocument> = {
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.attendanceType) {
    filter.attendanceType = query.attendanceType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.employeeId) {
    filter.employeeId = getObjectId(query.employeeId);
  }

  if (query.classId) {
    filter.classId = getObjectId(query.classId);
  }

  if (query.sectionId) {
    filter.sectionId = getObjectId(query.sectionId);
  }

  if (query.startDate || query.endDate) {
    filter.attendanceDate = {};

    if (query.startDate) {
      filter.attendanceDate.$gte = normalizeAttendanceDate(
        query.startDate
      );
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.attendanceDate.$lte = end;
    }
  }

  return filter;
};

const assertNotFutureDate = (date: Date): void => {
  const requested = normalizeAttendanceDate(date).getTime();
  const today = normalizeAttendanceDate(new Date()).getTime();
  if (requested > today) {
    throw new AppError("Future-date attendance marking is not allowed", 400);
  }
};

const assertValidTimetablePeriod = async (
  date: Date,
  periodNumber: number | undefined,
  classId: string | undefined,
  sectionId: string | undefined,
  sessionId: string,
  schoolId: string
): Promise<void> => {
  if (periodNumber === undefined) return;
  if (!classId || !sectionId) {
    throw new AppError("Class and section are required for period-wise attendance", 400);
  }
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const dayOfWeek = dayNames[new Date(date).getDay()] as DayOfWeek;
  const period = await Timetable.findOne({
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(sessionId),
    classId: getObjectId(classId),
    sectionId: getObjectId(sectionId),
    dayOfWeek,
    periodNumber,
    isBreak: false,
    isActive: true,
  }).select("_id");
  if (!period) {
    throw new AppError("Selected period is not a teaching period in the existing timetable", 400);
  }
};

// Create a single attendance record.
export const createAttendanceService = async (
  data: CreateAttendanceInput,
  actor: AttendanceActor
) => {
  await validateAttendanceReferences(data, actor.schoolId);
  assertNotFutureDate(data.attendanceDate);
  await assertNotSchoolHoliday(data.attendanceDate, data.sessionId, actor.schoolId, data.attendanceType);
  await assertValidTimetablePeriod(data.attendanceDate, data.periodNumber, data.classId, data.sectionId, data.sessionId, actor.schoolId);

  const attendanceDate = normalizeAttendanceDate(
    data.attendanceDate
  );

  const duplicateFilter: FilterQuery<IAttendanceDocument> = {
    schoolId: getObjectId(actor.schoolId),
    sessionId: getObjectId(data.sessionId),
    attendanceType: data.attendanceType,
    attendanceDate,
    periodNumber: data.periodNumber ?? null,
    isDeleted: false,
  };

  if (data.attendanceType === "STUDENT" && data.studentId) {
    duplicateFilter.studentId = getObjectId(data.studentId);
  }

  if (data.attendanceType === "EMPLOYEE" && data.employeeId) {
    duplicateFilter.employeeId = getObjectId(data.employeeId);
  }

  const existing = await Attendance.findOne(duplicateFilter).select("_id");

  if (existing) {
    throw new AppError(
      "Attendance has already been marked for this date",
      409
    );
  }

  try {
    const attendance = await Attendance.create({
      ...data,
      schoolId: getObjectId(actor.schoolId),
      sessionId: getObjectId(data.sessionId),
      attendanceDate,
      periodNumber: data.periodNumber ?? null,
      studentId: data.studentId
        ? getObjectId(data.studentId)
        : null,
      employeeId: data.employeeId
        ? getObjectId(data.employeeId)
        : null,
      classId: data.classId
        ? getObjectId(data.classId)
        : null,
      sectionId: data.sectionId
        ? getObjectId(data.sectionId)
        : null,
      markedBy: getObjectId(actor.userId),
    });

    return attendance;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        "Attendance has already been marked for this date",
        409
      );
    }

    throw error;
  }
};

// Mark attendance for multiple students or employees.
export const bulkMarkAttendanceService = async (
  data: BulkAttendanceInput,
  actor: AttendanceActor
) => {
  await validateActiveSession(data.sessionId, actor.schoolId);
  assertNotFutureDate(data.attendanceDate);
  await assertNotSchoolHoliday(data.attendanceDate, data.sessionId, actor.schoolId, data.attendanceType);
  await assertValidTimetablePeriod(data.attendanceDate, data.periodNumber, data.classId, data.sectionId, data.sessionId, actor.schoolId);

  if (data.attendanceType === "STUDENT") {
    if (!data.classId || !data.sectionId) {
      throw new AppError(
        "Class and section are required for student attendance",
        400
      );
    }

    await validateClassAndSection(
      data.classId,
      data.sectionId,
      actor.schoolId,
      data.sessionId
    );

    const studentIds = data.records.map(
      (record) => record.studentId as string
    );

    const validStudents = await Student.countDocuments({
      _id: { $in: studentIds.map(getObjectId) },
      schoolId: getObjectId(actor.schoolId),
      sessionId: getObjectId(data.sessionId),
      classId: getObjectId(data.classId),
      sectionId: getObjectId(data.sectionId),
      isDeleted: false,
    });

    if (validStudents !== studentIds.length) {
      throw new AppError(
        "One or more students do not belong to the selected class and section",
        400
      );
    }
  }

  if (data.attendanceType === "EMPLOYEE") {
    const employeeIds = data.records.map(
      (record) => record.employeeId as string
    );

    const validEmployees = await Employee.countDocuments({
      _id: { $in: employeeIds.map(getObjectId) },
      schoolId: getObjectId(actor.schoolId),
      isDeleted: false,
    });

    if (validEmployees !== employeeIds.length) {
      throw new AppError(
        "One or more employees were not found in this school",
        400
      );
    }
  }

  const attendanceDate = normalizeAttendanceDate(
    data.attendanceDate
  );
  await assertNotSchoolHoliday(attendanceDate, data.sessionId, actor.schoolId, data.attendanceType);

  // A teacher may bulk-mark a new register, but must not overwrite a
  // previously submitted register; changes go through correction approval.
  const existingIdentityFilters = data.records.map((record) =>
    data.attendanceType === "STUDENT"
      ? { studentId: getObjectId(record.studentId as string) }
      : { employeeId: getObjectId(record.employeeId as string) }
  );
  const alreadyMarked = await Attendance.findOne({
    schoolId: getObjectId(actor.schoolId),
    sessionId: getObjectId(data.sessionId),
    attendanceType: data.attendanceType,
    attendanceDate,
    periodNumber: data.periodNumber ?? null,
    isDeleted: false,
    $or: existingIdentityFilters,
  }).select("_id");
  if (alreadyMarked) {
    throw new AppError("Attendance already exists for at least one selected person. Submit a correction request instead of overwriting it.", 409);
  }

  const operations = data.records.map((record) => {
    const identityFilter =
      data.attendanceType === "STUDENT"
        ? { studentId: getObjectId(record.studentId as string) }
        : { employeeId: getObjectId(record.employeeId as string) };

    return {
      updateOne: {
        filter: {
          schoolId: getObjectId(actor.schoolId),
          sessionId: getObjectId(data.sessionId),
          attendanceType: data.attendanceType,
          attendanceDate,
          periodNumber: data.periodNumber ?? null,
          isDeleted: false,
          ...identityFilter,
        },
        update: {
          $set: {
            status: record.status,
            checkInTime: record.checkInTime ?? null,
            checkOutTime: record.checkOutTime ?? null,
            remarks: record.remarks ?? "",
            classId: data.classId
              ? getObjectId(data.classId)
              : null,
            sectionId: data.sectionId
              ? getObjectId(data.sectionId)
              : null,
            updatedBy: getObjectId(actor.userId),
          },
          $setOnInsert: {
            schoolId: getObjectId(actor.schoolId),
            sessionId: getObjectId(data.sessionId),
            attendanceType: data.attendanceType,
            attendanceDate,
            periodNumber: data.periodNumber ?? null,
            markedBy: getObjectId(actor.userId),
            isDeleted: false,
          },
        },
        upsert: true,
      },
    };
  });

  const result = await Attendance.bulkWrite(operations, {
    ordered: false,
  });

  return {
    totalRecords: data.records.length,
    created: result.upsertedCount,
    updated: result.modifiedCount,
    matched: result.matchedCount,
    attendanceDate,
  };
};

// Get all attendance records with filters and pagination.
export const getAllAttendanceService = async (
  query: AttendanceListQuery,
  schoolId: string
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit) || 10)
  );

  const filter = buildAttendanceFilter(query, schoolId);

  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const sort: Record<string, 1 | -1> = {
    [query.sortBy]: sortOrder,
  };

  const [attendance, total] = await Promise.all([
    Attendance.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .populate("employeeId", "firstName lastName employeeId")
      .populate("classId", "name code")
      .populate("sectionId", "name code")
      .populate("markedBy", "name email")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Attendance.countDocuments(filter),
  ]);

  return {
    attendance,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// Get attendance by ID.
export const getAttendanceByIdService = async (
  attendanceId: string,
  schoolId: string
) => {
  const attendance = await Attendance.findOne({
    _id: getObjectId(attendanceId),
    schoolId: getObjectId(schoolId),
    isDeleted: false,
  })
    .populate("studentId", "firstName lastName admissionNumber")
    .populate("employeeId", "firstName lastName employeeId")
    .populate("classId", "name code")
    .populate("sectionId", "name code")
    .populate("markedBy", "name email")
    .populate("updatedBy", "name email");

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  return attendance;
};

// Update an attendance record.
export const updateAttendanceService = async (
  attendanceId: string,
  data: UpdateAttendanceInput,
  actor: AttendanceActor
) => {
  const attendance = await Attendance.findOne({
    _id: getObjectId(attendanceId),
    schoolId: getObjectId(actor.schoolId),
    isDeleted: false,
  });

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  if (
    data.status &&
    ["ABSENT", "LEAVE", "HOLIDAY"].includes(data.status)
  ) {
    attendance.checkInTime = null;
    attendance.checkOutTime = null;
  }

  Object.assign(attendance, data);
  attendance.updatedBy = getObjectId(actor.userId);

  await attendance.save();

  return attendance;
};

// Update attendance status only.
export const updateAttendanceStatusService = async (
  attendanceId: string,
  status: AttendanceStatus,
  remarks: string | undefined,
  actor: AttendanceActor
) => {
  const attendance = await Attendance.findOne({
    _id: getObjectId(attendanceId),
    schoolId: getObjectId(actor.schoolId),
    isDeleted: false,
  });

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  attendance.status = status;

  if (remarks !== undefined) {
    attendance.remarks = remarks;
  }

  if (["ABSENT", "LEAVE", "HOLIDAY"].includes(status)) {
    attendance.checkInTime = null;
    attendance.checkOutTime = null;
    attendance.lateByMinutes = 0;
    attendance.earlyDepartureMinutes = 0;
  }

  attendance.updatedBy = getObjectId(actor.userId);

  await attendance.save();

  return attendance;
};

// Soft delete attendance record.
export const deleteAttendanceService = async (
  attendanceId: string,
  actor: AttendanceActor
) => {
  const attendance = await Attendance.findOne({
    _id: getObjectId(attendanceId),
    schoolId: getObjectId(actor.schoolId),
    isDeleted: false,
  });

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  attendance.isDeleted = true;
  attendance.deletedAt = new Date();
  attendance.updatedBy = getObjectId(actor.userId);

  await attendance.save();

  return {
    id: attendance._id,
    deleted: true,
  };
};

// Get attendance summary grouped by status.
export const getAttendanceSummaryService = async (
  query: AttendanceSummaryQuery,
  schoolId: string
) => {
  const filter: FilterQuery<IAttendanceDocument> = {
    schoolId: getObjectId(schoolId),
    isDeleted: false,
    attendanceType: query.attendanceType,
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.classId) {
    filter.classId = getObjectId(query.classId);
  }

  if (query.sectionId) {
    filter.sectionId = getObjectId(query.sectionId);
  }

  if (query.startDate || query.endDate) {
    filter.attendanceDate = {};

    if (query.startDate) {
      filter.attendanceDate.$gte = normalizeAttendanceDate(
        query.startDate
      );
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.attendanceDate.$lte = end;
    }
  }

  const [statusCounts, totalRecords, uniquePeople] =
    await Promise.all([
      Attendance.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      Attendance.countDocuments(filter),

      Attendance.distinct(
        query.attendanceType === "STUDENT"
          ? "studentId"
          : "employeeId",
        filter
      ),
    ]);

  const summary: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    HALF_DAY: 0,
    LEAVE: 0,
    HOLIDAY: 0,
  };

  statusCounts.forEach(
    (item: { _id: AttendanceStatus; count: number }) => {
      summary[item._id] = item.count;
    }
  );

  const workingRecords =
    totalRecords - summary.HOLIDAY;

  const presentRecords =
    summary.PRESENT + summary.LATE + (summary.HALF_DAY * 0.5);

  const attendancePercentage =
    workingRecords > 0
      ? Number(((presentRecords / workingRecords) * 100).toFixed(2))
      : 0;

  return {
    attendanceType: query.attendanceType,
    totalRecords,
    totalPeople: uniquePeople.length,
    summary,
    presentRecords,
    workingRecords,
    attendancePercentage,
  };
};

// Get attendance for a particular person on a particular date.
export const getPersonDailyAttendanceService = async (
  personId: string,
  attendanceType: AttendanceType,
  date: Date,
  schoolId: string,
  sessionId: string
) => {
  const { start, end } = getDayRange(date);

  const identityFilter =
    attendanceType === "STUDENT"
      ? { studentId: getObjectId(personId) }
      : { employeeId: getObjectId(personId) };

  const attendance = await Attendance.findOne({
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(sessionId),
    attendanceType,
    attendanceDate: {
      $gte: start,
      $lte: end,
    },
    isDeleted: false,
    ...identityFilter,
  });

  return attendance;
};


import AttendanceCorrection from "./attendance-correction.model";

export const requestAttendanceCorrectionService = async (
  attendanceId: string,
  requestedStatus: AttendanceStatus,
  reason: string,
  actor: AttendanceActor
) => {
  const attendance = await Attendance.findOne({
    _id: getObjectId(attendanceId),
    schoolId: getObjectId(actor.schoolId),
    isDeleted: false,
  });
  if (!attendance) throw new AppError("Attendance record not found", 404);
  const pending = await AttendanceCorrection.findOne({
    schoolId: getObjectId(actor.schoolId),
    attendanceId: attendance._id,
    decision: "PENDING",
  }).select("_id");
  if (pending) throw new AppError("A correction request is already pending", 409);
  return AttendanceCorrection.create({
    schoolId: getObjectId(actor.schoolId),
    attendanceId: attendance._id,
    sessionId: attendance.sessionId,
    previousStatus: attendance.status,
    requestedStatus,
    reason,
    requestedBy: getObjectId(actor.userId),
    decision: "PENDING",
  });
};

export const reviewAttendanceCorrectionService = async (
  correctionId: string,
  decision: "APPROVED" | "REJECTED",
  reviewRemarks: string | undefined,
  actor: AttendanceActor
) => {
  const correction = await AttendanceCorrection.findOne({
    _id: getObjectId(correctionId),
    schoolId: getObjectId(actor.schoolId),
    decision: "PENDING",
  });
  if (!correction) throw new AppError("Pending attendance correction not found", 404);
  const attendance = await Attendance.findOne({
    _id: correction.attendanceId,
    schoolId: getObjectId(actor.schoolId),
    isDeleted: false,
  });
  if (!attendance) throw new AppError("Attendance record no longer exists", 404);
  correction.decision = decision;
  correction.reviewedBy = getObjectId(actor.userId);
  correction.reviewedAt = new Date();
  correction.reviewRemarks = reviewRemarks;
  if (decision === "APPROVED") {
    attendance.correctionHistory = attendance.correctionHistory || [];
    attendance.correctionHistory.push({
      previousStatus: attendance.status,
      requestedStatus: correction.requestedStatus,
      reason: correction.reason,
      requestedBy: correction.requestedBy,
      reviewedBy: getObjectId(actor.userId),
      reviewedAt: new Date(),
      decision: "APPROVED",
      createdAt: correction.createdAt,
    });
    attendance.status = correction.requestedStatus;
    if (["ABSENT", "LEAVE", "HOLIDAY"].includes(correction.requestedStatus)) {
      attendance.checkInTime = null;
      attendance.checkOutTime = null;
      attendance.lateByMinutes = 0;
      attendance.earlyDepartureMinutes = 0;
    }
    attendance.updatedBy = getObjectId(actor.userId);
    await attendance.save();
  } else {
    attendance.correctionHistory = attendance.correctionHistory || [];
    attendance.correctionHistory.push({
      previousStatus: attendance.status,
      requestedStatus: correction.requestedStatus,
      reason: correction.reason,
      requestedBy: correction.requestedBy,
      reviewedBy: getObjectId(actor.userId),
      reviewedAt: new Date(),
      decision: "REJECTED",
      createdAt: correction.createdAt,
    });
    await attendance.save();
  }
  await correction.save();
  return correction;
};

export const listAttendanceCorrectionsService = async (
  schoolId: string,
  decision?: "PENDING" | "APPROVED" | "REJECTED"
) => AttendanceCorrection.find({
  schoolId: getObjectId(schoolId),
  ...(decision ? { decision } : {}),
}).populate({
  path: "attendanceId",
  populate: [
    { path: "studentId", select: "firstName lastName admissionNumber" },
    { path: "employeeId", select: "firstName lastName employeeId" },
  ],
}).populate("requestedBy", "name email").populate("reviewedBy", "name email").sort({ createdAt: -1 }).limit(200);


export const getAttendanceDefaultersService = async (
  params: { sessionId: string; classId?: string; sectionId?: string; startDate: Date; endDate: Date; threshold?: number },
  schoolId: string
) => {
  const filter: FilterQuery<IAttendanceDocument> = {
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(params.sessionId),
    attendanceType: "STUDENT",
    isDeleted: false,
    attendanceDate: { $gte: normalizeAttendanceDate(params.startDate), $lte: new Date(new Date(params.endDate).setHours(23, 59, 59, 999)) },
  };
  if (params.classId) filter.classId = getObjectId(params.classId);
  if (params.sectionId) filter.sectionId = getObjectId(params.sectionId);
  const records = await Attendance.find(filter).select("studentId attendanceDate status").lean();
  const workingDates = new Set(records.filter((r) => r.status !== "HOLIDAY").map((r) => new Date(r.attendanceDate).toISOString().slice(0, 10)));
  const workingDays = workingDates.size;
  if (!workingDays) return { workingDays: 0, threshold: params.threshold ?? 75, defaulters: [] };
  const stats = new Map<string, { present: number; absent: number; late: number; halfDay: number; leave: number }>();
  for (const row of records) {
    if (!row.studentId || row.status === "HOLIDAY") continue;
    const id = String(row.studentId);
    const item = stats.get(id) || { present: 0, absent: 0, late: 0, halfDay: 0, leave: 0 };
    if (row.status === "PRESENT") item.present += 1;
    if (row.status === "ABSENT") item.absent += 1;
    if (row.status === "LATE") item.late += 1;
    if (row.status === "HALF_DAY") item.halfDay += 1;
    if (row.status === "LEAVE") item.leave += 1;
    stats.set(id, item);
  }
  const studentIds = Array.from(stats.keys()).map(getObjectId);
  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId: getObjectId(schoolId),
    sessionId: getObjectId(params.sessionId),
    isDeleted: false,
  }).select("firstName lastName admissionNumber classId sectionId").lean();
  const threshold = params.threshold ?? 75;
  const defaulters = students.map((student: any) => {
    const item = stats.get(String(student._id)) || { present: 0, absent: 0, late: 0, halfDay: 0, leave: 0 };
    const attendedUnits = item.present + item.late + (item.halfDay * 0.5);
    return {
      studentId: student._id,
      studentName: [student.firstName, student.lastName].filter(Boolean).join(" "),
      admissionNumber: student.admissionNumber,
      presentDays: item.present,
      lateDays: item.late,
      halfDays: item.halfDay,
      absentDays: item.absent,
      leaveDays: item.leave,
      workingDays,
      attendancePercentage: Number(((attendedUnits / workingDays) * 100).toFixed(2)),
    };
  }).filter((row) => row.attendancePercentage < threshold)
    .sort((a, b) => a.attendancePercentage - b.attendancePercentage);
  return { workingDays, threshold, defaulters };
};
