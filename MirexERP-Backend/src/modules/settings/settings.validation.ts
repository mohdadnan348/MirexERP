
import { z } from "zod";

const optionalString = z.string().trim().optional();

const optionalBoolean = z.boolean().optional();

const optionalPositiveNumber = z.number().min(0).optional();

// GENERAL SETTINGS
export const updateSettingsSchema = z.object({
  body: z.object({
    schoolName: z.string().trim().min(2).max(150).optional(),
    schoolCode: z.string().trim().min(2).max(30).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    website: z.string().url().optional(),
    address: optionalString,
    city: optionalString,
    state: optionalString,
    country: optionalString,
    postalCode: optionalString,
    logo: z.string().url().optional(),
    timezone: z.string().trim().optional(),
    currency: z.string().trim().length(3).optional(),
    dateFormat: z.string().trim().optional(),
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one setting is required" }
  ),
});

// ACADEMIC SETTINGS
export const updateAcademicSettingsSchema = z.object({
  body: z.object({
    currentSessionId: z.string().regex(
      /^[0-9a-fA-F]{24}$/,
      "Invalid academic session ID"
    ).optional(),

    academicYearStartMonth: z.number().int().min(1).max(12).optional(),

    workingDays: z.array(
      z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ])
    ).optional(),

    schoolStartTime: z.string().regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Time must be in HH:mm format"
    ).optional(),

    schoolEndTime: z.string().regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Time must be in HH:mm format"
    ).optional(),

    periodsPerDay: z.number().int().min(1).max(20).optional(),
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one academic setting is required" }
  ),
});

// ATTENDANCE SETTINGS
export const updateAttendanceSettingsSchema = z.object({
  body: z.object({
    enabled: optionalBoolean,

    allowLateMarking: optionalBoolean,

    lateAfterTime: z.string().regex(
      /^([01]\d|2[0-3]):[0-5]\d$/
    ).optional(),

    minimumAttendancePercentage: z.number().min(0).max(100).optional(),

    autoMarkAbsent: optionalBoolean,
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one attendance setting is required" }
  ),
});

// FEE SETTINGS
export const updateFeeSettingsSchema = z.object({
  body: z.object({
    currency: z.string().trim().length(3).optional(),

    lateFeeEnabled: optionalBoolean,

    lateFeeAmount: optionalPositiveNumber,

    lateFeeType: z.enum([
      "FIXED",
      "PERCENTAGE",
    ]).optional(),

    gracePeriodDays: z.number().int().min(0).max(365).optional(),

    allowPartialPayment: optionalBoolean,
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one fee setting is required" }
  ),
});

// NOTIFICATION SETTINGS
export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    emailEnabled: optionalBoolean,

    smsEnabled: optionalBoolean,

    pushEnabled: optionalBoolean,

    parentNotifications: optionalBoolean,

    teacherNotifications: optionalBoolean,

    feeReminders: optionalBoolean,

    attendanceAlerts: optionalBoolean,

    examNotifications: optionalBoolean,
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one notification setting is required" }
  ),
});

// INFERRED TYPES
export type UpdateSettingsInput = z.infer<
  typeof updateSettingsSchema
>["body"];

export type UpdateAcademicSettingsInput = z.infer<
  typeof updateAcademicSettingsSchema
>["body"];

export type UpdateAttendanceSettingsInput = z.infer<
  typeof updateAttendanceSettingsSchema
>["body"];

export type UpdateFeeSettingsInput = z.infer<
  typeof updateFeeSettingsSchema
>["body"];

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>["body"];
