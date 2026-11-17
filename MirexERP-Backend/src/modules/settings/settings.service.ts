
import { Types } from "mongoose";
import {
  SchoolSettings,
  ISchoolSettings,
} from "./settings.model";
import { AppError } from "../../utils/AppError";
import { AuditLog } from "../platform/platform.model";

interface SettingsActor {
  userId: string;
  schoolId: string;
  role: string;
}

type SettingsSection =
  | "general"
  | "academic"
  | "attendance"
  | "fees"
  | "notifications";

const getSchoolId = (actor: SettingsActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Valid school ID is required", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getUserId = (actor: SettingsActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Valid user ID is required", 400);
  }

  return new Types.ObjectId(actor.userId);
};

// Get existing settings or create default settings.
const getOrCreateSettings = async (
  actor: SettingsActor
): Promise<ISchoolSettings> => {
  const schoolId = getSchoolId(actor);

  let settings = await SchoolSettings.findOne({ schoolId });

  if (settings) {
    return settings;
  }

  try {
    settings = await SchoolSettings.create({
      schoolId,
      createdBy: getUserId(actor),
    });

    return settings;
  } catch (error: any) {
    // Handle concurrent first-time settings creation.
    if (error?.code === 11000) {
      const existing = await SchoolSettings.findOne({ schoolId });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

// Whitelist fields to prevent unwanted updates.
const updateSection = async (
  section: SettingsSection,
  data: Record<string, unknown>,
  actor: SettingsActor,
  allowedFields: string[]
) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Invalid settings data", 400);
  }

  const settings = await getOrCreateSettings(actor);

  const sectionData = (settings as any)[section];

  if (!sectionData) {
    throw new AppError("Settings section not found", 404);
  }

  const entries = Object.entries(data);

  if (entries.length === 0) {
    throw new AppError("At least one setting is required", 400);
  }

  for (const [key, value] of entries) {
    if (!allowedFields.includes(key)) {
      throw new AppError(
        `Updating ${key} is not allowed`,
        400
      );
    }

    sectionData[key] = value;
  }

  settings.updatedBy = getUserId(actor);

  await settings.save();
  await AuditLog.create({ actorId: getUserId(actor), actorRole: actor.role, action: "SCHOOL_SETTINGS_UPDATED", entity: "SchoolSettings", entityId: String(settings._id), description: `Updated ${section} school settings`, after: { section, changedFields: entries.map(([key]) => key) } });

  return settings;
};

// GET GENERAL SETTINGS
export const getSettingsService = async (
  actor: SettingsActor
) => {
  const settings = await getOrCreateSettings(actor);

  return {
    schoolId: settings.schoolId,
    general: settings.general,
    updatedAt: settings.updatedAt,
  };
};

// UPDATE GENERAL SETTINGS
export const updateSettingsService = async (
  data: Record<string, unknown>,
  actor: SettingsActor
) => {
  const allowedFields = [
    "schoolName",
    "schoolCode",
    "email",
    "phone",
    "website",
    "address",
    "city",
    "state",
    "country",
    "postalCode",
    "logo",
    "timezone",
    "currency",
    "dateFormat",
  ];

  const settings = await updateSection(
    "general",
    data,
    actor,
    allowedFields
  );

  return settings.general;
};

// GET ACADEMIC SETTINGS
export const getAcademicSettingsService = async (
  actor: SettingsActor
) => {
  const settings = await getOrCreateSettings(actor);

  return settings.academic;
};

// UPDATE ACADEMIC SETTINGS
export const updateAcademicSettingsService = async (
  data: Record<string, unknown>,
  actor: SettingsActor
) => {
  const allowedFields = [
    "currentSessionId",
    "academicYearStartMonth",
    "workingDays",
    "schoolStartTime",
    "schoolEndTime",
    "periodsPerDay",
  ];

  if (
    data.currentSessionId &&
    !Types.ObjectId.isValid(String(data.currentSessionId))
  ) {
    throw new AppError("Invalid academic session ID", 400);
  }

  const settings = await updateSection(
    "academic",
    data,
    actor,
    allowedFields
  );

  return settings.academic;
};

// GET ATTENDANCE SETTINGS
export const getAttendanceSettingsService = async (
  actor: SettingsActor
) => {
  const settings = await getOrCreateSettings(actor);

  return settings.attendance;
};

// UPDATE ATTENDANCE SETTINGS
export const updateAttendanceSettingsService = async (
  data: Record<string, unknown>,
  actor: SettingsActor
) => {
  const allowedFields = [
    "enabled",
    "allowLateMarking",
    "lateAfterTime",
    "minimumAttendancePercentage",
    "autoMarkAbsent",
  ];

  const settings = await updateSection(
    "attendance",
    data,
    actor,
    allowedFields
  );

  return settings.attendance;
};

// GET FEE SETTINGS
export const getFeeSettingsService = async (
  actor: SettingsActor
) => {
  const settings = await getOrCreateSettings(actor);

  return settings.fees;
};

// UPDATE FEE SETTINGS
export const updateFeeSettingsService = async (
  data: Record<string, unknown>,
  actor: SettingsActor
) => {
  const allowedFields = [
    "currency",
    "lateFeeEnabled",
    "lateFeeAmount",
    "lateFeeType",
    "gracePeriodDays",
    "allowPartialPayment",
  ];

  const settings = await updateSection(
    "fees",
    data,
    actor,
    allowedFields
  );

  return settings.fees;
};

// GET NOTIFICATION SETTINGS
export const getNotificationSettingsService = async (
  actor: SettingsActor
) => {
  const settings = await getOrCreateSettings(actor);

  return settings.notifications;
};

// UPDATE NOTIFICATION SETTINGS
export const updateNotificationSettingsService = async (
  data: Record<string, unknown>,
  actor: SettingsActor
) => {
  const allowedFields = [
    "emailEnabled",
    "smsEnabled",
    "pushEnabled",
    "parentNotifications",
    "teacherNotifications",
    "feeReminders",
    "attendanceAlerts",
    "examNotifications",
  ];

  const settings = await updateSection(
    "notifications",
    data,
    actor,
    allowedFields
  );

  return settings.notifications;
};
