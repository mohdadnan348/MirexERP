
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

import {
  SCHOOL_STATUS,
  SchoolStatus,
} from "../../config/constants";

export interface ISchoolAddress {
  street?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ISchoolContact {
  phone: string;
  alternatePhone?: string;
  email: string;
  website?: string;
}

export interface ISchoolPrincipal {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ISchoolAffiliation {
  board?: string;
  affiliationNumber?: string;
  recognitionNumber?: string;
}

export interface ISchoolBranding {
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface ISchool extends Document {
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: ISchoolAddress;
  contact: ISchoolContact;
  principal?: ISchoolPrincipal;
  affiliation?: ISchoolAffiliation;
  branding?: ISchoolBranding;
  establishedYear?: number;
  schoolType: "PUBLIC" | "PRIVATE" | "GOVERNMENT" | "OTHER";
  status: SchoolStatus;
  timezone: string;
  currency: string;
  statusHistory: Array<{ status: SchoolStatus; changedBy: Types.ObjectId | null; changedAt: Date; reason?: string }>;
  subscriptionId?: Types.ObjectId | null;
  subscriptionExpiresAt?: Date | null;
  isVerified: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<ISchoolAddress>(
  {
    street: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    area: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: "India",
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9A-Za-z\s-]{4,12}$/,
    },
  },
  { _id: false }
);

const contactSchema = new Schema<ISchoolContact>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+?[0-9\s-]{7,20}$/,
    },
    alternatePhone: {
      type: String,
      trim: true,
      match: /^\+?[0-9\s-]{7,20}$/,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 255,
    },
  },
  { _id: false }
);

const principalSchema = new Schema<ISchoolPrincipal>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      trim: true,
      match: /^\+?[0-9\s-]{7,20}$/,
    },
  },
  { _id: false }
);

const affiliationSchema = new Schema<ISchoolAffiliation>(
  {
    board: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    affiliationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    recognitionNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

const brandingSchema = new Schema<ISchoolBranding>(
  {
    logo: {
      type: String,
      trim: true,
    },
    favicon: {
      type: String,
      trim: true,
    },
    primaryColor: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
      default: "#2563EB",
    },
    secondaryColor: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
      default: "#0F172A",
    },
  },
  { _id: false }
);

const schoolSchema = new Schema<ISchool>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+?[0-9\s-]{7,20}$/,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    contact: {
      type: contactSchema,
      required: true,
    },
    principal: {
      type: principalSchema,
      default: undefined,
    },
    affiliation: {
      type: affiliationSchema,
      default: undefined,
    },
    branding: {
      type: brandingSchema,
      default: () => ({}),
    },
    establishedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear(),
    },
    schoolType: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "GOVERNMENT", "OTHER"],
      default: "PRIVATE",
      required: true,
    },
    timezone: { type: String, trim: true, default: "Asia/Kolkata", maxlength: 80 },
    currency: { type: String, trim: true, uppercase: true, default: "INR", minlength: 3, maxlength: 3 },
    statusHistory: [{
      status: { type: String, enum: Object.values(SCHOOL_STATUS), required: true },
      changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String, trim: true, maxlength: 500 },
    }],
    status: {
      type: String,
      enum: Object.values(SCHOOL_STATUS),
      default: SCHOOL_STATUS.PENDING,
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
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
    collection: "schools",
  }
);

// Unique school identifiers.
schoolSchema.index({ code: 1 }, { unique: true });
schoolSchema.index({ slug: 1 }, { unique: true });
schoolSchema.index({ email: 1 }, { unique: true });

// Common filters and search.
schoolSchema.index({ status: 1, isDeleted: 1 });
schoolSchema.index({ name: "text", code: "text", email: "text" });

// Keep deletion metadata consistent.
schoolSchema.pre("save", function (next) {
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }

  if (!this.isDeleted) {
    this.deletedAt = null;
  }

  next();
});

const School: Model<ISchool> =
  mongoose.models.School ||
  mongoose.model<ISchool>("School", schoolSchema);

export default School;
