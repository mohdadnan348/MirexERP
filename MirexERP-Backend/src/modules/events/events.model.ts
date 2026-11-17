
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

export enum EventStatus {
  DRAFT = "DRAFT",
  UPCOMING = "UPCOMING",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum EventCategory {
  ACADEMIC = "ACADEMIC",
  CULTURAL = "CULTURAL",
  SPORTS = "SPORTS",
  CELEBRATION = "CELEBRATION",
  MEETING = "MEETING",
  WORKSHOP = "WORKSHOP",
  HOLIDAY = "HOLIDAY",
  OTHER = "OTHER",
}

export interface IEvent extends Document {
  schoolId: Types.ObjectId;
  sessionId?: Types.ObjectId;

  title: string;
  description?: string;
  category: EventCategory;

  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;

  venue?: string;
  organizer?: string;

  targetAudience: string[];
  classIds: Types.ObjectId[];
  sectionIds: Types.ObjectId[];
  recipientIds: Types.ObjectId[];

  status: EventStatus;
  isPublished: boolean;

  attachments: {
    name: string;
    url: string;
  }[];

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
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
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    category: {
      type: String,
      enum: Object.values(EventCategory),
      default: EventCategory.OTHER,
      required: true,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
      index: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    endTime: {
      type: String,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    venue: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    organizer: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    targetAudience: {
      type: [String],
      default: ["ALL"],
    },

    classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    sectionIds: [{ type: Schema.Types.ObjectId, ref: "Section" }],
    recipientIds: [{ type: Schema.Types.ObjectId, ref: "User" }],

    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT,
      index: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
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

eventSchema.index({
  schoolId: 1,
  startDate: 1,
  status: 1,
});

eventSchema.index({
  schoolId: 1,
  category: 1,
  startDate: -1,
});
eventSchema.index({ schoolId: 1, sectionIds: 1, startDate: 1 });

eventSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate) {
    if (this.startDate > this.endDate) {
      this.invalidate(
        "endDate",
        "Event end date cannot be before start date"
      );
    }
  }

  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      this.invalidate(
        "endTime",
        "Event end time must be after start time"
      );
    }
  }

  next();
});

const Event: Model<IEvent> =
  mongoose.models.Event ||
  mongoose.model<IEvent>("Event", eventSchema);

export { Event };
export default Event;
