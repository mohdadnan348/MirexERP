import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IHomeworkNotificationLog extends Document {
  schoolId: Types.ObjectId;
  homeworkId: Types.ObjectId;
  studentId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  recipientRole: "PARENT" | "STUDENT";
  type: "NEW_HOMEWORK" | "PENDING_REMINDER" | "GRADED";
  periodKey: string;
  communicationId?: Types.ObjectId;
  status: "QUEUED" | "FAILED" | "SKIPPED";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IHomeworkNotificationLog>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  homeworkId: { type: Schema.Types.ObjectId, ref: "Homework", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientRole: { type: String, enum: ["PARENT", "STUDENT"], required: true },
  type: { type: String, enum: ["NEW_HOMEWORK", "PENDING_REMINDER", "GRADED"], required: true },
  periodKey: { type: String, required: true },
  communicationId: { type: Schema.Types.ObjectId, ref: "Communication" },
  status: { type: String, enum: ["QUEUED", "FAILED", "SKIPPED"], default: "QUEUED" },
  error: { type: String, maxlength: 500 },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, homeworkId: 1, studentId: 1, recipientUserId: 1, type: 1, periodKey: 1 }, { unique: true });
export const HomeworkNotificationLog = models.HomeworkNotificationLog || model<IHomeworkNotificationLog>("HomeworkNotificationLog", schema);
