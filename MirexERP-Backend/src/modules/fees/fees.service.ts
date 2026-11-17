
import mongoose, { Types } from "mongoose";

import {
  FeeHead,
  FeeStructure,
  StudentFeeAssignment,
  FeeInvoice,
  FeePayment,
  FeeDiscount,
  FeeRefund,
  FEE_INVOICE_STATUS,
  FEE_REFUND_STATUS,
  FEE_DISCOUNT_TYPES,
} from "./fees.model";

import Student from "../students/students.model";
import Session from "../sessions/sessions.model";
import Exam from "../exams/exams.model";
import { postFeePaymentToFinance, postFeeRefundToFinance } from "../finance/fee-posting.service";

import { AppError } from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

// --------------------------------------------------
// COMMON TYPES AND HELPERS
// --------------------------------------------------

interface FeeActor {
  userId: string;
  schoolId: string;
}

type FeeData = Record<string, any>;

const getObjectId = (id: string, label = "ID"): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }

  return new Types.ObjectId(id);
};

const getActorId = (actor: FeeActor): Types.ObjectId =>
  getObjectId(actor.userId, "user ID");

const getSchoolId = (actor: FeeActor): Types.ObjectId =>
  getObjectId(actor.schoolId, "school ID");

const getTenantFilter = (actor: FeeActor) => ({
  schoolId: getSchoolId(actor),
  isDeleted: false,
});

const getDate = (value: unknown, label: string): Date => {
  const date = new Date(value as string);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${label}`, 400);
  }

  return date;
};

const getPositiveAmount = (
  value: unknown,
  label = "Amount"
): number => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${label} must be a valid non-negative number`, 400);
  }

  return amount;
};

const getRequiredText = (
  value: unknown,
  label: string
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${label} is required`, 400);
  }

  return value.trim();
};

const getPaginationOptions = (query: FeeData) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return getPagination({ page, limit });
};

const createListResult = (
  items: unknown[],
  total: number,
  page: number,
  limit: number
) => ({
  items,
  pagination: createPaginationMeta(page, limit, total),
});

const ensureActiveSession = async (
  sessionId: string,
  actor: FeeActor
) => {
  const session = await Session.findOne({
    _id: getObjectId(sessionId, "session ID"),
    schoolId: getSchoolId(actor),
    isDeleted: false,
    isActive: true,
    isClosed: { $ne: true },
  });

  if (!session) {
    throw new AppError("Active academic session not found", 404);
  }

  return session;
};

const ensureStudent = async (
  studentId: string,
  actor: FeeActor,
  sessionId?: string
) => {
  const filter: FeeData = {
    _id: getObjectId(studentId, "student ID"),
    schoolId: getSchoolId(actor),
    isDeleted: false,
  };

  if (sessionId) {
    filter.sessionId = getObjectId(sessionId, "session ID");
  }

  const student = await Student.findOne(filter);

  if (!student) {
    throw new AppError("Student not found in this school", 404);
  }

  return student;
};

const getFeeHeadOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const feeHead = await FeeHead.findOne({
    _id: getObjectId(id, "fee head ID"),
    ...getTenantFilter(actor),
  });

  if (!feeHead) {
    throw new AppError("Fee head not found", 404);
  }

  return feeHead;
};

const getFeeStructureOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const structure = await FeeStructure.findOne({
    _id: getObjectId(id, "fee structure ID"),
    ...getTenantFilter(actor),
  });

  if (!structure) {
    throw new AppError("Fee structure not found", 404);
  }

  return structure;
};

const getInvoiceOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const invoice = await FeeInvoice.findOne({
    _id: getObjectId(id, "invoice ID"),
    ...getTenantFilter(actor),
  });

  if (!invoice) {
    throw new AppError("Fee invoice not found", 404);
  }

  return invoice;
};

const getPaymentOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const payment = await FeePayment.findOne({
    _id: getObjectId(id, "payment ID"),
    ...getTenantFilter(actor),
  });

  if (!payment) {
    throw new AppError("Fee payment not found", 404);
  }

  return payment;
};

const getDiscountOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const discount = await FeeDiscount.findOne({
    _id: getObjectId(id, "discount ID"),
    ...getTenantFilter(actor),
  });

  if (!discount) {
    throw new AppError("Fee discount not found", 404);
  }

  return discount;
};

const getRefundOrFail = async (
  id: string,
  actor: FeeActor
) => {
  const refund = await FeeRefund.findOne({
    _id: getObjectId(id, "refund ID"),
    ...getTenantFilter(actor),
  });

  if (!refund) {
    throw new AppError("Fee refund not found", 404);
  }

  return refund;
};

const getNextNumber = async (
  model: mongoose.Model<any>,
  schoolId: Types.ObjectId,
  field: string,
  prefix: string
): Promise<string> => {
  const count = await model.countDocuments({
    schoolId,
    isDeleted: false,
  });

  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
};

const calculateInvoiceStatus = (
  totalAmount: number,
  paidAmount: number,
  dueDate: Date
): string => {
  if (paidAmount >= totalAmount) {
    return FEE_INVOICE_STATUS.PAID;
  }

  if (paidAmount > 0) {
    return FEE_INVOICE_STATUS.PARTIAL;
  }

  if (dueDate.getTime() < Date.now()) {
    return FEE_INVOICE_STATUS.OVERDUE;
  }

  return FEE_INVOICE_STATUS.PENDING;
};

const updateInvoiceBalance = async (
  invoice: InstanceType<typeof FeeInvoice>,
  session?: mongoose.ClientSession
) => {
  const total = invoice.totalAmount;
  const paid = invoice.paidAmount;

  if (paid > total) {
    throw new AppError("Paid amount cannot exceed invoice total", 400);
  }

  invoice.balanceAmount = Math.max(0, total - paid);
  invoice.status = calculateInvoiceStatus(
    total,
    paid,
    invoice.dueDate
  );

  await invoice.save(session ? { session } : undefined);
};

// --------------------------------------------------
// 1. FEE DASHBOARD
// --------------------------------------------------

export const getFeeDashboardService = async (
  actor: FeeActor
) => {
  const filter = getTenantFilter(actor);

  const [
    totalInvoices,
    pendingInvoices,
    paidInvoices,
    overdueInvoices,
    paymentStats,
    discountStats,
    refundStats,
    pendingBalanceStats,
  ] = await Promise.all([
    FeeInvoice.countDocuments(filter),

    FeeInvoice.countDocuments({
      ...filter,
      status: FEE_INVOICE_STATUS.PENDING,
    }),

    FeeInvoice.countDocuments({
      ...filter,
      status: FEE_INVOICE_STATUS.PAID,
    }),

    FeeInvoice.countDocuments({
      ...filter,
      status: FEE_INVOICE_STATUS.OVERDUE,
    }),

    FeePayment.aggregate([
      {
        $match: {
          ...filter,
          paymentStatus: "SUCCESS",
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
        },
      },
    ]),

    FeeDiscount.aggregate([
      {
        $match: {
          ...filter,
          isApproved: true,
        },
      },
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: "$discountAmount" },
        },
      },
    ]),

    FeeRefund.aggregate([
      {
        $match: {
          ...filter,
          status: FEE_REFUND_STATUS.PROCESSED,
        },
      },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: "$amount" },
        },
      },
    ]),
    FeeInvoice.aggregate([
      {
        $match: {
          ...filter,
          status: { $in: [FEE_INVOICE_STATUS.PENDING, FEE_INVOICE_STATUS.PARTIAL, FEE_INVOICE_STATUS.OVERDUE] },
        },
      },
      {
        $group: {
          _id: null,
          pendingAmount: { $sum: "$balanceAmount" },
        },
      },
    ]),
  ]);

  return {
    invoices: {
      total: totalInvoices,
      pending: pendingInvoices,
      paid: paidInvoices,
      overdue: overdueInvoices,
      pendingAmount: pendingBalanceStats[0]?.pendingAmount || 0,
    },
    payments: {
      totalCollected: paymentStats[0]?.totalCollected || 0,
      totalPayments: paymentStats[0]?.totalPayments || 0,
    },
    discounts: {
      totalDiscount: discountStats[0]?.totalDiscount || 0,
    },
    refunds: {
      totalRefunded: refundStats[0]?.totalRefunded || 0,
    },
  };
};

// --------------------------------------------------
// 2. FEE HEADS
// --------------------------------------------------

export const createFeeHeadService = async (
  data: FeeData,
  actor: FeeActor
) => {
  const name = getRequiredText(data.name, "Fee head name");
  const code = getRequiredText(data.code, "Fee head code").toUpperCase();

  const duplicate = await FeeHead.findOne({
    schoolId: getSchoolId(actor),
    isDeleted: false,
    $or: [{ name }, { code }],
  });

  if (duplicate) {
    throw new AppError("Fee head name or code already exists", 409);
  }

  return FeeHead.create({
    ...data,
    name,
    code,
    schoolId: getSchoolId(actor),
    createdBy: getActorId(actor),
  });
};

export const getFeeHeadsService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { code: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true" || query.isActive === true;
  }

  const [items, total] = await Promise.all([
    FeeHead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeHead.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const updateFeeHeadService = async (
  id: string,
  data: FeeData,
  actor: FeeActor
) => {
  const feeHead = await getFeeHeadOrFail(id, actor);

  if (data.name || data.code) {
    const duplicate = await FeeHead.findOne({
      ...getTenantFilter(actor),
      _id: { $ne: feeHead._id },
      $or: [
        ...(data.name ? [{ name: data.name }] : []),
        ...(data.code ? [{ code: String(data.code).toUpperCase() }] : []),
      ],
    });

    if (duplicate) {
      throw new AppError("Fee head name or code already exists", 409);
    }
  }

  Object.assign(feeHead, data);
  feeHead.updatedBy = getActorId(actor);

  await feeHead.save();

  return feeHead;
};

export const deleteFeeHeadService = async (
  id: string,
  actor: FeeActor
) => {
  const feeHead = await getFeeHeadOrFail(id, actor);

  const used = await FeeStructure.exists({
    schoolId: getSchoolId(actor),
    "items.feeHeadId": feeHead._id,
    isDeleted: false,
  });

  if (used) {
    throw new AppError(
      "Fee head is already used in a fee structure",
      409
    );
  }

  feeHead.isDeleted = true;
  feeHead.deletedAt = new Date();
  feeHead.updatedBy = getActorId(actor);

  await feeHead.save();

  return { id };
};

// --------------------------------------------------
// 3. FEE STRUCTURES
// --------------------------------------------------

export const createFeeStructureService = async (
  data: FeeData,
  actor: FeeActor
) => {
  await ensureActiveSession(data.sessionId, actor);

  const name = getRequiredText(data.name, "Structure name");
  const code = getRequiredText(data.code, "Structure code").toUpperCase();

  const duplicate = await FeeStructure.findOne({
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    isDeleted: false,
    $or: [{ name }, { code }],
  });

  if (duplicate) {
    throw new AppError("Fee structure name or code already exists", 409);
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new AppError("At least one fee item is required", 400);
  }

  const items = [];

  for (const item of data.items) {
    const head = await getFeeHeadOrFail(item.feeHeadId, actor);

    if (!head.isActive) {
      throw new AppError(`Fee head ${head.name} is inactive`, 400);
    }

    items.push({
      feeHeadId: head._id,
      name: head.name,
      amount: getPositiveAmount(item.amount),
      isOptional: head.isOptional,
    });
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  return FeeStructure.create({
    ...data,
    name,
    code,
    items,
    totalAmount,
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    createdBy: getActorId(actor),
  });
};

export const getFeeStructuresService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { code: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true" || query.isActive === true;
  }

  const [items, total] = await Promise.all([
    FeeStructure.find(filter)
      .populate("classIds", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeStructure.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const getFeeStructureByIdService = async (
  id: string,
  actor: FeeActor
) => {
  const structure = await FeeStructure.findOne({
    _id: getObjectId(id),
    ...getTenantFilter(actor),
  }).populate("classIds", "name code");

  if (!structure) {
    throw new AppError("Fee structure not found", 404);
  }

  return structure;
};

export const updateFeeStructureService = async (
  id: string,
  data: FeeData,
  actor: FeeActor
) => {
  const structure = await getFeeStructureOrFail(id, actor);

  const structureSession = await Session.findOne({
    _id: structure.sessionId,
    schoolId: getSchoolId(actor),
    isDeleted: false,
    isClosed: { $ne: true },
  }).select("_id").lean();
  if (!structureSession) throw new AppError("Fee structure session is closed or unavailable", 409);

  if (data.items) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new AppError("At least one fee item is required", 400);
    }

    const items = [];

    for (const item of data.items) {
      const head = await getFeeHeadOrFail(item.feeHeadId, actor);

      items.push({
        feeHeadId: head._id,
        name: head.name,
        amount: getPositiveAmount(item.amount),
        isOptional: head.isOptional,
      });
    }

    structure.items = items;
    structure.totalAmount = items.reduce(
      (sum, item) => sum + item.amount,
      0
    );
  }

  if (data.name !== undefined) structure.name = data.name;
  if (data.description !== undefined) structure.description = data.description;
  if (data.frequency !== undefined) structure.frequency = data.frequency;
  if (data.classIds !== undefined) {
    structure.classIds = data.classIds.map((id: string) =>
      getObjectId(id, "class ID")
    );
  }
  if (data.dueDay !== undefined) structure.dueDay = data.dueDay;
  if (data.lateFineType !== undefined) structure.lateFineType = data.lateFineType;
  if (data.lateFineAmount !== undefined) structure.lateFineAmount = getPositiveAmount(data.lateFineAmount, "Late fine amount");
  if (data.graceDays !== undefined) structure.graceDays = Number(data.graceDays);
  if (data.isActive === true && !structure.isActive) {
    throw new AppError("Activate a prepared fee structure through the confirmed session preparation action", 409);
  }
  if (data.isActive === false) structure.isActive = false;

  structure.updatedBy = getActorId(actor);

  await structure.save();

  return structure;
};

export const deleteFeeStructureService = async (
  id: string,
  actor: FeeActor
) => {
  const structure = await getFeeStructureOrFail(id, actor);

  const assigned = await StudentFeeAssignment.exists({
    schoolId: getSchoolId(actor),
    feeStructureId: structure._id,
    isDeleted: false,
  });

  if (assigned) {
    throw new AppError(
      "Fee structure is assigned to students and cannot be deleted",
      409
    );
  }

  structure.isDeleted = true;
  structure.deletedAt = new Date();
  structure.updatedBy = getActorId(actor);

  await structure.save();

  return { id };
};

// --------------------------------------------------
// 4. STUDENT FEE ASSIGNMENTS
// --------------------------------------------------

export const assignStudentFeeService = async (
  data: FeeData,
  actor: FeeActor
) => {
  await ensureActiveSession(data.sessionId, actor);

  const student = await ensureStudent(
    data.studentId,
    actor,
    data.sessionId
  );

  const structure = await getFeeStructureOrFail(
    data.feeStructureId,
    actor
  );

  if (
    structure.sessionId.toString() !== data.sessionId
  ) {
    throw new AppError("Fee structure belongs to another session", 400);
  }
  if (structure.classIds?.length && !structure.classIds.some((classId: Types.ObjectId) => String(classId) === String(student.classId))) {
    throw new AppError("Fee structure is not applicable to the student's current class", 400);
  }

  const existing = await StudentFeeAssignment.findOne({
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    studentId: student._id,
    feeStructureId: structure._id,
    isDeleted: false,
  });

  if (existing) {
    throw new AppError("Fee structure already assigned to this student", 409);
  }

  const customItems = (data.customItems || []).map((item: FeeData) => ({
    feeHeadId: getObjectId(item.feeHeadId, "fee head ID"),
    name: getRequiredText(item.name, "Custom fee name"),
    amount: getPositiveAmount(item.amount),
  }));
  if (customItems.length) {
    const customHeadIds = [...new Set(customItems.map((item: FeeData) => String(item.feeHeadId)))];
    const validHeads = await FeeHead.countDocuments({ schoolId: getSchoolId(actor), _id: { $in: customHeadIds }, isActive: true, isDeleted: false });
    if (validHeads !== customHeadIds.length) throw new AppError("Custom fee items must reference active fee heads in this school", 400);
    if (customHeadIds.length !== customItems.length) throw new AppError("A fee head can only be overridden once per student assignment", 400);
  }
  const overrides = new Map(customItems.map((item: FeeData) => [String(item.feeHeadId), item]));
  const structureItems = structure.items.map((item: FeeData) => overrides.get(String(item.feeHeadId)) || item);
  const structureHeadIds = new Set(structure.items.map((item: FeeData) => String(item.feeHeadId)));
  const additionalItems = customItems.filter((item: FeeData) => !structureHeadIds.has(String(item.feeHeadId)));
  const assignedAmount = structureItems.reduce((sum: number, item: FeeData) => sum + Number(item.amount || 0), 0) + additionalItems.reduce((sum: number, item: FeeData) => sum + Number(item.amount || 0), 0);

  return StudentFeeAssignment.create({
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    studentId: student._id,
    feeStructureId: structure._id,
    classId: student.classId,
    sectionId: student.sectionId || null,
    customItems,
    assignedAmount,
    createdBy: getActorId(actor),
  });
};

export const getFeeAssignmentsService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);
  const filter: FeeData = { ...getTenantFilter(actor), isDeleted: false };
  if (query.sessionId) filter.sessionId = getObjectId(query.sessionId);
  if (query.studentId) filter.studentId = getObjectId(query.studentId);
  const [items, total] = await Promise.all([
    StudentFeeAssignment.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .populate("feeStructureId", "name code frequency totalAmount")
      .populate("classId", "name")
      .sort({ assignedAt: -1 }).skip(skip).limit(limit).lean(),
    StudentFeeAssignment.countDocuments(filter),
  ]);
  return createListResult(items, total, page, limit);
};

export const getStudentFeesService = async (
  studentId: string,
  query: FeeData,
  actor: FeeActor
) => {
  await ensureStudent(studentId, actor);

  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = {
    ...getTenantFilter(actor),
    studentId: getObjectId(studentId),
  };

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  const [assignments, invoices, total] = await Promise.all([
    StudentFeeAssignment.find(filter)
      .populate("feeStructureId", "name code frequency")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeInvoice.find(filter)
      .sort({ dueDate: 1 })
      .lean(),

    StudentFeeAssignment.countDocuments(filter),
  ]);

  return {
    assignments,
    invoices,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// --------------------------------------------------
// 5. FEE INVOICES
// --------------------------------------------------



export const getExamFeeStatusService = async (examIdValue: string, actor: FeeActor) => {
  const examId = getObjectId(examIdValue, "exam ID");
  const schoolId = getSchoolId(actor);
  const exam = await Exam.findOne({ _id: examId, schoolId }).select("_id examName sessionId classId").lean();
  if (!exam) throw new AppError("Examination not found", 404);
  const [summary, invoices] = await Promise.all([
    FeeInvoice.aggregate([{ $match: { schoolId, examId, isDeleted: false } }, { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, outstandingAmount: { $sum: "$balanceAmount" } } }]),
    FeeInvoice.find({ schoolId, examId, isDeleted: false }).populate("studentId", "firstName lastName admissionNumber").sort({ dueDate: 1 }).limit(1000).lean(),
  ]);
  return { exam: { id: exam._id, name: exam.examName }, totals: summary.reduce((result: any, row: any) => ({ invoiceCount: result.invoiceCount + row.count, totalAmount: result.totalAmount + row.totalAmount, paidAmount: result.paidAmount + row.paidAmount, outstandingAmount: result.outstandingAmount + row.outstandingAmount }), { invoiceCount: 0, totalAmount: 0, paidAmount: 0, outstandingAmount: 0 }), byStatus: summary, invoices };
};

export const generateExamFeeInvoicesService = async (data: FeeData, actor: FeeActor) => {
  const schoolId = getSchoolId(actor);
  const examId = getObjectId(String(data.examId || ""), "exam ID");
  const feeHeadId = getObjectId(String(data.feeHeadId || ""), "fee head ID");
  const amount = getPositiveAmount(data.amount, "Examination fee");
  if (amount <= 0) throw new AppError("Examination fee must be greater than zero", 400);
  const dueDate = getDate(data.dueDate, "due date");
  const exam = await Exam.findOne({ _id: examId, schoolId, status: { $ne: "CANCELLED" } }).select("schoolId sessionId classId examName").lean();
  if (!exam) throw new AppError("Examination not found in this school", 404);
  await ensureActiveSession(String(exam.sessionId), actor);
  const feeHead = await FeeHead.findOne({ _id: feeHeadId, schoolId, isActive: true, isDeleted: false }).select("name").lean();
  if (!feeHead) throw new AppError("Active examination fee head not found", 404);
  const students = await Student.find({ schoolId, sessionId: exam.sessionId, classId: exam.classId, isActive: true, isDeleted: false }).select("_id").lean();
  if (!students.length) throw new AppError("No active students are enrolled in the examination class", 409);
  const existing = await FeeInvoice.find({ schoolId, examId, studentId: { $in: students.map((student) => student._id) }, isDeleted: false }).select("studentId").lean();
  const existingIds = new Set(existing.map((invoice) => String(invoice.studentId)));
  const pending = students.filter((student) => !existingIds.has(String(student._id)));
  if (!pending.length) return { examId, examName: exam.examName, created: 0, alreadyInvoiced: existing.length, eligibleStudents: students.length };
  const session = await mongoose.startSession();
  let created = 0;
  try {
    await session.withTransaction(async () => {
      const docs = pending.map((student) => {
        const invoiceNumber = `EXAM-${String(examId).slice(-6).toUpperCase()}-${String(student._id).slice(-8).toUpperCase()}`;
        return {
          schoolId, sessionId: exam.sessionId, studentId: student._id, examId,
          invoiceNumber,
          items: [{ feeHeadId, name: `${exam.examName} - ${feeHead.name}`, amount, discountAmount: 0, fineAmount: 0, netAmount: amount }],
          subtotal: amount, discountAmount: 0, fineAmount: 0, totalAmount: amount, paidAmount: 0, balanceAmount: amount,
          dueDate, lateFineType: "NONE", lateFineAmount: 0, graceDays: 0, lateFineAppliedAmount: 0, lateFineAppliedDays: 0,
          status: FEE_INVOICE_STATUS.PENDING, remarks: `Examination fee for ${exam.examName}`, createdBy: getActorId(actor),
        };
      });
      await FeeInvoice.insertMany(docs, { session, ordered: true });
      created = docs.length;
    });
  } finally { await session.endSession(); }
  return { examId, examName: exam.examName, created, alreadyInvoiced: existing.length, eligibleStudents: students.length };
};

export const generateFeeInvoiceService = async (
  data: FeeData,
  actor: FeeActor
) => {
  if (data.sourceType && data.sourceId) {
    const existing = await FeeInvoice.findOne({ schoolId: getSchoolId(actor), sourceType: data.sourceType, sourceId: getObjectId(data.sourceId), isDeleted: false });
    if (existing) return existing;
  }
  await ensureActiveSession(data.sessionId, actor);

  await ensureStudent(data.studentId, actor, data.sessionId);

  const items: FeeData[] = [];
  let lateFineType: "NONE" | "FLAT" | "PER_DAY" = "NONE";
  let lateFineAmount = 0;
  let graceDays = 0;

  if (data.feeAssignmentId) {
    const assignment = await StudentFeeAssignment.findOne({
      _id: getObjectId(data.feeAssignmentId),
      ...getTenantFilter(actor),
      studentId: getObjectId(data.studentId),
      sessionId: getObjectId(data.sessionId),
    });

    if (!assignment) {
      throw new AppError("Student fee assignment not found", 404);
    }

    const structure = await getFeeStructureOrFail(
      assignment.feeStructureId.toString(),
      actor
    );
    lateFineType = structure.lateFineType || "NONE";
    lateFineAmount = Number(structure.lateFineAmount || 0);
    graceDays = Number(structure.graceDays || 0);

    const overrides = new Map((assignment.customItems || []).map((item) => [String(item.feeHeadId), item]));
    const structureHeadIds = new Set<string>();
    for (const item of structure.items) {
      structureHeadIds.add(String(item.feeHeadId));
      const effective = overrides.get(String(item.feeHeadId)) || item;
      items.push({ feeHeadId: effective.feeHeadId, name: effective.name, amount: effective.amount, discountAmount: 0, fineAmount: 0, netAmount: effective.amount });
    }
    for (const item of assignment.customItems || []) {
      if (structureHeadIds.has(String(item.feeHeadId))) continue;
      items.push({ feeHeadId: item.feeHeadId, name: item.name, amount: item.amount, discountAmount: 0, fineAmount: 0, netAmount: item.amount });
    }
  } else if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const amount = getPositiveAmount(item.amount);

      items.push({
        feeHeadId: item.feeHeadId
          ? getObjectId(item.feeHeadId)
          : null,
        name: getRequiredText(item.name, "Invoice item name"),
        amount,
        discountAmount: getPositiveAmount(item.discountAmount || 0),
        fineAmount: getPositiveAmount(item.fineAmount || 0),
        netAmount:
          amount -
          getPositiveAmount(item.discountAmount || 0) +
          getPositiveAmount(item.fineAmount || 0),
      });
    }
  } else {
    throw new AppError(
      "A fee assignment or invoice items are required",
      400
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const discountAmount = items.reduce(
    (sum, item) => sum + item.discountAmount,
    0
  );

  const fineAmount = items.reduce(
    (sum, item) => sum + item.fineAmount,
    0
  );

  const totalAmount = subtotal - discountAmount + fineAmount;

  if (totalAmount <= 0) {
    throw new AppError("Invoice total must be greater than zero", 400);
  }

  const invoiceNumber = await getNextNumber(
    FeeInvoice,
    getSchoolId(actor),
    "invoiceNumber",
    "INV"
  );

  return FeeInvoice.create({
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    studentId: getObjectId(data.studentId),
    feeAssignmentId: data.feeAssignmentId
      ? getObjectId(data.feeAssignmentId)
      : null,
    invoiceNumber,
    items,
    subtotal,
    discountAmount,
    fineAmount,
    totalAmount,
    paidAmount: 0,
    balanceAmount: totalAmount,
    dueDate: getDate(data.dueDate, "due date"),
    lateFineType,
    lateFineAmount,
    graceDays,
    lateFineAppliedAmount: 0,
    lateFineAppliedDays: 0,
    status: FEE_INVOICE_STATUS.PENDING,
    remarks: data.remarks,
    createdBy: getActorId(actor),
  });
};

export const getFeeInvoicesService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.sessionId) {
    filter.sessionId = getObjectId(query.sessionId);
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    filter.invoiceNumber = {
      $regex: query.search,
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    FeeInvoice.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeInvoice.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const getFeeInvoiceByIdService = async (
  id: string,
  actor: FeeActor
) => {
  const invoice = await getInvoiceOrFail(id, actor);

  await invoice.populate(
    "studentId",
    "firstName lastName admissionNumber classId sectionId"
  );

  return invoice;
};

export const updateFeeInvoiceService = async (
  id: string,
  data: FeeData,
  actor: FeeActor
) => {
  const invoice = await getInvoiceOrFail(id, actor);

  if (invoice.paidAmount > 0) {
    throw new AppError(
      "An invoice with payments cannot be edited",
      409
    );
  }

  if (invoice.status === FEE_INVOICE_STATUS.CANCELLED) {
    throw new AppError("Cancelled invoice cannot be updated", 400);
  }

  if (data.dueDate !== undefined) {
    invoice.dueDate = getDate(data.dueDate, "due date");
  }

  if (data.remarks !== undefined) {
    invoice.remarks = data.remarks;
  }

  if (Array.isArray(data.items)) {
    const items = data.items.map((item: FeeData) => {
      const amount = getPositiveAmount(item.amount);
      const discount = getPositiveAmount(item.discountAmount || 0);
      const fine = getPositiveAmount(item.fineAmount || 0);

      if (discount > amount) {
        throw new AppError("Discount cannot exceed item amount", 400);
      }

      return {
        feeHeadId: item.feeHeadId
          ? getObjectId(item.feeHeadId)
          : null,
        name: getRequiredText(item.name, "Item name"),
        amount,
        discountAmount: discount,
        fineAmount: fine,
        netAmount: amount - discount + fine,
      };
    });

    invoice.items = items;

    invoice.subtotal = items.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    invoice.discountAmount = items.reduce(
      (sum, item) => sum + item.discountAmount,
      0
    );

    invoice.fineAmount = items.reduce(
      (sum, item) => sum + item.fineAmount,
      0
    );

    invoice.totalAmount =
      invoice.subtotal -
      invoice.discountAmount +
      invoice.fineAmount;

    invoice.balanceAmount = invoice.totalAmount;
  }

  invoice.status = calculateInvoiceStatus(
    invoice.totalAmount,
    invoice.paidAmount,
    invoice.dueDate
  );

  invoice.updatedBy = getActorId(actor);

  await invoice.save();

  return invoice;
};

export const cancelFeeInvoiceService = async (
  id: string,
  actor: FeeActor
) => {
  const invoice = await getInvoiceOrFail(id, actor);

  if (invoice.paidAmount > 0) {
    throw new AppError(
      "Invoice with collected payments cannot be cancelled",
      409
    );
  }

  invoice.status = FEE_INVOICE_STATUS.CANCELLED;
  invoice.updatedBy = getActorId(actor);

  await invoice.save();

  return invoice;
};

// --------------------------------------------------
// 6. FEE PAYMENTS
// --------------------------------------------------

const applyLateFineToInvoice = async (
  invoice: InstanceType<typeof FeeInvoice>,
  session: mongoose.ClientSession,
  updatedBy: Types.ObjectId
) => {
  if (!invoice.lateFineType || invoice.lateFineType === "NONE" || !(invoice.lateFineAmount > 0) || invoice.balanceAmount <= 0) return;
  const due = new Date(invoice.dueDate);
  const firstFineDay = new Date(due.getFullYear(), due.getMonth(), due.getDate() + invoice.graceDays + 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (todayStart < firstFineDay) return;
  const daysLate = Math.floor((todayStart.getTime() - firstFineDay.getTime()) / 86400000) + 1;
  const expectedFine = invoice.lateFineType === "FLAT"
    ? invoice.lateFineAmount
    : invoice.lateFineAmount * daysLate;
  const additionalFine = Math.max(0, expectedFine - Number(invoice.lateFineAppliedAmount || 0));
  if (additionalFine <= 0) return;
  invoice.fineAmount += additionalFine;
  invoice.totalAmount += additionalFine;
  invoice.balanceAmount += additionalFine;
  invoice.lateFineAppliedAmount = expectedFine;
  invoice.lateFineAppliedDays = daysLate;
  invoice.updatedBy = updatedBy;
  const lastItem = invoice.items[invoice.items.length - 1];
  if (lastItem) {
    lastItem.fineAmount += additionalFine;
    lastItem.netAmount += additionalFine;
  }
  invoice.status = calculateInvoiceStatus(invoice.totalAmount, invoice.paidAmount, invoice.dueDate);
  await invoice.save({ session });
};

export const applyLateFinesService = async (actor: FeeActor) => {
  const session = await mongoose.startSession();
  try {
    let updated = 0;
    await session.withTransaction(async () => {
      const overdueInvoices = await FeeInvoice.find({
        ...getTenantFilter(actor),
        dueDate: { $lt: new Date() },
        status: { $in: [FEE_INVOICE_STATUS.PENDING, FEE_INVOICE_STATUS.PARTIAL, FEE_INVOICE_STATUS.OVERDUE] },
        lateFineType: { $in: ["FLAT", "PER_DAY"] },
        lateFineAmount: { $gt: 0 },
        balanceAmount: { $gt: 0 },
        isDeleted: false,
      }).limit(500).session(session);
      for (const invoice of overdueInvoices) {
        const previous = Number(invoice.lateFineAppliedAmount || 0);
        await applyLateFineToInvoice(invoice, session, getActorId(actor));
        if (Number(invoice.lateFineAppliedAmount || 0) > previous) updated += 1;
      }
    });
    return { updatedInvoices: updated, scannedLimit: 500 };
  } finally {
    await session.endSession();
  }
};

export const collectFeePaymentService = async (
  data: FeeData,
  actor: FeeActor
) => {
  const amount = getPositiveAmount(data.amount, "Payment amount");

  if (amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", 400);
  }

  const schoolId = getSchoolId(actor);
  const idempotencyKey = typeof data.idempotencyKey === "string"
    ? data.idempotencyKey.trim()
    : "";

  // A client retry must return the original payment rather than collecting twice.
  if (idempotencyKey) {
    const existing = await FeePayment.findOne({
      schoolId,
      idempotencyKey,
      isDeleted: false,
    });
    if (existing) {
      if (
        String(existing.invoiceId) !== String(data.invoiceId) ||
        Number(existing.amount) !== amount ||
        String(existing.paymentMethod) !== String(data.paymentMethod)
      ) {
        throw new AppError("Idempotency key was already used for a different payment", 409);
      }
      return existing;
    }
  }

  const session = await mongoose.startSession();

  try {
    let createdPayment: unknown = null;

    await session.withTransaction(async () => {
      const invoice = await FeeInvoice.findOne({
        _id: getObjectId(data.invoiceId, "invoice ID"),
        ...getTenantFilter(actor),
      }).session(session);

      if (!invoice) {
        throw new AppError("Fee invoice not found", 404);
      }

      if (invoice.status === FEE_INVOICE_STATUS.CANCELLED) {
        throw new AppError("Cannot pay a cancelled invoice", 400);
      }

      await applyLateFineToInvoice(invoice, session, getActorId(actor));

      if (amount > invoice.balanceAmount) {
        throw new AppError(
          "Payment amount exceeds outstanding balance",
          400
        );
      }

      const receiptNumber = await getNextNumber(
        FeePayment,
        getSchoolId(actor),
        "receiptNumber",
        "REC"
      );

      const [payment] = await FeePayment.create(
        [
          {
            schoolId: getSchoolId(actor),
            sessionId: invoice.sessionId,
            studentId: invoice.studentId,
            invoiceId: invoice._id,
            receiptNumber,
            amount,
            paymentMethod: data.paymentMethod,
            paymentStatus: "SUCCESS",
            transactionReference: data.transactionReference,
            gatewayOrderId: data.gatewayOrderId,
            gatewayPaymentId: data.gatewayPaymentId,
            idempotencyKey: data.idempotencyKey,
            paymentDate: data.paymentDate
              ? getDate(data.paymentDate, "payment date")
              : new Date(),
            remarks: data.remarks,
            collectedBy: getActorId(actor),
          },
        ],
        { session }
      );

      invoice.paidAmount += amount;

      await updateInvoiceBalance(invoice, session);

      // Fee payment and its finance ledger posting commit atomically.
      await postFeePaymentToFinance(payment, session);
      createdPayment = payment;
    });

    return createdPayment;
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000 && idempotencyKey) {
      const existing = await FeePayment.findOne({
        schoolId,
        idempotencyKey,
        isDeleted: false,
      });
      if (
        existing &&
        String(existing.invoiceId) === String(data.invoiceId) &&
        Number(existing.amount) === amount &&
        String(existing.paymentMethod) === String(data.paymentMethod)
      ) {
        return existing;
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const getFeePaymentsService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.invoiceId) {
    filter.invoiceId = getObjectId(query.invoiceId);
  }

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  const [items, total] = await Promise.all([
    FeePayment.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .populate("invoiceId", "invoiceNumber totalAmount")
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeePayment.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const getFeePaymentByIdService = async (
  id: string,
  actor: FeeActor
) => {
  const payment = await getPaymentOrFail(id, actor);

  await payment.populate([
    {
      path: "studentId",
      select: "firstName lastName admissionNumber",
    },
    {
      path: "invoiceId",
      select: "invoiceNumber totalAmount paidAmount balanceAmount",
    },
  ]);

  return payment;
};

// --------------------------------------------------
// 7. FEE DISCOUNTS
// --------------------------------------------------

export const createFeeDiscountService = async (
  data: FeeData,
  actor: FeeActor
) => {
  await ensureActiveSession(data.sessionId, actor);

  await ensureStudent(data.studentId, actor, data.sessionId);

  const discountType = data.discountType;

  if (!Object.values(FEE_DISCOUNT_TYPES).includes(discountType)) {
    throw new AppError("Invalid discount type", 400);
  }

  const value = getPositiveAmount(data.value, "Discount value");

  if (
    discountType === FEE_DISCOUNT_TYPES.PERCENTAGE &&
    value > 100
  ) {
    throw new AppError("Percentage discount cannot exceed 100", 400);
  }

  let discountAmount = value;

  if (data.invoiceId) {
    const invoice = await getInvoiceOrFail(data.invoiceId, actor);

    if (invoice.studentId.toString() !== data.studentId) {
      throw new AppError("Invoice does not belong to this student", 400);
    }

    discountAmount =
      discountType === FEE_DISCOUNT_TYPES.PERCENTAGE
        ? (invoice.balanceAmount * value) / 100
        : value;

    if (discountAmount > invoice.balanceAmount) {
      throw new AppError("Discount exceeds invoice balance", 400);
    }
  }

  return FeeDiscount.create({
    schoolId: getSchoolId(actor),
    sessionId: getObjectId(data.sessionId),
    studentId: getObjectId(data.studentId),
    invoiceId: data.invoiceId
      ? getObjectId(data.invoiceId)
      : null,
    name: getRequiredText(data.name, "Discount name"),
    discountType,
    value,
    discountAmount,
    reason: getRequiredText(data.reason, "Discount reason"),
    isApproved: false,
    createdBy: getActorId(actor),
  });
};

export const getFeeDiscountsService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.isApproved !== undefined) {
    filter.isApproved =
      query.isApproved === "true" || query.isApproved === true;
  }

  const [items, total] = await Promise.all([
    FeeDiscount.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeDiscount.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const approveFeeDiscountService = async (
  id: string,
  actor: FeeActor
) => {
  const session = await mongoose.startSession();

  try {
    let result: unknown = null;

    await session.withTransaction(async () => {
      const discount = await FeeDiscount.findOne({
        _id: getObjectId(id),
        ...getTenantFilter(actor),
      }).session(session);

      if (!discount) {
        throw new AppError("Fee discount not found", 404);
      }

      if (discount.isApproved) {
        throw new AppError("Discount is already approved", 409);
      }

      if (discount.invoiceId) {
        const invoice = await FeeInvoice.findOne({
          _id: discount.invoiceId,
          ...getTenantFilter(actor),
        }).session(session);

        if (!invoice) {
          throw new AppError("Related invoice not found", 404);
        }

        if (invoice.paidAmount > 0) {
          throw new AppError(
            "Cannot apply discount after payment collection",
            409
          );
        }

        if (discount.discountAmount > invoice.totalAmount) {
          throw new AppError("Discount exceeds invoice total", 400);
        }

        invoice.discountAmount += discount.discountAmount;
        invoice.totalAmount -= discount.discountAmount;
        invoice.balanceAmount = invoice.totalAmount;

        invoice.items = invoice.items.map((item) => ({
          ...item,
          discountAmount:
            item.discountAmount +
            (item === invoice.items[0]
              ? discount.discountAmount
              : 0),
          netAmount:
            item.netAmount -
            (item === invoice.items[0]
              ? discount.discountAmount
              : 0),
        })) as typeof invoice.items;

        invoice.status = calculateInvoiceStatus(
          invoice.totalAmount,
          invoice.paidAmount,
          invoice.dueDate
        );

        await invoice.save({ session });
      }

      discount.isApproved = true;
      discount.approvedBy = getActorId(actor);
      discount.approvedAt = new Date();

      await discount.save({ session });

      result = discount;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const rejectFeeDiscountService = async (
  id: string,
  actor: FeeActor,
  data: FeeData = {}
) => {
  const discount = await getDiscountOrFail(id, actor);

  if (discount.isApproved) {
    throw new AppError("Approved discount cannot be rejected", 409);
  }

  discount.isDeleted = true;

  await discount.save();

  return {
    id,
    status: "REJECTED",
    remarks: data.remarks || null,
  };
};

// --------------------------------------------------
// 8. FEE REFUNDS
// --------------------------------------------------

export const createFeeRefundService = async (
  data: FeeData,
  actor: FeeActor
) => {
  const payment = await getPaymentOrFail(data.paymentId, actor);

  if (payment.paymentStatus !== "SUCCESS") {
    throw new AppError("Only successful payments can be refunded", 400);
  }

  const amount = getPositiveAmount(data.amount, "Refund amount");

  if (amount <= 0 || amount > payment.amount) {
    throw new AppError("Invalid refund amount", 400);
  }

  const alreadyRefunded = await FeeRefund.aggregate([
    {
      $match: {
        schoolId: getSchoolId(actor),
        paymentId: payment._id,
        status: {
          $in: [
            FEE_REFUND_STATUS.PENDING,
            FEE_REFUND_STATUS.APPROVED,
            FEE_REFUND_STATUS.PROCESSED,
          ],
        },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const remaining =
    payment.amount - (alreadyRefunded[0]?.total || 0);

  if (amount > remaining) {
    throw new AppError(
      "Refund amount exceeds refundable payment balance",
      400
    );
  }

  const refundNumber = await getNextNumber(
    FeeRefund,
    getSchoolId(actor),
    "refundNumber",
    "REF"
  );

  return FeeRefund.create({
    schoolId: getSchoolId(actor),
    sessionId: payment.sessionId,
    studentId: payment.studentId,
    paymentId: payment._id,
    refundNumber,
    amount,
    reason: getRequiredText(data.reason, "Refund reason"),
    status: FEE_REFUND_STATUS.PENDING,
    requestedBy: getActorId(actor),
  });
};

export const getFeeRefundsService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FeeData = getTenantFilter(actor);

  if (query.studentId) {
    filter.studentId = getObjectId(query.studentId);
  }

  if (query.paymentId) {
    filter.paymentId = getObjectId(query.paymentId);
  }

  if (query.status) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    FeeRefund.find(filter)
      .populate("studentId", "firstName lastName admissionNumber")
      .populate("paymentId", "receiptNumber amount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeRefund.countDocuments(filter),
  ]);

  return createListResult(items, total, page, limit);
};

export const approveFeeRefundService = async (
  id: string,
  actor: FeeActor,
  data: FeeData = {}
) => {
  const refund = await getRefundOrFail(id, actor);

  if (refund.status !== FEE_REFUND_STATUS.PENDING) {
    throw new AppError("Only pending refunds can be approved", 400);
  }

  refund.status = FEE_REFUND_STATUS.APPROVED;
  refund.reviewedBy = getActorId(actor);
  refund.reviewedAt = new Date();
  refund.remarks = data.remarks;

  await refund.save();

  return refund;
};

export const rejectFeeRefundService = async (
  id: string,
  actor: FeeActor,
  data: FeeData
) => {
  const refund = await getRefundOrFail(id, actor);

  if (refund.status !== FEE_REFUND_STATUS.PENDING) {
    throw new AppError("Only pending refunds can be rejected", 400);
  }

  refund.status = FEE_REFUND_STATUS.REJECTED;
  refund.reviewedBy = getActorId(actor);
  refund.reviewedAt = new Date();
  refund.remarks = getRequiredText(data.remarks, "Rejection remarks");

  await refund.save();

  return refund;
};

export const processFeeRefundService = async (
  id: string,
  actor: FeeActor,
  data: FeeData
) => {
  const session = await mongoose.startSession();

  try {
    let result: unknown = null;

    await session.withTransaction(async () => {
      const refund = await FeeRefund.findOne({
        _id: getObjectId(id),
        ...getTenantFilter(actor),
      }).session(session);

      if (!refund) {
        throw new AppError("Fee refund not found", 404);
      }

      if (refund.status !== FEE_REFUND_STATUS.APPROVED) {
        throw new AppError(
          "Only approved refunds can be processed",
          400
        );
      }

      const payment = await FeePayment.findOne({
        _id: refund.paymentId,
        ...getTenantFilter(actor),
      }).session(session);

      if (!payment) {
        throw new AppError("Original payment not found", 404);
      }

      const invoice = await FeeInvoice.findOne({
        _id: payment.invoiceId,
        ...getTenantFilter(actor),
      }).session(session);

      if (!invoice) {
        throw new AppError("Related invoice not found", 404);
      }

      if (refund.amount > invoice.paidAmount) {
        throw new AppError(
          "Refund amount exceeds collected invoice payment",
          400
        );
      }

      invoice.paidAmount -= refund.amount;
      await updateInvoiceBalance(invoice, session);

      refund.status = FEE_REFUND_STATUS.PROCESSED;
      refund.processedAt = new Date();
      refund.refundMethod = data.refundMethod;
      refund.transactionReference = data.transactionReference;

      await refund.save({ session });

      // Refund reversal is linked to the source refund and committed atomically.
      await postFeeRefundToFinance(refund, session);
      result = refund;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// --------------------------------------------------
// 9. STUDENT FEE SUMMARY
// --------------------------------------------------

export const getStudentFeeSummaryService = async (
  studentId: string,
  actor: FeeActor
) => {
  await ensureStudent(studentId, actor);

  const filter = {
    ...getTenantFilter(actor),
    studentId: getObjectId(studentId),
  };

  const [invoiceStats, paymentStats, refundStats] = await Promise.all([
    FeeInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$paidAmount" },
          balanceAmount: { $sum: "$balanceAmount" },
        },
      },
    ]),

    FeePayment.aggregate([
      {
        $match: {
          ...filter,
          paymentStatus: "SUCCESS",
        },
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalPaid: { $sum: "$amount" },
        },
      },
    ]),

    FeeRefund.aggregate([
      {
        $match: {
          ...filter,
          status: FEE_REFUND_STATUS.PROCESSED,
        },
      },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  return {
    invoices: invoiceStats[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      paidAmount: 0,
      balanceAmount: 0,
    },
    payments: paymentStats[0] || {
      totalPayments: 0,
      totalPaid: 0,
    },
    refunds: refundStats[0] || {
      totalRefunded: 0,
    },
  };
};

// --------------------------------------------------
// 10. FEE COLLECTION REPORT
// --------------------------------------------------

export const getFeeCollectionReportService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const match: FeeData = {
    ...getTenantFilter(actor),
    paymentStatus: "SUCCESS",
  };

  if (query.startDate || query.endDate) {
    match.paymentDate = {};

    if (query.startDate) {
      match.paymentDate.$gte = getDate(query.startDate, "start date");
    }

    if (query.endDate) {
      match.paymentDate.$lte = getDate(query.endDate, "end date");
    }
  }

  if (query.sessionId) {
    match.sessionId = getObjectId(query.sessionId);
  }

  const [summary, methods, daily] = await Promise.all([
    FeePayment.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCollection: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          averagePayment: { $avg: "$amount" },
        },
      },
    ]),

    FeePayment.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    FeePayment.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paymentDate",
            },
          },
          totalAmount: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    summary: summary[0] || {
      totalCollection: 0,
      totalTransactions: 0,
      averagePayment: 0,
    },
    paymentMethods: methods,
    dailyCollection: daily,
  };
};

// --------------------------------------------------
// 11. OUTSTANDING FEES REPORT
// --------------------------------------------------

export const getOutstandingFeesReportService = async (
  query: FeeData,
  actor: FeeActor
) => {
  const match: FeeData = {
    ...getTenantFilter(actor),
    balanceAmount: { $gt: 0 },
    status: {
      $in: [
        FEE_INVOICE_STATUS.PENDING,
        FEE_INVOICE_STATUS.PARTIAL,
        FEE_INVOICE_STATUS.OVERDUE,
      ],
    },
  };

  if (query.sessionId) {
    match.sessionId = getObjectId(query.sessionId);
  }

  if (query.studentId) {
    match.studentId = getObjectId(query.studentId);
  }

  if (query.status) {
    match.status = query.status;
  }

  const { page, limit, skip } = getPaginationOptions(query);

  const [items, summary, total] = await Promise.all([
    FeeInvoice.find(match)
      .populate("studentId", "firstName lastName admissionNumber phone")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    FeeInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$balanceAmount" },
          totalInvoices: { $sum: 1 },
          overdueAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", FEE_INVOICE_STATUS.OVERDUE] },
                "$balanceAmount",
                0,
              ],
            },
          },
        },
      },
    ]),

    FeeInvoice.countDocuments(match),
  ]);

  return {
    ...createListResult(items, total, page, limit),
    summary: summary[0] || {
      totalOutstanding: 0,
      totalInvoices: 0,
      overdueAmount: 0,
    },
  };
};
