
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

const eventCategorySchema = z.enum([
  "ACADEMIC",
  "CULTURAL",
  "SPORTS",
  "CELEBRATION",
  "MEETING",
  "WORKSHOP",
  "HOLIDAY",
  "OTHER",
]);

const eventStatusSchema = z.enum([
  "DRAFT",
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);

const attachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    url: z.string().url().max(2048),
  })
  .strict();

// Base schema: keep this free from refinements.
const eventBodyBaseSchema = z
  .object({
    sessionId: objectIdSchema.optional(),
    title: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional(),
    category: eventCategorySchema,
    startDate: dateSchema,
    endDate: dateSchema,
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    venue: z.string().trim().max(200).optional(),
    organizer: z.string().trim().max(150).optional(),
    targetAudience: z.array(z.enum(["ALL", "PARENTS", "STUDENTS", "TEACHERS", "EMPLOYEES", "CLASS", "SECTION", "INDIVIDUAL"])).max(8).optional(),
    classIds: z.array(objectIdSchema).max(100).optional(),
    sectionIds: z.array(objectIdSchema).max(200).optional(),
    recipientIds: z.array(objectIdSchema).max(2000).optional(),
    status: eventStatusSchema.optional(),
    isPublished: z.boolean().optional(),
    attachments: z.array(attachmentSchema).max(10).optional(),
  })
  .strict();

// Shared validation rules for create and update.
const validateEventDatesAndTimes = (
  data: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
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

  if (
    data.startTime &&
    data.endTime &&
    data.startTime >= data.endTime
  ) {
    ctx.addIssue({
      code: "custom",
      message: "End time must be after start time",
      path: ["endTime"],
    });
  }
};

// CREATE EVENT
export const createEventSchema = z.object({
  body: eventBodyBaseSchema.superRefine(
    (data, ctx) => {
      validateEventDatesAndTimes(data, ctx);
    }
  ),
});

// UPDATE EVENT
export const updateEventSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: eventBodyBaseSchema
    .partial()
    .strict()
    .superRefine((data, ctx) => {
      if (Object.keys(data).length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one field is required for update",
        });
      }

      validateEventDatesAndTimes(data, ctx);
    }),
});

// EVENT ID
export const eventIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// GET EVENTS
export const getEventsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(10),
      search: z.string().trim().max(100).optional(),
      category: eventCategorySchema.optional(),
      status: eventStatusSchema.optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
    })
    .refine(
      (data) =>
        !data.startDate ||
        !data.endDate ||
        new Date(data.startDate) <= new Date(data.endDate),
      {
        message: "End date cannot be before start date",
        path: ["endDate"],
      }
    ),
});
