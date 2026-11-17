
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

const leaveTypeSchema = z.enum([
  "CASUAL",
  "SICK",
  "EARNED",
  "UNPAID",
  "MATERNITY",
  "PATERNITY",
  "OTHER",
]);

const leaveStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

const applicantTypeSchema = z.enum([
  "STUDENT",
  "EMPLOYEE",
]);

const reasonSchema = z
  .string()
  .trim()
  .min(3, "Reason must contain at least 3 characters")
  .max(1000, "Reason cannot exceed 1000 characters");

const remarksSchema = z
  .string()
  .trim()
  .max(1000, "Remarks cannot exceed 1000 characters")
  .optional();

const documentSchema = z
  .string()
  .trim()
  .url("Supporting document must be a valid URL")
  .max(2048)
  .nullable()
  .optional();

// Create leave application.
export const createLeaveSchema = z
  .object({
    sessionId: objectIdSchema,

    applicantType: applicantTypeSchema,

    studentId: objectIdSchema.optional(),

    employeeId: objectIdSchema.optional(),

    leaveType: leaveTypeSchema,

    startDate: dateSchema,

    endDate: dateSchema,

    reason: reasonSchema,

    supportingDocument: documentSchema,
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

    if (data.applicantType === "STUDENT") {
      if (!data.studentId) {
        ctx.addIssue({
          code: "custom",
          path: ["studentId"],
          message: "Student ID is required",
        });
      }

      if (data.employeeId) {
        ctx.addIssue({
          code: "custom",
          path: ["employeeId"],
          message: "Employee ID is not allowed for student leave",
        });
      }
    }

    if (data.applicantType === "EMPLOYEE") {
      if (!data.employeeId) {
        ctx.addIssue({
          code: "custom",
          path: ["employeeId"],
          message: "Employee ID is required",
        });
      }

      if (data.studentId) {
        ctx.addIssue({
          code: "custom",
          path: ["studentId"],
          message: "Student ID is not allowed for employee leave",
        });
      }
    }
  });

// Update leave application.
export const updateLeaveSchema = z
  .object({
    leaveType: leaveTypeSchema.optional(),

    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),

    reason: reasonSchema.optional(),

    supportingDocument: documentSchema,
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
  });

// Leave ID parameter.
export const leaveIdParamSchema = z.object({
  id: objectIdSchema,
});

// Leave listing filters.
export const leaveListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    applicantType: applicantTypeSchema.optional(),

    studentId: objectIdSchema.optional(),

    employeeId: objectIdSchema.optional(),

    sessionId: objectIdSchema.optional(),

    leaveType: leaveTypeSchema.optional(),

    status: leaveStatusSchema.optional(),

    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),

    sortBy: z
      .enum(["startDate", "endDate", "appliedAt", "createdAt"])
      .default("appliedAt"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
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

    if (
      data.applicantType === "STUDENT" &&
      data.employeeId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["employeeId"],
        message: "Employee ID cannot be used for student leave",
      });
    }

    if (
      data.applicantType === "EMPLOYEE" &&
      data.studentId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["studentId"],
        message: "Student ID cannot be used for employee leave",
      });
    }
  });

// Review leave application.
export const reviewLeaveSchema = z.object({
  reviewRemarks: remarksSchema,
});

// Approve leave application.
export const approveLeaveSchema = z.object({
  reviewRemarks: remarksSchema,
});

// Reject leave application.
export const rejectLeaveSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(3, "Rejection reason must contain at least 3 characters")
    .max(1000),
});

// Cancel leave application.
export const cancelLeaveSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .max(500)
    .optional(),
});

// Update leave status.
export const updateLeaveStatusSchema = z.object({
  status: leaveStatusSchema,

  reviewRemarks: remarksSchema,

  rejectionReason: z
    .string()
    .trim()
    .min(3)
    .max(1000)
    .optional(),
});

// Leave summary filters.
export const leaveSummaryQuerySchema = z
  .object({
    sessionId: objectIdSchema.optional(),

    applicantType: applicantTypeSchema.optional(),

    studentId: objectIdSchema.optional(),

    employeeId: objectIdSchema.optional(),

    leaveType: leaveTypeSchema.optional(),

    startDate: dateSchema.optional(),

    endDate: dateSchema.optional(),
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

// Inferred TypeScript types.
export type CreateLeaveInput = z.infer<
  typeof createLeaveSchema
>;

export type UpdateLeaveInput = z.infer<
  typeof updateLeaveSchema
>;

export type LeaveListQuery = z.infer<
  typeof leaveListQuerySchema
>;

export type ReviewLeaveInput = z.infer<
  typeof reviewLeaveSchema
>;

export type ApproveLeaveInput = z.infer<
  typeof approveLeaveSchema
>;

export type RejectLeaveInput = z.infer<
  typeof rejectLeaveSchema
>;

export type CancelLeaveInput = z.infer<
  typeof cancelLeaveSchema
>;

export type UpdateLeaveStatusInput = z.infer<
  typeof updateLeaveStatusSchema
>;

export type LeaveSummaryQuery = z.infer<
  typeof leaveSummaryQuerySchema
>;
