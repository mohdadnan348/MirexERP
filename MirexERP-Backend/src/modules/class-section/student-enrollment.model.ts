import mongoose, { Document, Schema, Types } from "mongoose";

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "TRANSFERRED" | "DETAINED";
export interface IStudentEnrollment extends Document {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId: Types.ObjectId;
  status: EnrollmentStatus;
  enrolledAt: Date;
  endedAt?: Date | null;
  detentionReason?: string;
  detainedAt?: Date | null;
  detainedBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<IStudentEnrollment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  status: { type: String, enum: ["ACTIVE", "COMPLETED", "TRANSFERRED", "DETAINED"], default: "ACTIVE", required: true, index: true },
  enrolledAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  detentionReason: { type: String, trim: true, maxlength: 500 },
  detainedAt: { type: Date, default: null },
  detainedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false, collection: "student_enrollments" });
schema.index({ schoolId: 1, studentId: 1, sessionId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
schema.index({ schoolId: 1, studentId: 1, sessionId: 1 }, { unique: true, partialFilterExpression: { status: "DETAINED" } });
schema.index({ schoolId: 1, sessionId: 1, classId: 1, sectionId: 1, status: 1 });
export default mongoose.models.StudentEnrollment || mongoose.model<IStudentEnrollment>("StudentEnrollment", schema);
