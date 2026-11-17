
import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

export enum DayOfWeek {
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
  SUNDAY = "SUNDAY",
}

export interface ITimetable extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  roomId?: Types.ObjectId;
  periodId?: Types.ObjectId;
  versionId?: Types.ObjectId;
  combinedGroupId?: string;
  entryType?: "REGULAR" | "ACTIVITY" | "LAB";
  isBreak: boolean;
  breakName?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timetableSchema = new Schema<ITimetable>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: function () {
        return !this.isBreak;
      },
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: function () {
        return !this.isBreak;
      },
    },
    dayOfWeek: {
      type: String,
      enum: Object.values(DayOfWeek),
      required: true,
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    roomNumber: { type: String, trim: true, maxlength: 30 },
    roomId: { type: Schema.Types.ObjectId, ref: "TimetableRoom" },
    periodId: { type: Schema.Types.ObjectId, ref: "TimetablePeriod" },
    versionId: { type: Schema.Types.ObjectId, ref: "TimetableVersion", default: null },
    combinedGroupId: { type: String, trim: true, maxlength: 80 },
    entryType: { type: String, enum: ["REGULAR", "ACTIVITY", "LAB"], default: "REGULAR" },
    isBreak: {
      type: Boolean,
      default: false,
    },
    breakName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
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
  }
);

// Query index; version-aware uniqueness is enforced by the version workflow.
timetableSchema.index({ schoolId: 1, sessionId: 1, classId: 1, sectionId: 1, dayOfWeek: 1, periodNumber: 1, versionId: 1 });

// Useful for teacher timetable queries.
timetableSchema.index({
  schoolId: 1,
  teacherId: 1,
  isActive: 1,
  dayOfWeek: 1,
});

// Useful for class timetable queries.
timetableSchema.index({
  schoolId: 1,
  classId: 1,
  sectionId: 1,
  dayOfWeek: 1,
});

const Timetable = mongoose.model<ITimetable>(
  "Timetable",
  timetableSchema
);

export default Timetable;
