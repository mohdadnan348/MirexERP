
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

import {
  FEE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
} from "../../config/constants";

// --------------------------------------------------
// ENUMS
// --------------------------------------------------

export const FEE_FREQUENCIES = {
  ONE_TIME: "ONE_TIME",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  HALF_YEARLY: "HALF_YEARLY",
  ANNUALLY: "ANNUALLY",
  CUSTOM: "CUSTOM",
} as const;

export const FEE_DISCOUNT_TYPES = {
  FIXED: "FIXED",
  PERCENTAGE: "PERCENTAGE",
} as const;

export const FEE_INVOICE_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;

export const FEE_REFUND_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PROCESSED: "PROCESSED",
} as const;

export type FeeFrequency =
  (typeof FEE_FREQUENCIES)[keyof typeof FEE_FREQUENCIES];

export type FeeDiscountType =
  (typeof FEE_DISCOUNT_TYPES)[keyof typeof FEE_DISCOUNT_TYPES];

// --------------------------------------------------
// COMMON SUBDOCUMENTS
// --------------------------------------------------

const FeeStructureItemSchema = new Schema(
  {
    feeHeadId: {
      type: Schema.Types.ObjectId,
      ref: "FeeHead",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    isOptional: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const FeeInvoiceItemSchema = new Schema(
  {
    feeHeadId: {
      type: Schema.Types.ObjectId,
      ref: "FeeHead",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

// --------------------------------------------------
// 1. FEE HEAD
// --------------------------------------------------

export interface IFeeHead extends Document {
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  isOptional: boolean;
  isRefundable: boolean;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

const FeeHeadSchema = new Schema<IFeeHead>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isOptional: {
      type: Boolean,
      default: false,
    },
    isRefundable: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, collection: "fee_heads" }
);

FeeHeadSchema.index(
  { schoolId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeeHeadSchema.index(
  { schoolId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeeHeadSchema.index({ schoolId: 1, isActive: 1 });

// --------------------------------------------------
// 2. FEE STRUCTURE
// --------------------------------------------------

export interface IFeeStructure extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  frequency: FeeFrequency;
  classIds: Types.ObjectId[];
  items: Array<{
    feeHeadId: Types.ObjectId;
    name: string;
    amount: number;
    isOptional: boolean;
  }>;
  totalAmount: number;
  dueDay?: number;
  lateFineType: "NONE" | "FLAT" | "PER_DAY";
  lateFineAmount: number;
  graceDays: number;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

const FeeStructureSchema = new Schema<IFeeStructure>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    frequency: {
      type: String,
      enum: Object.values(FEE_FREQUENCIES),
      required: true,
    },
    classIds: [{
      type: Schema.Types.ObjectId,
      ref: "Class",
    }],
    items: {
      type: [FeeStructureItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "At least one fee item is required",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDay: {
      type: Number,
      min: 1,
      max: 28,
    },
    lateFineType: { type: String, enum: ["NONE", "FLAT", "PER_DAY"], default: "NONE" },
    lateFineAmount: { type: Number, min: 0, default: 0 },
    graceDays: { type: Number, min: 0, max: 365, default: 0 },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, collection: "fee_structures" }
);

FeeStructureSchema.index(
  { schoolId: 1, sessionId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeeStructureSchema.index({
  schoolId: 1,
  sessionId: 1,
  classIds: 1,
  isActive: 1,
});

// --------------------------------------------------
// 3. STUDENT FEE ASSIGNMENT
// --------------------------------------------------

export interface IStudentFeeAssignment extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  feeStructureId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId?: Types.ObjectId | null;
  customItems?: Array<{
    feeHeadId: Types.ObjectId;
    name: string;
    amount: number;
  }>;
  assignedAmount: number;
  assignedAt: Date;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

const StudentFeeAssignmentSchema =
  new Schema<IStudentFeeAssignment>(
    {
      schoolId: {
        type: Schema.Types.ObjectId,
        ref: "School",
        required: true,
        index: true,
      },
      sessionId: {
        type: Schema.Types.ObjectId,
        ref: "Session",
        required: true,
      },
      studentId: {
        type: Schema.Types.ObjectId,
        ref: "Student",
        required: true,
      },
      feeStructureId: {
        type: Schema.Types.ObjectId,
        ref: "FeeStructure",
        required: true,
      },
      classId: {
        type: Schema.Types.ObjectId,
        ref: "Class",
        required: true,
      },
      sectionId: {
        type: Schema.Types.ObjectId,
        ref: "Section",
        default: null,
      },
      customItems: {
        type: [{
          feeHeadId: {
            type: Schema.Types.ObjectId,
            ref: "FeeHead",
            required: true,
          },
          name: { type: String, required: true, trim: true },
          amount: { type: Number, required: true, min: 0 },
        }],
        default: [],
      },
      assignedAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      assignedAt: {
        type: Date,
        default: Date.now,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      isDeleted: {
        type: Boolean,
        default: false,
        select: false,
      },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    { timestamps: true, collection: "student_fee_assignments" }
  );

StudentFeeAssignmentSchema.index(
  { schoolId: 1, sessionId: 1, studentId: 1, feeStructureId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

StudentFeeAssignmentSchema.index({
  schoolId: 1,
  sessionId: 1,
  studentId: 1,
  isActive: 1,
});

// --------------------------------------------------
// 4. FEE INVOICE
// --------------------------------------------------

export interface IFeeInvoice extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  feeAssignmentId?: Types.ObjectId | null;
  examId?: Types.ObjectId | null;
  sourceType?: string;
  sourceId?: Types.ObjectId;
  gatewayOrderId?: string;
  gatewayOrderAmountPaise?: number;
  invoiceNumber: string;
  items: Array<{
    feeHeadId?: Types.ObjectId | null;
    name: string;
    amount: number;
    discountAmount: number;
    fineAmount: number;
    netAmount: number;
  }>;
  subtotal: number;
  discountAmount: number;
  fineAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: Date;
  lateFineType: "NONE" | "FLAT" | "PER_DAY";
  lateFineAmount: number;
  graceDays: number;
  lateFineAppliedAmount: number;
  lateFineAppliedDays: number;
  status: string;
  remarks?: string;
  issuedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

const FeeInvoiceSchema = new Schema<IFeeInvoice>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    feeAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "StudentFeeAssignment",
      default: null,
    },
    examId: { type: Schema.Types.ObjectId, ref: "Exam", default: null, index: true },
    sourceType: { type: String, enum: ["TRANSPORT_ASSIGNMENT"] },
    sourceId: { type: Schema.Types.ObjectId },
    gatewayOrderId: { type: String, trim: true, index: true },
    gatewayOrderAmountPaise: { type: Number, min: 1 },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    items: {
      type: [FeeInvoiceItemSchema],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    lateFineType: { type: String, enum: ["NONE", "FLAT", "PER_DAY"], default: "NONE" },
    lateFineAmount: { type: Number, min: 0, default: 0 },
    graceDays: { type: Number, min: 0, max: 365, default: 0 },
    lateFineAppliedAmount: { type: Number, min: 0, default: 0 },
    lateFineAppliedDays: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(FEE_INVOICE_STATUS),
      default: FEE_INVOICE_STATUS.PENDING,
    },
    remarks: {
      type: String,
      trim: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, collection: "fee_invoices" }
);

FeeInvoiceSchema.index(
  { schoolId: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeeInvoiceSchema.index({
  schoolId: 1,
  sessionId: 1,
  studentId: 1,
  status: 1,
});

FeeInvoiceSchema.index({ schoolId: 1, examId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { examId: { $type: "objectId" }, isDeleted: false }, name: "uniq_exam_fee_invoice_student" });
FeeInvoiceSchema.index({ schoolId: 1, sourceType: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: "objectId" }, isDeleted: false }, name: "uniq_fee_invoice_source" });

FeeInvoiceSchema.index({
  schoolId: 1,
  dueDate: 1,
  status: 1,
});

// --------------------------------------------------
// 5. FEE PAYMENT
// --------------------------------------------------

export interface IFeePayment extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  transactionReference?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  idempotencyKey?: string;
  paymentDate: Date;
  remarks?: string;
  collectedBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date | null;
}

const FeePaymentSchema = new Schema<IFeePayment>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "FeeInvoice",
      required: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be greater than zero"],
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
    collectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "fee_payments" }
);

FeePaymentSchema.index(
  { schoolId: 1, receiptNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeePaymentSchema.index(
  { schoolId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      idempotencyKey: { $type: "string" },
    },
  }
);

FeePaymentSchema.index({
  schoolId: 1,
  studentId: 1,
  paymentDate: -1,
});

// --------------------------------------------------
// 6. FEE DISCOUNT
// --------------------------------------------------

export interface IFeeDiscount extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId?: Types.ObjectId | null;
  name: string;
  discountType: FeeDiscountType;
  value: number;
  discountAmount: number;
  reason: string;
  isApproved: boolean;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
}

const FeeDiscountSchema = new Schema<IFeeDiscount>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "FeeInvoice",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: Object.values(FEE_DISCOUNT_TYPES),
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, collection: "fee_discounts" }
);

FeeDiscountSchema.index({
  schoolId: 1,
  sessionId: 1,
  studentId: 1,
});

// --------------------------------------------------
// 7. FEE REFUND
// --------------------------------------------------

export interface IFeeRefund extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  paymentId: Types.ObjectId;
  refundNumber: string;
  amount: number;
  reason: string;
  status: string;
  refundMethod?: string;
  transactionReference?: string;
  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  processedAt?: Date | null;
  remarks?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeeRefundSchema = new Schema<IFeeRefund>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "FeePayment",
      required: true,
    },
    refundNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Refund amount must be greater than zero"],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(FEE_REFUND_STATUS),
      default: FEE_REFUND_STATUS.PENDING,
    },
    refundMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  { timestamps: true, collection: "fee_refunds" }
);

FeeRefundSchema.index(
  { schoolId: 1, refundNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

FeeRefundSchema.index({
  schoolId: 1,
  paymentId: 1,
  status: 1,
});

// --------------------------------------------------
// MODEL EXPORTS
// --------------------------------------------------

const FeeHead: Model<IFeeHead> =
  mongoose.models.FeeHead ||
  mongoose.model<IFeeHead>("FeeHead", FeeHeadSchema);

const FeeStructure: Model<IFeeStructure> =
  mongoose.models.FeeStructure ||
  mongoose.model<IFeeStructure>("FeeStructure", FeeStructureSchema);

const StudentFeeAssignment: Model<IStudentFeeAssignment> =
  mongoose.models.StudentFeeAssignment ||
  mongoose.model<IStudentFeeAssignment>(
    "StudentFeeAssignment",
    StudentFeeAssignmentSchema
  );

const FeeInvoice: Model<IFeeInvoice> =
  mongoose.models.FeeInvoice ||
  mongoose.model<IFeeInvoice>("FeeInvoice", FeeInvoiceSchema);

const FeePayment: Model<IFeePayment> =
  mongoose.models.FeePayment ||
  mongoose.model<IFeePayment>("FeePayment", FeePaymentSchema);

const FeeDiscount: Model<IFeeDiscount> =
  mongoose.models.FeeDiscount ||
  mongoose.model<IFeeDiscount>("FeeDiscount", FeeDiscountSchema);

const FeeRefund: Model<IFeeRefund> =
  mongoose.models.FeeRefund ||
  mongoose.model<IFeeRefund>("FeeRefund", FeeRefundSchema);

export {
  FeeHead,
  FeeStructure,
  StudentFeeAssignment,
  FeeInvoice,
  FeePayment,
  FeeDiscount,
  FeeRefund,
};

export { FeeInvoice as Fee };
export default FeeInvoice;