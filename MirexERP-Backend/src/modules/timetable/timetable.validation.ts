
import { z } from "zod";
import { DayOfWeek } from "./timetable.model";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const timeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Time must be in HH:mm format"
  );

const daySchema = z.nativeEnum(DayOfWeek);

const timetableFields = {
  sessionId: objectIdSchema,
  classId: objectIdSchema,
  sectionId: objectIdSchema,
  subjectId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  dayOfWeek: daySchema,
  periodNumber: z.number().int().min(1),
  startTime: timeSchema,
  endTime: timeSchema,
  roomNumber: z.string().trim().max(30).optional(),
  roomId: objectIdSchema.optional(),
  periodId: objectIdSchema.optional(),
  combinedGroupId: z.string().trim().max(80).optional(),
  entryType: z.enum(["REGULAR", "ACTIVITY", "LAB"]).optional(),
  isBreak: z.boolean().optional().default(false),
  breakName: z.string().trim().max(50).optional(),
};

const createTimetableBodySchema = z
  .object(timetableFields)
  .superRefine((data, ctx) => {
    const [startHour, startMinute] = data.startTime
      .split(":")
      .map(Number);

    const [endHour, endMinute] = data.endTime
      .split(":")
      .map(Number);

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["endTime"],
      });
    }

    if (!data.isBreak && !data.subjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Subject is required for a teaching period",
        path: ["subjectId"],
      });
    }

    if (!data.isBreak && !data.teacherId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teacher is required for a teaching period",
        path: ["teacherId"],
      });
    }

    if (data.isBreak && !data.breakName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Break name is required for a break period",
        path: ["breakName"],
      });
    }
  });

const updateTimetableBodySchema = z
  .object({
    sessionId: objectIdSchema.optional(),
    classId: objectIdSchema.optional(),
    sectionId: objectIdSchema.optional(),
    subjectId: objectIdSchema.optional(),
    teacherId: objectIdSchema.optional(),
    dayOfWeek: daySchema.optional(),
    periodNumber: z.number().int().min(1).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    roomNumber: z.string().trim().max(30).optional(),
    roomId: objectIdSchema.optional(),
    periodId: objectIdSchema.optional(),
    combinedGroupId: z.string().trim().max(80).optional(),
    entryType: z.enum(["REGULAR", "ACTIVITY", "LAB"]).optional(),
    isBreak: z.boolean().optional(),
    breakName: z.string().trim().max(50).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required for update"
  );

export const createTimetableSchema = z.object({
  body: createTimetableBodySchema,
});

export const updateTimetableSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: updateTimetableBodySchema,
});

export const timetableIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getTimetablesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    classId: objectIdSchema.optional(),
    sectionId: objectIdSchema.optional(),
    sessionId: objectIdSchema.optional(),
    dayOfWeek: daySchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export const classTimetableSchema = z.object({
  params: z.object({
    classId: objectIdSchema,
  }),
  query: z.object({
    sectionId: objectIdSchema.optional(),
    sessionId: objectIdSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export const teacherTimetableSchema = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    dayOfWeek: daySchema.optional(),
  }),
});
