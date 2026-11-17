
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export enum ExamMarksWorkflowStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  APPROVED = "APPROVED",
  PUBLISHED = "PUBLISHED",
}

export enum ExamStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface IExamSubject {
  subjectId: Types.ObjectId;
  examDate: Date;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passingMarks: number;
  roomNumber?: string;
}

export interface IExam extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classId: Types.ObjectId;

  examName: string;
  examCode?: string;
  examType: string;
  description?: string;

  startDate: Date;
  endDate: Date;

  subjects: IExamSubject[];

  status: ExamStatus;
  isPublished: boolean;
  marksWorkflowStatus: ExamMarksWorkflowStatus;
  submittedAt?: Date | null;
  submittedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  verifiedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  publishedAt?: Date | null;
  publishedBy?: Types.ObjectId | null;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const examSubjectSchema = new Schema<IExamSubject>(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    examDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    roomNumber: {
      type: String,
      trim: true,
      maxlength: 30,
    },
  },
  {
    _id: true,
  }
);

const examSchema = new Schema<IExam>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    examName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    examCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    examType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    subjects: {
      type: [examSubjectSchema],
      required: true,
      validate: {
        validator: (value: IExamSubject[]) =>
          Array.isArray(value) && value.length > 0,
        message: "At least one subject is required",
      },
    },

    status: {
      type: String,
      enum: Object.values(ExamStatus),
      default: ExamStatus.DRAFT,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    marksWorkflowStatus: { type: String, enum: Object.values(ExamMarksWorkflowStatus), default: ExamMarksWorkflowStatus.DRAFT, index: true },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Exam code unique within a school and academic session.
examSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    examCode: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      examCode: { $type: "string" },
    },
  }
);

examSchema.index({ schoolId: 1, sessionId: 1, examName: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "uniq_exam_name_per_school_session_ci" });

// Common exam listing queries.
examSchema.index({
  schoolId: 1,
  sessionId: 1,
  classId: 1,
  status: 1,
});

examSchema.index({
  schoolId: 1,
  startDate: 1,
});

examSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate) {
    if (this.startDate > this.endDate) {
      this.invalidate(
        "endDate",
        "Exam end date cannot be before start date"
      );
    }
  }

  for (const subject of this.subjects || []) {
    if (subject.passingMarks > subject.maxMarks) {
      this.invalidate(
        "subjects",
        "Passing marks cannot exceed maximum marks"
      );
      break;
    }

    if (subject.startTime >= subject.endTime) {
      this.invalidate(
        "subjects",
        "Subject exam start time must be before end time"
      );
      break;
    }
  }

  next();
});

const Exam: Model<IExam> =
  mongoose.models.Exam ||
  mongoose.model<IExam>("Exam", examSchema);

export { Exam };
export default Exam;