import { z } from "zod";

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(150),
  url: z.string().url().max(2048),
});

const communicationBodySchema = z.object({
  title: z.string().trim().min(2).max(180),
  message: z.string().trim().min(1).max(10000),
  type: z.enum([
    "NOTICE",
    "ANNOUNCEMENT",
    "EVENT",
    "FEE_REMINDER",
    "ATTENDANCE_ALERT",
    "EXAM_UPDATE",
    "GENERAL",
  ]).optional(),
  audiences: z.array(z.enum([
    "ALL",
    "PARENTS",
    "TEACHERS",
    "STUDENTS",
    "STAFF",
    "CLASS",
    "SECTION",
    "INDIVIDUAL",
  ])).min(1).max(8).optional(),
  classIds: z.array(objectIdSchema).max(200).optional(),
  sectionIds: z.array(objectIdSchema).max(500).optional(),
  recipientIds: z.array(objectIdSchema).max(5000).optional(),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS", "PUSH"])).min(1).max(4).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  isPinned: z.boolean().optional(),
}).strict();

export const createSchema = z.object({
  body: communicationBodySchema,
});

export const updateSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: communicationBodySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field is required for update" }
  ),
});

export const idSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(180).optional(),
    type: z.enum([
      "NOTICE",
      "ANNOUNCEMENT",
      "EVENT",
      "FEE_REMINDER",
      "ATTENDANCE_ALERT",
      "EXAM_UPDATE",
      "GENERAL",
    ]).optional(),
    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
    audience: z.enum([
      "ALL",
      "PARENTS",
      "TEACHERS",
      "STUDENTS",
      "STAFF",
      "CLASS",
      "SECTION",
      "INDIVIDUAL",
    ]).optional(),
  }),
});

export const settingsSchema = z.object({
  body: z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    parentNotifications: z.boolean().optional(),
    teacherNotifications: z.boolean().optional(),
    studentNotifications: z.boolean().optional(),
    staffNotifications: z.boolean().optional(),
  }).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one setting must be provided" }
  ),
});
