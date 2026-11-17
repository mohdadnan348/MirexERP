
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDashboardSnapshot extends Document {
  schoolId: Types.ObjectId;
  date: Date;
  totalStudents: number;
  totalEmployees: number;
  totalTeachers: number;
  totalParents: number;
  presentStudents: number;
  absentStudents: number;
  presentEmployees: number;
  absentEmployees: number;
  totalFees: number;
  collectedFees: number;
  pendingFees: number;
  totalExpenses: number;
  createdAt: Date;
  updatedAt: Date;
}

const dashboardSnapshotSchema = new Schema<IDashboardSnapshot>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
    },

    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEmployees: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalTeachers: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalParents: {
      type: Number,
      default: 0,
      min: 0,
    },

    presentStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    absentStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    presentEmployees: {
      type: Number,
      default: 0,
      min: 0,
    },

    absentEmployees: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalFees: {
      type: Number,
      default: 0,
      min: 0,
    },

    collectedFees: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingFees: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalExpenses: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

dashboardSnapshotSchema.index(
  { schoolId: 1, date: 1 },
  { unique: true }
);

export const DashboardSnapshot = mongoose.model<IDashboardSnapshot>(
  "DashboardSnapshot",
  dashboardSnapshotSchema
);

// Dashboard activity model

export interface IDashboardActivity extends Document {
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId;
  userName: string;
  action: string;
  module: string;
  description: string;
  entityId?: Types.ObjectId;
  entityType?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const dashboardActivitySchema = new Schema<IDashboardActivity>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    entityId: {
      type: Schema.Types.ObjectId,
    },

    entityType: {
      type: String,
      trim: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

dashboardActivitySchema.index({
  schoolId: 1,
  createdAt: -1,
});

export const DashboardActivity = mongoose.model<IDashboardActivity>(
  "DashboardActivity",
  dashboardActivitySchema
);
