
import { Types } from "mongoose";

import { Student } from "../students/students.model";
import { Employee } from "../employees/employees.model";
import { Attendance } from "../attendance/attendance.model";
import { Fee } from "../fees/fees.model";
import { Exam } from "../exams/exams.model";
import { Finance } from "../finance/finance.model";

import { AppError } from "../../utils/AppError";

interface ReportActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface ReportFilters {
  startDate?: string | Date;
  endDate?: string | Date;
  sessionId?: string;
  classId?: string;
  sectionId?: string;
  month?: number;
  year?: number;
}

const getSchoolId = (actor: ReportActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Valid school ID is required", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getDateRange = (filters: ReportFilters) => {
  const startDate = filters.startDate
    ? new Date(filters.startDate)
    : undefined;

  const endDate = filters.endDate
    ? new Date(filters.endDate)
    : undefined;

  if (
    startDate &&
    Number.isNaN(startDate.getTime())
  ) {
    throw new AppError("Invalid start date", 400);
  }

  if (
    endDate &&
    Number.isNaN(endDate.getTime())
  ) {
    throw new AppError("Invalid end date", 400);
  }

  if (startDate && endDate && startDate > endDate) {
    throw new AppError(
      "Start date cannot be after end date",
      400
    );
  }

  return { startDate, endDate };
};

const getDateFilter = (filters: ReportFilters) => {
  const { startDate, endDate } = getDateRange(filters);

  if (!startDate && !endDate) {
    return {};
  }

  return {
    $gte: startDate ?? new Date("2000-01-01"),
    $lte: endDate ?? new Date(),
  };
};

const getCommonFilter = (
  filters: ReportFilters,
  schoolId: Types.ObjectId
) => {
  const filter: Record<string, any> = { schoolId };

  if (filters.sessionId) {
    if (!Types.ObjectId.isValid(filters.sessionId)) {
      throw new AppError("Invalid session ID", 400);
    }

    filter.sessionId = new Types.ObjectId(filters.sessionId);
  }

  if (filters.classId) {
    if (!Types.ObjectId.isValid(filters.classId)) {
      throw new AppError("Invalid class ID", 400);
    }

    filter.classId = new Types.ObjectId(filters.classId);
  }

  if (filters.sectionId) {
    if (!Types.ObjectId.isValid(filters.sectionId)) {
      throw new AppError("Invalid section ID", 400);
    }

    filter.sectionId = new Types.ObjectId(filters.sectionId);
  }

  return filter;
};

// DASHBOARD REPORT
export const getDashboardReportService = async (
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);

  const [
    totalStudents,
    activeStudents,
    totalEmployees,
    activeEmployees,
    totalAttendance,
    totalFees,
    collectedFees,
    pendingFees,
  ] = await Promise.all([
    Student.countDocuments({ schoolId }),

    Student.countDocuments({
      schoolId,
      status: "ACTIVE",
    }),

    Employee.countDocuments({ schoolId }),

    Employee.countDocuments({
      schoolId,
      isActive: true,
    }),

    Attendance.countDocuments({ schoolId }),

    Fee.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),

    Fee.aggregate([
      {
        $match: {
          schoolId,
          status: "PAID",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),

    Fee.aggregate([
      {
        $match: {
          schoolId,
          status: { $in: ["PENDING", "PARTIAL"] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  return {
    students: {
      total: totalStudents,
      active: activeStudents,
    },
    employees: {
      total: totalEmployees,
      active: activeEmployees,
    },
    attendance: {
      totalRecords: totalAttendance,
    },
    fees: {
      total: totalFees[0]?.total ?? 0,
      collected: collectedFees[0]?.total ?? 0,
      pending: pendingFees[0]?.total ?? 0,
    },
    generatedAt: new Date(),
  };
};

// STUDENT REPORT
export const getStudentReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);
  const match = getCommonFilter(filters, schoolId);

  const [
    totalStudents,
    activeStudents,
    inactiveStudents,
    classWiseStudents,
    genderWiseStudents,
  ] = await Promise.all([
    Student.countDocuments(match),

    Student.countDocuments({
      ...match,
      status: "ACTIVE",
    }),

    Student.countDocuments({
      ...match,
      status: "INACTIVE",
    }),

    Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$classId",
          totalStudents: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "classes",
          localField: "_id",
          foreignField: "_id",
          as: "class",
        },
      },
      {
        $unwind: {
          path: "$class",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          classId: "$_id",
          className: "$class.name",
          totalStudents: 1,
        },
      },
      { $sort: { className: 1 } },
    ]),

    Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$gender",
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    summary: {
      totalStudents,
      activeStudents,
      inactiveStudents,
    },
    classWiseStudents,
    genderWiseStudents,
  };
};

// ATTENDANCE REPORT
export const getAttendanceReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);

  const match: Record<string, any> = {
    ...getCommonFilter(filters, schoolId),
  };

  const dateFilter = getDateFilter(filters);

  if (Object.keys(dateFilter).length) {
    match.date = dateFilter;
  }

  const [summary, dailyReport, statusReport] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0],
            },
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0],
            },
          },
          late: {
            $sum: {
              $cond: [{ $eq: ["$status", "LATE"] }, 1, 0],
            },
          },
          leave: {
            $sum: {
              $cond: [{ $eq: ["$status", "LEAVE"] }, 1, 0],
            },
          },
        },
      },
    ]),

    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$date",
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0],
            },
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          total: { $sum: 1 },
        },
      },
    ]),
  ]);

  const result = summary[0] ?? {
    totalRecords: 0,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  };

  const attendancePercentage =
    result.totalRecords > 0
      ? Number(
          ((result.present / result.totalRecords) * 100).toFixed(2)
        )
      : 0;

  return {
    summary: {
      ...result,
      attendancePercentage,
    },
    dailyReport,
    statusReport,
  };
};

// FEES REPORT
export const getFeesReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);
  const match: Record<string, any> = {
    ...getCommonFilter(filters, schoolId),
  };

  const dateFilter = getDateFilter(filters);

  if (Object.keys(dateFilter).length) {
    match.createdAt = dateFilter;
  }

  const [summary, monthlyReport, statusReport] = await Promise.all([
    Fee.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalRecords: { $sum: 1 },
          paidAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "PAID"] },
                "$amount",
                0,
              ],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["PENDING", "PARTIAL"]] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]),

    Fee.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
          totalRecords: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    Fee.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    summary: summary[0] ?? {
      totalAmount: 0,
      totalRecords: 0,
      paidAmount: 0,
      pendingAmount: 0,
    },
    monthlyReport,
    statusReport,
  };
};

// EMPLOYEE REPORT
export const getEmployeeReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);
  const match = getCommonFilter(filters, schoolId);

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    departmentWiseEmployees,
    designationWiseEmployees,
  ] = await Promise.all([
    Employee.countDocuments(match),

    Employee.countDocuments({
      ...match,
      isActive: true,
    }),

    Employee.countDocuments({
      ...match,
      isActive: false,
    }),

    Employee.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$department",
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    Employee.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$designation",
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
  ]);

  return {
    summary: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
    },
    departmentWiseEmployees,
    designationWiseEmployees,
  };
};

// EXAMINATION REPORT
export const getExamReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);
  const match = getCommonFilter(filters, schoolId);

  const exams = await Exam.find({
    ...match,
    ...(filters.startDate || filters.endDate
      ? { createdAt: getDateFilter(filters) }
      : {}),
  })
    .sort({ createdAt: -1 })
    .lean();

  const totalExams = exams.length;

  return {
    summary: {
      totalExams,
    },
    exams,
    note: "Detailed marks, pass percentage and subject-wise performance require the exam results collection.",
  };
};

// FINANCIAL REPORT
export const getFinancialReportService = async (
  filters: ReportFilters,
  actor: ReportActor
) => {
  const schoolId = getSchoolId(actor);
  const match: Record<string, any> = {
    schoolId,
  };

  const dateFilter = getDateFilter(filters);

  if (Object.keys(dateFilter).length) {
    match.date = dateFilter;
  }

  const [summary, categoryWise, monthlyReport] = await Promise.all([
    Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [
                { $eq: ["$type", "INCOME"] },
                "$amount",
                0,
              ],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [
                { $eq: ["$type", "EXPENSE"] },
                "$amount",
                0,
              ],
            },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ]),

    Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            type: "$type",
            category: "$category",
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          income: {
            $sum: {
              $cond: [
                { $eq: ["$type", "INCOME"] },
                "$amount",
                0,
              ],
            },
          },
          expense: {
            $sum: {
              $cond: [
                { $eq: ["$type", "EXPENSE"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const result = summary[0] ?? {
    totalIncome: 0,
    totalExpense: 0,
    totalTransactions: 0,
  };

  return {
    summary: {
      ...result,
      netBalance: result.totalIncome - result.totalExpense,
    },
    categoryWise,
    monthlyReport,
  };
};
