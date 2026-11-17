
import { z } from "zod";
import {
  PayrollStatus,
  PaymentMethod,
} from "./payroll.model";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const amountSchema = z
  .number()
  .finite()
  .min(0, "Amount cannot be negative");

const allowanceSchema = z.object({
  houseRent: amountSchema.optional().default(0),
  transport: amountSchema.optional().default(0),
  medical: amountSchema.optional().default(0),
  special: amountSchema.optional().default(0),
  other: amountSchema.optional().default(0),
});

const deductionSchema = z.object({
  providentFund: amountSchema.optional().default(0),
  esi: amountSchema.optional().default(0),
  professionalTax: amountSchema.optional().default(0),
  incomeTax: amountSchema.optional().default(0),
  insurance: amountSchema.optional().default(0),
  leaveDeduction: amountSchema.optional().default(0),
  other: amountSchema.optional().default(0),
});

const attendanceSchema = z.object({
  workingDays: z.number().int().min(0).optional().default(0),
  presentDays: z.number().int().min(0).optional().default(0),
  absentDays: z.number().int().min(0).optional().default(0),
  paidLeaveDays: z.number().int().min(0).optional().default(0),
  unpaidLeaveDays: z.number().int().min(0).optional().default(0),
  halfDayDays: z.number().int().min(0).optional().default(0),
  lateDays: z.number().int().min(0).optional().default(0),
}).refine(
  (data) =>
    data.presentDays +
    data.absentDays +
    data.paidLeaveDays +
    data.unpaidLeaveDays +
    data.halfDayDays * 0.5 <= data.workingDays,
  {
    message: "Attendance and leave days cannot exceed working days",
    path: ["workingDays"],
  }
);

// Create Payroll
export const createPayrollSchema = z.object({
  employeeId: objectIdSchema,

  payrollMonth: z.number().int().min(1).max(12),

  payrollYear: z.number().int().min(2000).max(2100),

  basicSalary: amountSchema,

  allowances: allowanceSchema.optional(),

  deductions: deductionSchema.optional(),

  workingDays: z.number().int().min(0).optional().default(0),

  presentDays: z.number().int().min(0).optional().default(0),

  absentDays: z.number().int().min(0).optional().default(0),

  paidLeaveDays: z.number().int().min(0).optional().default(0),

  unpaidLeaveDays: z.number().int().min(0).optional().default(0),

  remarks: z.string().trim().max(1000).optional(),
}).refine(
  (data) =>
    data.presentDays +
    data.absentDays +
    data.paidLeaveDays +
    data.unpaidLeaveDays +
    data.halfDayDays * 0.5 <= data.workingDays,
  {
    message: "Attendance and leave days cannot exceed working days",
    path: ["workingDays"],
  }
);

// Update Payroll
export const updatePayrollSchema = z.object({
  basicSalary: amountSchema.optional(),

  allowances: allowanceSchema.optional(),

  deductions: deductionSchema.optional(),

  workingDays: z.number().int().min(0).optional(),

  presentDays: z.number().int().min(0).optional(),

  absentDays: z.number().int().min(0).optional(),

  paidLeaveDays: z.number().int().min(0).optional(),

  unpaidLeaveDays: z.number().int().min(0).optional(),

  remarks: z.string().trim().max(1000).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field is required for update",
  }
).refine(
  (data) => {
    const attendanceFields = [
      data.workingDays,
      data.presentDays,
      data.absentDays,
      data.paidLeaveDays,
      data.unpaidLeaveDays,
    ];

    if (attendanceFields.every((value) => value === undefined)) {
      return true;
    }

    return (
      (data.presentDays ?? 0) +
      (data.absentDays ?? 0) +
      (data.paidLeaveDays ?? 0) +
      (data.unpaidLeaveDays ?? 0) <=
      (data.workingDays ?? 0)
    );
  },
  {
    message: "Provide complete attendance values when updating attendance",
    path: ["workingDays"],
  }
);

// Get Payroll List
export const getPayrollsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  month: z.string().regex(/^(0?[1-9]|1[0-2])$/).optional(),

  year: z.coerce.number().int().min(2000).max(2100).optional(),

  status: z.nativeEnum(PayrollStatus).optional(),

  employeeId: objectIdSchema.optional(),
});

// Payroll ID Params
export const payrollIdSchema = z.object({
  id: objectIdSchema,
});

// Employee Payroll History
export const employeePayrollHistorySchema = z.object({
  employeeId: objectIdSchema,
});

// Export inferred types
export type CreatePayrollInput = z.infer<
  typeof createPayrollSchema
>;

export type UpdatePayrollInput = z.infer<
  typeof updatePayrollSchema
>;

export type GetPayrollsQuery = z.infer<
  typeof getPayrollsSchema
>;

export type EmployeePayrollHistoryQuery = z.infer<
  typeof employeePayrollHistorySchema
>;
