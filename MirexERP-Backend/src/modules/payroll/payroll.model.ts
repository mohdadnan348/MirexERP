
import mongoose, { Document, Schema, Types } from "mongoose";

export enum PayrollStatus {
  DRAFT = "DRAFT",
  GENERATED = "GENERATED",
  APPROVED = "APPROVED",
  FINALIZED = "FINALIZED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

export enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  UPI = "UPI",
  CHEQUE = "CHEQUE",
}

export interface IPayroll extends Document {
  schoolId: Types.ObjectId;
  employeeId: Types.ObjectId;

  payrollMonth: number;
  payrollYear: number;

  basicSalary: number;

  allowances: {
    houseRent: number;
    transport: number;
    medical: number;
    special: number;
    other: number;
    total: number;
  };

  deductions: {
    providentFund: number;
    esi: number;
    professionalTax: number;
    incomeTax: number;
    insurance: number;
    leaveDeduction: number;
    other: number;
    total: number;
  };

  grossSalary: number;
  netSalary: number;

  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  halfDayDays?: number;
  lateDays?: number;
  salarySnapshot?: Record<string, unknown>;
  finalizedBy?: Types.ObjectId;
  finalizedAt?: Date;

  paymentStatus: PayrollStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: Date;
  transactionReference?: string;

  remarks?: string;

  generatedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  paidBy?: Types.ObjectId;

  approvedAt?: Date;
  paidAt?: Date;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const payrollSchema = new Schema<IPayroll>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    payrollMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    payrollYear: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    allowances: {
      houseRent: {
        type: Number,
        min: 0,
        default: 0,
      },
      transport: {
        type: Number,
        min: 0,
        default: 0,
      },
      medical: {
        type: Number,
        min: 0,
        default: 0,
      },
      special: {
        type: Number,
        min: 0,
        default: 0,
      },
      other: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    deductions: {
      providentFund: {
        type: Number,
        min: 0,
        default: 0,
      },
      esi: { type: Number, min: 0, default: 0 },
      professionalTax: {
        type: Number,
        min: 0,
        default: 0,
      },
      incomeTax: {
        type: Number,
        min: 0,
        default: 0,
      },
      insurance: {
        type: Number,
        min: 0,
        default: 0,
      },
      leaveDeduction: {
        type: Number,
        min: 0,
        default: 0,
      },
      other: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    grossSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    workingDays: {
      type: Number,
      min: 0,
      default: 0,
    },

    presentDays: {
      type: Number,
      min: 0,
      default: 0,
    },

    absentDays: {
      type: Number,
      min: 0,
      default: 0,
    },

    paidLeaveDays: {
      type: Number,
      min: 0,
      default: 0,
    },

    unpaidLeaveDays: {
      type: Number,
      min: 0,
      default: 0,
    },
    halfDayDays: { type: Number, min: 0, default: 0 },
    lateDays: { type: Number, min: 0, default: 0 },
    salarySnapshot: { type: Schema.Types.Mixed, default: null },
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User" },
    finalizedAt: { type: Date },

    paymentStatus: {
      type: String,
      enum: Object.values(PayrollStatus),
      default: PayrollStatus.DRAFT,
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
    },

    paymentDate: {
      type: Date,
    },

    transactionReference: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    paidAt: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One payroll record per employee per month per school.
payrollSchema.index(
  {
    schoolId: 1,
    employeeId: 1,
    payrollMonth: 1,
    payrollYear: 1,
  },
  { unique: true }
);

// School-wise payroll listing.
payrollSchema.index({
  schoolId: 1,
  payrollYear: 1,
  payrollMonth: 1,
  paymentStatus: 1,
});

// Employee payroll history.
payrollSchema.index({
  schoolId: 1,
  employeeId: 1,
  createdAt: -1,
});

export const Payroll = mongoose.model<IPayroll>(
  "Payroll",
  payrollSchema
);
