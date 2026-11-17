
import mongoose, { FilterQuery, Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import {
  FinanceCategory,
  Income,
  Expense,
  FinanceTransaction,
  FINANCE_CATEGORY_TYPES,
  FINANCE_PAYMENT_METHODS,
  FINANCE_RECORD_STATUS,
  FINANCE_TRANSACTION_TYPES,
  FinanceActor,
  ExpenseDocument,
} from "./finance.model";
import { FeePayment, FeeRefund } from "../fees/fees.model";
import { FinanceVendor } from "./vendors.model";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type FinanceQuery = {
  page?: number | string;
  limit?: number | string;
  search?: string;
  startDate?: string;
  endDate?: string;
  fromDate?: string;
  toDate?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  paymentMethod?: string;
  academicSessionId?: string;
};

type FinancePayload = Record<string, unknown>;

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const getSchoolId = (actor: FinanceActor): Types.ObjectId => {
  if (!actor.schoolId) {
    throw new AppError("School context is required", 400);
  }

  if (!Types.ObjectId.isValid(String(actor.schoolId))) {
    throw new AppError("Invalid school ID", 400);
  }

  return new Types.ObjectId(String(actor.schoolId));
};

const getActorId = (actor: FinanceActor): Types.ObjectId => {
  if (!actor.userId || !Types.ObjectId.isValid(String(actor.userId))) {
    throw new AppError("Valid user context is required", 401);
  }

  return new Types.ObjectId(String(actor.userId));
};

const getPagination = (query: FinanceQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getPaginationData = (
  page: number,
  limit: number,
  total: number
): PaginationData => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPreviousPage: page > 1 && total > 0,
});

const getDateFilter = (query: FinanceQuery, field: string) => {
  const startDate = query.startDate || query.fromDate;
  const endDate = query.endDate || query.toDate;

  if (!startDate && !endDate) return {};

  const dateFilter: Record<string, Date> = {};

  if (startDate) {
    const date = new Date(startDate);
    if (Number.isNaN(date.getTime())) {
      throw new AppError("Invalid start date", 400);
    }
    dateFilter.$gte = date;
  }

  if (endDate) {
    const date = new Date(endDate);
    if (Number.isNaN(date.getTime())) {
      throw new AppError("Invalid end date", 400);
    }
    date.setHours(23, 59, 59, 999);
    dateFilter.$lte = date;
  }

  return { [field]: dateFilter };
};

const buildRecordFilter = (
  actor: FinanceActor,
  query: FinanceQuery,
  dateField: string
) => {
  const filter: Record<string, unknown> = {
    schoolId: getSchoolId(actor),
  };

  if (query.categoryId) {
    if (!Types.ObjectId.isValid(query.categoryId)) {
      throw new AppError("Invalid category ID", 400);
    }
    filter.categoryId = new Types.ObjectId(query.categoryId);
  }

  if (query.status) filter.status = query.status;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.academicSessionId) {
    filter.academicSessionId = query.academicSessionId;
  }

  Object.assign(filter, getDateFilter(query, dateField));

  if (query.search?.trim()) {
    const search = query.search.trim();
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { receiptNumber: { $regex: search, $options: "i" } },
      { voucherNumber: { $regex: search, $options: "i" } },
      { transactionReference: { $regex: search, $options: "i" } },
      { receivedFrom: { $regex: search, $options: "i" } },
      { paidTo: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
};

const ensureObjectId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid record ID", 400);
  }

  return new Types.ObjectId(id);
};

const ensureValidAmount = (amount: unknown) => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("Amount must be greater than zero", 400);
  }

  return value;
};

const ensureCategory = async (
  categoryId: string,
  schoolId: Types.ObjectId,
  expectedType: string
) => {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new AppError("Invalid category ID", 400);
  }

  const category = await FinanceCategory.findOne({
    _id: categoryId,
    schoolId,
    type: expectedType,
    isActive: true,
  });

  if (!category) {
    throw new AppError("Active finance category not found", 404);
  }

  return category;
};

const createTransaction = async (data: {
  schoolId: Types.ObjectId;
  type: string;
  sourceId: Types.ObjectId;
  sourceModel: string;
  categoryId: Types.ObjectId;
  title: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  transactionDate: Date;
  createdBy: Types.ObjectId;
}) => {
  const transactionNumber = `TXN-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  return FinanceTransaction.create({
    ...data,
    transactionNumber,
    status: FINANCE_RECORD_STATUS.ACTIVE,
  });
};

// --------------------------------------------------
// 1. FINANCE DASHBOARD
// --------------------------------------------------

export const getFinanceDashboardService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const schoolId = getSchoolId(actor);

  const incomeFilter = { ...buildRecordFilter(actor, query, "receivedDate"), status: FINANCE_RECORD_STATUS.ACTIVE };
  const expenseFilter = { ...buildRecordFilter(actor, query, "expenseDate"), status: FINANCE_RECORD_STATUS.ACTIVE };
  const feePaymentFilter: Record<string, unknown> = {
    schoolId, paymentStatus: "SUCCESS", isDeleted: false, ...getDateFilter(query, "paymentDate"),
  };
  const feeRefundFilter: Record<string, unknown> = {
    schoolId, status: "PROCESSED", isDeleted: false, ...getDateFilter(query, "processedAt"),
  };
  const payrollPostingFilter: Record<string, unknown> = { schoolId, sourceModel: "Payroll", type: "EXPENSE", status: FINANCE_RECORD_STATUS.ACTIVE, ...getDateFilter(query, "transactionDate") };
  if (query.academicSessionId) {
    feePaymentFilter.sessionId = ensureObjectId(query.academicSessionId);
    feeRefundFilter.sessionId = ensureObjectId(query.academicSessionId);
  }

  const [incomeResult, expenseResult, categoryCount, feeCollectionResult, feeRefundResult, payrollExpenseResult] = await Promise.all([
    Income.aggregate([
      { $match: incomeFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalRecords: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalRecords: { $sum: 1 },
        },
      },
    ]),
    FinanceCategory.countDocuments({
      schoolId,
      isActive: true,
    }),
    FeePayment.aggregate([
      { $match: feePaymentFilter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalRecords: { $sum: 1 } } },
    ]),
    FeeRefund.aggregate([
      { $match: feeRefundFilter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]),
    FinanceTransaction.aggregate([{ $match: payrollPostingFilter }, { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalRecords: { $sum: 1 } } }]),
  ]);

  const otherIncome = incomeResult[0]?.totalAmount || 0;
  const feeCollection = feeCollectionResult[0]?.totalAmount || 0;
  const feeRefunds = feeRefundResult[0]?.totalAmount || 0;
  const totalIncome = otherIncome + feeCollection - feeRefunds;
  const payrollExpenses = payrollExpenseResult[0]?.totalAmount || 0;
  const totalExpenses = (expenseResult[0]?.totalAmount || 0) + payrollExpenses;

  const [recentIncome, recentExpenses, recentFeePayments] = await Promise.all([
    Income.find({ schoolId, status: FINANCE_RECORD_STATUS.ACTIVE })
      .sort({ receivedDate: -1 }).limit(5).populate("categoryId", "name code").lean(),
    Expense.find({ schoolId, status: FINANCE_RECORD_STATUS.ACTIVE })
      .sort({ expenseDate: -1 }).limit(5).populate("categoryId", "name code").lean(),
    FeePayment.find({ schoolId, paymentStatus: "SUCCESS", isDeleted: false })
      .sort({ paymentDate: -1 }).limit(5)
      .populate("studentId", "firstName lastName admissionNumber")
      .populate("invoiceId", "invoiceNumber").lean(),
  ]);

  return {
    summary: {
      totalIncome,
      otherIncome,
      feeCollection,
      feeRefunds,
      totalExpenses,
      payrollExpenses,
      netBalance: totalIncome - totalExpenses,
      incomeRecords: incomeResult[0]?.totalRecords || 0,
      feePayments: feeCollectionResult[0]?.totalRecords || 0,
      expenseRecords: expenseResult[0]?.totalRecords || 0,
      payrollExpenseRecords: payrollExpenseResult[0]?.totalRecords || 0,
      activeCategories: categoryCount,
    },
    recentIncome,
    recentExpenses,
    recentFeePayments,
  };
};

// --------------------------------------------------
// 2. FINANCE CATEGORY
// --------------------------------------------------

export const createFinanceCategoryService = async (
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const userId = getActorId(actor);

  const name = String(payload.name || "").trim();
  const code = String(payload.code || "").trim().toUpperCase();
  const type = String(payload.type || "");

  if (!name || !code) {
    throw new AppError("Category name and code are required", 400);
  }

  if (!Object.values(FINANCE_CATEGORY_TYPES).includes(type as never)) {
    throw new AppError("Invalid finance category type", 400);
  }

  const existing = await FinanceCategory.findOne({
    schoolId,
    code,
    type,
  });

  if (existing) {
    throw new AppError("Category code already exists", 409);
  }

  return FinanceCategory.create({
    schoolId,
    name,
    code,
    type,
    description: payload.description,
    isActive: true,
    createdBy: userId,
  });
};

export const getFinanceCategoriesService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);

  const filter: FilterQuery<unknown> = { schoolId };

  if (query.type) filter.type = query.type;

  if (query.search?.trim()) {
    filter.$or = [
      { name: { $regex: query.search.trim(), $options: "i" } },
      { code: { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    FinanceCategory.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FinanceCategory.countDocuments(filter),
  ]);

  return {
    items,
    pagination: getPaginationData(page, limit, total),
  };
};

export const updateFinanceCategoryService = async (
  id: string,
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const userId = getActorId(actor);
  const categoryId = ensureObjectId(id);

  const category = await FinanceCategory.findOne({
    _id: categoryId,
    schoolId,
  });

  if (!category) {
    throw new AppError("Finance category not found", 404);
  }

  if (payload.code) {
    const code = String(payload.code).trim().toUpperCase();

    const duplicate = await FinanceCategory.findOne({
      _id: { $ne: categoryId },
      schoolId,
      code,
      type: category.type,
    });

    if (duplicate) {
      throw new AppError("Category code already exists", 409);
    }

    category.code = code;
  }

  if (payload.name !== undefined) {
    category.name = String(payload.name).trim();
  }

  if (payload.description !== undefined) {
    category.description = String(payload.description);
  }

  if (payload.isActive !== undefined) {
    category.isActive = Boolean(payload.isActive);
  }

  category.updatedBy = userId;

  await category.save();
  return category;
};

export const deleteFinanceCategoryService = async (
  id: string,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const categoryId = ensureObjectId(id);

  const category = await FinanceCategory.findOne({
    _id: categoryId,
    schoolId,
  });

  if (!category) {
    throw new AppError("Finance category not found", 404);
  }

  const [incomeExists, expenseExists] = await Promise.all([
    Income.exists({ schoolId, categoryId }),
    Expense.exists({ schoolId, categoryId }),
  ]);

  if (incomeExists || expenseExists) {
    throw new AppError(
      "Category is already used in finance records. Deactivate it instead.",
      409
    );
  }

  category.isActive = false;
  category.updatedBy = getActorId(actor);
  await category.save();

  return category;
};

// --------------------------------------------------
// 3. INCOME MANAGEMENT
// --------------------------------------------------

export const createIncomeService = async (
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const userId = getActorId(actor);

  const category = await ensureCategory(
    String(payload.categoryId || ""),
    schoolId,
    FINANCE_CATEGORY_TYPES.INCOME
  );

  const amount = ensureValidAmount(payload.amount);
  const receivedDate = payload.receivedDate
    ? new Date(String(payload.receivedDate))
    : new Date();

  if (Number.isNaN(receivedDate.getTime())) {
    throw new AppError("Invalid received date", 400);
  }

  const receiptNumber = `INC-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const income = await Income.create({
    schoolId,
    receiptNumber,
    categoryId: category._id,
    title: String(payload.title || "").trim(),
    description: payload.description,
    amount,
    paymentMethod:
      payload.paymentMethod || FINANCE_PAYMENT_METHODS.CASH,
    transactionReference: payload.transactionReference,
    receivedFrom: String(payload.receivedFrom || "").trim(),
    receivedDate,
    academicSessionId: payload.academicSessionId,
    status: FINANCE_RECORD_STATUS.ACTIVE,
    attachmentUrl: payload.attachmentUrl,
    remarks: payload.remarks,
    createdBy: userId,
  });

  await createTransaction({
    schoolId,
    type: FINANCE_TRANSACTION_TYPES.INCOME,
    sourceId: income._id,
    sourceModel: "Income",
    categoryId: category._id,
    title: income.title,
    amount,
    paymentMethod: income.paymentMethod,
    transactionReference: income.transactionReference,
    transactionDate: receivedDate,
    createdBy: userId,
  });

  return income;
};

export const getIncomeRecordsService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const filter = buildRecordFilter(actor, query, "receivedDate");
  const { page, limit, skip } = getPagination(query);

  const [items, total] = await Promise.all([
    Income.find(filter)
      .populate("categoryId", "name code")
      .sort({ receivedDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Income.countDocuments(filter),
  ]);

  return {
    items,
    pagination: getPaginationData(page, limit, total),
  };
};

export const getIncomeByIdService = async (
  id: string,
  actor: FinanceActor
) => {
  const income = await Income.findOne({
    _id: ensureObjectId(id),
    schoolId: getSchoolId(actor),
  }).populate("categoryId", "name code");

  if (!income) {
    throw new AppError("Income record not found", 404);
  }

  return income;
};

export const updateIncomeService = async (
  id: string,
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const income = await Income.findOne({
    _id: ensureObjectId(id),
    schoolId,
  });

  if (!income) {
    throw new AppError("Income record not found", 404);
  }

  if (income.status === FINANCE_RECORD_STATUS.CANCELLED) {
    throw new AppError("Cancelled income cannot be updated", 400);
  }

  if (payload.categoryId) {
    const category = await ensureCategory(
      String(payload.categoryId),
      schoolId,
      FINANCE_CATEGORY_TYPES.INCOME
    );
    income.categoryId = category._id;
  }

  if (payload.amount !== undefined) {
    income.amount = ensureValidAmount(payload.amount);
  }

  if (payload.title !== undefined) {
    income.title = String(payload.title).trim();
  }

  if (payload.description !== undefined) {
    income.description = String(payload.description);
  }

  if (payload.paymentMethod !== undefined) {
    income.paymentMethod = String(payload.paymentMethod);
  }

  if (payload.transactionReference !== undefined) {
    income.transactionReference = String(payload.transactionReference);
  }

  if (payload.receivedFrom !== undefined) {
    income.receivedFrom = String(payload.receivedFrom).trim();
  }

  if (payload.receivedDate !== undefined) {
    const date = new Date(String(payload.receivedDate));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("Invalid received date", 400);
    }
    income.receivedDate = date;
  }

  if (payload.remarks !== undefined) {
    income.remarks = String(payload.remarks);
  }

  if (payload.attachmentUrl !== undefined) {
    income.attachmentUrl = String(payload.attachmentUrl);
  }

  income.updatedBy = getActorId(actor);
  await income.save();

  await FinanceTransaction.updateOne(
    {
      schoolId,
      sourceId: income._id,
      sourceModel: "Income",
    },
    {
      $set: {
        categoryId: income.categoryId,
        title: income.title,
        amount: income.amount,
        paymentMethod: income.paymentMethod,
        transactionReference: income.transactionReference,
        transactionDate: income.receivedDate,
      },
    }
  );

  return income;
};

export const deleteIncomeService = async (
  id: string,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);

  const income = await Income.findOne({
    _id: ensureObjectId(id),
    schoolId,
  });

  if (!income) {
    throw new AppError("Income record not found", 404);
  }

  income.status = FINANCE_RECORD_STATUS.CANCELLED;
  income.updatedBy = getActorId(actor);
  await income.save();

  await FinanceTransaction.updateOne(
    {
      schoolId,
      sourceId: income._id,
      sourceModel: "Income",
    },
    { $set: { status: FINANCE_RECORD_STATUS.CANCELLED } }
  );

  return income;
};

// --------------------------------------------------
// 4. EXPENSE MANAGEMENT
// --------------------------------------------------

export const createExpenseService = async (
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);
  const userId = getActorId(actor);
  const category = await ensureCategory(
    String(payload.categoryId || ""),
    schoolId,
    FINANCE_CATEGORY_TYPES.EXPENSE
  );
  const amount = ensureValidAmount(payload.amount);
  const expenseDate = payload.expenseDate ? new Date(String(payload.expenseDate)) : new Date();
  if (Number.isNaN(expenseDate.getTime())) throw new AppError("Invalid expense date", 400);

  const sourceRef = String(payload.sourceRef || "").trim() || undefined;
  if (sourceRef) {
    const existing = await Expense.findOne({ schoolId, sourceRef });
    if (existing) {
      const transaction = await FinanceTransaction.findOne({ schoolId, sourceModel: "Expense", sourceId: existing._id });
      if (!transaction) {
        await createTransaction({
          schoolId, type: FINANCE_TRANSACTION_TYPES.EXPENSE, sourceId: existing._id, sourceModel: "Expense",
          categoryId: existing.categoryId, title: existing.title, amount: existing.amount,
          paymentMethod: existing.paymentMethod, transactionReference: existing.transactionReference,
          transactionDate: existing.expenseDate, createdBy: userId,
        });
      }
      return existing;
    }
  }

  let vendorId: Types.ObjectId | null = null;
  if (payload.vendorId) {
    if (!Types.ObjectId.isValid(String(payload.vendorId))) throw new AppError("Invalid vendor ID", 400);
    const vendor = await FinanceVendor.findOne({ _id: payload.vendorId, schoolId, isActive: true });
    if (!vendor) throw new AppError("Active vendor not found in this school", 404);
    vendorId = vendor._id;
  }

  const voucherNumber = `EXP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  let expense: ExpenseDocument;
  try {
    expense = await Expense.create({
      schoolId, voucherNumber, categoryId: category._id, vendorId,
      title: String(payload.title || "").trim(), description: payload.description, amount,
      paymentMethod: payload.paymentMethod || FINANCE_PAYMENT_METHODS.CASH,
      transactionReference: payload.transactionReference, sourceRef,
      paidTo: String(payload.paidTo || "").trim(), expenseDate,
      status: FINANCE_RECORD_STATUS.ACTIVE, attachmentUrl: payload.attachmentUrl,
      remarks: payload.remarks, createdBy: userId,
    });
  } catch (error: any) {
    if (sourceRef && error?.code === 11000) {
      const existing = await Expense.findOne({ schoolId, sourceRef });
      if (existing) {
        const transaction = await FinanceTransaction.findOne({ schoolId, sourceModel: "Expense", sourceId: existing._id });
        if (!transaction) {
          await createTransaction({ schoolId, type: FINANCE_TRANSACTION_TYPES.EXPENSE, sourceId: existing._id, sourceModel: "Expense", categoryId: existing.categoryId, title: existing.title, amount: existing.amount, paymentMethod: existing.paymentMethod, transactionReference: existing.transactionReference, transactionDate: existing.expenseDate, createdBy: userId });
        }
        return existing;
      }
    }
    throw error;
  }

  await createTransaction({
    schoolId, type: FINANCE_TRANSACTION_TYPES.EXPENSE, sourceId: expense._id,
    sourceModel: "Expense", categoryId: category._id, title: expense.title,
    amount, paymentMethod: expense.paymentMethod, transactionReference: expense.transactionReference,
    transactionDate: expenseDate, createdBy: userId,
  });
  return expense;
};

export const getExpenseRecordsService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const filter = buildRecordFilter(actor, query, "expenseDate");
  const { page, limit, skip } = getPagination(query);

  const [items, total] = await Promise.all([
    Expense.find(filter)
      .populate("categoryId", "name code")
      .populate("vendorId", "name code phone")
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return {
    items,
    pagination: getPaginationData(page, limit, total),
  };
};

export const getExpenseByIdService = async (
  id: string,
  actor: FinanceActor
) => {
  const expense = await Expense.findOne({
    _id: ensureObjectId(id),
    schoolId: getSchoolId(actor),
  }).populate("categoryId", "name code").populate("vendorId", "name code phone");

  if (!expense) {
    throw new AppError("Expense record not found", 404);
  }

  return expense;
};

export const updateExpenseService = async (
  id: string,
  payload: FinancePayload,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);

  const expense = await Expense.findOne({
    _id: ensureObjectId(id),
    schoolId,
  });

  if (!expense) {
    throw new AppError("Expense record not found", 404);
  }

  if (expense.status === FINANCE_RECORD_STATUS.CANCELLED) {
    throw new AppError("Cancelled expense cannot be updated", 400);
  }

  if (payload.categoryId) {
    const category = await ensureCategory(
      String(payload.categoryId),
      schoolId,
      FINANCE_CATEGORY_TYPES.EXPENSE
    );
    expense.categoryId = category._id;
  }
  if (payload.vendorId !== undefined) {
    if (!payload.vendorId) {
      expense.vendorId = null;
    } else {
      if (!Types.ObjectId.isValid(String(payload.vendorId))) throw new AppError("Invalid vendor ID", 400);
      const vendor = await FinanceVendor.findOne({ _id: payload.vendorId, schoolId, isActive: true });
      if (!vendor) throw new AppError("Active vendor not found in this school", 404);
      expense.vendorId = vendor._id;
      if (payload.paidTo === undefined) expense.paidTo = vendor.name;
    }
  }

  if (payload.amount !== undefined) {
    expense.amount = ensureValidAmount(payload.amount);
  }

  if (payload.title !== undefined) {
    expense.title = String(payload.title).trim();
  }

  if (payload.description !== undefined) {
    expense.description = String(payload.description);
  }

  if (payload.paymentMethod !== undefined) {
    expense.paymentMethod = String(payload.paymentMethod);
  }

  if (payload.transactionReference !== undefined) {
    expense.transactionReference = String(payload.transactionReference);
  }

  if (payload.paidTo !== undefined) {
    expense.paidTo = String(payload.paidTo).trim();
  }

  if (payload.expenseDate !== undefined) {
    const date = new Date(String(payload.expenseDate));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("Invalid expense date", 400);
    }
    expense.expenseDate = date;
  }

  if (payload.remarks !== undefined) {
    expense.remarks = String(payload.remarks);
  }

  if (payload.attachmentUrl !== undefined) {
    expense.attachmentUrl = String(payload.attachmentUrl);
  }

  expense.updatedBy = getActorId(actor);
  await expense.save();

  await FinanceTransaction.updateOne(
    {
      schoolId,
      sourceId: expense._id,
      sourceModel: "Expense",
    },
    {
      $set: {
        categoryId: expense.categoryId,
        title: expense.title,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        transactionReference: expense.transactionReference,
        transactionDate: expense.expenseDate,
      },
    }
  );

  return expense;
};

export const deleteExpenseService = async (
  id: string,
  actor: FinanceActor
) => {
  const schoolId = getSchoolId(actor);

  const expense = await Expense.findOne({
    _id: ensureObjectId(id),
    schoolId,
  });

  if (!expense) {
    throw new AppError("Expense record not found", 404);
  }

  expense.status = FINANCE_RECORD_STATUS.CANCELLED;
  expense.updatedBy = getActorId(actor);
  await expense.save();

  await FinanceTransaction.updateOne(
    {
      schoolId,
      sourceId: expense._id,
      sourceModel: "Expense",
    },
    { $set: { status: FINANCE_RECORD_STATUS.CANCELLED } }
  );

  return expense;
};

// --------------------------------------------------
// 5. TRANSACTIONS
// --------------------------------------------------

export const getTransactionsService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);

  const filter: Record<string, unknown> = { schoolId };

  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.categoryId) {
    filter.categoryId = ensureObjectId(query.categoryId);
  }

  Object.assign(filter, getDateFilter(query, "transactionDate"));

  if (query.search?.trim()) {
    filter.$or = [
      { title: { $regex: query.search.trim(), $options: "i" } },
      { transactionNumber: { $regex: query.search.trim(), $options: "i" } },
      { transactionReference: { $regex: query.search.trim(), $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    FinanceTransaction.find(filter)
      .populate("categoryId", "name code")
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FinanceTransaction.countDocuments(filter),
  ]);

  return {
    items,
    pagination: getPaginationData(page, limit, total),
  };
};

export const getTransactionByIdService = async (
  id: string,
  actor: FinanceActor
) => {
  const transaction = await FinanceTransaction.findOne({
    _id: ensureObjectId(id),
    schoolId: getSchoolId(actor),
  }).populate("categoryId", "name code");

  if (!transaction) {
    throw new AppError("Finance transaction not found", 404);
  }

  return transaction;
};

// --------------------------------------------------
// 6. FINANCIAL REPORTS
// --------------------------------------------------

const getFinancialReport = async (
  actor: FinanceActor,
  query: FinanceQuery,
  model: typeof Income | typeof Expense,
  dateField: "receivedDate" | "expenseDate"
) => {
  const filter = buildRecordFilter(actor, query, dateField);

  const records = await model.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$categoryId",
        totalAmount: { $sum: "$amount" },
        totalRecords: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "financecategories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        categoryId: "$_id",
        categoryName: "$category.name",
        totalAmount: 1,
        totalRecords: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const summary = await model.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalRecords: { $sum: 1 },
      },
    },
  ]);

  return {
    summary: {
      totalAmount: summary[0]?.totalAmount || 0,
      totalRecords: summary[0]?.totalRecords || 0,
    },
    categories: records,
  };
};

export const getIncomeReportService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  return getFinancialReport(actor, query, Income, "receivedDate");
};

export const getExpenseReportService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  return getFinancialReport(actor, query, Expense, "expenseDate");
};

export const getProfitLossReportService = async (
  actor: FinanceActor,
  query: FinanceQuery
) => {
  const schoolId = getSchoolId(actor);
  const incomeFilter = { ...buildRecordFilter(actor, query, "receivedDate"), status: FINANCE_RECORD_STATUS.ACTIVE };
  const expenseFilter = { ...buildRecordFilter(actor, query, "expenseDate"), status: FINANCE_RECORD_STATUS.ACTIVE };
  const feePaymentFilter: Record<string, unknown> = {
    schoolId,
    paymentStatus: "SUCCESS",
    isDeleted: false,
    ...getDateFilter(query, "paymentDate"),
  };
  const refundFilter: Record<string, unknown> = {
    schoolId,
    status: "PROCESSED",
    isDeleted: false,
    ...getDateFilter(query, "processedAt"),
  };
  const payrollPostingFilter: Record<string, unknown> = { schoolId, sourceModel: "Payroll", type: "EXPENSE", status: FINANCE_RECORD_STATUS.ACTIVE, ...getDateFilter(query, "transactionDate") };
  if (query.academicSessionId) {
    feePaymentFilter.sessionId = ensureObjectId(query.academicSessionId);
    refundFilter.sessionId = ensureObjectId(query.academicSessionId);
  }

  const [income, feeCollections, refunds, expense, payrollExpense] = await Promise.all([
    Income.aggregate([
      { $match: incomeFilter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    FeePayment.aggregate([
      { $match: feePaymentFilter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    FeeRefund.aggregate([
      { $match: refundFilter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    FinanceTransaction.aggregate([{ $match: payrollPostingFilter }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
  ]);

  const otherIncome = income[0]?.total || 0;
  const feeCollection = feeCollections[0]?.total || 0;
  const totalRefunds = refunds[0]?.total || 0;
  const payrollExpenses = payrollExpense[0]?.total || 0;
  const totalExpenses = (expense[0]?.total || 0) + payrollExpenses;
  const netIncome = otherIncome + feeCollection - totalRefunds;

  return {
    otherIncome,
    feeCollection,
    totalRefunds,
    totalIncome: netIncome,
    totalExpenses,
    payrollExpenses,
    netProfit: netIncome - totalExpenses,
    isProfit: netIncome >= totalExpenses,
    counts: {
      otherIncomeRecords: income[0]?.count || 0,
      feePayments: feeCollections[0]?.count || 0,
      refunds: refunds[0]?.count || 0,
      expenses: expense[0]?.count || 0,
      payrollExpenses: payrollExpense[0]?.count || 0,
    },
  };
};
