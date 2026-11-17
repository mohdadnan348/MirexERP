import mongoose from "mongoose";

import User from "../auth/auth.model";
import School from "../schools/schools.model";
import Subscription from "../subscriptions/subscriptions.model";
import ClassModel from "../classes/classes.model";
import Exam from "../exams/exams.model";
import { Book, BookIssue } from "../library/library.model";
import Transport from "../transport/transport.model";
import { Expense, Income, FinanceTransaction } from "../finance/finance.model";
import Student, { StudentStatus } from "../students/students.model";
import Attendance from "../attendance/attendance.model";
import FeeInvoice, { FeePayment, FeeRefund } from "../fees/fees.model";
import Employee from "../employees/employees.model";
import Admission from "../admissions/admissions.model";

const toDate = (value: unknown, fallback: Date): Date => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const getDateRange = (query: Record<string, unknown>) => {
  const now = new Date();
  const startDate = toDate(query.startDate, new Date(now.getFullYear(), now.getMonth(), 1));
  const endDate = toDate(query.endDate, now);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

export const getDashboardOverviewService = async (schoolId: string) => {
  const [totalStudents, activeStudents, totalEmployees, pendingAdmissions, feeTotals] = await Promise.all([
    Student.countDocuments({ schoolId }),
    Student.countDocuments({ schoolId, status: StudentStatus.ACTIVE }),
    Employee.countDocuments({ schoolId }),
    Admission.countDocuments({ schoolId, status: { $nin: ["APPROVED", "REJECTED", "CANCELLED"] } }),
    FeeInvoice.aggregate([
      { $match: aggregateSchoolFilter(schoolId, { isDeleted: { $ne: true }, status: { $ne: "CANCELLED" } }) },
      { $group: { _id: null, totalAmount: { $sum: "$totalAmount" }, collectedAmount: { $sum: "$paidAmount" }, pendingAmount: { $sum: "$balanceAmount" } } },
    ]),
  ]);

  return {
    totalStudents,
    activeStudents,
    inactiveStudents: totalStudents - activeStudents,
    totalEmployees,
    pendingAdmissions,
    fees: feeTotals[0] ?? { totalAmount: 0, collectedAmount: 0, pendingAmount: 0 },
  };
};

export const getDashboardAttendanceService = async (
  schoolId: string,
  query: Record<string, unknown>
) => {
  const { startDate, endDate } = getDateRange(query);
  const rows = await Attendance.aggregate([
    { $match: aggregateSchoolFilter(schoolId, { attendanceType: "STUDENT", isDeleted: { $ne: true }, attendanceDate: { $gte: startDate, $lte: endDate } }) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const summary: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, HOLIDAY: 0 };
  for (const row of rows) summary[String(row._id)] = row.count;
  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  return { startDate, endDate, total, summary };
};

export const getDashboardFeesService = async (
  schoolId: string,
  query: Record<string, unknown>
) => {
  const { startDate, endDate } = getDateRange(query);
  const [totals] = await FeeInvoice.aggregate([
    { $match: aggregateSchoolFilter(schoolId, { isDeleted: { $ne: true }, issuedAt: { $gte: startDate, $lte: endDate }, status: { $ne: "CANCELLED" } }) },
    { $group: { _id: null, invoiceCount: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, balanceAmount: { $sum: "$balanceAmount" } } },
  ]);
  const byStatus = await FeeInvoice.aggregate([
    { $match: aggregateSchoolFilter(schoolId, { isDeleted: { $ne: true }, issuedAt: { $gte: startDate, $lte: endDate } }) },
    { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
  ]);
  return { startDate, endDate, totals: totals ?? { invoiceCount: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0 }, byStatus };
};

export const getDashboardRecentActivitiesService = async (
  schoolId: string,
  query: Record<string, unknown>
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const fetchLimit = page * limit;
  const [students, admissions, studentCount, admissionCount] = await Promise.all([
    Student.find({ schoolId }).sort({ createdAt: -1 }).limit(fetchLimit).select("firstName lastName admissionNumber createdAt").lean(),
    Admission.find({ schoolId }).sort({ createdAt: -1 }).limit(fetchLimit).select("firstName lastName applicationNumber status createdAt").lean(),
    Student.countDocuments({ schoolId }),
    Admission.countDocuments({ schoolId }),
  ]);
  const activities = [
    ...students.map((item: any) => ({ type: "STUDENT_CREATED", title: "New student added", description: `${item.firstName} ${item.lastName} (${item.admissionNumber})`, createdAt: item.createdAt })),
    ...admissions.map((item: any) => ({ type: "ADMISSION_UPDATED", title: "Admission activity", description: `${item.firstName} ${item.lastName} (${item.applicationNumber}) - ${item.status}`, createdAt: item.createdAt })),
  ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = studentCount + admissionCount;
  const start = (page - 1) * limit;
  return { items: activities.slice(start, start + limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// Role dashboard services. All school queries are scoped by schoolId.
const count = (model: any, filter: Record<string, unknown>) => model.countDocuments(filter);
const moneyTotal = async (model: any, filter: Record<string, unknown>, field = "amount") => {
  const safeFilter = typeof filter.schoolId === "string"
    ? { ...filter, schoolId: schoolObjectId(filter.schoolId) }
    : filter;
  const [row] = await model.aggregate([{ $match: safeFilter }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
  return Number(row?.total || 0);
};
const schoolObjectId = (schoolId: string) => new mongoose.Types.ObjectId(schoolId);
const aggregateSchoolFilter = (schoolId: string, extra: Record<string, unknown> = {}) => ({
  ...extra,
  schoolId: schoolObjectId(schoolId),
});
const schoolFilter = (schoolId: string) => ({ schoolId, isDeleted: { $ne: true } });

export const getSuperAdminOverviewService = async () => {
  const [totalSchools, activeSchools, totalUsers, totalStudents, activeSubscriptions] = await Promise.all([
    count(School, { isDeleted: { $ne: true } }),
    count(School, { isDeleted: { $ne: true }, status: "ACTIVE" }),
    count(User, { isDeleted: { $ne: true } }),
    count(Student, { status: StudentStatus.ACTIVE }),
    count(Subscription, { status: "ACTIVE" }),
  ]);
  return { totalSchools, activeSchools, inactiveSchools: totalSchools - activeSchools, totalUsers, totalStudents, activeSubscriptions };
};
export const getSuperAdminSchoolsStatisticsService = async () => {
  const rows = await School.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  return { byStatus: rows, total: rows.reduce((n: number, r: any) => n + r.count, 0) };
};
export const getSuperAdminRevenueStatisticsService = async () => {
  const [all, activeSubscriptions, trials, byStatus, expiringTrials] = await Promise.all([
    Subscription.aggregate([
      { $match: { paymentStatus: "PAID" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
    Subscription.find({ status: "ACTIVE", paymentStatus: "PAID" })
      .select("amount billingCycle currency")
      .lean(),
    count(Subscription, { status: "TRIAL" }),
    Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    count(Subscription, {
      status: "TRIAL",
      trialEndsAt: { $gte: new Date(), $lte: new Date(Date.now() + 14 * 86400000) },
    }),
  ]);

  // Normalize recurring plans to a monthly equivalent. One-time/non-recurring
  // payments are excluded from MRR by design.
  const monthlyRecurringRevenue = activeSubscriptions.reduce((total: number, item: any) => {
    const amount = Number(item.amount) || 0;
    const cycle = String(item.billingCycle || "").toUpperCase();
    const divisor: Record<string, number> = {
      MONTHLY: 1,
      QUARTERLY: 3,
      HALF_YEARLY: 6,
      YEARLY: 12,
    };
    return total + (divisor[cycle] ? amount / divisor[cycle] : 0);
  }, 0);

  return {
    totalRevenue: all[0]?.totalRevenue || 0,
    activeSubscriptionValue: monthlyRecurringRevenue,
    monthlyRecurringRevenue,
    trialSubscriptions: trials,
    expiringTrials,
    byStatus,
  };
};
export const getSuperAdminRecentActivitiesService = async (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const [schools, users, schoolCount, userCount] = await Promise.all([
    School.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(page * limit).select("name code status createdAt").lean(),
    User.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(page * limit).select("name email role createdAt").lean(),
    School.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ isDeleted: { $ne: true } }),
  ]);
  const items = [...schools.map((x: any) => ({ type: "SCHOOL_CREATED", title: "School registered", description: `${x.name} (${x.code || "N/A"})`, createdAt: x.createdAt })), ...users.map((x: any) => ({ type: "USER_CREATED", title: "User account created", description: `${x.name} - ${x.role}`, createdAt: x.createdAt }))].sort((a: any,b: any) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  return { items: items.slice((page-1)*limit, page*limit), pagination: { page, limit, total: schoolCount + userCount, totalPages: Math.ceil((schoolCount + userCount) / limit) } };
};

export const getPrincipalOverviewService = async (schoolId: string) => {
  const [totalStudents, totalEmployees, totalClasses, attendance] = await Promise.all([
    count(Student, { schoolId }), count(Employee, { schoolId, isDeleted: { $ne: true } }), count(ClassModel, schoolFilter(schoolId)),
    count(Attendance, { schoolId, attendanceType: "STUDENT", isDeleted: { $ne: true }, attendanceDate: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
  ]);
  return { totalStudents, totalTeachers: await count(Employee, { schoolId, employeeType: "TEACHING", isDeleted: { $ne: true } }), totalEmployees, totalClasses, todayAttendanceRecords: attendance };
};
export const getPrincipalAcademicStatisticsService = async (schoolId: string) => {
  const [totalExams, publishedExams, upcomingExams] = await Promise.all([
    count(Exam, { schoolId }), count(Exam, { schoolId, isPublished: true }), count(Exam, { schoolId, startDate: { $gte: new Date() }, status: { $ne: "CANCELLED" } }),
  ]);
  return { totalExams, publishedExams, upcomingExams, results: { note: "Result/pass-rate data is not represented by the current Exam model." } };
};
export const getPrincipalPendingApprovalsService = async (schoolId: string) => {
  const [pendingAdmissions, unpublishedExams] = await Promise.all([
    Admission.countDocuments({ schoolId, isDeleted: { $ne: true }, status: { $in: ["APPLIED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] } }),
    count(Exam, { schoolId, isPublished: false, status: "COMPLETED" }),
  ]);
  return { pendingAdmissions, unpublishedExams, totalPending: pendingAdmissions + unpublishedExams };
};
export const getAccountantOverviewService = async (schoolId: string) => {
  const paymentMatch = { schoolId: schoolObjectId(schoolId), isDeleted: { $ne: true }, paymentStatus: "SUCCESS" };
  const [collectedRows, pending, expenses, income, refunds] = await Promise.all([
    FeePayment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    moneyTotal(FeeInvoice, { schoolId, isDeleted: { $ne: true }, status: { $ne: "CANCELLED" } }, "balanceAmount"),
    moneyTotal(Expense, { schoolId, status: { $ne: "CANCELLED" } }),
    moneyTotal(Income, { schoolId, status: { $ne: "CANCELLED" } }),
    FeeRefund.aggregate([
      { $match: { schoolId: schoolObjectId(schoolId), isDeleted: { $ne: true }, status: "PROCESSED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const collected = Number(collectedRows[0]?.total || 0);
  const refundTotal = Number(refunds[0]?.total || 0);
  return { totalCollection: collected, pendingFees: pending, totalExpenses: expenses, otherIncome: income, refunds: refundTotal, netCashFlow: collected + income - expenses - refundTotal };
};
export const getAccountantCollectionStatisticsService = async (schoolId: string) => {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = new Date(now.getFullYear(), 0, 1);
  const base = { schoolId: schoolObjectId(schoolId), isDeleted: { $ne: true }, paymentStatus: "SUCCESS" };
  const [todayRows, monthlyRows, yearlyRows] = await Promise.all([
    FeePayment.aggregate([{ $match: { ...base, paymentDate: { $gte: day, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    FeePayment.aggregate([{ $match: { ...base, paymentDate: { $gte: month, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    FeePayment.aggregate([{ $match: { ...base, paymentDate: { $gte: year, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  return {
    todayCollection: Number(todayRows[0]?.total || 0),
    monthlyCollection: Number(monthlyRows[0]?.total || 0),
    yearlyCollection: Number(yearlyRows[0]?.total || 0),
  };
};
export const getAccountantRecentTransactionsService = async (schoolId: string, query: Record<string, unknown>) => {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const items = await FinanceTransaction.find({ schoolId }).sort({ transactionDate: -1 }).limit(limit).lean();
  return { items };
};
export const getReceptionistOverviewService = async (schoolId: string) => {
  const [totalApplications, pendingApplications, approvedApplications, totalAdmissions] = await Promise.all([
    count(Admission, { schoolId, isDeleted: { $ne: true } }),
    count(Admission, { schoolId, isDeleted: { $ne: true }, status: { $in: ["APPLIED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] } }),
    count(Admission, { schoolId, isDeleted: { $ne: true }, status: "APPROVED" }),
    count(Student, { schoolId }),
  ]);
  return { totalApplications, pendingApplications, approvedApplications, totalAdmissions };
};
export const getReceptionistPendingApplicationsService = async (schoolId: string, query: Record<string, unknown>) => {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const items = await Admission.find({ schoolId, isDeleted: { $ne: true }, status: { $in: ["APPLIED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] } }).sort({ applicationDate: -1 }).limit(limit).select("applicationNumber firstName lastName phone status applicationDate").lean();
  return { items, total: await Admission.countDocuments({ schoolId, isDeleted: { $ne: true }, status: { $in: ["APPLIED", "UNDER_REVIEW", "DOCUMENTS_PENDING"] } }) };
};
export const getLibrarianOverviewService = async (schoolId: string) => {
  const [totalBooks, issuedBooks, availableBooks, overdueBooks] = await Promise.all([
    count(Book, { schoolId }), count(BookIssue, { schoolId, status: "ISSUED" }), moneyTotal(Book, { schoolId }, "availableQuantity"), count(BookIssue, { schoolId, status: "OVERDUE" }),
  ]);
  return { totalBooks, issuedBooks, availableBooks, overdueBooks };
};
export const getLibrarianOverdueBooksService = async (schoolId: string, query: Record<string, unknown>) => {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const items = await BookIssue.find({ schoolId, $or: [{ status: "OVERDUE" }, { status: "ISSUED", dueDate: { $lt: new Date() } }] }).sort({ dueDate: 1 }).limit(limit).populate("bookId", "title author isbn").lean();
  return { items, total: await BookIssue.countDocuments({ schoolId, $or: [{ status: "OVERDUE" }, { status: "ISSUED", dueDate: { $lt: new Date() } }] }) };
};
export const getTransportOverviewService = async (schoolId: string) => {
  const [totalVehicles, activeVehicles, maintenanceVehicles, routeRows] = await Promise.all([
    count(Transport, { schoolId }), count(Transport, { schoolId, status: "ACTIVE" }), count(Transport, { schoolId, status: "MAINTENANCE" }), Transport.distinct("routeName", { schoolId }),
  ]);
  return { totalVehicles, activeVehicles, maintenanceVehicles, totalRoutes: routeRows.length };
};
export const getTransportStudentStatisticsService = async (schoolId: string) => {
  const [assigned, students] = await Promise.all([
    Transport.aggregate([{ $match: { schoolId: schoolObjectId(schoolId) } }, { $project: { assigned: { $size: { $ifNull: ["$assignedStudents", []] } } } }, { $group: { _id: null, total: { $sum: "$assigned" } } }]),
    count(Student, { schoolId }),
  ]);
  return { assignedTransportStudents: assigned[0]?.total || 0, totalStudents: students, unassignedStudents: Math.max(0, students - (assigned[0]?.total || 0)) };
};
export const getTransportAlertsService = async (schoolId: string) => {
  const now = new Date(), horizon = new Date(now.getTime() + 30 * 86400000);
  const [insurance, fitness, permit, maintenance] = await Promise.all([
    count(Transport, { schoolId, insuranceExpiry: { $lte: horizon } }), count(Transport, { schoolId, fitnessExpiry: { $lte: horizon } }), count(Transport, { schoolId, permitExpiry: { $lte: horizon } }), count(Transport, { schoolId, status: "MAINTENANCE" }),
  ]);
  return { insuranceExpiring: insurance, fitnessExpiring: fitness, permitsExpiring: permit, vehiclesInMaintenance: maintenance, windowDays: 30 };
};
