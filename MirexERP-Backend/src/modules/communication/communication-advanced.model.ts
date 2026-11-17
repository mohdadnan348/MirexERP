import { Schema, model, models, type Document, type Types } from "mongoose";

export type CommunicationChannel = "IN_APP" | "SMS" | "EMAIL" | "WHATSAPP" | "PUSH";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";

export interface ICommunicationTemplate extends Document {
  schoolId: Types.ObjectId; name: string; channel: CommunicationChannel; category: string;
  subject?: string; body: string; variables: string[]; isActive: boolean;
  createdBy: Types.ObjectId; updatedBy?: Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const templateSchema = new Schema<ICommunicationTemplate>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  channel: { type: String, enum: ["IN_APP", "SMS", "EMAIL", "WHATSAPP", "PUSH"], required: true },
  category: { type: String, trim: true, maxlength: 80, default: "GENERAL" },
  subject: { type: String, trim: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 12000 },
  variables: [{ type: String, trim: true }], isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });
templateSchema.index({ schoolId: 1, name: 1, channel: 1 }, { unique: true });
export const CommunicationTemplate = models.CommunicationTemplate || model<ICommunicationTemplate>("CommunicationTemplate", templateSchema);

export interface ICommunicationCampaign extends Document {
  schoolId: Types.ObjectId; idempotencyKey: string; name: string; channel: CommunicationChannel; message: string; subject?: string;
  templateId?: Types.ObjectId; audience: string[]; recipientIds: Types.ObjectId[]; scheduledAt?: Date;
  status: CampaignStatus; totalRecipients: number; queuedCount: number; sentCount: number; deliveredCount: number; failedCount: number;
  createdBy: Types.ObjectId; cancelledAt?: Date; createdAt: Date; updatedAt: Date;
}
const campaignSchema = new Schema<ICommunicationCampaign>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  channel: { type: String, enum: ["IN_APP", "SMS", "EMAIL", "WHATSAPP", "PUSH"], required: true },
  message: { type: String, required: true, maxlength: 12000 }, subject: { type: String, maxlength: 200 },
  templateId: { type: Schema.Types.ObjectId, ref: "CommunicationTemplate" },
  audience: [{ type: String, enum: ["ALL", "PARENTS", "STUDENTS", "TEACHERS", "EMPLOYEES", "CLASS", "SECTION", "INDIVIDUAL"] }],
  recipientIds: [{ type: Schema.Types.ObjectId, ref: "User" }], scheduledAt: Date,
  status: { type: String, enum: ["DRAFT", "SCHEDULED", "QUEUED", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"], default: "DRAFT", index: true },
  totalRecipients: { type: Number, default: 0, min: 0 }, queuedCount: { type: Number, default: 0, min: 0 }, sentCount: { type: Number, default: 0, min: 0 }, deliveredCount: { type: Number, default: 0, min: 0 }, failedCount: { type: Number, default: 0, min: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, cancelledAt: Date,
}, { timestamps: true, versionKey: false });
campaignSchema.index({ schoolId: 1, idempotencyKey: 1 }, { unique: true });
campaignSchema.index({ schoolId: 1, createdAt: -1 });
export const CommunicationCampaign = models.CommunicationCampaign || model<ICommunicationCampaign>("CommunicationCampaign", campaignSchema);

export interface INotificationPreference extends Document { schoolId: Types.ObjectId; userId: Types.ObjectId; sms: boolean; email: boolean; whatsapp: boolean; inApp: boolean; announcements: boolean; updatedAt: Date; }
const preferenceSchema = new Schema<INotificationPreference>({ schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true }, userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, sms: { type: Boolean, default: true }, email: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true }, inApp: { type: Boolean, default: true }, announcements: { type: Boolean, default: true } }, { timestamps: true, versionKey: false });
preferenceSchema.index({ schoolId: 1, userId: 1 }, { unique: true });
export const NotificationPreference = models.NotificationPreference || model<INotificationPreference>("NotificationPreference", preferenceSchema);
