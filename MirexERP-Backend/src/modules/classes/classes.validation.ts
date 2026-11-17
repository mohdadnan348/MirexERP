
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

// CREATE CLASS
export const createClassSchema = z
  .object({
    sessionId: objectIdSchema,

    name: z
      .string()
      .trim()
      .min(1, "Class name is required")
      .max(50),

    code: z
      .string()
      .trim()
      .min(1, "Class code is required")
      .max(20)
      .transform((value) => value.toUpperCase()),

    displayName: z
      .string()
      .trim()
      .max(100)
      .optional(),

    numericLevel: z
      .number()
      .int()
      .min(1)
      .max(20),

    description: z
      .string()
      .trim()
      .max(500)
      .optional(),

    classTeacherId: objectIdSchema.optional(),

    capacity: z
      .number()
      .int()
      .min(1)
      .optional(),

    stream: z
      .string()
      .trim()
      .max(50)
      .optional(),

    subjects: z
      .array(objectIdSchema)
      .max(50)
      .optional()
      .default([]),

    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.subjects).size === data.subjects.length,
    {
      message: "Duplicate subjects are not allowed",
      path: ["subjects"],
    }
  );

// UPDATE CLASS
export const updateClassSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional(),

    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((value) => value.toUpperCase())
      .optional(),

    displayName: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional(),

    numericLevel: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional(),

    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    classTeacherId: objectIdSchema.nullable().optional(),

    capacity: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional(),

    stream: z
      .string()
      .trim()
      .max(50)
      .nullable()
      .optional(),

    subjects: z
      .array(objectIdSchema)
      .max(50)
      .optional(),

    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field is required for update",
    }
  )
  .refine(
    (data) =>
      !data.subjects ||
      new Set(data.subjects).size === data.subjects.length,
    {
      message: "Duplicate subjects are not allowed",
      path: ["subjects"],
    }
  );

// CLASS ID PARAMETER
export const classIdParamSchema = z.object({
  id: objectIdSchema,
});

// CLASS LIST QUERY
export const classListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  sessionId: objectIdSchema.optional(),

  classTeacherId: objectIdSchema.optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  stream: z.string().trim().max(50).optional(),

  sortBy: z
    .enum(["name", "code", "numericLevel", "createdAt"])
    .default("numericLevel"),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// UPDATE CLASS STATUS
export const updateClassStatusSchema = z.object({
  isActive: z.boolean(),
});

// CLASS SUBJECT ASSIGNMENT
export const assignClassSubjectsSchema = z
  .object({
    subjects: z
      .array(objectIdSchema)
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.subjects).size === data.subjects.length,
    {
      message: "Duplicate subjects are not allowed",
      path: ["subjects"],
    }
  );

// EXPORT TYPES
export type CreateClassInput = z.infer<
  typeof createClassSchema
>;

export type UpdateClassInput = z.infer<
  typeof updateClassSchema
>;

export type ClassListQuery = z.infer<
  typeof classListQuerySchema
>;

export type UpdateClassStatusInput = z.infer<
  typeof updateClassStatusSchema
>;

export type AssignClassSubjectsInput = z.infer<
  typeof assignClassSubjectsSchema
>;
