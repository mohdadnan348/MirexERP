
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export interface ISection {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classId: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  roomNumber?: string;
  capacity?: number | null;
  classTeacherId?: Types.ObjectId | null;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISectionDocument extends ISection, Document {}

const sectionSchema = new Schema<ISectionDocument>(
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    roomNumber: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    capacity: {
      type: Number,
      min: 1,
      default: null,
    },

    classTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
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
    collection: "sections",
  }
);

// Prevent duplicate section names and codes
// within the same school, session and class.
sectionSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    classId: 1,
    code: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

sectionSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    classId: 1,
    name: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Common listing and filtering indexes
sectionSchema.index({
  schoolId: 1,
  sessionId: 1,
  classId: 1,
  isActive: 1,
  isDeleted: 1,
});

sectionSchema.index({
  schoolId: 1,
  classTeacherId: 1,
});

// Normalize section code before validation.
sectionSchema.pre("validate", function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.name) {
    this.name = this.name.trim();
  }

  if (
    this.capacity !== null &&
    this.capacity !== undefined &&
    this.capacity < 1
  ) {
    this.invalidate(
      "capacity",
      "Section capacity must be at least 1"
    );
  }
});

const Section: Model<ISectionDocument> =
  mongoose.models.Section ||
  mongoose.model<ISectionDocument>("Section", sectionSchema);

export default Section;
