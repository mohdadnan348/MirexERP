import { Schema, model, models, Document, Types } from "mongoose";

export type StudentRecordType = "DOCUMENT" | "TRANSFER" | "PROMOTION" | "STATUS" | "TC";

export interface IStudentRecord extends Document {
  schoolId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  studentId: Types.ObjectId;
  recordType: StudentRecordType;
  title: string;
  details: Record<string, unknown>;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const schema = new Schema<IStudentRecord>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  recordType: { type: String, enum: ["DOCUMENT", "TRANSFER", "PROMOTION", "STATUS", "TC"], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  details: { type: Schema.Types.Mixed, default: {} },
  storagePath: { type: String, select: false },
  fileName: String,
  mimeType: String,
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false, collection: "student_records" });

schema.index({ schoolId: 1, studentId: 1, recordType: 1, createdAt: -1 });
schema.index({ schoolId: 1, title: 1 }, { unique: true, partialFilterExpression: { recordType: "TC", isDeleted: false } });
schema.index({ schoolId: 1, studentId: 1, recordType: 1, "details.newSessionId": 1 }, {
  unique: true,
  partialFilterExpression: { recordType: "PROMOTION", isDeleted: false },
});
const StudentRecord = models.StudentRecord || model<IStudentRecord>("StudentRecord", schema);
export default StudentRecord;
