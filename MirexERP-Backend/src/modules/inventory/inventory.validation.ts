
import { z } from "zod";

import {
  INVENTORY_ITEM_CONDITION,
  INVENTORY_ITEM_STATUS,
  INVENTORY_TRANSACTION_TYPE,
} from "./inventory.model";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional();

const nonNegativeNumber = z
  .number()
  .finite()
  .min(0, "Value cannot be negative");

const positiveNumber = z
  .number()
  .finite()
  .positive("Value must be greater than zero");

const optionalDate = z
  .union([z.string().datetime(), z.date()])
  .optional();

// Create inventory item
export const createInventoryItemSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),

    itemCode: z.string().trim().min(2).max(50),

    category: z.string().trim().min(2).max(100),

    description: optionalText(1000),

    unit: z.string().trim().min(1).max(30).optional(),

    quantity: nonNegativeNumber.optional(),

    minimumStockLevel: nonNegativeNumber.optional(),

    unitPrice: nonNegativeNumber.optional(),

    supplierName: optionalText(150),

    supplierContact: optionalText(30),

    storageLocation: optionalText(150),

    purchaseDate: optionalDate,

    warrantyExpiry: optionalDate,

    condition: z
      .enum(Object.values(INVENTORY_ITEM_CONDITION) as [
        string,
        ...string[],
      ])
      .optional(),
  }),
});

// Update inventory item
export const updateInventoryItemSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),

      itemCode: z.string().trim().min(2).max(50).optional(),

      category: z.string().trim().min(2).max(100).optional(),

      description: optionalText(1000),

      unit: z.string().trim().min(1).max(30).optional(),

      minimumStockLevel: nonNegativeNumber.optional(),

      unitPrice: nonNegativeNumber.optional(),

      supplierName: optionalText(150),

      supplierContact: optionalText(30),

      storageLocation: optionalText(150),

      purchaseDate: optionalDate,

      warrantyExpiry: optionalDate,

      condition: z
        .enum(Object.values(INVENTORY_ITEM_CONDITION) as [
          string,
          ...string[],
        ])
        .optional(),

      status: z
        .enum(Object.values(INVENTORY_ITEM_STATUS) as [
          string,
          ...string[],
        ])
        .optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
});

// Inventory item ID
export const inventoryItemIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Get inventory items
export const getInventoryItemsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),

    limit: z.coerce.number().int().min(1).max(100).optional(),

    search: z.string().trim().max(100).optional(),

    category: z.string().trim().max(100).optional(),

    status: z
      .enum(Object.values(INVENTORY_ITEM_STATUS) as [
        string,
        ...string[],
      ])
      .optional(),

    lowStock: z
      .enum(["true", "false"])
      .optional(),
  }),
});

// Adjust stock
export const adjustInventoryStockSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    quantity: positiveNumber,

    operation: z.enum(["ADD", "REMOVE"]),

    reason: z.string().trim().min(2).max(500),

    idempotencyKey: z.string().trim().min(8).max(150),

    notes: optionalText(1000),
  }),
});

// Issue inventory item
export const issueInventoryItemSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    quantity: positiveNumber,

    issuedTo: objectIdSchema.optional(),

    issuedToName: optionalText(150),

    issuedToRole: optionalText(50),

    expectedReturnDate: optionalDate,

    reason: optionalText(500),

    idempotencyKey: z.string().trim().min(8).max(150),

    notes: optionalText(1000),
  }),
});

// Return inventory item
export const returnInventoryItemSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  body: z.object({
    quantity: positiveNumber,

    condition: z
      .enum(Object.values(INVENTORY_ITEM_CONDITION) as [
        string,
        ...string[],
      ])
      .optional(),

    idempotencyKey: z.string().trim().min(8).max(150),

    notes: optionalText(1000),
  }),
});

// Get inventory transaction history
export const getInventoryTransactionsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({
    page: z.coerce.number().int().min(1).optional(),

    limit: z.coerce.number().int().min(1).max(100).optional(),

    type: z
      .enum(Object.values(INVENTORY_TRANSACTION_TYPE) as [
        string,
        ...string[],
      ])
      .optional(),
  }),
});

export type CreateInventoryItemInput = z.infer<
  typeof createInventoryItemSchema
>["body"];

export type UpdateInventoryItemInput = z.infer<
  typeof updateInventoryItemSchema
>["body"];

export type AdjustInventoryStockInput = z.infer<
  typeof adjustInventoryStockSchema
>["body"];

export type IssueInventoryItemInput = z.infer<
  typeof issueInventoryItemSchema
>["body"];

export type ReturnInventoryItemInput = z.infer<
  typeof returnInventoryItemSchema
>["body"];
