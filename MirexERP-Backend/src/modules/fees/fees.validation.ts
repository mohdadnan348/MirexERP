
import { z } from "zod";
import {
  PAYMENT_METHODS,
} from "../../config/constants";

import {
  FEE_FREQUENCIES,
  FEE_DISCOUNT_TYPES,
  FEE_INVOICE_STATUS,
  FEE_REFUND_STATUS,
} from "./fees.model";

// --------------------------------------------------
// COMMON SCHEMAS
// --------------------------------------------------

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const requiredTextSchema = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(150);

const optionalTextSchema = z
  .string()
  .trim()
  .max(1000)
  .optional();

const amountSchema = z
  .coerce
  .number()
  .finite()
  .min(0, "Amount cannot be negative");

const positiveAmountSchema = z
  .coerce
  .number()
  .finite()
  .gt(0, "Amount must be greater than zero");

const dateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.coerce.date());

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

const sortSchema = {
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

// --------------------------------------------------
// 1. FEE HEAD VALIDATION
// --------------------------------------------------

export const createFeeHeadSchema = z.object({
  name: requiredTextSchema.max(100),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),
  description: optionalTextSchema,
  isOptional: z.boolean().default(false),
  isRefundable: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateFeeHeadSchema = z
  .object({
    name: requiredTextSchema.max(100).optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .transform((value) => value.toUpperCase())
      .optional(),
    description: optionalTextSchema,
    isOptional: z.boolean().optional(),
    isRefundable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const feeHeadIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feeHeadListQuerySchema = z.object({
  ...paginationSchema,
  ...sortSchema,
  search: z.string().trim().optional(),
  isActive: booleanQuerySchema.optional(),
});

// --------------------------------------------------
// 2. FEE STRUCTURE VALIDATION
// --------------------------------------------------

const feeStructureItemSchema = z.object({
  feeHeadId: objectIdSchema,
  amount: amountSchema,
});

export const createFeeStructureSchema = z.object({
  sessionId: objectIdSchema,
  name: requiredTextSchema,
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),
  description: optionalTextSchema,
  frequency: z.enum(Object.values(FEE_FREQUENCIES) as [
    string,
    ...string[],
  ]),
  classIds: z.array(objectIdSchema).default([]),
  items: z.array(feeStructureItemSchema).min(1),
  dueDay: z.coerce.number().int().min(1).max(28).optional(),
  lateFineType: z.enum(["NONE", "FLAT", "PER_DAY"]).default("NONE"),
  lateFineAmount: amountSchema.default(0),
  graceDays: z.coerce.number().int().min(0).max(365).default(0),
  isActive: z.boolean().default(true),
});

export const updateFeeStructureSchema = z
  .object({
    name: requiredTextSchema.optional(),
    description: optionalTextSchema,
    frequency: z
      .enum(Object.values(FEE_FREQUENCIES) as [
        string,
        ...string[],
      ])
      .optional(),
    classIds: z.array(objectIdSchema).optional(),
    items: z.array(feeStructureItemSchema).min(1).optional(),
    dueDay: z.coerce.number().int().min(1).max(28).optional(),
    lateFineType: z.enum(["NONE", "FLAT", "PER_DAY"]).optional(),
    lateFineAmount: amountSchema.optional(),
    graceDays: z.coerce.number().int().min(0).max(365).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const feeStructureIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feeStructureListQuerySchema = z.object({
  ...paginationSchema,
  ...sortSchema,
  search: z.string().trim().optional(),
  sessionId: objectIdSchema.optional(),
  isActive: booleanQuerySchema.optional(),
});

// --------------------------------------------------
// 3. STUDENT FEE ASSIGNMENT
// --------------------------------------------------

const customFeeItemSchema = z.object({
  feeHeadId: objectIdSchema,
  name: requiredTextSchema,
  amount: amountSchema,
});

export const assignStudentFeeSchema = z.object({
  sessionId: objectIdSchema,
  studentId: objectIdSchema,
  feeStructureId: objectIdSchema,
  customItems: z.array(customFeeItemSchema).default([]),
});

export const feeAssignmentListQuerySchema = z.object({
  ...paginationSchema,
  sessionId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
});

export const studentFeeParamsSchema = z.object({
  studentId: objectIdSchema,
});

export const studentFeeQuerySchema = z.object({
  ...paginationSchema,
  sessionId: objectIdSchema.optional(),
});

// --------------------------------------------------
// 4. FEE INVOICE VALIDATION
// --------------------------------------------------

const invoiceItemSchema = z.object({
  feeHeadId: objectIdSchema.optional(),
  name: requiredTextSchema,
  amount: amountSchema,
  discountAmount: amountSchema.default(0),
  fineAmount: amountSchema.default(0),
}).refine(
  (item) => item.discountAmount <= item.amount,
  {
    message: "Discount cannot exceed item amount",
    path: ["discountAmount"],
  }
);

export const generateFeeInvoiceSchema = z.object({
  sessionId: objectIdSchema,
  studentId: objectIdSchema,
  feeAssignmentId: objectIdSchema.optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  dueDate: dateSchema,
  remarks: optionalTextSchema,
}).refine(
  (data) => Boolean(data.feeAssignmentId) || Boolean(data.items?.length),
  {
    message: "Fee assignment or invoice items are required",
  }
);

export const updateFeeInvoiceSchema = z
  .object({
    items: z.array(invoiceItemSchema).min(1).optional(),
    dueDate: dateSchema.optional(),
    remarks: optionalTextSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const feeInvoiceIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feeInvoiceListQuerySchema = z.object({
  ...paginationSchema,
  ...sortSchema,
  studentId: objectIdSchema.optional(),
  sessionId: objectIdSchema.optional(),
  status: z.enum(Object.values(FEE_INVOICE_STATUS) as [
    string,
    ...string[],
  ]).optional(),
  search: z.string().trim().optional(),
});

// --------------------------------------------------
// 5. FEE PAYMENT VALIDATION
// --------------------------------------------------

export const collectFeePaymentSchema = z.object({
  invoiceId: objectIdSchema,
  amount: positiveAmountSchema,
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS) as [
    string,
    ...string[],
  ]),
  transactionReference: z.string().trim().optional(),
  gatewayOrderId: z.string().trim().optional(),
  gatewayPaymentId: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(8).max(150).optional(),
  paymentDate: dateSchema.optional(),
  remarks: optionalTextSchema,
});

export const feePaymentIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feePaymentListQuerySchema = z.object({
  ...paginationSchema,
  studentId: objectIdSchema.optional(),
  invoiceId: objectIdSchema.optional(),
  paymentStatus: z.enum([
    "INITIATED",
    "PENDING",
    "SUCCESS",
    "FAILED",
    "REFUNDED",
    "CANCELLED",
  ]).optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS) as [
    string,
    ...string[],
  ]).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

// --------------------------------------------------
// 6. FEE DISCOUNT VALIDATION
// --------------------------------------------------

export const createFeeDiscountSchema = z.object({
  sessionId: objectIdSchema,
  studentId: objectIdSchema,
  invoiceId: objectIdSchema.optional(),
  name: requiredTextSchema,
  discountType: z.enum(Object.values(FEE_DISCOUNT_TYPES) as [
    string,
    ...string[],
  ]),
  value: positiveAmountSchema,
  reason: requiredTextSchema.max(1000),
});

export const feeDiscountIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feeDiscountListQuerySchema = z.object({
  ...paginationSchema,
  studentId: objectIdSchema.optional(),
  isApproved: booleanQuerySchema.optional(),
});

export const reviewFeeDiscountSchema = z.object({
  remarks: optionalTextSchema,
});

// --------------------------------------------------
// 7. FEE REFUND VALIDATION
// --------------------------------------------------

export const createFeeRefundSchema = z.object({
  paymentId: objectIdSchema,
  amount: positiveAmountSchema,
  reason: requiredTextSchema.max(1000),
});

export const feeRefundIdParamSchema = z.object({
  id: objectIdSchema,
});

export const feeRefundListQuerySchema = z.object({
  ...paginationSchema,
  studentId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  status: z.enum(Object.values(FEE_REFUND_STATUS) as [
    string,
    ...string[],
  ]).optional(),
});

export const reviewFeeRefundSchema = z.object({
  remarks: optionalTextSchema,
});

export const rejectFeeRefundSchema = z.object({
  remarks: requiredTextSchema.max(1000),
});

export const processFeeRefundSchema = z.object({
  refundMethod: z.enum(Object.values(PAYMENT_METHODS) as [
    string,
    ...string[],
  ]).optional(),
  transactionReference: z.string().trim().optional(),
});

// --------------------------------------------------
// 8. FEE REPORT VALIDATION
// --------------------------------------------------

export const feeReportQuerySchema = z.object({
  sessionId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: z.enum(Object.values(FEE_INVOICE_STATUS) as [
    string,
    ...string[],
  ]).optional(),
  ...paginationSchema,
}).refine(
  (data) =>
    !data.startDate ||
    !data.endDate ||
    new Date(data.startDate) <= new Date(data.endDate),
  {
    message: "Start date cannot be after end date",
    path: ["endDate"],
  }
);

// --------------------------------------------------
// 9. DASHBOARD VALIDATION
// --------------------------------------------------

export const feeDashboardQuerySchema = z.object({
  sessionId: objectIdSchema.optional(),
});

// --------------------------------------------------
export const createGatewayOrderSchema = z.object({
  body: z.object({
    invoiceId: objectIdSchema,
    amount: positiveAmountSchema.optional(),
  }),
});

export const verifyGatewayPaymentSchema = z.object({
  body: z.object({
    invoiceId: objectIdSchema,
    razorpayOrderId: z.string().trim().min(5).max(100),
    razorpayPaymentId: z.string().trim().min(5).max(100),
    razorpaySignature: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "Invalid payment signature"),
  }),
});

// TYPESCRIPT TYPES
// --------------------------------------------------

export type CreateFeeHeadInput =
  z.infer<typeof createFeeHeadSchema>;

export type UpdateFeeHeadInput =
  z.infer<typeof updateFeeHeadSchema>;

export type FeeHeadListQuery =
  z.infer<typeof feeHeadListQuerySchema>;

export type CreateFeeStructureInput =
  z.infer<typeof createFeeStructureSchema>;

export type UpdateFeeStructureInput =
  z.infer<typeof updateFeeStructureSchema>;

export type FeeStructureListQuery =
  z.infer<typeof feeStructureListQuerySchema>;

export type AssignStudentFeeInput =
  z.infer<typeof assignStudentFeeSchema>;

export type GenerateFeeInvoiceInput =
  z.infer<typeof generateFeeInvoiceSchema>;

export type UpdateFeeInvoiceInput =
  z.infer<typeof updateFeeInvoiceSchema>;

export type CollectFeePaymentInput =
  z.infer<typeof collectFeePaymentSchema>;

export type CreateFeeDiscountInput =
  z.infer<typeof createFeeDiscountSchema>;

export type CreateFeeRefundInput =
  z.infer<typeof createFeeRefundSchema>;

export type FeeReportQuery =
  z.infer<typeof feeReportQuerySchema>;

export const createExamFeeInvoicesSchema = z.object({ params: z.object({ examId: objectIdSchema }), body: z.object({ feeHeadId: objectIdSchema, amount: z.coerce.number().finite().positive(), dueDate: z.coerce.date() }).strict() });
