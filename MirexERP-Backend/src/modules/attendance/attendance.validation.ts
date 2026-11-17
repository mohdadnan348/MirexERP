
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const attendanceStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
  "HOLIDAY",
]);

const attendanceTypeSchema = z.enum([
  "STUDENT",
  "EMPLOYEE",
]);

const dateSchema = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid date"
  )
  .transform((value) => new Date(value));

const optionalDateSchema = dateSchema.nullable().optional();

const positiveIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(1440);

const remarksSchema = z
  .string()
  .trim()
  .max(500)
  .optional();

// Create attendance record.
export const createAttendanceSchema = z
  .object({
    sessionId: objectIdSchema,

    attendanceType: attendanceTypeSchema,

    studentId: objectIdSchema.optional(),

    employeeId: objectIdSchema.optional(),

    classId: objectIdSchema.optional(),

    sectionId: objectIdSchema.optional(),

    attendanceDate: dateSchema,
    periodNumber: z.coerce.number().int().min(1).optional(),

    status: attendanceStatusSchema.default("PRESENT"),

    checkInTime: optionalDateSchema,

    checkOutTime: optionalDateSchema,

    lateByMinutes: positiveIntegerSchema.optional(),

    earlyDepartureMinutes: positiveIntegerSchema.optional(),

    remarks: remarksSchema,
  })
  .superRefine((data, ctx) => {
    if (data.attendanceType === "STUDENT") {
      if (!data.studentId) {
        ctx.addIssue({
          code: "custom",
          path: ["studentId"],
          message: "Student ID is required",
        });
      }

      if (!data.classId) {
        ctx.addIssue({
          code: "custom",
          path: ["classId"],
          message: "Class ID is required",
        });
      }

      if (!data.sectionId) {
        ctx.addIssue({
          code: "custom",
          path: ["sectionId"],
          message: "Section ID is required",
        });
      }

      if (data.employeeId) {
        ctx.addIssue({
          code: "custom",
          path: ["employeeId"],
          message: "Employee ID is not allowed for student attendance",
        });
      }
    }

    if (data.attendanceType === "EMPLOYEE") {
      if (!data.employeeId) {
        ctx.addIssue({
          code: "custom",
          path: ["employeeId"],
          message: "Employee ID is required",
        });
      }

      if (data.studentId || data.classId || data.sectionId) {
        ctx.addIssue({
          code: "custom",
          path: ["attendanceType"],
          message:
            "Student, class and section IDs are not allowed for employee attendance",
        });
      }
    }

    if (
      data.checkInTime &&
      data.checkOutTime &&
      data.checkOutTime < data.checkInTime
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutTime"],
        message: "Check-out time cannot be before check-in time",
      });
    }

    if (
      ["ABSENT", "LEAVE", "HOLIDAY"].includes(data.status) &&
      (data.checkInTime || data.checkOutTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkInTime"],
        message:
          "Check-in and check-out times are not allowed for this status",
      });
    }
  });

// Update attendance record.
export const updateAttendanceSchema = z
  .object({
    status: attendanceStatusSchema.optional(),

    checkInTime: optionalDateSchema,

    checkOutTime: optionalDateSchema,

    lateByMinutes: positiveIntegerSchema.optional(),

    earlyDepartureMinutes: positiveIntegerSchema.optional(),

    remarks: remarksSchema,
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required for update",
      });
    }

    if (
      data.checkInTime &&
      data.checkOutTime &&
      data.checkOutTime < data.checkInTime
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutTime"],
        message: "Check-out time cannot be before check-in time",
      });
    }

    if (
      data.status &&
      ["ABSENT", "LEAVE", "HOLIDAY"].includes(data.status) &&
      (data.checkInTime || data.checkOutTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkInTime"],
        message:
          "Check-in and check-out times are not allowed for this status",
      });
    }
  });

// Attendance ID parameter.
export const attendanceIdParamSchema = z.object({
  id: objectIdSchema,
});

// Attendance listing filters.
export const attendanceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  attendanceType: attendanceTypeSchema.optional(),

  status: attendanceStatusSchema.optional(),

  studentId: objectIdSchema.optional(),

  employeeId: objectIdSchema.optional(),

  classId: objectIdSchema.optional(),

  sectionId: objectIdSchema.optional(),

  sessionId: objectIdSchema.optional(),

  startDate: dateSchema.optional(),

  endDate: dateSchema.optional(),

  sortBy: z
    .enum(["attendanceDate", "createdAt", "status"])
    .default("attendanceDate"),

  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).superRefine((data, ctx) => {
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

  if (
    data.attendanceType === "STUDENT" &&
    data.employeeId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["employeeId"],
      message: "Employee ID cannot be used for student attendance",
    });
  }

  if (
    data.attendanceType === "EMPLOYEE" &&
    (data.studentId || data.classId || data.sectionId)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["attendanceType"],
      message: "Student filters cannot be used for employee attendance",
    });
  }
});

// Bulk attendance marking.
export const bulkAttendanceSchema = z
  .object({
    sessionId: objectIdSchema,

    attendanceType: attendanceTypeSchema,

    attendanceDate: dateSchema,
    periodNumber: z.coerce.number().int().min(1).optional(),

    classId: objectIdSchema.optional(),

    sectionId: objectIdSchema.optional(),

    records: z
      .array(
        z.object({
          studentId: objectIdSchema.optional(),

          employeeId: objectIdSchema.optional(),

          status: attendanceStatusSchema,

          checkInTime: optionalDateSchema,

          checkOutTime: optionalDateSchema,

          remarks: remarksSchema,
        })
      )
      .min(1, "At least one attendance record is required")
      .max(500, "Maximum 500 records are allowed"),
  })
  .superRefine((data, ctx) => {
    if (data.attendanceType === "STUDENT") {
      if (!data.classId || !data.sectionId) {
        ctx.addIssue({
          code: "custom",
          path: ["classId"],
          message: "Class ID and section ID are required",
        });
      }

      data.records.forEach((record, index) => {
        if (!record.studentId) {
          ctx.addIssue({
            code: "custom",
            path: ["records", index, "studentId"],
            message: "Student ID is required",
          });
        }

        if (record.employeeId) {
          ctx.addIssue({
            code: "custom",
            path: ["records", index, "employeeId"],
            message: "Employee ID is not allowed",
          });
        }
      });
    }

    if (data.attendanceType === "EMPLOYEE") {
      data.records.forEach((record, index) => {
        if (!record.employeeId) {
          ctx.addIssue({
            code: "custom",
            path: ["records", index, "employeeId"],
            message: "Employee ID is required",
          });
        }

        if (record.studentId) {
          ctx.addIssue({
            code: "custom",
            path: ["records", index, "studentId"],
            message: "Student ID is not allowed",
          });
        }
      });
    }

    const recordIds = data.records.map((record) =>
      data.attendanceType === "STUDENT"
        ? record.studentId
        : record.employeeId
    );

    const validIds = recordIds.filter(
      (id): id is string => Boolean(id)
    );

    if (new Set(validIds).size !== validIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["records"],
        message: "Duplicate attendance records are not allowed",
      });
    }
  });

// Attendance status update.
export const updateAttendanceStatusSchema = z.object({
  status: attendanceStatusSchema,

  remarks: remarksSchema,
});

// Attendance summary filters.
export const attendanceSummaryQuerySchema = z.object({
  sessionId: objectIdSchema.optional(),

  attendanceType: attendanceTypeSchema.default("STUDENT"),

  classId: objectIdSchema.optional(),

  sectionId: objectIdSchema.optional(),

  startDate: dateSchema.optional(),

  endDate: dateSchema.optional(),
}).superRefine((data, ctx) => {
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

// Inferred TypeScript types.
export type CreateAttendanceInput = z.infer<
  typeof createAttendanceSchema
>;

export type UpdateAttendanceInput = z.infer<
  typeof updateAttendanceSchema
>;

export type AttendanceListQuery = z.infer<
  typeof attendanceListQuerySchema
>;

export type BulkAttendanceInput = z.infer<
  typeof bulkAttendanceSchema
>;

export type UpdateAttendanceStatusInput = z.infer<
  typeof updateAttendanceStatusSchema
>;

export type AttendanceSummaryQuery = z.infer<
  typeof attendanceSummaryQuerySchema
>;


export const attendanceCorrectionRequestSchema = z.object({
  requestedStatus: attendanceStatusSchema,
  reason: z.string().trim().min(3).max(500),
});
export const attendanceCorrectionReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewRemarks: z.string().trim().max(500).optional(),
});
export const attendanceCorrectionIdParamSchema = z.object({
  correctionId: objectIdSchema,
});
