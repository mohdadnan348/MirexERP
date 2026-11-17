import mongoose, { ClientSession, Types } from "mongoose";
import { FinanceCategory, FinanceTransaction, FINANCE_PAYMENT_METHODS, FINANCE_TRANSACTION_TYPES, FINANCE_RECORD_STATUS } from "./finance.model";
import { FeePayment, FeeRefund } from "../fees/fees.model";
import { Payroll } from "../payroll/payroll.model";
import { AppError } from "../../utils/AppError";

const mapPaymentMethod = (value: string): string => {
  const supported = new Set<string>(Object.values(FINANCE_PAYMENT_METHODS));
  return supported.has(value) ? value : FINANCE_PAYMENT_METHODS.OTHER;
};

const getSystemCategory = async (schoolId: Types.ObjectId, type: "INCOME" | "EXPENSE", createdBy: Types.ObjectId, session: ClientSession, custom?: { code: string; name: string }) => {
  const code = custom?.code || (type === "INCOME" ? "FEE_COLLECTION" : "FEE_REFUND");
  const name = custom?.name || (type === "INCOME" ? "Fee Collection" : "Fee Refunds");
  const category = await FinanceCategory.findOneAndUpdate(
    { schoolId, code, type },
    { $setOnInsert: { schoolId, code, name, type, description: "System-managed posting from Fees Management", isActive: true, createdBy } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
  if (!category) throw new AppError("Unable to prepare the system finance category", 500);
  return category;
};

const createLinkedPosting = async (input: {
  schoolId: Types.ObjectId; sourceId: Types.ObjectId; sourceModel: "FeePayment" | "FeeRefund" | "Payroll";
  type: "INCOME" | "EXPENSE"; title: string; amount: number; paymentMethod: string;
  reference?: string; transactionDate: Date; createdBy: Types.ObjectId; session: ClientSession; category?: { code: string; name: string };
}) => {
  const existing = await FinanceTransaction.findOne({ schoolId: input.schoolId, sourceModel: input.sourceModel, sourceId: input.sourceId }).session(input.session);
  if (existing) return existing;
  const category = await getSystemCategory(input.schoolId, input.type, input.createdBy, input.session, input.category);
  const transactionNumber = `TXN-${Date.now()}-${new Types.ObjectId().toString().slice(-8).toUpperCase()}`;
  try {
    const [created] = await FinanceTransaction.create([{
      schoolId: input.schoolId, transactionNumber, type: input.type, sourceId: input.sourceId,
      sourceModel: input.sourceModel, categoryId: category._id, title: input.title,
      amount: input.amount, paymentMethod: mapPaymentMethod(input.paymentMethod),
      transactionReference: input.reference, transactionDate: input.transactionDate,
      status: FINANCE_RECORD_STATUS.ACTIVE, createdBy: input.createdBy,
    }], { session: input.session });
    return created;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await FinanceTransaction.findOne({ schoolId: input.schoolId, sourceModel: input.sourceModel, sourceId: input.sourceId }).session(input.session);
      if (duplicate) return duplicate;
    }
    throw error;
  }
};

export const postFeePaymentToFinance = async (payment: {
  _id: Types.ObjectId; schoolId: Types.ObjectId; amount: number; paymentMethod: string;
  transactionReference?: string; paymentDate: Date; receiptNumber: string; collectedBy: Types.ObjectId;
}, session: ClientSession) => createLinkedPosting({
  schoolId: payment.schoolId, sourceId: payment._id, sourceModel: "FeePayment", type: FINANCE_TRANSACTION_TYPES.INCOME,
  title: `Fee collection - ${payment.receiptNumber}`, amount: payment.amount, paymentMethod: payment.paymentMethod,
  reference: payment.transactionReference, transactionDate: payment.paymentDate, createdBy: payment.collectedBy, session,
});

export const postFeeRefundToFinance = async (refund: {
  _id: Types.ObjectId; schoolId: Types.ObjectId; amount: number; refundMethod?: string;
  transactionReference?: string; processedAt: Date; refundNumber: string; requestedBy: Types.ObjectId;
}, session: ClientSession) => createLinkedPosting({
  schoolId: refund.schoolId, sourceId: refund._id, sourceModel: "FeeRefund", type: FINANCE_TRANSACTION_TYPES.EXPENSE,
  title: `Fee refund - ${refund.refundNumber}`, amount: refund.amount, paymentMethod: refund.refundMethod || FINANCE_PAYMENT_METHODS.OTHER,
  reference: refund.transactionReference, transactionDate: refund.processedAt, createdBy: refund.requestedBy, session,
});

export const postPayrollToFinance = async (payroll: { _id: Types.ObjectId; schoolId: Types.ObjectId; netSalary: number; paymentMethod: string; transactionReference?: string; paymentDate: Date; payrollMonth: number; payrollYear: number; paidBy: Types.ObjectId }, session: ClientSession) => createLinkedPosting({
  schoolId: payroll.schoolId, sourceId: payroll._id, sourceModel: "Payroll", type: FINANCE_TRANSACTION_TYPES.EXPENSE,
  title: `Staff salary - ${String(payroll.payrollMonth).padStart(2, "0")}/${payroll.payrollYear}`, amount: payroll.netSalary, paymentMethod: payroll.paymentMethod,
  reference: payroll.transactionReference, transactionDate: payroll.paymentDate, createdBy: payroll.paidBy, session, category: { code: "SALARY_EXPENSE", name: "Staff Salary" },
});

export const reconcileFinanceSourcePostingsService = async (schoolIdValue: string, userIdValue: string) => {
  if (!Types.ObjectId.isValid(schoolIdValue) || !Types.ObjectId.isValid(userIdValue)) throw new AppError("Valid school and user context are required", 400);
  const schoolId = new Types.ObjectId(schoolIdValue);
  const userId = new Types.ObjectId(userIdValue);
  const paymentFilter = { schoolId, paymentStatus: "SUCCESS", isDeleted: false };
  const refundFilter = { schoolId, status: "PROCESSED", isDeleted: false };
  const payrollFilter = { schoolId, paymentStatus: "PAID", isActive: true };
  const [postedPayments, postedRefunds, postedPayroll] = await Promise.all([
    FinanceTransaction.distinct("sourceId", { schoolId, sourceModel: "FeePayment" }),
    FinanceTransaction.distinct("sourceId", { schoolId, sourceModel: "FeeRefund" }),
    FinanceTransaction.distinct("sourceId", { schoolId, sourceModel: "Payroll" }),
  ]);
  const missingPaymentFilter = { ...paymentFilter, _id: { $nin: postedPayments } };
  const missingRefundFilter = { ...refundFilter, _id: { $nin: postedRefunds } };
  const missingPayrollFilter = { ...payrollFilter, _id: { $nin: postedPayroll } };
  const [payments, refunds, payrolls, missingPaymentCount, missingRefundCount, missingPayrollCount] = await Promise.all([
    FeePayment.find(missingPaymentFilter).sort({ paymentDate: 1 }).limit(1000).lean(),
    FeeRefund.find(missingRefundFilter).sort({ processedAt: 1 }).limit(1000).lean(),
    Payroll.find(missingPayrollFilter).sort({ paidAt: 1 }).limit(1000).lean(),
    FeePayment.countDocuments(missingPaymentFilter),
    FeeRefund.countDocuments(missingRefundFilter),
    Payroll.countDocuments(missingPayrollFilter),
  ]);
  let paymentPosted = 0;
  let refundPosted = 0;
  let payrollPosted = 0;
  for (const payment of payments) {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => { await postFeePaymentToFinance({ ...payment, collectedBy: payment.collectedBy || userId }, session); }); paymentPosted += 1; }
    finally { await session.endSession(); }
  }
  for (const refund of refunds) {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => { await postFeeRefundToFinance({ ...refund, processedAt: refund.processedAt || refund.updatedAt, requestedBy: refund.requestedBy || userId }, session); }); refundPosted += 1; }
    finally { await session.endSession(); }
  }
  for (const payroll of payrolls) {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => { await postPayrollToFinance({ ...payroll, paymentDate: payroll.paymentDate || payroll.paidAt || payroll.updatedAt, paidBy: payroll.paidBy || userId }, session); }); payrollPosted += 1; }
    finally { await session.endSession(); }
  }
  return {
    paymentPosted, refundPosted, payrollPosted,
    scannedPayments: payments.length, scannedRefunds: refunds.length, scannedPayroll: payrolls.length,
    olderRecordsNotScanned: Math.max(0, missingPaymentCount - payments.length) + Math.max(0, missingRefundCount - refunds.length) + Math.max(0, missingPayrollCount - payrolls.length),
  };
};
