
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

// Address validation
const addressSchema = z
  .object({
    street: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
  })
  .optional();

const emergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  relationship: z.string().trim().max(50).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
}).optional();

// Create Parent
export const createParentSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must contain at least 2 characters")
    .max(100),

  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(150)
    .transform((value) => value.toLowerCase())
    .optional(),

  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20),

  alternatePhone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .optional(),

  relation: z.enum([
    "FATHER",
    "MOTHER",
    "GUARDIAN",
    "GRANDFATHER",
    "GRANDMOTHER",
    "OTHER",
  ]),

  occupation: z.string().trim().max(100).optional(),

  qualification: z.string().trim().max(100).optional(),

  annualIncome: z.number().min(0).optional(),

  address: addressSchema,
  emergencyContact: emergencyContactSchema,

  studentIds: z
    .array(objectIdSchema)
    .max(20, "Maximum 20 students can be linked")
    .optional()
    .default([]),
});

// Update Parent
export const updateParentSchema = z
  .object({
    firstName: z.string().trim().min(2).max(100).optional(),

    lastName: z.string().trim().min(1).max(100).optional(),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(150)
      .transform((value) => value.toLowerCase())
      .optional(),

    phone: z.string().trim().min(7).max(20).optional(),

    alternatePhone: z.string().trim().min(7).max(20).optional(),

    relation: z
      .enum([
        "FATHER",
        "MOTHER",
        "GUARDIAN",
        "GRANDFATHER",
        "GRANDMOTHER",
        "OTHER",
      ])
      .optional(),

    occupation: z.string().trim().max(100).optional(),

    qualification: z.string().trim().max(100).optional(),

    annualIncome: z.number().min(0).optional(),

    address: addressSchema,
    emergencyContact: emergencyContactSchema,

    studentIds: z
      .array(objectIdSchema)
      .max(20, "Maximum 20 students can be linked")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

// Get Parents List
export const getParentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),
});

// Parent ID Params
export const parentIdSchema = z.object({
  id: objectIdSchema,
});

// Inferred Types
export type CreateParentInput = z.infer<typeof createParentSchema>;

export type UpdateParentInput = z.infer<typeof updateParentSchema>;

export type GetParentsQuery = z.infer<typeof getParentsSchema>;
