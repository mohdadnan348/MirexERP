
import mongoose, { Document, Schema, Types } from "mongoose";

export enum ReportType {
  DASHBOARD = "DASHBOARD",
  STUDENTS = "STUDENTS",
  ATTENDANCE = "ATTENDANCE",
  FEES = "FEES",
  EMPLOYEES = "EMPLOYEES",
  EXAMS = "EXAMS",
  FINANCIAL = "FINANCIAL",
}

export enum ReportFormat {
  PDF = "PDF",
  EXCEL = "EXCEL",
  CSV = "CSV",
}

export enum ReportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface IReport extends Document {
  schoolId: Types.ObjectId;
  reportType: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  title: string;
  filters: {
    startDate?: Date;
    endDate?: Date;
    sessionId?: Types.ObjectId;
    classId?: Types.ObjectId;
    sectionId?: Types.ObjectId;
    month?: number;
    year?: number;
  };
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  recordCount: number;
  errorMessage?: string;
  generatedBy: Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    reportType: {
      type: String,
      enum: Object.values(ReportType),
      required: true,
      index: true,
    },

    format: {
      type: String,
      enum: Object.values(ReportFormat),
      required: true,
      default: ReportFormat.PDF,
    },

    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    filters: {
      startDate: Date,
      endDate: Date,

      sessionId: {
        type: Schema.Types.ObjectId,
        ref: "Session",
      },

      classId: {
        type: Schema.Types.ObjectId,
        ref: "Class",
      },

      sectionId: {
        type: Schema.Types.ObjectId,
        ref: "Section",
      },

      month: {
        type: Number,
        min: 1,
        max: 12,
      },

      year: {
        type: Number,
        min: 2000,
        max: 2100,
      },
    },

    fileUrl: {
      type: String,
      trim: true,
    },

    fileName: {
      type: String,
      trim: true,
    },

    fileSize: {
      type: Number,
      min: 0,
    },

    recordCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    errorMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// School-wise report history
reportSchema.index({
  schoolId: 1,
  reportType: 1,
  createdAt: -1,
});

// Report status filtering
reportSchema.index({
  schoolId: 1,
  status: 1,
  createdAt: -1,
});

// User-wise generated reports
reportSchema.index({
  schoolId: 1,
  generatedBy: 1,
  createdAt: -1,
});

export const Report = mongoose.model<IReport>(
  "Report",
  reportSchema
);
