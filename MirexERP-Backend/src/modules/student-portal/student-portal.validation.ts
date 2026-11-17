
import { z } from "zod";

const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

const dateSchema = z.string().date();

const dateRangeSchema = {
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
};

const validateDateRange = (
  data: { startDate?: string; endDate?: string }
) => {
  if (data.startDate && data.endDate) {
    return (
      new Date(data.startDate).getTime() <=
      new Date(data.endDate).getTime()
    );
  }

  return true;
};

// STUDENT DASHBOARD
export const studentDashboardSchema = z.object({
  query: z.object({}).strict().optional(),
});

// STUDENT PROFILE
export const studentProfileSchema = z.object({
  query: z.object({}).strict().optional(),
});

// STUDENT ATTENDANCE
export const studentAttendanceSchema = z.object({
  query: z.object({
    ...paginationSchema,
    ...dateRangeSchema,
    status: z.enum([
      "PRESENT",
      "ABSENT",
      "LATE",
      "HALF_DAY",
      "LEAVE",
    ]).optional(),
  }).strict().refine(validateDateRange, {
    message: "Start date cannot be after end date",
    path: ["endDate"],
  }),
});

// STUDENT FEES
export const studentFeesSchema = z.object({
  query: z.object({
    ...paginationSchema,
    status: z.enum([
      "PAID",
      "PARTIAL",
      "PENDING",
      "OVERDUE",
      "CANCELLED",
    ]).optional(),
  }).strict(),
});

// STUDENT HOMEWORK
export const studentHomeworkSchema = z.object({
  query: z.object({
    ...paginationSchema,
    ...dateRangeSchema,
    status: z.enum([
      "PENDING",
      "SUBMITTED",
      "CHECKED",
      "LATE",
      "OVERDUE",
    ]).optional(),
  }).strict().refine(validateDateRange, {
    message: "Start date cannot be after end date",
    path: ["endDate"],
  }),
});

// STUDENT EXAM RESULTS
export const studentResultsSchema = z.object({
  query: z.object({
    ...paginationSchema,
    sessionId: z.string().regex(
      /^[0-9a-fA-F]{24}$/,
      "Invalid academic session ID"
    ).optional(),
  }).strict(),
});

// STUDENT TIMETABLE
export const studentTimetableSchema = z.object({
  query: z.object({
    sessionId: z.string().regex(
      /^[0-9a-fA-F]{24}$/,
      "Invalid academic session ID"
    ).optional(),
  }).strict(),
});

// INFERRED TYPES
export type StudentAttendanceQuery = z.infer<
  typeof studentAttendanceSchema
>["query"];

export type StudentFeesQuery = z.infer<
  typeof studentFeesSchema
>["query"];

export type StudentHomeworkQuery = z.infer<
  typeof studentHomeworkSchema
>["query"];

export type StudentResultsQuery = z.infer<
  typeof studentResultsSchema
>["query"];

export type StudentTimetableQuery = z.infer<
  typeof studentTimetableSchema
>["query"];
