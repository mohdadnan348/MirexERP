
import { z } from "zod";

import {
  FINANCE_CATEGORY_TYPES,
  FINANCE_PAYMENT_METHODS,
  FINANCE_RECORD_STATUS,
  FINANCE_TRANSACTION_TYPES,
} from "./finance.model";

// --------------------------------------------------
// COMMON VALIDATORS
// --------------------------------------------------

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const optionalString = z.string().trim().optional();

const positiveAmountSchema = z.coerce
  .number()
  .finite("Amount must be a valid number")
  .positive("Amount must be greater than zero");

const dateSchema = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid date format"
  );

const optionalDateSchema = dateSchema.optional();

const paymentMethodSchema = z.enum(
  Object.values(FINANCE_PAYMENT_METHODS) as [
    string,
    ...string[],
  ]
);

// --------------------------------------------------
// CATEGORY VALIDATION
// --------------------------------------------------

export const createFinanceCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must contain at least 2 characters")
      .max(100),

    code: z
      .string()
      .trim()
      .min(2, "Category code is required")
      .max(30)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Category code can contain letters, numbers, underscore and hyphen"
      ),

    type: z.enum(
      Object.values(FINANCE_CATEGORY_TYPES) as [
        string,
        ...string[],
      ]
    ),

    description: z.string().trim().max(500).optional(),
  }),
});

export const updateFinanceCategorySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),

      code: z
        .string()
        .trim()
        .min(2)
        .max(30)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),

      description: z.string().trim().max(500).optional(),

      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required"
    ),
});

// --------------------------------------------------
// INCOME VALIDATION
// --------------------------------------------------

export const createIncomeSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,

    title: z.string().trim().min(2).max(150),

    description: optionalString,

    amount: positiveAmountSchema,

    paymentMethod: paymentMethodSchema.optional(),

    transactionReference: z.string().trim().max(100).optional(),

    receivedFrom: z.string().trim().min(2).max(150),

    receivedDate: optionalDateSchema,

    academicSessionId: objectIdSchema.optional(),

    attachmentUrl: z.string().url().optional(),

    remarks: z.string().trim().max(1000).optional(),
  }),
});

export const updateIncomeSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z
    .object({
      categoryId: objectIdSchema.optional(),

      title: z.string().trim().min(2).max(150).optional(),

      description: optionalString,

      amount: positiveAmountSchema.optional(),

      paymentMethod: paymentMethodSchema.optional(),

      transactionReference: z.string().trim().max(100).optional(),

      receivedFrom: z.string().trim().min(2).max(150).optional(),

      receivedDate: optionalDateSchema,

      attachmentUrl: z.string().url().optional(),

      remarks: z.string().trim().max(1000).optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required"
    ),
});

// --------------------------------------------------
// EXPENSE VALIDATION
// --------------------------------------------------

export const createExpenseSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    vendorId: objectIdSchema.optional(),

    title: z.string().trim().min(2).max(150),

    description: optionalString,

    amount: positiveAmountSchema,

    paymentMethod: paymentMethodSchema.optional(),

    transactionReference: z.string().trim().max(100).optional(),

    paidTo: z.string().trim().min(2).max(150),

    expenseDate: optionalDateSchema,

    attachmentUrl: z.string().url().optional(),

    remarks: z.string().trim().max(1000).optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z
    .object({
      categoryId: objectIdSchema.optional(),
      vendorId: objectIdSchema.nullable().optional(),

      title: z.string().trim().min(2).max(150).optional(),

      description: optionalString,

      amount: positiveAmountSchema.optional(),

      paymentMethod: paymentMethodSchema.optional(),

      transactionReference: z.string().trim().max(100).optional(),

      paidTo: z.string().trim().min(2).max(150).optional(),

      expenseDate: optionalDateSchema,

      attachmentUrl: z.string().url().optional(),

      remarks: z.string().trim().max(1000).optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required"
    ),
});

// --------------------------------------------------
// COMMON QUERY VALIDATION
// --------------------------------------------------

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),

  limit: z.coerce.number().int().positive().max(100).optional(),

  search: z.string().trim().max(100).optional(),

  startDate: optionalDateSchema,

  endDate: optionalDateSchema,

  fromDate: optionalDateSchema,

  toDate: optionalDateSchema,

  categoryId: objectIdSchema.optional(),

  status: z
    .enum(
      Object.values(FINANCE_RECORD_STATUS) as [
        string,
        ...string[],
      ]
    )
    .optional(),

  paymentMethod: paymentMethodSchema.optional(),
});

const validateDateRange = (
  data: Record<string, unknown>
) => {
  const start = data.startDate || data.fromDate;
  const end = data.endDate || data.toDate;

  if (!start || !end) return true;

  return new Date(String(start)) <= new Date(String(end));
};

// --------------------------------------------------
// CATEGORY QUERY
// --------------------------------------------------

export const getFinanceCategoriesSchema = z.object({
  query: paginationQuerySchema.extend({
    type: z
      .enum(
        Object.values(FINANCE_CATEGORY_TYPES) as [
          string,
          ...string[],
        ]
      )
      .optional(),
  }),
});

// --------------------------------------------------
// INCOME QUERY
// --------------------------------------------------

export const getIncomeRecordsSchema = z.object({
  query: paginationQuerySchema
    .extend({
      academicSessionId: objectIdSchema.optional(),
    })
    .refine(validateDateRange, {
      message: "Start date cannot be after end date",
    }),
});

// --------------------------------------------------
// EXPENSE QUERY
// --------------------------------------------------

export const getExpenseRecordsSchema = z.object({
  query: paginationQuerySchema.refine(validateDateRange, {
    message: "Start date cannot be after end date",
  }),
});

// --------------------------------------------------
// TRANSACTION QUERY
// --------------------------------------------------

export const getTransactionsSchema = z.object({
  query: paginationQuerySchema
    .extend({
      type: z
        .enum(
          Object.values(FINANCE_TRANSACTION_TYPES) as [
            string,
            ...string[],
          ]
        )
        .optional(),
    })
    .refine(validateDateRange, {
      message: "Start date cannot be after end date",
    }),
});

// --------------------------------------------------
// ID PARAMETER VALIDATION
// --------------------------------------------------

export const financeIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// --------------------------------------------------
// REPORT QUERY VALIDATION
// --------------------------------------------------

export const financeReportSchema = z.object({
  query: z
    .object({
      startDate: optionalDateSchema,
      endDate: optionalDateSchema,
      fromDate: optionalDateSchema,
      toDate: optionalDateSchema,
      categoryId: objectIdSchema.optional(),
    })
    .refine(validateDateRange, {
      message: "Start date cannot be after end date",
    }),
});

// --------------------------------------------------
// EXPORTED VALIDATION TYPES
// --------------------------------------------------

export type CreateFinanceCategoryInput = z.infer<
  typeof createFinanceCategorySchema
>;

export type UpdateFinanceCategoryInput = z.infer<
  typeof updateFinanceCategorySchema
>;

export type CreateIncomeInput = z.infer<
  typeof createIncomeSchema
>;

export type UpdateIncomeInput = z.infer<
  typeof updateIncomeSchema
>;

export type CreateExpenseInput = z.infer<
  typeof createExpenseSchema
>;

export type UpdateExpenseInput = z.infer<
  typeof updateExpenseSchema
>;
