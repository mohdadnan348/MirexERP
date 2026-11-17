
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type AttendanceType = "STUDENT" | "EMPLOYEE";

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "LEAVE"
  | "HOLIDAY";

export interface IAttendance {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;

  attendanceType: AttendanceType;

  studentId?: Types.ObjectId | null;
  employeeId?: Types.ObjectId | null;

  classId?: Types.ObjectId | null;
  sectionId?: Types.ObjectId | null;

  attendanceDate: Date;
  periodNumber?: number | null;
  correctionHistory?: Array<{ previousStatus: AttendanceStatus; requestedStatus: AttendanceStatus; reason: string; requestedBy: Types.ObjectId; reviewedBy?: Types.ObjectId; reviewedAt?: Date; decision: "PENDING" | "APPROVED" | "REJECTED"; createdAt: Date }>;

  status: AttendanceStatus;

  checkInTime?: Date | null;
  checkOutTime?: Date | null;

  lateByMinutes?: number;
  earlyDepartureMinutes?: number;

  remarks?: string;

  markedBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  isDeleted: boolean;
  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendanceDocument
  extends IAttendance,
    Document {
  invalidate(path: string, errorMessage: string, value?: unknown, kind?: string): void;
}

const attendanceSchema = new Schema<IAttendanceDocument>(
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

    attendanceType: {
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

    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },

    attendanceDate: {
      type: Date,
      required: true,
    },

    periodNumber: { type: Number, min: 1, default: null },
    correctionHistory: [{
      previousStatus: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE", "HOLIDAY"], required: true },
      requestedStatus: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE", "HOLIDAY"], required: true },
      reason: { type: String, required: true, trim: true, maxlength: 500 },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
      decision: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
      createdAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: [
        "PRESENT",
        "ABSENT",
        "LATE",
        "HALF_DAY",
        "LEAVE",
        "HOLIDAY",
      ],
      required: true,
      default: "PRESENT",
    },

    checkInTime: {
      type: Date,
      default: null,
    },

    checkOutTime: {
      type: Date,
      default: null,
    },

    lateByMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    earlyDepartureMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "attendance",
  }
);

// One daily record when periodNumber is absent; one record per timetable period otherwise.
attendanceSchema.index(
  { schoolId: 1, sessionId: 1, studentId: 1, attendanceDate: 1 },
  { unique: true, partialFilterExpression: { attendanceType: "STUDENT", isDeleted: false, periodNumber: null } }
);
attendanceSchema.index(
  { schoolId: 1, sessionId: 1, studentId: 1, attendanceDate: 1, periodNumber: 1 },
  { unique: true, partialFilterExpression: { attendanceType: "STUDENT", isDeleted: false, periodNumber: { $type: "number" } } }
);
attendanceSchema.index(
  { schoolId: 1, sessionId: 1, employeeId: 1, attendanceDate: 1 },
  { unique: true, partialFilterExpression: { attendanceType: "EMPLOYEE", isDeleted: false, periodNumber: null } }
);
attendanceSchema.index(
  { schoolId: 1, sessionId: 1, employeeId: 1, attendanceDate: 1, periodNumber: 1 },
  { unique: true, partialFilterExpression: { attendanceType: "EMPLOYEE", isDeleted: false, periodNumber: { $type: "number" } } }
);

// Student class and section attendance filtering.
attendanceSchema.index({
  schoolId: 1,
  sessionId: 1,
  classId: 1,
  sectionId: 1,
  attendanceDate: 1,
  isDeleted: 1,
});

// Employee attendance filtering.
attendanceSchema.index({
  schoolId: 1,
  sessionId: 1,
  employeeId: 1,
  attendanceDate: -1,
  isDeleted: 1,
});

// Attendance reports by date and status.
attendanceSchema.index({
  schoolId: 1,
  attendanceDate: 1,
  status: 1,
  attendanceType: 1,
});

// Validate attendance record relationships.
attendanceSchema.pre("validate", function (this: IAttendanceDocument) {
  if (this.attendanceType === "STUDENT") {
    if (!this.studentId) {
      this.invalidate(
        "studentId",
        "Student ID is required for student attendance"
      );
    }

    if (!this.classId) {
      this.invalidate(
        "classId",
        "Class ID is required for student attendance"
      );
    }

    if (!this.sectionId) {
      this.invalidate(
        "sectionId",
        "Section ID is required for student attendance"
      );
    }

    if (this.employeeId) {
      this.invalidate(
        "employeeId",
        "Employee ID is not allowed for student attendance"
      );
    }
  }

  if (this.attendanceType === "EMPLOYEE") {
    if (!this.employeeId) {
      this.invalidate(
        "employeeId",
        "Employee ID is required for employee attendance"
      );
    }

    if (this.studentId || this.classId || this.sectionId) {
      this.invalidate(
        "attendanceType",
        "Student, class and section references are not allowed for employee attendance"
      );
    }
  }

  if (
    this.checkInTime &&
    this.checkOutTime &&
    this.checkOutTime < this.checkInTime
  ) {
    this.invalidate(
      "checkOutTime",
      "Check-out time cannot be before check-in time"
    );
  }

  if (
    this.status === "ABSENT" ||
    this.status === "LEAVE" ||
    this.status === "HOLIDAY"
  ) {
    if (this.checkInTime || this.checkOutTime) {
      this.invalidate(
        "checkInTime",
        "Check-in and check-out times are not allowed for this attendance status"
      );
    }
  }

  if (this.status === "PRESENT" && !this.checkInTime) {
    // Check-in may be optional for manually marked attendance.
    this.checkInTime = null;
  }
});

const Attendance: Model<IAttendanceDocument> =
  mongoose.models.Attendance ||
  mongoose.model<IAttendanceDocument>(
    "Attendance",
    attendanceSchema
  );

export { Attendance };
export default Attendance;
