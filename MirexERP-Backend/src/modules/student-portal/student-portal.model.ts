
import {
  Schema,
  model,
  models,
  Document,
  Types,
} from "mongoose";

export interface IStudentPortal extends Document {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  userId?: Types.ObjectId;

  preferences: {
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    language: string;
    theme: "LIGHT" | "DARK" | "SYSTEM";
  };

  lastLoginAt?: Date;
  lastActiveAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const studentPortalSchema = new Schema<IStudentPortal>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    preferences: {
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },

      emailNotifications: {
        type: Boolean,
        default: true,
      },

      pushNotifications: {
        type: Boolean,
        default: true,
      },

      language: {
        type: String,
        default: "en",
        trim: true,
      },

      theme: {
        type: String,
        enum: ["LIGHT", "DARK", "SYSTEM"],
        default: "SYSTEM",
      },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastActiveAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One portal preference record per student per school.
studentPortalSchema.index(
  { schoolId: 1, studentId: 1 },
  { unique: true }
);

studentPortalSchema.index({ schoolId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });

studentPortalSchema.index({
  schoolId: 1,
  lastActiveAt: -1,
});

const StudentPortal =
  models.StudentPortal ||
  model<IStudentPortal>(
    "StudentPortal",
    studentPortalSchema
  );

export default StudentPortal;
