
import mongoose, {
  InferSchemaType,
  Schema,
} from "mongoose";

import {
  USER_ROLES,
  ACCOUNT_STATUS,
} from "../../config/constants";

/**
 * User schema.
 *
 * Collection name: users
 *
 * Supports:
 * - Platform Super Admin
 * - School management users
 * - Parents
 * - Teachers
 * - Students
 */
const userSchema = new Schema(
  {
    // Basic account information
    name: {
      type: String,
      required: [true, "User name is required."],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Email address is required."],
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      maxlength: 20,
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      select: false,
    },

    // Role and school association
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: [true, "User role is required."],
      index: true,
    },

    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },

    // Account status
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
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

    // Profile information
    avatar: {
      type: String,
      default: null,
    },

    permissions: {
      type: [String],
      default: [],
    },

    // Authentication tracking
    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    // Email verification
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // Password reset
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "users",
    strict: true,
  }
);

/**
 * Email must be globally unique.
 *
 * This prevents the same email from being registered
 * under multiple school accounts.
 */
userSchema.index(
  { email: 1 },
  { unique: true, name: "unique_user_email" }
);

/**
 * School-wise user listing.
 */
userSchema.index({
  schoolId: 1,
  role: 1,
  status: 1,
});

/**
 * Validate school association.
 *
 * Only Super Admin can have a null schoolId.
 */
userSchema.pre("validate", function (next) {
  if (
    this.role === USER_ROLES.SUPER_ADMIN &&
    this.schoolId !== null
  ) {
    this.invalidate(
      "schoolId",
      "Super Admin cannot be associated with a school."
    );
  }

  if (
    this.role !== USER_ROLES.SUPER_ADMIN &&
    !this.schoolId
  ) {
    this.invalidate(
      "schoolId",
      "School ID is required for school users."
    );
  }

  next();
});

/**
 * Infer TypeScript document type from schema.
 */
export type User = InferSchemaType<typeof userSchema>;

/**
 * User model.
 *
 * Explicit collection name keeps compatibility
 * with the existing seed.ts implementation.
 */
const UserModel =
  mongoose.models.User ||
  mongoose.model("User", userSchema, "users");

export default UserModel;
