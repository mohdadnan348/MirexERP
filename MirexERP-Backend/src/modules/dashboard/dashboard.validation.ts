
import { z } from "zod";

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const dateRangeSchema = z
  .object({
    startDate: dateString.optional(),
    endDate: dateString.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "Start date cannot be after end date",
      path: ["startDate"],
    }
  );

export const dashboardAttendanceSchema = {
  query: dateRangeSchema,
};

export const dashboardFeesSchema = {
  query: dateRangeSchema,
};

export const dashboardActivitiesSchema = {
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
  }),
};
