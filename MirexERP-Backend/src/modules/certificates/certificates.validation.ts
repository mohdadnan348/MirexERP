
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

const dateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be in YYYY-MM-DD format"
  ),
]);

const certificateTypeSchema = z.enum([
  "BONAFIDE",
  "TRANSFER",
  "CHARACTER",
  "STUDY",
  "COMPLETION",
  "MIGRATION",
  "ACHIEVEMENT",
  "OTHER",
]);

const certificateStatusSchema = z.enum([
  "ACTIVE",
  "REVOKED",
]);

const createCertificateBodySchema = z.object({
  sessionId: objectIdSchema,

  studentId: objectIdSchema,

  certificateType: certificateTypeSchema,

  title: z
    .string()
    .trim()
    .min(2, "Certificate title must be at least 2 characters")
    .max(150, "Certificate title cannot exceed 150 characters"),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional(),

  issueDate: dateSchema.optional(),

  validUntil: dateSchema.optional(),

  reason: z
    .string()
    .trim()
    .max(500)
    .optional(),

  remarks: z
    .string()
    .trim()
    .max(1000)
    .optional(),

  templateId: objectIdSchema.optional(),

  pdfUrl: z
    .string()
    .url("Invalid PDF URL")
    .max(2048)
    .optional(),
}).strict();

export const createCertificateSchema = z.object({
  body: createCertificateBodySchema,
});

export const certificateIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }).strict(),
});

export const getCertificatesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),

    limit: z.coerce.number().int().min(1).max(100).optional(),

    search: z.string().trim().optional(),

    studentId: objectIdSchema.optional(),

    certificateType: certificateTypeSchema.optional(),

    status: certificateStatusSchema.optional(),

    sessionId: objectIdSchema.optional(),
  }).strict(),
});

export const getStudentCertificatesSchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }).strict(),
});

export const updateCertificateSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }).strict(),

  body: createCertificateBodySchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required to update certificate"
    ),
});
