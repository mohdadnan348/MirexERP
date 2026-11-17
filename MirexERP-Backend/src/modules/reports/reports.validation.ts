
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const dateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

// Common Report Filters
export const reportFiltersSchema = z
  .object({
    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),

    sessionId: objectIdSchema.optional(),

    classId: objectIdSchema.optional(),

    sectionId: objectIdSchema.optional(),

    month: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional(),

    year: z.coerce
      .number()
      .int()
      .min(2000)
      .max(2100)
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) {
        return true;
      }

      return (
        new Date(data.startDate).getTime() <=
        new Date(data.endDate).getTime()
      );
    },
    {
      message: "Start date cannot be after end date",
      path: ["startDate"],
    }
  );

// Inferred Types
export type ReportFiltersInput = z.infer<
  typeof reportFiltersSchema
>;
