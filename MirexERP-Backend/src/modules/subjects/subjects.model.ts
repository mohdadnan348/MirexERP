
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export type SubjectType =
  | "CORE"
  | "ELECTIVE"
  | "OPTIONAL"
  | "LANGUAGE"
  | "PRACTICAL";

export type SubjectCategory = "CORE" | "ELECTIVE" | "ACTIVITY";

export interface ISubject {
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  subjectType: SubjectType;
  category: SubjectCategory;
  remarks?: string;
  icon?: string;
  color?: string;
  description?: string;
  isOptional: boolean;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubjectDocument extends ISubject, Document {}

const subjectSchema = new Schema<ISubjectDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    category: { type: String, enum: ["CORE", "ELECTIVE", "ACTIVITY"], default: "CORE", required: true },

    remarks: { type: String, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 60 },
    color: { type: String, trim: true, maxlength: 30 },

    subjectType: {
      type: String,
      enum: [
        "CORE",
        "ELECTIVE",
        "OPTIONAL",
        "LANGUAGE",
        "PRACTICAL",
      ],
      default: "CORE",
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    isOptional: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
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
    collection: "subjects",
  }
);

// Subject code must be unique within a school.
subjectSchema.index(
  {
    schoolId: 1,
    code: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Subject name must be unique within a school.
subjectSchema.index(
  {
    schoolId: 1,
    name: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Common subject listing filters.
subjectSchema.index({
  schoolId: 1,
  subjectType: 1,
  isActive: 1,
  isDeleted: 1,
});

// Normalize subject code and name.
subjectSchema.pre("validate", function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.name) {
    this.name = this.name.trim();
  }
});

// Prevent duplicate subject names in the same school.
subjectSchema.pre("validate", function () {
  if (this.name && !this.name.trim()) {
    this.invalidate("name", "Subject name is required");
  }

  if (this.code && !this.code.trim()) {
    this.invalidate("code", "Subject code is required");
  }
});

const Subject: Model<ISubjectDocument> =
  mongoose.models.Subject ||
  mongoose.model<ISubjectDocument>(
    "Subject",
    subjectSchema
  );

export default Subject;
