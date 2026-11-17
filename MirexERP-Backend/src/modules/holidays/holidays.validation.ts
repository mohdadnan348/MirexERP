
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const dateSchema = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid date"
  )
  .transform((value) => new Date(value));

const holidayTypeSchema = z.enum([
  "NATIONAL",
  "STATE",
  "RELIGIOUS",
  "SCHOOL",
  "OPTIONAL",
  "OTHER",
]);

const applicableToSchema = z.enum([
  "STUDENTS",
  "EMPLOYEES",
  "BOTH",
]);

const holidayNameSchema = z
  .string()
  .trim()
  .min(2, "Holiday name must contain at least 2 characters")
  .max(150, "Holiday name cannot exceed 150 characters");

const descriptionSchema = z
  .string()
  .trim()
  .max(1000)
  .optional();

// Create holiday.
export const createHolidaySchema = z
  .object({
    sessionId: objectIdSchema,

    name: holidayNameSchema,

    description: descriptionSchema,

    holidayType: holidayTypeSchema.default("SCHOOL"),

    applicableTo: applicableToSchema.default("BOTH"),

    startDate: dateSchema,

    endDate: dateSchema,

    isOptional: z.boolean().default(false),

    isRecurring: z.boolean().default(false),

    recurringMonth: z.number().int().min(1).max(12).nullable().optional(),

    recurringDay: z.number().int().min(1).max(31).nullable().optional(),

    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date",
      });
    }

    if (data.isRecurring) {
      if (!data.recurringMonth) {
        ctx.addIssue({
          code: "custom",
          path: ["recurringMonth"],
          message: "Recurring month is required",
        });
      }

      if (!data.recurringDay) {
        ctx.addIssue({
          code: "custom",
          path: ["recurringDay"],
          message: "Recurring day is required",
        });
      }
    } else if (
      data.recurringMonth != null ||
      data.recurringDay != null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["isRecurring"],
        message:
          "Recurring month and day are only allowed for recurring holidays",
      });
    }
  });

// Update holiday.
export const updateHolidaySchema = z
  .object({
    name: holidayNameSchema.optional(),

    description: descriptionSchema,

    holidayType: holidayTypeSchema.optional(),

    applicableTo: applicableToSchema.optional(),

    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),

    isOptional: z.boolean().optional(),

    isRecurring: z.boolean().optional(),

    recurringMonth: z
      .number()
      .int()
      .min(1)
      .max(12)
      .nullable()
      .optional(),

    recurringDay: z
      .number()
      .int()
      .min(1)
      .max(31)
      .nullable()
      .optional(),

    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required for update",
      });
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "End date cannot be before start date",
        });
      }
    }

    if (
      data.isRecurring === true &&
      (!data.recurringMonth || !data.recurringDay)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["recurringMonth"],
        message:
          "Recurring month and day are required for recurring holidays",
      });
    }

    if (
      data.isRecurring === false &&
      (data.recurringMonth != null ||
        data.recurringDay != null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["isRecurring"],
        message:
          "Recurring month and day must be removed when recurring is disabled",
      });
    }
  });

// Holiday ID parameter.
export const holidayIdParamSchema = z.object({
  id: objectIdSchema,
});

// Holiday listing filters.
export const holidayListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    sessionId: objectIdSchema.optional(),

    search: z.string().trim().max(100).optional(),

    holidayType: holidayTypeSchema.optional(),

    applicableTo: applicableToSchema.optional(),

    isOptional: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    isRecurring: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),

    sortBy: z
      .enum(["name", "startDate", "endDate", "createdAt"])
      .default("startDate"),

    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .superRefine((data, ctx) => {
    if (
      data.startDate &&
      data.endDate &&
      data.startDate > data.endDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date",
      });
    }
  });

// Update holiday status.
export const updateHolidayStatusSchema = z.object({
  isActive: z.boolean(),
});

// Holiday calendar filters.
export const holidayCalendarQuerySchema = z
  .object({
    sessionId: objectIdSchema,

    month: z.coerce.number().int().min(1).max(12).optional(),

    year: z.coerce.number().int().min(2000).max(2100),

    applicableTo: applicableToSchema.optional(),
  });

// Inferred TypeScript types.
export type CreateHolidayInput = z.infer<
  typeof createHolidaySchema
>;

export type UpdateHolidayInput = z.infer<
  typeof updateHolidaySchema
>;

export type HolidayListQuery = z.infer<
  typeof holidayListQuerySchema
>;

export type UpdateHolidayStatusInput = z.infer<
  typeof updateHolidayStatusSchema
>;

export type HolidayCalendarQuery = z.infer<
  typeof holidayCalendarQuerySchema
>;
