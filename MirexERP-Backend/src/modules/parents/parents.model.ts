
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IParent extends Document {
  schoolId: Types.ObjectId;
  userId?: Types.ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  relation: string;
  occupation?: string;
  qualification?: string;
  annualIncome?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  studentIds: Types.ObjectId[];
  emergencyContact?: { name?: string; relationship?: string; phone?: string };
  notificationPreferences?: { homework?: boolean };
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const parentSchema = new Schema<IParent>(
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
      default: null,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    alternatePhone: {
      type: String,
      trim: true,
    },

    relation: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "FATHER",
        "MOTHER",
        "GUARDIAN",
        "GRANDFATHER",
        "GRANDMOTHER",
        "OTHER",
      ],
    },

    occupation: {
      type: String,
      trim: true,
    },

    qualification: {
      type: String,
      trim: true,
    },

    annualIncome: {
      type: Number,
      min: 0,
      default: 0,
    },

    address: {
      street: {
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
    },

    studentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Student",
      },
    ],

    emergencyContact: {
      name: { type: String, trim: true, maxlength: 100 },
      relationship: { type: String, trim: true, maxlength: 50 },
      phone: { type: String, trim: true, maxlength: 20 },
    },

    notificationPreferences: {
      homework: { type: Boolean, default: true },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// School-wise parent lookup
parentSchema.index({
  schoolId: 1,
  firstName: 1,
  lastName: 1,
});

// School-wise email lookup
parentSchema.index({
  schoolId: 1,
  email: 1,
});

// School-wise phone lookup
parentSchema.index({
  schoolId: 1,
  phone: 1,
});

// Linked students lookup
parentSchema.index({
  schoolId: 1,
  studentIds: 1,
});

// Export model
export const Parent = mongoose.model<IParent>(
  "Parent",
  parentSchema
);
