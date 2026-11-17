
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const dateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    "Time must be in HH:mm format"
  );

const examStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);

const examSubjectSchema = z
  .object({
    subjectId: objectIdSchema,
    examDate: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    maxMarks: z.coerce.number().positive(),
    passingMarks: z.coerce.number().min(0),
    roomNumber: z.string().trim().max(30).optional(),
  })
  .strict()
  .refine((subject) => subject.startTime < subject.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  })
  .refine(
    (subject) => subject.passingMarks <= subject.maxMarks,
    {
      message: "Passing marks cannot exceed maximum marks",
      path: ["passingMarks"],
    }
  );

// Base schema: no refinements here.
const examBodyBaseSchema = z
  .object({
    sessionId: objectIdSchema,
    classId: objectIdSchema,
    examName: z.string().trim().min(2).max(100),
    examCode: z.string().trim().max(30).optional(),
    examType: z.string().trim().min(2).max(50),
    description: z.string().trim().max(1000).optional(),
    startDate: dateSchema,
    endDate: dateSchema,
    subjects: z.array(examSubjectSchema).min(1).max(100),
    status: examStatusSchema.optional(),
  })
  .strict();

// Shared date and subject validation.
const validateExamDates = (
  data: {
    startDate?: string;
    endDate?: string;
    subjects?: Array<{ examDate: string }>;
  },
  ctx: z.RefinementCtx
) => {
  if (
    data.startDate &&
    data.endDate &&
    new Date(data.startDate) > new Date(data.endDate)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "End date cannot be before start date",
      path: ["endDate"],
    });
  }

  if (data.startDate && data.endDate && data.subjects) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    const invalidSubjectDates = data.subjects.some((subject) => {
      const examDate = new Date(subject.examDate);

      return examDate < startDate || examDate > endDate;
    });

    if (invalidSubjectDates) {
      ctx.addIssue({
        code: "custom",
        message: "Subject exam dates must be within exam dates",
        path: ["subjects"],
      });
    }
  }
};

// CREATE EXAM
export const createExamSchema = z.object({
  body: examBodyBaseSchema.superRefine((data, ctx) => {
    validateExamDates(data, ctx);
  }),
});

// UPDATE EXAM
export const updateExamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: examBodyBaseSchema
    .partial()
    .strict()
    .superRefine((data, ctx) => {
      if (Object.keys(data).length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one field is required for update",
        });
      }

      validateExamDates(data, ctx);
    }),
});

// EXAM ID
export const examIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// GET EXAMS
export const getExamsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().trim().max(100).optional(),
    classId: objectIdSchema.optional(),
    sessionId: objectIdSchema.optional(),
    status: examStatusSchema.optional(),
  }),
});
