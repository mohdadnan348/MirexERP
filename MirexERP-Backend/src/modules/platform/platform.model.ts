import mongoose, { Schema } from "mongoose";

const planSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 40 },
  description: { type: String, default: "", maxlength: 1000 },
  monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
  quarterlyPrice: { type: Number, min: 0, default: 0 },
  halfYearlyPrice: { type: Number, min: 0, default: 0 },
  yearlyPrice: { type: Number, required: true, min: 0, default: 0 },
  currency: { type: String, default: "INR", uppercase: true, minlength: 3, maxlength: 3 },
  features: { type: [String], default: [] },
  maxStudents: { type: Number, default: 0, min: 0 },
  maxStaff: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
planSchema.index({ isActive: 1, sortOrder: 1 });

const roleSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 50 },
  description: { type: String, default: "", maxlength: 500 },
  scope: { type: String, enum: ["PLATFORM", "SCHOOL"], default: "PLATFORM" },
  permissions: { type: [String], default: [] },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const supportTicketSchema = new Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  subject: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, enum: ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "OTHER"], default: "GENERAL" },
  priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
  status: { type: String, enum: ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"], default: "OPEN", index: true },
  messages: [{ senderId: { type: Schema.Types.ObjectId, ref: "User" }, senderRole: String, message: { type: String, maxlength: 5000 }, createdAt: { type: Date, default: Date.now } }],
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

const platformSettingSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "GLOBAL" },
  values: { type: Schema.Types.Mixed, default: {} },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  actorName: { type: String, default: "" },
  actorRole: { type: String, default: "" },
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true, index: true },
  entityId: { type: String, default: "" },
  description: { type: String, default: "" },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  ip: { type: String, default: "" },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export const SubscriptionPlan = mongoose.models.SubscriptionPlan || mongoose.model("SubscriptionPlan", planSchema);
export const PlatformRole = mongoose.models.PlatformRole || mongoose.model("PlatformRole", roleSchema);
export const SupportTicket = mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema);
export const PlatformSetting = mongoose.models.PlatformSetting || mongoose.model("PlatformSetting", platformSettingSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
