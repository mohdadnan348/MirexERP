
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[0-9\s-]{7,20}$/,
    "Please enter a valid phone number"
  );

const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address")
  .max(150)
  .transform((value) => value.toLowerCase());

const addressSchema = z.object({
  street: z.string().trim().max(150).optional(),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80).default("India"),
  postalCode: z
    .string()
    .trim()
    .regex(
      /^[0-9A-Za-z\s-]{4,12}$/,
      "Please enter a valid postal code"
    ),
});

const contactSchema = z.object({
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional(),
  email: emailSchema,
  website: z
    .string()
    .trim()
    .url("Please enter a valid website URL")
    .max(255)
    .optional(),
});

const principalSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

const affiliationSchema = z.object({
  board: z.string().trim().max(100).optional(),
  affiliationNumber: z.string().trim().max(100).optional(),
  recognitionNumber: z.string().trim().max(100).optional(),
});

const brandingSchema = z.object({
  logo: z.string().trim().url().optional(),
  favicon: z.string().trim().url().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

const schoolTypeSchema = z.enum([
  "PUBLIC",
  "PRIVATE",
  "GOVERNMENT",
  "OTHER",
]);

const schoolStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING",
  "EXPIRED",
]);

export const createSchoolSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),

    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "School code can contain letters, numbers, hyphens and underscores"
      ),

    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(
        /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/,
        "Slug must contain only letters, numbers and hyphens"
      ),

    email: emailSchema,
    phone: phoneSchema,

    address: addressSchema,
    contact: contactSchema,

    principal: principalSchema.optional(),
    affiliation: affiliationSchema.optional(),

    schoolType: schoolTypeSchema.default("PRIVATE"),

    timezone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
    currency: z.string().trim().length(3).default("INR"),

    establishedYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
  }),
});

export const updateSchoolSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid school ID"),
  }),

  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),

      code: z
        .string()
        .trim()
        .min(2)
        .max(30)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),

      slug: z
        .string()
        .trim()
        .min(2)
        .max(180)
        .regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/)
        .optional(),

      email: emailSchema.optional(),
      phone: phoneSchema.optional(),

      address: addressSchema.partial().optional(),
      contact: contactSchema.partial().optional(),

      principal: principalSchema.optional(),
      affiliation: affiliationSchema.optional(),
      branding: brandingSchema.optional(),

      schoolType: schoolTypeSchema.optional(),

      establishedYear: z
        .number()
        .int()
        .min(1800)
        .max(new Date().getFullYear())
        .optional(),

      isVerified: z.boolean().optional(),
      timezone: z.string().trim().min(1).max(80).optional(),
      currency: z.string().trim().length(3).optional(),
    })
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required for update"
    ),
});

export const updateSchoolStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid school ID"),
  }),

  body: z.object({
    status: schoolStatusSchema,
    reason: z.string().trim().max(500).optional(),
  }),
});

export const schoolIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid school ID"),
  }),
});

export const schoolListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(150).optional(),

    status: schoolStatusSchema.optional(),

    city: z.string().trim().max(80).optional(),
  }),
});

export type CreateSchoolInput = z.infer<
  typeof createSchoolSchema
>["body"];

export type UpdateSchoolInput = z.infer<
  typeof updateSchoolSchema
>["body"];

export type UpdateSchoolStatusInput = z.infer<
  typeof updateSchoolStatusSchema
>["body"];

export type SchoolListQueryInput = z.infer<
  typeof schoolListQuerySchema
>["query"];
