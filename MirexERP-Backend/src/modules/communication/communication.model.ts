import {
  Schema,
  model,
  models,
  type Document,
  type Types,
} from "mongoose";

export const COMMUNICATION_TYPES = {
  NOTICE: "NOTICE",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  EVENT: "EVENT",
  FEE_REMINDER: "FEE_REMINDER",
  ATTENDANCE_ALERT: "ATTENDANCE_ALERT",
  EXAM_UPDATE: "EXAM_UPDATE",
  GENERAL: "GENERAL",
} as const;

export const COMMUNICATION_AUDIENCES = {
  ALL: "ALL",
  PARENTS: "PARENTS",
  TEACHERS: "TEACHERS",
  STUDENTS: "STUDENTS",
  STAFF: "STAFF",
  CLASS: "CLASS",
  SECTION: "SECTION",
  INDIVIDUAL: "INDIVIDUAL",
} as const;

export const COMMUNICATION_STATUSES = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export const COMMUNICATION_CHANNELS = {
  IN_APP: "IN_APP",
  EMAIL: "EMAIL",
  SMS: "SMS",
  PUSH: "PUSH",
} as const;

export interface ICommunication extends Document {
  schoolId: Types.ObjectId;
  sourceEventId?: Types.ObjectId;
  title: string;
  message: string;
  type: (typeof COMMUNICATION_TYPES)[keyof typeof COMMUNICATION_TYPES];
  audiences: Array<(typeof COMMUNICATION_AUDIENCES)[keyof typeof COMMUNICATION_AUDIENCES]>;
  classIds: Types.ObjectId[];
  sectionIds: Types.ObjectId[];
  recipientIds: Types.ObjectId[];
  channels: Array<(typeof COMMUNICATION_CHANNELS)[keyof typeof COMMUNICATION_CHANNELS]>;
  status: (typeof COMMUNICATION_STATUSES)[keyof typeof COMMUNICATION_STATUSES];
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  attachments: Array<{ name: string; url: string }>;
  scheduledAt?: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  isPinned: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communicationSchema = new Schema<ICommunication>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sourceEventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 10000 },
    type: {
      type: String,
      enum: Object.values(COMMUNICATION_TYPES),
      default: COMMUNICATION_TYPES.NOTICE,
      index: true,
    },
    audiences: {
      type: [{ type: String, enum: Object.values(COMMUNICATION_AUDIENCES) }],
      default: [COMMUNICATION_AUDIENCES.ALL],
    },
    classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    sectionIds: [{ type: Schema.Types.ObjectId, ref: "Section" }],
    recipientIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    channels: {
      type: [{ type: String, enum: Object.values(COMMUNICATION_CHANNELS) }],
      default: [COMMUNICATION_CHANNELS.IN_APP],
    },
    status: {
      type: String,
      enum: Object.values(COMMUNICATION_STATUSES),
      default: COMMUNICATION_STATUSES.DRAFT,
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },
    attachments: {
      type: [{
        name: { type: String, required: true, trim: true, maxlength: 150 },
        url: { type: String, required: true, trim: true, maxlength: 2048 },
      }],
      default: [],
    },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    isPinned: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false, strict: true }
);

communicationSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
communicationSchema.index({ schoolId: 1, audiences: 1, publishedAt: -1 });
communicationSchema.index({ schoolId: 1, scheduledAt: 1 });
communicationSchema.index({ schoolId: 1, sourceEventId: 1 }, { unique: true, partialFilterExpression: { sourceEventId: { $type: "objectId" } } });

export const Communication =
  models.Communication ||
  model<ICommunication>("Communication", communicationSchema);

export interface ICommunicationDelivery extends Document {
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  recipientId: Types.ObjectId;
  channel: string;
  status: "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED" | "READ";
  provider?: string;
  providerMessageId?: string;
  attemptCount: number;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  readAt?: Date;
  failureReason?: string;
  estimatedCost?: number;
  fallbackOf?: Types.ObjectId;
  fallbackReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const communicationDeliverySchema = new Schema<ICommunicationDelivery>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication", required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: { type: String, enum: Object.values(COMMUNICATION_CHANNELS), required: true },
    status: { type: String, enum: ["QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "CANCELLED", "READ"], default: "QUEUED", index: true },
    provider: { type: String, trim: true, maxlength: 80 },
    providerMessageId: { type: String, trim: true, maxlength: 200 },
    attemptCount: { type: Number, default: 0, min: 0 },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500 },
    estimatedCost: { type: Number, min: 0 },
    fallbackOf: { type: Schema.Types.ObjectId, ref: "CommunicationDelivery" },
    fallbackReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false }
);

communicationDeliverySchema.index(
  { communicationId: 1, recipientId: 1, channel: 1 },
  { unique: true }
);

export const CommunicationDelivery =
  models.CommunicationDelivery ||
  model<ICommunicationDelivery>("CommunicationDelivery", communicationDeliverySchema);

export interface ICommunicationSettings extends Document {
  schoolId: Types.ObjectId;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  parentNotifications: boolean;
  teacherNotifications: boolean;
  studentNotifications: boolean;
  staffNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const communicationSettingsSchema = new Schema<ICommunicationSettings>(
  {
    
schoolId: {
  type: Schema.Types.ObjectId,
  ref: "School",
  required: true,
  unique: true,
},

    inAppEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
    parentNotifications: { type: Boolean, default: true },
    teacherNotifications: { type: Boolean, default: true },
    studentNotifications: { type: Boolean, default: true },
    staffNotifications: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const CommunicationSettings =
  models.CommunicationSettings ||
  model<ICommunicationSettings>("CommunicationSettings", communicationSettingsSchema);
