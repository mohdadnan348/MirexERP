
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const sectionNameSchema = z
  .string()
  .trim()
  .min(1, "Section name is required")
  .max(50, "Section name cannot exceed 50 characters");

const sectionCodeSchema = z
  .string()
  .trim()
  .min(1, "Section code is required")
  .max(20, "Section code cannot exceed 20 characters")
  .transform((value) => value.toUpperCase());

const capacitySchema = z
  .number()
  .int("Capacity must be a whole number")
  .min(1, "Capacity must be at least 1")
  .nullable();

const optionalTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional();

// Create section
export const createSectionSchema = z.object({
  sessionId: objectIdSchema,

  classId: objectIdSchema,

  name: sectionNameSchema,

  code: sectionCodeSchema,

  displayName: optionalTextSchema(100),

  roomNumber: z
    .string()
    .trim()
    .max(30, "Room number cannot exceed 30 characters")
    .optional(),

  capacity: capacitySchema.optional(),

  classTeacherId: objectIdSchema.nullable().optional(),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),

  isActive: z.boolean().default(true),
});

// Update section
export const updateSectionSchema = z
  .object({
    name: sectionNameSchema.optional(),

    code: sectionCodeSchema.optional(),

    displayName: optionalTextSchema(100),

    roomNumber: z
      .string()
      .trim()
      .max(30, "Room number cannot exceed 30 characters")
      .nullable()
      .optional(),

    capacity: capacitySchema.optional(),

    classTeacherId: objectIdSchema.nullable().optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .nullable()
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

// Section ID parameter
export const sectionIdParamSchema = z.object({
  id: objectIdSchema,
});

// Section listing and filtering
export const sectionListQuerySchema = z.object({
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

  sessionId: objectIdSchema.optional(),

  classId: objectIdSchema.optional(),

  classTeacherId: objectIdSchema.optional(),

  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  sortBy: z
    .enum(["name", "code", "createdAt"])
    .default("name"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("asc"),
});

// Update section status
export const updateSectionStatusSchema = z.object({
  isActive: z.boolean(),
});

// Assign class teacher
export const assignSectionTeacherSchema = z.object({
  classTeacherId: objectIdSchema.nullable(),
});

// Types inferred from validation schemas
export type CreateSectionInput = z.infer<
  typeof createSectionSchema
>;

export type UpdateSectionInput = z.infer<
  typeof updateSectionSchema
>;

export type SectionListQuery = z.infer<
  typeof sectionListQuerySchema
>;

export type UpdateSectionStatusInput = z.infer<
  typeof updateSectionStatusSchema
>;

export type AssignSectionTeacherInput = z.infer<
  typeof assignSectionTeacherSchema
>;