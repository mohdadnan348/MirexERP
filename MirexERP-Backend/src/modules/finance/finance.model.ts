
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

// --------------------------------------------------
// ENUMS
// --------------------------------------------------

export const FINANCE_CATEGORY_TYPES = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export const FINANCE_PAYMENT_METHODS = {
  CASH: "CASH",
  UPI: "UPI",
  CARD: "CARD",
  NET_BANKING: "NET_BANKING",
  CHEQUE: "CHEQUE",
  BANK_TRANSFER: "BANK_TRANSFER",
  OTHER: "OTHER",
  RAZORPAY: "RAZORPAY",
} as const;

export const FINANCE_TRANSACTION_TYPES = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export const FINANCE_RECORD_STATUS = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
} as const;

// --------------------------------------------------
// COMMON TYPES
// --------------------------------------------------

export interface FinanceActor {
  userId: string;
  role: string;
  schoolId: string | null;
}

export interface FinanceCategoryDocument extends Document {
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  type: "INCOME" | "EXPENSE";
  description?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncomeDocument extends Document {
  schoolId: Types.ObjectId;
  receiptNumber: string;
  categoryId: Types.ObjectId;
  title: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  receivedFrom: string;
  receivedDate: Date;
  academicSessionId?: Types.ObjectId;
  status: string;
  attachmentUrl?: string;
  remarks?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseDocument extends Document {
  schoolId: Types.ObjectId;
  voucherNumber: string;
  categoryId: Types.ObjectId;
  vendorId?: Types.ObjectId | null;
  title: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  sourceRef?: string;
  paidTo: string;
  expenseDate: Date;
  status: string;
  attachmentUrl?: string;
  remarks?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceTransactionDocument extends Document {
  schoolId: Types.ObjectId;
  transactionNumber: string;
  type: "INCOME" | "EXPENSE";
  sourceId: Types.ObjectId;
  sourceModel: "Income" | "Expense" | "FeePayment" | "FeeRefund" | "Payroll";
  categoryId: Types.ObjectId;
  title: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  transactionDate: Date;
  status: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// --------------------------------------------------
// CATEGORY SCHEMA
// --------------------------------------------------

const financeCategorySchema =
  new Schema<FinanceCategoryDocument>(
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
        maxlength: 100,
      },

      code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 30,
      },

      type: {
        type: String,
        enum: Object.values(FINANCE_CATEGORY_TYPES),
        required: true,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      isActive: {
        type: Boolean,
        default: true,
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

financeCategorySchema.index(
  { schoolId: 1, code: 1, type: 1 },
  { unique: true }
);

financeCategorySchema.index({
  schoolId: 1,
  type: 1,
  isActive: 1,
});

// --------------------------------------------------
// INCOME SCHEMA
// --------------------------------------------------

const incomeSchema = new Schema<IncomeDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "FinanceCategory",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(FINANCE_PAYMENT_METHODS),
      required: true,
    },

    transactionReference: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    receivedFrom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    receivedDate: {
      type: Date,
      required: true,
    },

    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
    },

    status: {
      type: String,
      enum: Object.values(FINANCE_RECORD_STATUS),
      default: FINANCE_RECORD_STATUS.ACTIVE,
      index: true,
    },

    attachmentUrl: {
      type: String,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

incomeSchema.index(
  { schoolId: 1, receiptNumber: 1 },
  { unique: true }
);

incomeSchema.index({
  schoolId: 1,
  receivedDate: -1,
});

incomeSchema.index({
  schoolId: 1,
  categoryId: 1,
  status: 1,
});

// --------------------------------------------------
// EXPENSE SCHEMA
// --------------------------------------------------

const expenseSchema = new Schema<ExpenseDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    voucherNumber: {
      type: String,
      required: true,
      trim: true,
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "FinanceCategory",
      required: true,
    },
    vendorId: { type: Schema.Types.ObjectId, ref: "FinanceVendor", default: null, index: true },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(FINANCE_PAYMENT_METHODS),
      required: true,
    },

    transactionReference: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    sourceRef: { type: String, trim: true, maxlength: 180 },

    paidTo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    expenseDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(FINANCE_RECORD_STATUS),
      default: FINANCE_RECORD_STATUS.ACTIVE,
      index: true,
    },

    attachmentUrl: {
      type: String,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

expenseSchema.index(
  { schoolId: 1, voucherNumber: 1 },
  { unique: true }
);

expenseSchema.index({
  schoolId: 1,
  expenseDate: -1,
});

expenseSchema.index({
  schoolId: 1,
  categoryId: 1,
  status: 1,
});
expenseSchema.index({ schoolId: 1, sourceRef: 1 }, { unique: true, partialFilterExpression: { sourceRef: { $type: "string" } }, name: "uniq_expense_source_ref" });

// --------------------------------------------------
// FINANCE TRANSACTION SCHEMA
// --------------------------------------------------

const financeTransactionSchema =
  new Schema<FinanceTransactionDocument>(
    {
      schoolId: {
        type: Schema.Types.ObjectId,
        ref: "School",
        required: true,
        index: true,
      },

      transactionNumber: {
        type: String,
        required: true,
        trim: true,
      },

      type: {
        type: String,
        enum: Object.values(FINANCE_TRANSACTION_TYPES),
        required: true,
      },

      sourceId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      sourceModel: {
        type: String,
        enum: ["Income", "Expense", "FeePayment", "FeeRefund", "Payroll"],
        required: true,
      },

      categoryId: {
        type: Schema.Types.ObjectId,
        ref: "FinanceCategory",
        required: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0.01,
      },

      paymentMethod: {
        type: String,
        enum: Object.values(FINANCE_PAYMENT_METHODS),
        required: true,
      },

      transactionReference: {
        type: String,
        trim: true,
      },

      transactionDate: {
        type: Date,
        required: true,
      },

      status: {
        type: String,
        enum: Object.values(FINANCE_RECORD_STATUS),
        default: FINANCE_RECORD_STATUS.ACTIVE,
        index: true,
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

financeTransactionSchema.index(
  { schoolId: 1, transactionNumber: 1 },
  { unique: true }
);

financeTransactionSchema.index({
  schoolId: 1,
  transactionDate: -1,
});

financeTransactionSchema.index({
  schoolId: 1,
  type: 1,
  status: 1,
});

financeTransactionSchema.index(
  { schoolId: 1, sourceModel: 1, sourceId: 1 },
  { unique: true, name: "uniq_finance_source_posting" }
);

// --------------------------------------------------
// MODEL EXPORTS
// --------------------------------------------------

const FinanceCategory: Model<FinanceCategoryDocument> =
  mongoose.models.FinanceCategory ||
  mongoose.model<FinanceCategoryDocument>(
    "FinanceCategory",
    financeCategorySchema
  );

const Income: Model<IncomeDocument> =
  mongoose.models.Income ||
  mongoose.model<IncomeDocument>("Income", incomeSchema);

const Expense: Model<ExpenseDocument> =
  mongoose.models.Expense ||
  mongoose.model<ExpenseDocument>("Expense", expenseSchema);

const FinanceTransaction: Model<FinanceTransactionDocument> =
  mongoose.models.FinanceTransaction ||
  mongoose.model<FinanceTransactionDocument>(
    "FinanceTransaction",
    financeTransactionSchema
  );

export {
  FinanceCategory,
  Income,
  Expense,
  FinanceTransaction,
};

export { FinanceTransaction as Finance };
export default FinanceTransaction;
