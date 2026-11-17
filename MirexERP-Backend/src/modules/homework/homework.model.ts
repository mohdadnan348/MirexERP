import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const HOMEWORK_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
  CANCELLED: "CANCELLED",
} as const;

export const HOMEWORK_SUBMISSION_STATUS = {
  NOT_SUBMITTED: "NOT_SUBMITTED",
  SUBMITTED: "SUBMITTED",
  LATE: "LATE",
  REVIEWED: "REVIEWED",
  EVALUATED: "EVALUATED",
  RETURNED: "RETURNED",
  RESUBMISSION_REQUESTED: "RESUBMISSION_REQUESTED",
  OVERDUE: "OVERDUE",
} as const;

export interface HomeworkAttachment {
  _id?: Types.ObjectId;
  name: string;
  url: string;
  type?: string;
  size?: number;
  storagePath?: string;
}

export interface HomeworkDocument extends Document {
  schoolId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  sectionIds: Types.ObjectId[];
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description: string;
  instructions?: string;
  assignedDate: Date;
  dueDate: Date;
  totalMarks?: number;
  attachments: HomeworkAttachment[];
  allowSubmission: boolean;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  status: (typeof HOMEWORK_STATUS)[keyof typeof HOMEWORK_STATUS];
  isDeleted: boolean;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeworkAttempt {
  attemptNumber: number;
  answer?: string;
  attachments: HomeworkAttachment[];
  submittedAt: Date;
  status: string;
  isLate: boolean;
}

export interface HomeworkEvaluationEntry {
  evaluatorId: Types.ObjectId;
  marksObtained?: number;
  feedback?: string;
  action: "EVALUATED" | "RESUBMISSION_REQUESTED";
  evaluatedAt: Date;
}

export interface HomeworkSubmissionDocument extends Document {
  schoolId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  homeworkId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId: Types.ObjectId;
  subjectId: Types.ObjectId;
  submittedAt?: Date;
  answer?: string;
  attachments: HomeworkAttachment[];
  status: (typeof HOMEWORK_SUBMISSION_STATUS)[keyof typeof HOMEWORK_SUBMISSION_STATUS];
  isLate: boolean;
  attemptNumber: number;
  attempts: HomeworkAttempt[];
  marksObtained?: number;
  feedback?: string;
  evaluationHistory: HomeworkEvaluationEntry[];
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<HomeworkAttachment>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  type: { type: String, trim: true, maxlength: 120 },
  size: { type: Number, min: 0, max: 10 * 1024 * 1024 },
  storagePath: { type: String, trim: true, select: false },
});

const attemptSchema = new Schema<HomeworkAttempt>({
  attemptNumber: { type: Number, required: true, min: 1 },
  answer: { type: String, trim: true, maxlength: 20000 },
  attachments: { type: [attachmentSchema], default: [] },
  submittedAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(HOMEWORK_SUBMISSION_STATUS), required: true },
  isLate: { type: Boolean, default: false },
}, { _id: true });

const evaluationHistorySchema = new Schema<HomeworkEvaluationEntry>({
  evaluatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  marksObtained: { type: Number, min: 0 },
  feedback: { type: String, trim: true, maxlength: 2000 },
  action: { type: String, enum: ["EVALUATED", "RESUBMISSION_REQUESTED"], required: true },
  evaluatedAt: { type: Date, required: true },
}, { _id: true });

const homeworkSchema = new Schema<HomeworkDocument>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  academicSessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  // sectionId is retained for compatibility with records created by earlier builds.
  sectionId: { type: Schema.Types.ObjectId, ref: "Section", index: true },
  sectionIds: [{ type: Schema.Types.ObjectId, ref: "Section", index: true }],
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  instructions: { type: String, trim: true, maxlength: 5000 },
  assignedDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true, index: true },
  totalMarks: { type: Number, min: 0 },
  attachments: { type: [attachmentSchema], default: [] },
  allowSubmission: { type: Boolean, default: true },
  allowLateSubmission: { type: Boolean, default: false },
  allowResubmission: { type: Boolean, default: false },
  status: { type: String, enum: Object.values(HOMEWORK_STATUS), default: HOMEWORK_STATUS.DRAFT, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

homeworkSchema.index({ schoolId: 1, academicSessionId: 1, classId: 1, sectionIds: 1, dueDate: 1 });
homeworkSchema.index({ schoolId: 1, teacherId: 1, assignedDate: -1 });
homeworkSchema.index({ schoolId: 1, subjectId: 1, dueDate: 1 });
homeworkSchema.index({ schoolId: 1, status: 1, isDeleted: 1, dueDate: 1 });

const submissionSchema = new Schema<HomeworkSubmissionDocument>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  academicSessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  homeworkId: { type: Schema.Types.ObjectId, ref: "Homework", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  submittedAt: Date,
  answer: { type: String, trim: true, maxlength: 20000 },
  attachments: { type: [attachmentSchema], default: [] },
  status: { type: String, enum: Object.values(HOMEWORK_SUBMISSION_STATUS), default: HOMEWORK_SUBMISSION_STATUS.NOT_SUBMITTED, index: true },
  isLate: { type: Boolean, default: false },
  attemptNumber: { type: Number, default: 0, min: 0 },
  attempts: { type: [attemptSchema], default: [] },
  marksObtained: { type: Number, min: 0 },
  feedback: { type: String, trim: true, maxlength: 2000 },
  evaluationHistory: { type: [evaluationHistorySchema], default: [] },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
}, { timestamps: true, versionKey: false });

submissionSchema.index({ schoolId: 1, homeworkId: 1, studentId: 1 }, { unique: true });
submissionSchema.index({ schoolId: 1, studentId: 1, submittedAt: -1 });
submissionSchema.index({ schoolId: 1, homeworkId: 1, status: 1 });
submissionSchema.index({ schoolId: 1, academicSessionId: 1, classId: 1, sectionId: 1, status: 1 });

export const Homework: Model<HomeworkDocument> =
  mongoose.models.Homework || mongoose.model<HomeworkDocument>("Homework", homeworkSchema);
export const HomeworkSubmission: Model<HomeworkSubmissionDocument> =
  mongoose.models.HomeworkSubmission || mongoose.model<HomeworkSubmissionDocument>("HomeworkSubmission", submissionSchema);
export default Homework;
