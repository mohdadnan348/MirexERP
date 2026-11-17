
import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISchoolSettings extends Document {
  schoolId: Types.ObjectId;

  general: {
    schoolName?: string;
    schoolCode?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    logo?: string;
    timezone: string;
    currency: string;
    dateFormat: string;
  };

  academic: {
    currentSessionId?: Types.ObjectId;
    academicYearStartMonth: number;
    workingDays: string[];
    schoolStartTime?: string;
    schoolEndTime?: string;
    periodsPerDay: number;
  };

  attendance: {
    enabled: boolean;
    allowLateMarking: boolean;
    lateAfterTime?: string;
    minimumAttendancePercentage: number;
    autoMarkAbsent: boolean;
  };

  fees: {
    currency: string;
    lateFeeEnabled: boolean;
    lateFeeAmount: number;
    lateFeeType: "FIXED" | "DAILY" | "PERCENTAGE";
    gracePeriodDays: number;
    allowPartialPayment: boolean;
  };

  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    parentNotifications: boolean;
    teacherNotifications: boolean;
    feeReminders: boolean;
    attendanceAlerts: boolean;
    examNotifications: boolean;
  };

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSettingsSchema = new Schema<ISchoolSettings>(
  {
    schoolId: {
  type: Schema.Types.ObjectId,
  ref: "School",
  required: true,
  unique: true,
  index: true,
},

    general: {
      schoolName: {
        type: String,
        trim: true,
        maxlength: 200,
      },

      schoolCode: {
        type: String,
        trim: true,
        maxlength: 50,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      website: {
        type: String,
        trim: true,
      },

      address: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        trim: true,
        default: "India",
      },

      postalCode: {
        type: String,
        trim: true,
      },

      logo: {
        type: String,
        trim: true,
      },

      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },

      currency: {
        type: String,
        default: "INR",
      },

      dateFormat: {
        type: String,
        default: "DD-MM-YYYY",
      },
    },

    academic: {
      currentSessionId: {
        type: Schema.Types.ObjectId,
        ref: "Session",
      },

      academicYearStartMonth: {
        type: Number,
        min: 1,
        max: 12,
        default: 4,
      },

      workingDays: {
        type: [String],
        enum: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ],
        default: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
        ],
      },

      schoolStartTime: {
        type: String,
        default: "08:00",
      },

      schoolEndTime: {
        type: String,
        default: "14:00",
      },

      periodsPerDay: {
        type: Number,
        min: 1,
        max: 20,
        default: 8,
      },
    },

    attendance: {
      enabled: {
        type: Boolean,
        default: true,
      },

      allowLateMarking: {
        type: Boolean,
        default: true,
      },

      lateAfterTime: {
        type: String,
        default: "08:15",
      },

      minimumAttendancePercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 75,
      },

      autoMarkAbsent: {
        type: Boolean,
        default: false,
      },
    },

    fees: {
      currency: {
        type: String,
        default: "INR",
      },

      lateFeeEnabled: {
        type: Boolean,
        default: false,
      },

      lateFeeAmount: {
        type: Number,
        min: 0,
        default: 0,
      },

      lateFeeType: {
        type: String,
        enum: ["FIXED", "DAILY", "PERCENTAGE"],
        default: "FIXED",
      },

      gracePeriodDays: {
        type: Number,
        min: 0,
        default: 0,
      },

      allowPartialPayment: {
        type: Boolean,
        default: true,
      },
    },

    notifications: {
      emailEnabled: {
        type: Boolean,
        default: true,
      },

      smsEnabled: {
        type: Boolean,
        default: false,
      },

      pushEnabled: {
        type: Boolean,
        default: true,
      },

      parentNotifications: {
        type: Boolean,
        default: true,
      },

      teacherNotifications: {
        type: Boolean,
        default: true,
      },

      feeReminders: {
        type: Boolean,
        default: true,
      },

      attendanceAlerts: {
        type: Boolean,
        default: true,
      },

      examNotifications: {
        type: Boolean,
        default: true,
      },
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
  }
);



export const SchoolSettings =
  mongoose.model<ISchoolSettings>(
    "SchoolSettings",
    schoolSettingsSchema
  );
