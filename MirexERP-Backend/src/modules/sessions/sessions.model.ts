
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export interface ISession extends Document {
  schoolId: Types.ObjectId;

  name: string;
  code: string;

  startDate: Date;
  endDate: Date;

  description?: string;

  isActive: boolean;
  isClosed: boolean;
  status?: "DRAFT" | "UPCOMING" | "ACTIVE" | "CLOSED";
  activatedAt?: Date | null;
  activatedBy?: Types.ObjectId | null;
  closedAt?: Date | null;
  closedBy?: Types.ObjectId | null;
  auditHistory?: Array<{ action: string; performedAt: Date; performedBy: Types.ObjectId; details?: string }>;
  isDeleted: boolean;
  deletedAt?: Date | null;

  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
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
      minlength: 3,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: false,
      required: true,
    },

    isClosed: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "UPCOMING", "ACTIVE", "CLOSED"],
      default: "DRAFT",
      index: true,
    },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    auditHistory: [{
      action: { type: String, required: true, enum: ["CREATED", "UPDATED", "ACTIVATED", "DEACTIVATED", "CLOSED", "CLASSES_PREPARED", "FEES_CLONED", "FEE_STRUCTURE_ACTIVATED"] },
      performedAt: { type: Date, required: true },
      performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      details: { type: String, maxlength: 500 },
    }],

    closedAt: {
      type: Date,
      default: null,
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
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "sessions",
  }
);

// Unique session code within each school.
sessionSchema.index(
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

// Prevent duplicate session names within a school.
sessionSchema.index(
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

// Only one active academic session per school.
sessionSchema.index(
  {
    schoolId: 1,
    isActive: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      isDeleted: false,
    },
  }
);

// Common session filters.
sessionSchema.index({
  schoolId: 1,
  isDeleted: 1,
  startDate: -1,
});

// Validate session date range.
sessionSchema.pre("validate", function (this: ISession) {
  if (
    this.startDate &&
    this.endDate &&
    this.startDate >= this.endDate
  ) {
    this.invalidate(
      "endDate",
      "Session end date must be after start date"
    );
  }
  if (this.isClosed) {
    this.isActive = false;
    this.status = "CLOSED";
  } else if (this.isActive) {
    this.status = "ACTIVE";
  } else if (this.status === "ACTIVE" || this.status === "CLOSED") {
    this.status = this.isClosed ? "CLOSED" : "UPCOMING";
  }
});

// Reuse existing model during development hot reload.
const Session: Model<ISession> =
  mongoose.models.Session ||
  mongoose.model<ISession>("Session", sessionSchema);

export default Session;
