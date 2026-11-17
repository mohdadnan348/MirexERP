
import { Types } from "mongoose";

import Student from "../students/students.model";
import Attendance from "../attendance/attendance.model";
import Fee from "../fees/fees.model";
import Homework from "../homework/homework.model";
import Exam from "../exams/exams.model";
import Timetable from "../timetable/timetable.model";
import { ExamMark } from "../exams/exam-mark.model";

import { AppError } from "../../utils/AppError";

interface PortalActor {
  userId: string;
  schoolId: string;
  role: string;
  studentId?: string;
}

interface PortalQuery {
  page?: unknown;
  limit?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
  sessionId?: unknown;
  [key: string]: unknown;
}

// STUDENT CONTEXT
const getStudentContext = async (actor: PortalActor) => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Invalid school ID", 400);
  }

  if (!actor.studentId || !Types.ObjectId.isValid(actor.studentId)) {
    throw new AppError(
      "Student profile is not linked to this account",
      403
    );
  }

  const student: any = await Student.findOne({
    _id: actor.studentId,
    schoolId: actor.schoolId,
  }).lean();

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  return {
    student,
    studentId: new Types.ObjectId(actor.studentId),
    schoolId: new Types.ObjectId(actor.schoolId),
  };
};

// DATE FILTER
const getDateFilter = (query: PortalQuery) => {
  const date: Record<string, Date> = {};

  if (query.startDate) {
    const startDate = new Date(String(query.startDate));

    if (Number.isNaN(startDate.getTime())) {
      throw new AppError("Invalid start date", 400);
    }

    date.$gte = startDate;
  }

  if (query.endDate) {
    const endDate = new Date(String(query.endDate));

    if (Number.isNaN(endDate.getTime())) {
      throw new AppError("Invalid end date", 400);
    }

    endDate.setHours(23, 59, 59, 999);
    date.$lte = endDate;
  }

  if (
    date.$gte &&
    date.$lte &&
    date.$gte.getTime() > date.$lte.getTime()
  ) {
    throw new AppError("Start date cannot be after end date", 400);
  }

  return Object.keys(date).length ? date : undefined;
};

// PAGINATION
const getPageOptions = (query: PortalQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

// PAGINATION RESPONSE
const getPaginationResponse = (
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

// STUDENT DASHBOARD
export const getStudentDashboardService = async (
  actor: PortalActor
) => {
  const { student, studentId, schoolId } =
    await getStudentContext(actor);

  const [
    totalAttendance,
    totalHomework,
    pendingHomework,
    totalFees,
    upcomingExams,
    recentAttendance,
  ] = await Promise.all([
    Attendance.countDocuments({
      schoolId,
      studentId,
    }),

    Homework.countDocuments({
      schoolId, academicSessionId: student.sessionId, classId: student.classId,
      isDeleted: false, status: "PUBLISHED",
      $or: [{ sectionIds: { $size: 0 } }, { sectionIds: student.sectionId }, { sectionId: student.sectionId }],
    }),

    Homework.countDocuments({
      schoolId, academicSessionId: student.sessionId, classId: student.classId,
      isDeleted: false, status: "PUBLISHED", dueDate: { $gte: new Date() },
      $or: [{ sectionIds: { $size: 0 } }, { sectionIds: student.sectionId }, { sectionId: student.sectionId }],
    }),

    Fee.find({
      schoolId,
      studentId,
    })
      .select("amount paidAmount dueAmount status dueDate")
      .lean(),

    Exam.find({
      schoolId, sessionId: student.sessionId, classId: student.classId,
      startDate: { $gte: new Date() }, status: { $in: ["SCHEDULED", "ONGOING"] },
    })
      .sort({ examDate: 1 })
      .limit(5)
      .lean(),

    Attendance.find({
      schoolId,
      studentId,
    })
      .sort({ date: -1 })
      .limit(7)
      .lean(),
  ]);

  const totalFeeAmount = totalFees.reduce(
    (sum, fee: any) => sum + Number(fee.amount || 0),
    0
  );

  const totalPaidAmount = totalFees.reduce(
    (sum, fee: any) =>
      sum + Number(fee.paidAmount || 0),
    0
  );

  return {
    student: {
      id: student._id,
      name: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
      admissionNumber: student.admissionNumber,
      classId: student.classId,
      sectionId: student.sectionId,
      profileImage: student.profileImage,
    },

    attendance: {
      totalRecords: totalAttendance,
      recentRecords: recentAttendance,
    },

    homework: {
      total: totalHomework,
      pending: pendingHomework,
    },

    fees: {
      totalAmount: totalFeeAmount,
      paidAmount: totalPaidAmount,
      pendingAmount: Math.max(
        0,
        totalFeeAmount - totalPaidAmount
      ),
    },

    upcomingExams,
  };
};

// STUDENT PROFILE
export const getStudentProfileService = async (
  actor: PortalActor
) => {
  const { student } = await getStudentContext(actor);

  return student;
};

// STUDENT ATTENDANCE
export const getStudentAttendanceService = async (
  actor: PortalActor,
  query: PortalQuery
) => {
  const { studentId, schoolId } = await getStudentContext(actor);

  const { page, limit, skip } = getPageOptions(query);

  const filter: Record<string, unknown> = {
    schoolId,
    studentId,
  };

  const dateFilter = getDateFilter(query);

  if (dateFilter) {
    filter.date = dateFilter;
  }

  if (query.status) {
    filter.status = String(query.status);
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Attendance.countDocuments(filter),
  ]);

  return {
    records,
    pagination: getPaginationResponse(page, limit, total),
  };
};

// STUDENT FEES
export const getStudentFeesService = async (
  actor: PortalActor,
  query: PortalQuery
) => {
  const { studentId, schoolId } = await getStudentContext(actor);

  const { page, limit, skip } = getPageOptions(query);

  const filter: Record<string, unknown> = {
    schoolId,
    studentId,
  };

  if (query.status) {
    filter.status = String(query.status);
  }

  const [fees, total] = await Promise.all([
    Fee.find(filter)
      .sort({ dueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Fee.countDocuments(filter),
  ]);

  return {
    fees,
    pagination: getPaginationResponse(page, limit, total),
  };
};

// STUDENT HOMEWORK
export const getStudentHomeworkService = async (
  actor: PortalActor,
  query: PortalQuery
) => {
  const { student, schoolId } = await getStudentContext(actor);

  const { page, limit, skip } = getPageOptions(query);

  const filter: Record<string, unknown> = {
    schoolId,
    classId: student.classId,
    academicSessionId: student.sessionId,
    isDeleted: false,
    status: "PUBLISHED",
    $or: [
      { sectionIds: { $size: 0 } },
      { sectionIds: student.sectionId },
      { sectionId: student.sectionId },
    ],
  };

  // Student views only published homework; client status filters must never expose drafts.
  if (query.status && String(query.status).toUpperCase() !== "PUBLISHED") {
    throw new AppError("Only published homework is available in the student portal", 400);
  }

  const dateFilter = getDateFilter(query);

  if (dateFilter) {
    filter.dueDate = dateFilter;
  }

  const [homework, total] = await Promise.all([
    Homework.find(filter)
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Homework.countDocuments(filter),
  ]);

  return {
    homework,
    pagination: getPaginationResponse(page, limit, total),
  };
};

// STUDENT EXAM RESULTS
export const getStudentResultsService = async (
  actor: PortalActor,
  query: PortalQuery
) => {
  const { student, studentId, schoolId } = await getStudentContext(actor);
  const { page, limit, skip } = getPageOptions(query);
  const examFilter: Record<string, unknown> = {
    schoolId,
    sessionId: student.sessionId,
    classId: student.classId,
    isPublished: true,
    marksWorkflowStatus: "PUBLISHED",
  };
  if (query.sessionId && String(query.sessionId) !== String(student.sessionId)) {
    throw new AppError("Students can only view results for their linked academic session", 403);
  }
  const [exams, total] = await Promise.all([
    Exam.find(examFilter).sort({ endDate: -1 }).skip(skip).limit(limit).lean(),
    Exam.countDocuments(examFilter),
  ]);
  const examIds = exams.map((exam: any) => exam._id);
  const marks = examIds.length ? await ExamMark.find({
    schoolId, studentId, examId: { $in: examIds },
  }).populate("subjectId", "name code").lean() : [];
  const results = exams.map((exam: any) => ({
    exam,
    marks: marks.filter((mark: any) => String(mark.examId) === String(exam._id)),
  }));
  return { results, pagination: getPaginationResponse(page, limit, total) };
};

// STUDENT TIMETABLE
export const getStudentTimetableService = async (
  actor: PortalActor,
  query: PortalQuery
) => {
  const { student, schoolId } = await getStudentContext(actor);

  const filter: Record<string, unknown> = {
    schoolId,
    classId: student.classId,
    sectionId: student.sectionId,
  };

  if (query.sessionId && String(query.sessionId) !== String(student.sessionId)) {
    throw new AppError("Students can only view their linked academic session timetable", 403);
  }

  const timetable = await Timetable.find({ ...filter, isActive: true })
    .populate("subjectId", "name code")
    .populate("teacherId", "firstName lastName employeeId")
    .sort({ dayOfWeek: 1, periodNumber: 1 })
    .lean();

  return timetable;
};
