import mongoose, { Document, Schema, Types } from "mongoose";

export type ClassSectionEvent = "ALLOCATED" | "TRANSFERRED" | "PROMOTED" | "CLASS_TEACHER_ASSIGNED" | "SUBJECT_TEACHER_ASSIGNED";

export interface IClassSectionHistory extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId?: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  event: ClassSectionEvent;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  reason?: string;
  actorId: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IClassSectionHistory>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", index: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "Section", index: true },
  event: { type: String, enum: ["ALLOCATED", "TRANSFERRED", "PROMOTED", "CLASS_TEACHER_ASSIGNED", "SUBJECT_TEACHER_ASSIGNED"], required: true },
  previous: { type: Schema.Types.Mixed },
  next: { type: Schema.Types.Mixed },
  reason: { type: String, trim: true, maxlength: 1000 },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "class_section_history" });

schema.index({ schoolId: 1, studentId: 1, sessionId: 1, createdAt: -1 });
schema.index({ schoolId: 1, classId: 1, sectionId: 1, createdAt: -1 });

export default mongoose.models.ClassSectionHistory || mongoose.model<IClassSectionHistory>("ClassSectionHistory", schema);
