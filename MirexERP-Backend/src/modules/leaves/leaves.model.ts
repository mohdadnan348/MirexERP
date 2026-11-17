
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type LeaveApplicantType = "STUDENT" | "EMPLOYEE";

export type LeaveType =
  | "CASUAL"
  | "SICK"
  | "EARNED"
  | "UNPAID"
  | "MATERNITY"
  | "PATERNITY"
  | "OTHER";

export type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface ILeave {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;

  applicantType: LeaveApplicantType;

  studentId?: Types.ObjectId | null;
  employeeId?: Types.ObjectId | null;

  leaveType: LeaveType;

  startDate: Date;
  endDate: Date;
  totalDays: number;

  reason: string;

  supportingDocument?: string | null;

  status: LeaveStatus;

  appliedAt: Date;

  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewRemarks?: string;

  rejectionReason?: string;

  cancelledAt?: Date | null;
  cancellationReason?: string;

  isDeleted: boolean;
  deletedAt?: Date | null;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveDocument extends ILeave, Document {}

const leaveSchema = new Schema<ILeaveDocument>(
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

    applicantType: {
      type: String,
      enum: ["STUDENT", "EMPLOYEE"],
      required: true,
    },

    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },

    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    leaveType: {
      type: String,
      enum: [
        "CASUAL",
        "SICK",
        "EARNED",
        "UNPAID",
        "MATERNITY",
        "PATERNITY",
        "OTHER",
      ],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },

    supportingDocument: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING",
      required: true,
      index: true,
    },

    appliedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

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
    collection: "leaves",
  }
);

// Student leave lookup.
leaveSchema.index({
  schoolId: 1,
  sessionId: 1,
  studentId: 1,
  startDate: -1,
  isDeleted: 1,
});

// Employee leave lookup.
leaveSchema.index({
  schoolId: 1,
  sessionId: 1,
  employeeId: 1,
  startDate: -1,
  isDeleted: 1,
});

// School leave approval dashboard.
leaveSchema.index({
  schoolId: 1,
  status: 1,
  appliedAt: -1,
  isDeleted: 1,
});

// Date-wise leave reports.
leaveSchema.index({
  schoolId: 1,
  startDate: 1,
  endDate: 1,
  status: 1,
  isDeleted: 1,
});

// Validate applicant and leave dates.
leaveSchema.pre("validate", function () {
  if (this.applicantType === "STUDENT") {
    if (!this.studentId) {
      this.invalidate(
        "studentId",
        "Student ID is required for student leave"
      );
    }

    if (this.employeeId) {
      this.invalidate(
        "employeeId",
        "Employee ID is not allowed for student leave"
      );
    }
  }

  if (this.applicantType === "EMPLOYEE") {
    if (!this.employeeId) {
      this.invalidate(
        "employeeId",
        "Employee ID is required for employee leave"
      );
    }

    if (this.studentId) {
      this.invalidate(
        "studentId",
        "Student ID is not allowed for employee leave"
      );
    }
  }

  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      this.invalidate(
        "endDate",
        "Leave end date cannot be before start date"
      );
    }
  }

  if (this.status === "APPROVED" || this.status === "REJECTED") {
    if (!this.reviewedBy) {
      this.invalidate(
        "reviewedBy",
        "Reviewer ID is required for approved or rejected leave"
      );
    }

    if (!this.reviewedAt) {
      this.invalidate(
        "reviewedAt",
        "Review date is required"
      );
    }
  }
});

const Leave: Model<ILeaveDocument> =
  mongoose.models.Leave ||
  mongoose.model<ILeaveDocument>("Leave", leaveSchema);

export default Leave;
