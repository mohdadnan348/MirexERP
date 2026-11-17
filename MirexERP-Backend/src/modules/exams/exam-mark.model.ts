import { Schema, model, models, Types, Document } from "mongoose";

export interface IExamMark extends Document {
  schoolId: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  subjectId: Types.ObjectId;
  marksObtained: number;
  isAbsent: boolean;
  remarks?: string;
  enteredBy: Types.ObjectId;
  verifiedAt?: Date | null;
  verifiedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const examMarkSchema = new Schema<IExamMark>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  isAbsent: { type: Boolean, default: false },
  remarks: { type: String, trim: true, maxlength: 1000 },
  enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });

examMarkSchema.index({ schoolId: 1, examId: 1, studentId: 1, subjectId: 1 }, { unique: true });
examMarkSchema.index({ schoolId: 1, examId: 1, studentId: 1 });

export const ExamMark = models.ExamMark || model<IExamMark>("ExamMark", examMarkSchema);
