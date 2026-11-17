
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export interface IClass {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;

  name: string;
  code: string;
  displayName?: string;

  numericLevel: number;

  description?: string;

  classTeacherId?: Types.ObjectId;
  classTeacherHistory?: Array<{
    teacherId: Types.ObjectId;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    assignedBy: Types.ObjectId;
  }>;

  capacity?: number;

  stream?: string;

  subjects: Types.ObjectId[];

  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IClassDocumentModel extends IClass, Document {}

const ClassSchema = new Schema<IClassDocumentModel>(
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

    numericLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    classTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    classTeacherHistory: [{
      teacherId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
      effectiveFrom: { type: Date, required: true },
      effectiveTo: { type: Date, default: null },
      assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    }],

    capacity: {
      type: Number,
      min: 1,
    },

    stream: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    subjects: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Subject",
        },
      ],
      default: [],
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
    collection: "classes",
  }
);

// Class code must be unique within a school and session.
ClassSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    code: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Class name must be unique within a school and session.
ClassSchema.index(
  {
    schoolId: 1,
    sessionId: 1,
    name: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
    },
  }
);

// Efficient school-wise class listing.
ClassSchema.index({
  schoolId: 1,
  sessionId: 1,
  isActive: 1,
  numericLevel: 1,
});

// Validate duplicate subjects.
ClassSchema.pre("validate", function (next) {
  const subjectIds = this.subjects.map((id) => id.toString());

  if (new Set(subjectIds).size !== subjectIds.length) {
    this.invalidate(
      "subjects",
      "Duplicate subjects are not allowed in a class"
    );
  }

  next();
});

const Class: Model<IClassDocumentModel> =
  mongoose.models.Class ||
  mongoose.model<IClassDocumentModel>(
    "Class",
    ClassSchema
  );

export default Class;
