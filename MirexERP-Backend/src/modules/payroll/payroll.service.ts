
import mongoose, { Types } from "mongoose";
import { Payroll, PayrollStatus } from "./payroll.model";
import { Employee } from "../employees/employees.model";
import { AppError } from "../../utils/AppError";
import { postPayrollToFinance } from "../finance/fee-posting.service";
import { FinanceTransaction } from "../finance/finance.model";
import Attendance from "../attendance/attendance.model";
import Leave from "../leaves/leaves.model";
import SalaryStructure from "./salary-structure.model";
import Holiday from "../holidays/holidays.model";
import LeavePolicy from "../leaves/leave-policy.model";

interface PayrollActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface PayrollQuery {
  page?: number;
  limit?: number;
  search?: string;
  month?: string;
  year?: number;
  status?: string;
  employeeId?: string;
}

interface HistoryQuery {
  page?: number;
  limit?: number;
}

const getSchoolId = (actor: PayrollActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Valid school ID is required", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getUserId = (actor: PayrollActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Valid user ID is required", 400);
  }

  return new Types.ObjectId(actor.userId);
};

const getObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }

  return new Types.ObjectId(id);
};

const getPagination = (page?: number, limit?: number) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.min(100, Math.max(1, Number(limit) || 10));

  return {
    page: currentPage,
    limit: currentLimit,
    skip: (currentPage - 1) * currentLimit,
  };
};

const getAmount = (value: unknown): number => {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Salary amounts must be valid non-negative numbers", 400);
  }

  return Math.round(amount * 100) / 100;
};

const calculateSalary = (
  basicSalary: number,
  allowances: Record<string, unknown> = {},
  deductions: Record<string, unknown> = {}
) => {
  const normalizedAllowances = {
    houseRent: getAmount(allowances.houseRent),
    transport: getAmount(allowances.transport),
    medical: getAmount(allowances.medical),
    special: getAmount(allowances.special),
    other: getAmount(allowances.other),
    total: 0,
  };

  normalizedAllowances.total = Object.entries(normalizedAllowances)
    .filter(([key]) => key !== "total")
    .reduce((sum, [, value]) => sum + value, 0);

  const normalizedDeductions = {
    providentFund: getAmount(deductions.providentFund),
    esi: getAmount(deductions.esi),
    professionalTax: getAmount(deductions.professionalTax),
    incomeTax: getAmount(deductions.incomeTax),
    insurance: getAmount(deductions.insurance),
    leaveDeduction: getAmount(deductions.leaveDeduction),
    other: getAmount(deductions.other),
    total: 0,
  };

  normalizedDeductions.total = Object.entries(normalizedDeductions)
    .filter(([key]) => key !== "total")
    .reduce((sum, [, value]) => sum + value, 0);

  const grossSalary =
    Math.round((basicSalary + normalizedAllowances.total) * 100) / 100;

  const netSalary =
    Math.round((grossSalary - normalizedDeductions.total) * 100) / 100;

  if (netSalary < 0) {
    throw new AppError(
      "Total deductions cannot exceed gross salary",
      400
    );
  }

  return {
    allowances: normalizedAllowances,
    deductions: normalizedDeductions,
    grossSalary,
    netSalary,
  };
};

const validateAttendance = (data: Record<string, any>) => {
  const fields = [
    "workingDays",
    "presentDays",
    "absentDays",
    "paidLeaveDays",
    "unpaidLeaveDays",
    "halfDayDays",
    "lateDays",
  ];

  const attendance: Record<string, number> = {};

  for (const field of fields) {
    const value = Number(data[field] ?? 0);

    if (!Number.isInteger(value) || value < 0) {
      throw new AppError(`${field} must be a non-negative integer`, 400);
    }

    attendance[field] = value;
  }

  const totalDays =
    attendance.presentDays +
    attendance.absentDays +
    attendance.paidLeaveDays +
    attendance.unpaidLeaveDays +
    (attendance.halfDayDays || 0) * 0.5;

  if (totalDays > attendance.workingDays) {
    throw new AppError(
      "Attendance and leave days cannot exceed working days",
      400
    );
  }

  return attendance;
};

const verifyEmployee = async (
  employeeId: string,
  schoolId: Types.ObjectId,
  allowExited = false
) => {
  const employeeObjectId = getObjectId(employeeId, "employee ID");

  const employee = await Employee.findOne({
    _id: employeeObjectId,
    schoolId,
    ...(allowExited ? {} : { isActive: true }),
  });

  if (!employee) {
    throw new AppError(
      "Employee not found or inactive in this school",
      404
    );
  }

  return employee;
};

// CREATE PAYROLL
export const createPayrollService = async (
  data: Record<string, any>,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);

  const employee = await verifyEmployee(data.employeeId, schoolId, Boolean(data.allowExited));

  const payrollMonth = Number(data.payrollMonth);
  const payrollYear = Number(data.payrollYear);

  if (
    !Number.isInteger(payrollMonth) ||
    payrollMonth < 1 ||
    payrollMonth > 12
  ) {
    throw new AppError("Payroll month must be between 1 and 12", 400);
  }

  if (
    !Number.isInteger(payrollYear) ||
    payrollYear < 2000 ||
    payrollYear > 2100
  ) {
    throw new AppError("Invalid payroll year", 400);
  }

  const existingPayroll = await Payroll.findOne({
    schoolId,
    employeeId: employee._id,
    payrollMonth,
    payrollYear,
  });

  if (existingPayroll) {
    throw new AppError(
      "Payroll already exists for this employee and month",
      409
    );
  }

  const basicSalary = getAmount(data.basicSalary);

  const salary = calculateSalary(
    basicSalary,
    data.allowances,
    data.deductions
  );

  const attendance = validateAttendance(data);

  const payroll = await Payroll.create({
    schoolId,
    employeeId: employee._id,
    payrollMonth,
    payrollYear,
    basicSalary,
    ...salary,
    ...attendance,
    paymentStatus: PayrollStatus.DRAFT,
    remarks: data.remarks,
    generatedBy: getUserId(actor),
  });

  return payroll;
};

// GET ALL PAYROLL RECORDS
export const getPayrollsService = async (
  query: PayrollQuery,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(
    query.page,
    query.limit
  );

  const filter: Record<string, any> = {
    schoolId,
    isActive: true,
  };

  if (query.month) {
    const month = Number(query.month);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new AppError("Invalid payroll month", 400);
    }

    filter.payrollMonth = month;
  }

  if (query.year !== undefined) {
    filter.payrollYear = Number(query.year);
  }

  if (query.status) {
    filter.paymentStatus = query.status;
  }

  if (query.employeeId) {
    filter.employeeId = getObjectId(
      query.employeeId,
      "employee ID"
    );
  }

  if (query.search?.trim()) {
    const search = query.search.trim();

    const employees = await Employee.find({
      schoolId,
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    filter.employeeId = {
      $in: employees.map((employee) => employee._id),
    };
  }

  const [items, total] = await Promise.all([
    Payroll.find(filter)
      .populate("employeeId")
      .populate("generatedBy", "name email")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email")
      .sort({ payrollYear: -1, payrollMonth: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Payroll.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// GET PAYROLL BY ID
export const getPayrollByIdService = async (
  id: string,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const payrollId = getObjectId(id, "payroll ID");

  const payroll = await Payroll.findOne({
    _id: payrollId,
    schoolId,
    isActive: true,
  })
    .populate("employeeId")
    .populate("generatedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("paidBy", "name email");

  if (!payroll) {
    throw new AppError("Payroll record not found", 404);
  }

  return payroll;
};

// UPDATE PAYROLL
export const updatePayrollService = async (
  id: string,
  data: Record<string, any>,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const payrollId = getObjectId(id, "payroll ID");

  const payroll = await Payroll.findOne({
    _id: payrollId,
    schoolId,
    isActive: true,
  });

  if (!payroll) {
    throw new AppError("Payroll record not found", 404);
  }

  if (
    [PayrollStatus.FINALIZED, PayrollStatus.PAID, PayrollStatus.CANCELLED].includes(payroll.paymentStatus)
  ) {
    throw new AppError(
      "Paid or cancelled payroll cannot be updated",
      400
    );
  }

  const allowedFields = [
    "basicSalary",
    "allowances",
    "deductions",
    "remarks",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      (payroll as any)[field] = data[field];
    }
  }

  const salary = calculateSalary(
    getAmount(payroll.basicSalary),
    payroll.allowances,
    payroll.deductions
  );

  payroll.allowances = salary.allowances;
  payroll.deductions = salary.deductions;
  payroll.grossSalary = salary.grossSalary;
  payroll.netSalary = salary.netSalary;

  if (
    data.workingDays !== undefined || data.presentDays !== undefined || data.absentDays !== undefined ||
    data.paidLeaveDays !== undefined || data.unpaidLeaveDays !== undefined || data.halfDayDays !== undefined || data.lateDays !== undefined
  ) {
    const attendance = validateAttendance({
      workingDays: data.workingDays ?? payroll.workingDays,
      presentDays: data.presentDays ?? payroll.presentDays,
      absentDays: data.absentDays ?? payroll.absentDays,
      paidLeaveDays: data.paidLeaveDays ?? payroll.paidLeaveDays,
      unpaidLeaveDays: data.unpaidLeaveDays ?? payroll.unpaidLeaveDays,
      halfDayDays: data.halfDayDays ?? payroll.halfDayDays ?? 0,
      lateDays: data.lateDays ?? payroll.lateDays ?? 0,
    });

    Object.assign(payroll, attendance);
  }

  await payroll.save();

  return payroll;
};

// DELETE PAYROLL (SOFT DELETE)
export const deletePayrollService = async (
  id: string,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const payrollId = getObjectId(id, "payroll ID");

  const payroll = await Payroll.findOne({
    _id: payrollId,
    schoolId,
    isActive: true,
  });

  if (!payroll) {
    throw new AppError("Payroll record not found", 404);
  }

  if ([PayrollStatus.FINALIZED, PayrollStatus.PAID].includes(payroll.paymentStatus)) {
    throw new AppError(
      "Finalized or paid payroll records cannot be deleted",
      400
    );
  }

  payroll.isActive = false;
  await payroll.save();

  return payroll;
};

// GET EMPLOYEE PAYROLL HISTORY
export const getEmployeePayrollHistoryService = async (
  employeeId: string,
  query: HistoryQuery,
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const employeeObjectId = getObjectId(employeeId, "employee ID");

  await verifyEmployee(employeeId, schoolId);

  const { page, limit, skip } = getPagination(
    query.page,
    query.limit
  );

  const filter = {
    schoolId,
    employeeId: employeeObjectId,
    isActive: true,
  };

  const [items, total] = await Promise.all([
    Payroll.find(filter)
      .sort({ payrollYear: -1, payrollMonth: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Payroll.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};


// PHASE 6 — payroll approval and payment lifecycle.
export const approvePayrollService = async (id: string, actor: PayrollActor) => {
  const schoolId = getSchoolId(actor);
  const payroll = await Payroll.findOne({ _id: getObjectId(id, "payroll ID"), schoolId, isActive: true });
  if (!payroll) throw new AppError("Payroll record not found", 404);
  if (![PayrollStatus.DRAFT, PayrollStatus.GENERATED].includes(payroll.paymentStatus)) {
    throw new AppError("Only draft or generated payroll can be approved", 409);
  }
  payroll.paymentStatus = PayrollStatus.APPROVED;
  payroll.approvedBy = getUserId(actor);
  payroll.approvedAt = new Date();
  await payroll.save();
  return payroll;
};

export const finalizePayrollService = async (id: string, actor: PayrollActor) => {
  const schoolId = getSchoolId(actor);
  const payroll = await Payroll.findOne({ _id: getObjectId(id, "payroll ID"), schoolId, isActive: true });
  if (!payroll) throw new AppError("Payroll record not found", 404);
  if (payroll.paymentStatus !== PayrollStatus.APPROVED) throw new AppError("Only approved payroll can be finalized", 409);
  payroll.paymentStatus = PayrollStatus.FINALIZED;
  payroll.finalizedBy = getUserId(actor);
  payroll.finalizedAt = new Date();
  await payroll.save();
  return payroll;
};

export const markPayrollPaidService = async (
  id: string,
  data: { paymentMethod: string; paymentDate?: string; transactionReference?: string },
  actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  const session = await mongoose.startSession();
  try {
    let result: unknown = null;
    await session.withTransaction(async () => {
      const payroll = await Payroll.findOne({ _id: getObjectId(id, "payroll ID"), schoolId, isActive: true }).session(session);
      if (!payroll) throw new AppError("Payroll record not found", 404);
      if (payroll.paymentStatus === PayrollStatus.PAID) {
        const existing = await FinanceTransaction.findOne({ schoolId, sourceModel: "Payroll", sourceId: payroll._id }).session(session);
        if (!existing) await postPayrollToFinance({ ...payroll.toObject(), paymentDate: payroll.paymentDate || payroll.paidAt || new Date(), paidBy: payroll.paidBy || getUserId(actor) }, session);
        result = payroll;
        return;
      }
      if (payroll.paymentStatus !== PayrollStatus.FINALIZED) throw new AppError("Payroll must be finalized before payment", 409);
      const allowedMethods = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"];
      if (!allowedMethods.includes(data.paymentMethod)) throw new AppError("Invalid payroll payment method", 400);
      const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
      if (Number.isNaN(paymentDate.getTime())) throw new AppError("Invalid payroll payment date", 400);
      payroll.paymentStatus = PayrollStatus.PAID;
      payroll.paymentMethod = data.paymentMethod as any;
      payroll.paymentDate = paymentDate;
      payroll.transactionReference = data.transactionReference?.trim();
      payroll.paidBy = getUserId(actor);
      payroll.paidAt = new Date();
      await payroll.save({ session });
      await postPayrollToFinance(payroll, session);
      result = payroll;
    });
    return result;
  } finally { await session.endSession(); }
};

export const generateMonthlyPayrollService = async (
  month: number, year: number, actor: PayrollActor
) => {
  const schoolId = getSchoolId(actor);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Valid payroll month and year are required", 400);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const employees: any[] = await Employee.find({
    schoolId, joiningDate: { $lte: periodEnd },
    $or: [
      { isActive: true, status: { $in: ["ACTIVE", "ON_LEAVE"] } },
      { status: "RESIGNED", resignationDate: { $gte: periodStart, $lte: periodEnd } },
    ],
  }).lean() as any[];
  const created: unknown[] = [], skipped: Array<{ employeeId: string; reason: string }> = [];
  for (const employee of employees) {
    const existing = await Payroll.exists({ schoolId, employeeId: employee._id, payrollMonth: month, payrollYear: year });
    if (existing) { skipped.push({ employeeId: String(employee._id), reason: "Payroll already exists" }); continue; }
    const employedStart = new Date(Math.max(periodStart.getTime(), new Date(employee.joiningDate || periodStart).getTime()));
    const employedEnd = new Date(Math.min(periodEnd.getTime(), employee.resignationDate ? new Date(employee.resignationDate).getTime() : periodEnd.getTime()));
    if (employedEnd < employedStart) { skipped.push({ employeeId: String(employee._id), reason: "Employee was not employed during this payroll month" }); continue; }
    const structure = await SalaryStructure.findOne({
      schoolId, employeeId: employee._id, status: "ACTIVE", effectiveFrom: { $lte: periodEnd },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: periodStart } }],
    }).sort({ effectiveFrom: -1 }).lean();
    const basic = Number(structure?.basicSalary ?? employee.salary?.basic ?? 0);
    if (!Number.isFinite(basic) || basic <= 0) { skipped.push({ employeeId: String(employee._id), reason: "No active salary structure or basic salary" }); continue; }
    const attendanceRows = await Attendance.find({
      schoolId, employeeId: employee._id, attendanceType: "EMPLOYEE", isDeleted: false,
      attendanceDate: { $gte: periodStart, $lte: periodEnd },
    }).select("attendanceDate status sessionId").lean();
    const holidays = await Holiday.find({
      schoolId, applicableTo: { $in: ["EMPLOYEES", "BOTH"] }, isActive: true, isDeleted: false,
      startDate: { $lte: periodEnd }, endDate: { $gte: periodStart },
    }).select("startDate endDate").lean();
    const holidayDates = new Set<string>();
    for (const holiday of holidays as any[]) {
      for (const d = new Date(holiday.startDate); d <= new Date(holiday.endDate); d.setDate(d.getDate()+1)) holidayDates.add(d.toISOString().slice(0,10));
    }
    const expectedDates = new Set<string>();
    for (const d = new Date(employedStart); d <= employedEnd; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      if (d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(key)) expectedDates.add(key);
    }
    if (!expectedDates.size) { skipped.push({ employeeId: String(employee._id), reason: "No working days in the employee's active period" }); continue; }
    const unique = new Map<string, string>();
    for (const row of attendanceRows as any[]) {
      const key = new Date(row.attendanceDate).toISOString().slice(0,10);
      if (expectedDates.has(key)) unique.set(key, row.status);
    }
    const approvedLeaves = await Leave.find({
      schoolId, applicantType: "EMPLOYEE", employeeId: employee._id, status: "APPROVED",
      startDate: { $lte: periodEnd }, endDate: { $gte: periodStart },
    }).select("leaveType startDate endDate sessionId").lean();
    const policySessionId = (approvedLeaves as any[])[0]?.sessionId || (attendanceRows as any[])[0]?.sessionId;
    const leavePolicies = policySessionId ? await LeavePolicy.find({ schoolId, sessionId: policySessionId, status: "ACTIVE" }).select("leaveType isPaid").lean() : [];
    const paidPolicy = new Map<string, boolean>((leavePolicies as any[]).map((policy: any) => [policy.leaveType, policy.isPaid !== false]));
    for (const leave of approvedLeaves as any[]) {
      const start = new Date(Math.max(periodStart.getTime(), new Date(leave.startDate).getTime()));
      const end = new Date(Math.min(periodEnd.getTime(), new Date(leave.endDate).getTime()));
      for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const key = d.toISOString().slice(0,10);
        if (!expectedDates.has(key)) continue;
        const current = unique.get(key);
        // A recorded presence/late/half-day takes precedence over a leave record.
        if (["PRESENT","LATE","HALF_DAY"].includes(current || "")) continue;
        const isPaid = paidPolicy.has(leave.leaveType) ? paidPolicy.get(leave.leaveType)! : leave.leaveType !== "UNPAID";
        unique.set(key, isPaid ? "PAID_LEAVE" : "UNPAID_LEAVE");
      }
    }
    const missingAttendanceDays = [...expectedDates].filter((date) => !unique.has(date));
    if (missingAttendanceDays.length) {
      skipped.push({ employeeId: String(employee._id), reason: `Attendance is incomplete for ${missingAttendanceDays.length} working day(s); complete attendance before generating payroll` });
      continue;
    }
    const counts = { presentDays: 0, absentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, halfDayDays: 0, lateDays: 0 };
    for (const status of unique.values()) {
      if (status === "PRESENT") counts.presentDays++;
      else if (status === "LATE") { counts.presentDays++; counts.lateDays++; }
      else if (status === "ABSENT") counts.absentDays++;
      else if (status === "HALF_DAY") counts.halfDayDays++;
      else if (status === "LEAVE" || status === "PAID_LEAVE") counts.paidLeaveDays++;
      else if (status === "UNPAID_LEAVE") counts.unpaidLeaveDays++;
    }
    const workingDays = expectedDates.size;
    const unpaidTotal = counts.unpaidLeaveDays;
    const grossBase = basic + Number((structure?.allowances as any)?.get?.("houseRent") ?? (structure?.allowances as any)?.houseRent ?? employee.salary?.hra ?? 0) +
      Number((structure?.allowances as any)?.get?.("transport") ?? (structure?.allowances as any)?.transport ?? 0) +
      Number((structure?.allowances as any)?.get?.("medical") ?? (structure?.allowances as any)?.medical ?? 0) +
      Number((structure?.allowances as any)?.get?.("other") ?? (structure?.allowances as any)?.other ?? employee.salary?.allowances ?? 0);
    const employedCalendarDays = Math.floor((new Date(employedEnd.getFullYear(), employedEnd.getMonth(), employedEnd.getDate()).getTime() - new Date(employedStart.getFullYear(), employedStart.getMonth(), employedStart.getDate()).getTime()) / 86400000) + 1;
    const proratedGross = Math.round(grossBase * Math.min(1, Math.max(0, employedCalendarDays / periodEnd.getDate())) * 100) / 100;
    const dailyRate = proratedGross / Math.max(1, workingDays);
    const leaveDeduction = Math.round((unpaidTotal + counts.absentDays + counts.halfDayDays * 0.5) * dailyRate * 100) / 100;
    const structureDeductions = (structure?.deductions as any) || {};
    const getStructureComponent = (source: any, key: string) => typeof source?.get === "function" ? source.get(key) : source?.[key];
    try {
      const payroll = await createPayrollService({
        employeeId: String(employee._id), payrollMonth: month, payrollYear: year, allowExited: true,
        basicSalary: Math.round((basic * proratedGross / Math.max(1, grossBase)) * 100) / 100,
        allowances: {
          houseRent: Number((structure?.allowances as any)?.get?.("houseRent") ?? (structure?.allowances as any)?.houseRent ?? employee.salary?.hra ?? 0) * proratedGross / Math.max(1, grossBase),
          transport: Number((structure?.allowances as any)?.get?.("transport") ?? (structure?.allowances as any)?.transport ?? 0) * proratedGross / Math.max(1, grossBase),
          medical: Number((structure?.allowances as any)?.get?.("medical") ?? (structure?.allowances as any)?.medical ?? 0) * proratedGross / Math.max(1, grossBase),
          special: Number((structure?.allowances as any)?.get?.("special") ?? (structure?.allowances as any)?.special ?? 0) * proratedGross / Math.max(1, grossBase),
          other: Number((structure?.allowances as any)?.get?.("other") ?? (structure?.allowances as any)?.other ?? employee.salary?.allowances ?? 0) * proratedGross / Math.max(1, grossBase),
        },
        deductions: {
          providentFund: structure?.statutorySettings?.pfEnabled && Number.isFinite(Number(structure?.statutorySettings?.pfRate))
            ? Math.round(basic * Number(structure.statutorySettings.pfRate) / 100 * 100) / 100
            : Number(getStructureComponent(structureDeductions, "providentFund") ?? 0),
          esi: structure?.statutorySettings?.esiEnabled && Number.isFinite(Number(structure?.statutorySettings?.esiRate))
            ? Math.round(proratedGross * Number(structure.statutorySettings.esiRate) / 100 * 100) / 100
            : Number(getStructureComponent(structureDeductions, "esi") ?? 0),
          professionalTax: Number(getStructureComponent(structureDeductions, "professionalTax") ?? structure?.statutorySettings?.professionalTax ?? 0),
          incomeTax: Number(getStructureComponent(structureDeductions, "incomeTax") ?? 0),
          insurance: Number(getStructureComponent(structureDeductions, "insurance") ?? 0),
          leaveDeduction,
          other: Number(getStructureComponent(structureDeductions, "other") ?? employee.salary?.deductions ?? 0),
        },
        workingDays, presentDays: counts.presentDays, absentDays: counts.absentDays,
        paidLeaveDays: counts.paidLeaveDays, unpaidLeaveDays: unpaidTotal,
        halfDayDays: counts.halfDayDays, lateDays: counts.lateDays,
        remarks: "Generated from recorded employee attendance and approved unpaid leave",
      }, actor);
      await Payroll.updateOne({ _id: (payroll as any)._id, schoolId }, { $set: { salarySnapshot: { basicSalary: basic, allowances: structure?.allowances || employee.salary, deductions: structure?.deductions || {}, effectiveFrom: structure?.effectiveFrom || employee.joiningDate } } });
      created.push(payroll);
    } catch (error: any) {
      skipped.push({ employeeId: String(employee._id), reason: error?.message || "Payroll generation failed" });
    }
  }
  return { month, year, created, skipped, createdCount: created.length, skippedCount: skipped.length };
};

export const getPayrollSummaryService = async (month?: number, year?: number, actor?: PayrollActor) => {
  if (!actor) throw new AppError("Authenticated school context is required", 401);
  const schoolId = getSchoolId(actor);
  const match: Record<string, unknown> = { schoolId, isActive: true };
  if (month !== undefined) match.payrollMonth = month;
  if (year !== undefined) match.payrollYear = year;
  const rows = await Payroll.aggregate([
    { $match: match },
    { $group: { _id: "$paymentStatus", count: { $sum: 1 }, gross: { $sum: "$grossSalary" }, net: { $sum: "$netSalary" } } },
  ]);
  return {
    month: month ?? null, year: year ?? null,
    totals: rows.reduce((acc: any, row: any) => ({
      payrollCount: acc.payrollCount + row.count,
      grossSalary: acc.grossSalary + row.gross,
      netSalary: acc.netSalary + row.net,
    }), { payrollCount: 0, grossSalary: 0, netSalary: 0 }),
    byStatus: rows,
  };
};
