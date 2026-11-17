
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type HolidayType =
  | "NATIONAL"
  | "STATE"
  | "RELIGIOUS"
  | "SCHOOL"
  | "OPTIONAL"
  | "OTHER";

export type HolidayApplicableTo =
  | "STUDENTS"
  | "EMPLOYEES"
  | "BOTH";

export interface IHoliday {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;

  name: string;
  description?: string;

  holidayType: HolidayType;
  applicableTo: HolidayApplicableTo;

  startDate: Date;
  endDate: Date;
  totalDays: number;

  isOptional: boolean;
  isRecurring: boolean;

  recurringMonth?: number | null;
  recurringDay?: number | null;

  isActive: boolean;

  isDeleted: boolean;
  deletedAt?: Date | null;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IHolidayDocument extends IHoliday, Document {}

const holidaySchema = new Schema<IHolidayDocument>(
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

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    holidayType: {
      type: String,
      enum: [
        "NATIONAL",
        "STATE",
        "RELIGIOUS",
        "SCHOOL",
        "OPTIONAL",
        "OTHER",
      ],
      default: "SCHOOL",
      required: true,
    },

    applicableTo: {
      type: String,
      enum: ["STUDENTS", "EMPLOYEES", "BOTH"],
      default: "BOTH",
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

    isOptional: {
      type: Boolean,
      default: false,
    },

    isRecurring: {
      type: Boolean,
      default: false,
    },

    recurringMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },

    recurringDay: {
      type: Number,
      min: 1,
      max: 31,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
    collection: "holidays",
  }
);

// School-wise holiday listing.
holidaySchema.index({
  schoolId: 1,
  sessionId: 1,
  startDate: 1,
  isDeleted: 1,
});

// Date-wise calendar lookup.
holidaySchema.index({
  schoolId: 1,
  startDate: 1,
  endDate: 1,
  isActive: 1,
  isDeleted: 1,
});

// Holiday type filtering.
holidaySchema.index({
  schoolId: 1,
  sessionId: 1,
  holidayType: 1,
  isDeleted: 1,
});

// Validate holiday date range and recurring dates.
holidaySchema.pre("validate", function () {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      this.invalidate(
        "endDate",
        "Holiday end date cannot be before start date"
      );
    } else {
      const difference =
        Math.floor(
          (end.getTime() - start.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      if (this.totalDays !== difference) {
        this.totalDays = difference;
      }
    }
  }

  if (this.isRecurring) {
    if (!this.recurringMonth) {
      this.invalidate(
        "recurringMonth",
        "Recurring month is required for recurring holidays"
      );
    }

    if (!this.recurringDay) {
      this.invalidate(
        "recurringDay",
        "Recurring day is required for recurring holidays"
      );
    }
  } else {
    this.recurringMonth = null;
    this.recurringDay = null;
  }
});

const Holiday: Model<IHolidayDocument> =
  mongoose.models.Holiday ||
  mongoose.model<IHolidayDocument>(
    "Holiday",
    holidaySchema
  );

export default Holiday;