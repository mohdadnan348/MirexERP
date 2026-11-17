
import { z } from "zod";

const sessionIdSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Please provide a valid session ID"
  );

const sessionNameSchema = z
  .string()
  .trim()
  .min(3, "Session name must contain at least 3 characters")
  .max(100, "Session name cannot exceed 100 characters");

const sessionCodeSchema = z
  .string()
  .trim()
  .min(2, "Session code must contain at least 2 characters")
  .max(30, "Session code cannot exceed 30 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Session code can contain letters, numbers, hyphens and underscores"
  );

const sessionDateSchema = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  return !Number.isNaN(Date.parse(value));
}, "Please provide a valid date or ISO timestamp");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description cannot exceed 500 characters")
  .optional();

const dateRangeSchema = <T extends z.ZodType>(
  schema: T
) =>
  schema.refine(
    (data) => {
      const value = data as {
        startDate?: string;
        endDate?: string;
      };

      if (!value.startDate || !value.endDate) {
        return true;
      }

      return (
        new Date(value.startDate).getTime() <
        new Date(value.endDate).getTime()
      );
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  );

// CREATE SESSION
export const createSessionSchema = z.object({
  body: dateRangeSchema(
    z.object({
      name: sessionNameSchema,
      code: sessionCodeSchema,
      startDate: sessionDateSchema,
      endDate: sessionDateSchema,
      description: descriptionSchema,
    })
  ),
});

// UPDATE SESSION
export const updateSessionSchema = z.object({
  params: z.object({
    id: sessionIdSchema,
  }),

  body: dateRangeSchema(
    z
      .object({
        name: sessionNameSchema.optional(),
        code: sessionCodeSchema.optional(),
        startDate: sessionDateSchema.optional(),
        endDate: sessionDateSchema.optional(),
        description: descriptionSchema,
      })
      .strict()
      .refine(
        (data) => Object.keys(data).length > 0,
        "At least one field is required for update"
      )
  ),
});

// GET SESSION BY ID
export const sessionIdParamSchema = z.object({
  params: z.object({
    id: sessionIdSchema,
  }),
});

// GET ALL SESSIONS
export const sessionListQuerySchema = z.object({
  query: z.object({
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
      .max(150)
      .optional(),

    status: z
      .enum(["ACTIVE", "INACTIVE"])
      .optional(),
  }),
});

// SET ACTIVE SESSION
export const setActiveSessionSchema = z.object({
  params: z.object({
    id: sessionIdSchema,
  }),
  body: z.object({
    confirmation: z.literal("ACTIVATE_SESSION"),
  }),
});

// DELETE SESSION
export const deleteSessionSchema = z.object({
  params: z.object({
    id: sessionIdSchema,
  }),
});

// TYPES
export type CreateSessionInput = z.infer<
  typeof createSessionSchema
>["body"];

export type UpdateSessionInput = z.infer<
  typeof updateSessionSchema
>["body"];

export type SessionListQueryInput = z.infer<
  typeof sessionListQuerySchema
>["query"];
