import { Schema, model, models, Types, Document } from "mongoose";
export type ParentEngagementType = "FEEDBACK" | "COMPLAINT" | "MEETING";
export interface IParentEngagement extends Document {
  schoolId: Types.ObjectId; parentId: Types.ObjectId; studentId?: Types.ObjectId | null; type: ParentEngagementType;
  subject: string; message: string; category?: string; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: string; assignedTo?: Types.ObjectId | null; requestedAt?: Date | null; requestedTime?: string;
  response?: string; resolution?: string; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IParentEngagement>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Parent", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
  type: { type: String, enum: ["FEEDBACK","COMPLAINT","MEETING"], required: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, trim: true, maxlength: 80 },
  priority: { type: String, enum: ["LOW","NORMAL","HIGH","URGENT"], default: "NORMAL" },
  status: { type: String, default: "SUBMITTED", index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  requestedAt: { type: Date, default: null }, requestedTime: { type: String, trim: true },
  response: { type: String, trim: true, maxlength: 3000 }, resolution: { type: String, trim: true, maxlength: 3000 },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, parentId: 1, type: 1, createdAt: -1 });
export const ParentEngagement = models.ParentEngagement || model<IParentEngagement>("ParentEngagement", schema);
export default ParentEngagement;
