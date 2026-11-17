
import { z } from "zod";

// Subject types
export const SUBJECT_TYPES = [
  "CORE",
  "ELECTIVE",
  "OPTIONAL",
  "LANGUAGE",
  "PRACTICAL",
] as const;

// Subject name validation
const subjectNameSchema = z
  .string()
  .trim()
  .min(1, "Subject name is required")
  .max(100, "Subject name cannot exceed 100 characters");

// Subject code validation
const subjectCodeSchema = z
  .string()
  .trim()
  .min(1, "Subject code is required")
  .max(30, "Subject code cannot exceed 30 characters")
  .transform((value) => value.toUpperCase());

// Create subject
export const createSubjectSchema = z.object({
  name: subjectNameSchema,

  code: subjectCodeSchema,

  displayName: z
    .string()
    .trim()
    .max(120, "Display name cannot exceed 120 characters")
    .optional(),

  subjectType: z.enum(SUBJECT_TYPES).default("CORE"),
  category: z.enum(["CORE", "ELECTIVE", "ACTIVITY"]).default("CORE"),
  remarks: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(60).optional(),
  color: z.string().trim().max(30).optional(),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),

  isOptional: z.boolean().default(false),

  isActive: z.boolean().default(true),
});

// Update subject
export const updateSubjectSchema = z
  .object({
    name: subjectNameSchema.optional(),

    code: subjectCodeSchema.optional(),

    displayName: z
      .string()
      .trim()
      .max(120, "Display name cannot exceed 120 characters")
      .nullable()
      .optional(),

    subjectType: z.enum(SUBJECT_TYPES).optional(),
    category: z.enum(["CORE", "ELECTIVE", "ACTIVITY"]).optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
    icon: z.string().trim().max(60).nullable().optional(),
    color: z.string().trim().max(30).nullable().optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .nullable()
      .optional(),

    isOptional: z.boolean().optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

// Subject ID parameter
export const subjectIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid subject ID"),
});

// Subject listing and filtering
export const subjectListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),

  search: z
    .string()
    .trim()
    .max(100)
    .optional(),

  subjectType: z.enum(SUBJECT_TYPES).optional(),
  category: z.enum(["CORE", "ELECTIVE", "ACTIVITY"]).optional(),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  classId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),

  isOptional: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  sortBy: z
    .enum(["name", "code", "subjectType", "createdAt"])
    .default("name"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("asc"),
});

// Update subject status
export const updateSubjectStatusSchema = z.object({
  isActive: z.boolean(),
});

// Subject type update
export const updateSubjectTypeSchema = z.object({
  subjectType: z.enum(SUBJECT_TYPES),
});

// Inferred TypeScript types
export type CreateSubjectInput = z.infer<
  typeof createSubjectSchema
>;

export type UpdateSubjectInput = z.infer<
  typeof updateSubjectSchema
>;

export type SubjectListQuery = z.infer<
  typeof subjectListQuerySchema
>;

export type UpdateSubjectStatusInput = z.infer<
  typeof updateSubjectStatusSchema
>;

export type UpdateSubjectTypeInput = z.infer<
  typeof updateSubjectTypeSchema
>;
