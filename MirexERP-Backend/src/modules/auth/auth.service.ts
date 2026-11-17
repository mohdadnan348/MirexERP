
import crypto from "crypto";
import mongoose from "mongoose";

import { USER_ROLES, ACCOUNT_STATUS } from "../../config/constants";
import UserModel from "./auth.model";

import {
  generateAuthTokens,
  generateAccessToken,
  verifyRefreshToken,
} from "../../utils/token";

import {
  hashPassword,
  comparePassword,
  assertStrongPassword,
} from "../../utils/password";

import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";
import Student from "../students/students.model";
import StudentPortal from "../student-portal/student-portal.model";
import { Parent } from "../parents/parents.model";
import { SchoolSecurityPolicy } from "../settings/security.model";
import { consumeRefreshSession } from "./refresh-session";

/**
 * Authentication token response.
 */
export interface AuthResult {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
}

/** Apply the school-configured password complexity policy in backend auth workflows. */
const assertSchoolPasswordPolicy = async (password: string, schoolId?: unknown): Promise<void> => {
  assertStrongPassword(password);
  if (!schoolId || !mongoose.Types.ObjectId.isValid(String(schoolId))) return;
  const policy = await SchoolSecurityPolicy.findOne({ schoolId }).lean();
  if (!policy) return;
  const failures: string[] = [];
  if (password.length < Number(policy.minimumPasswordLength || 8)) failures.push(`at least ${policy.minimumPasswordLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password)) failures.push("an uppercase letter");
  if (policy.requireLowercase && !/[a-z]/.test(password)) failures.push("a lowercase letter");
  if (policy.requireNumber && !/[0-9]/.test(password)) failures.push("a number");
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) failures.push("a symbol");
  if (failures.length) throw new AppError(`Password must contain ${failures.join(", ")}.`, 400);
};

/**
 * Create SHA-256 hash for storing sensitive tokens.
 */
const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Generate a cryptographically secure random token.
 */
const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Convert user document into a safe public object.
 */
const sanitizeUser = (
  user: Record<string, unknown>
): Record<string, unknown> => {
  const {
    password,
    passwordResetToken,
    passwordResetExpires,
    emailVerificationToken,
    emailVerificationExpires,
    failedLoginAttempts,
    lockUntil,
    ...safeUser
  } = user;

  return safeUser;
};

/**
 * Convert a MongoDB user ID into a string.
 */
const getUserId = (user: {
  _id: mongoose.Types.ObjectId;
}): string => user._id.toString();

/**
 * Check whether an account can authenticate.
 */
const assertAccountCanLogin = (user: {
  status: string;
  isActive: boolean;
  isDeleted: boolean;
  lockUntil?: Date | null;
}): void => {
  if (user.isDeleted) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (
    user.status !== ACCOUNT_STATUS.ACTIVE ||
    !user.isActive
  ) {
    throw new AppError(
      "Your account is inactive or suspended. Contact your administrator.",
      403
    );
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(
      "Account temporarily locked. Please try again later.",
      423
    );
  }
};

/**
 * Create a refresh session in MongoDB.
 *
 * Refresh tokens are never stored as plain text.
 */
const createRefreshSession = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  const decoded = verifyRefreshToken(refreshToken);

  const expiresAt = new Date(
    (decoded.exp ?? 0) * 1000
  );

  await mongoose.connection
    .collection("authsessions")
    .insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      tokenHash: hashToken(refreshToken),
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
};

/**
 * Revoke a refresh session.
 */
const revokeRefreshSession = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  await mongoose.connection
    .collection("authsessions")
    .updateOne(
      {
        userId: new mongoose.Types.ObjectId(userId),
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
};

/**
 * Register a new school-level user.
 *
 * Super Admin, Parent, Teacher and Student accounts
 * are created through their dedicated workflows.
 */
export const registerUser = async (input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  schoolId: string;
  role: string;
}): Promise<Record<string, unknown>> => {
  const allowedRoles = [
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.PRINCIPAL,
    USER_ROLES.ACCOUNTANT,
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.LIBRARIAN,
    USER_ROLES.TRANSPORT_MANAGER,
  ];

  if (!allowedRoles.includes(input.role as never)) {
    throw new AppError("This role cannot be registered publicly.", 403);
  }

  if (!mongoose.Types.ObjectId.isValid(input.schoolId)) {
    throw new AppError("Invalid school ID.", 400);
  }

  const school = await mongoose.connection
    .collection("schools")
    .findOne({
      _id: new mongoose.Types.ObjectId(input.schoolId),
      isDeleted: { $ne: true },
    });

  if (!school) {
    throw new AppError("School not found.", 404);
  }

  const existingUser = await UserModel.findOne({
    email: input.email.toLowerCase(),
  });

  if (existingUser) {
    throw new AppError("Email address is already registered.", 409);
  }

  await assertSchoolPasswordPolicy(input.password, input.schoolId);
  const hashedPassword = await hashPassword(input.password);

  const user = await UserModel.create({
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    password: hashedPassword,
    role: input.role,
    schoolId: new mongoose.Types.ObjectId(input.schoolId),
    // This route is protected by Super Admin authentication; accounts
    // created by the platform owner are active immediately. A pending
    // status without an activation endpoint would otherwise lock users out.
    status: ACCOUNT_STATUS.ACTIVE,
    isActive: true,
    isEmailVerified: false,
    isDeleted: false,
  });

  return sanitizeUser(
    user.toObject() as Record<string, unknown>
  );
};

/**
 * Create an immediately usable School Admin account.
 * This operation is only exposed through a Super Admin protected route.
 */
export const createSchoolAdminUser = async (input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  schoolId: string;
}): Promise<Record<string, unknown>> => {
  if (!mongoose.Types.ObjectId.isValid(input.schoolId)) {
    throw new AppError("Invalid school ID.", 400);
  }

  const school = await mongoose.connection.collection("schools").findOne({
    _id: new mongoose.Types.ObjectId(input.schoolId),
    isDeleted: { $ne: true },
  });

  if (!school) {
    throw new AppError("School not found.", 404);
  }

  const existingUser = await UserModel.findOne({
    email: input.email.toLowerCase(),
    isDeleted: false,
  });

  if (existingUser) {
    throw new AppError("Email address is already registered.", 409);
  }

  await assertSchoolPasswordPolicy(input.password, input.schoolId);
  const hashedPassword = await hashPassword(input.password);

  const user = await UserModel.create({
    name: input.name.trim(),
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    password: hashedPassword,
    role: USER_ROLES.SCHOOL_ADMIN,
    schoolId: new mongoose.Types.ObjectId(input.schoolId),
    status: ACCOUNT_STATUS.ACTIVE,
    isActive: true,
    isEmailVerified: false,
    isDeleted: false,
  });

  return sanitizeUser(user.toObject() as Record<string, unknown>);
};

/**
 * Login user using email and password.
 */
export const loginUser = async (
  identifier: string,
  password: string
): Promise<AuthResult> => {
  const normalizedIdentifier = String(identifier || "").trim();
  let user = await UserModel.findOne({
    email: normalizedIdentifier.toLowerCase(),
    isDeleted: false,
  }).select("+password");

  // School-issued student IDs resolve only through a unique active student
  // record and an administrator-linked portal account. No student record is duplicated.
  if (!user) {
    const matches = await Student.find({
      admissionNumber: normalizedIdentifier.toUpperCase(),
      isDeleted: false,
      isActive: true,
      status: "ACTIVE",
    }).limit(2).select("_id schoolId").lean();
    if (matches.length === 1) {
      const portal = await StudentPortal.findOne({
        schoolId: matches[0].schoolId,
        studentId: matches[0]._id,
      }).select("userId").lean();
      if (portal?.userId) {
        const linkedUser = await UserModel.findOne({
          _id: portal.userId,
          role: USER_ROLES.STUDENT,
          schoolId: matches[0].schoolId,
          isDeleted: false,
        }).select("+password");
        if (linkedUser) user = linkedUser;
      }
    }
  }

  if (!user && /^[+0-9() -]{10,20}$/.test(normalizedIdentifier)) {
    const normalizedPhone = normalizedIdentifier.replace(/[^0-9]/g, "");
    const parents = await Parent.find({ phone: { $in: [normalizedIdentifier, normalizedPhone] }, isActive: true, userId: { $ne: null } }).limit(2).select("userId schoolId").lean();
    if (parents.length === 1 && parents[0].userId) {
      const linkedUser = await UserModel.findOne({ _id: parents[0].userId, role: USER_ROLES.PARENT, schoolId: parents[0].schoolId, isDeleted: false }).select("+password");
      if (linkedUser) user = linkedUser;
    }
  }

  if (!user) {
    throw new AppError("Invalid email, student ID or parent phone number/password.", 401);
  }

  assertAccountCanLogin(user);

  const passwordMatches = await comparePassword(
    password,
    user.password
  );

  if (!passwordMatches) {
    const failedAttempts = user.failedLoginAttempts + 1;

    const update: Record<string, unknown> = {
      failedLoginAttempts: failedAttempts,
    };

    const loginPolicy = user.schoolId ? await SchoolSecurityPolicy.findOne({ schoolId: user.schoolId }).select("failedLoginLimit lockoutMinutes").lean() : null;
    const failedLimit = Number(loginPolicy?.failedLoginLimit || 5);
    const lockoutMinutes = Number(loginPolicy?.lockoutMinutes || 15);
    if (failedAttempts >= failedLimit) {
      update.lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: update }
    );

    throw new AppError("Invalid email or password.", 401);
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    }
  );

  const userId = getUserId(user);
  const schoolId = user.schoolId?.toString() ?? null;

  const tokens = generateAuthTokens(
    userId,
    user.role,
    schoolId
  );

  await createRefreshSession(userId, tokens.refreshToken);

  return {
    user: sanitizeUser(
      user.toObject() as Record<string, unknown>
    ),
    ...tokens,
  };
};

/**
 * Refresh access and refresh tokens.
 *
 * Implements refresh-token rotation.
 */
export const refreshAuthTokens = async (
  refreshToken: string
): Promise<Pick<AuthResult, "accessToken" | "refreshToken">> => {
  const decoded = verifyRefreshToken(refreshToken);

  const userId = decoded.sub;

  const session = await mongoose.connection
    .collection("authsessions")
    .findOne({
      userId: new mongoose.Types.ObjectId(userId),
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

  if (!session) {
    throw new AppError(
      "Refresh session is invalid or has expired.",
      401
    );
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError("User account not found.", 401);
  }

  assertAccountCanLogin(user);

  // Consume the old token atomically. Without checking matchedCount, two
  // concurrent refresh requests could both rotate the same still-valid token.
  const consumed = await consumeRefreshSession(
    mongoose.connection.collection("authsessions"),
    new mongoose.Types.ObjectId(userId),
    hashToken(refreshToken)
  );
  if (!consumed) {
    throw new AppError("Refresh token has already been used or revoked.", 401);
  }

  const tokens = generateAuthTokens(
    userId,
    user.role,
    user.schoolId?.toString() ?? null
  );

  await createRefreshSession(userId, tokens.refreshToken);

  return tokens;
};

/**
 * Logout user by revoking the refresh session.
 */
export const logoutUser = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  verifyRefreshToken(refreshToken);

  await revokeRefreshSession(userId, refreshToken);
};

/**
 * Change password for authenticated user.
 */
export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await UserModel.findById(userId).select("+password");

  if (!user || user.isDeleted) {
    throw new AppError("User account not found.", 404);
  }

  const matches = await comparePassword(
    currentPassword,
    user.password
  );

  if (!matches) {
    throw new AppError("Current password is incorrect.", 400);
  }

  await assertSchoolPasswordPolicy(newPassword, user.schoolId);

  const newHash = await hashPassword(newPassword);

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        password: newHash,
        passwordChangedAt: new Date(),
      },
    }
  );

  await mongoose.connection
    .collection("authsessions")
    .updateMany(
      {
        userId: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
};

/**
 * Request a password reset.
 *
 * The raw token must be delivered through a secure email
 * service by the controller. Only its hash is stored.
 */
export const requestPasswordReset = async (
  email: string
): Promise<{ resetToken: string } | null> => {
  const user = await UserModel.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (!user) {
    return null;
  }

  const resetToken = generateSecureToken();

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetToken: hashToken(resetToken),
        passwordResetExpires: new Date(
          Date.now() + 15 * 60 * 1000
        ),
      },
    }
  );

  return { resetToken };
};

/**
 * Reset password using a valid reset token.
 */
export const resetUserPassword = async (
  token: string,
  newPassword: string
): Promise<void> => {
  const user = await UserModel.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(
      "Password reset token is invalid or expired.",
      400
    );
  }

  await assertSchoolPasswordPolicy(newPassword, user.schoolId);
  const hashedPassword = await hashPassword(newPassword);

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    }
  );

  await mongoose.connection
    .collection("authsessions")
    .updateMany(
      {
        userId: user._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
};

/**
 * Create email verification token.
 *
 * The raw token should be sent by the email service.
 */
export const createEmailVerificationToken = async (
  userId: string
): Promise<string> => {
  const user = await UserModel.findById(userId);

  if (!user || user.isDeleted) {
    throw new AppError("User account not found.", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified.", 400);
  }

  const verificationToken = generateSecureToken();

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerificationToken: hashToken(verificationToken),
        emailVerificationExpires: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ),
      },
    }
  );

  return verificationToken;
};

/**
 * Verify user's email address.
 */
export const verifyUserEmail = async (
  token: string
): Promise<void> => {
  const user = await UserModel.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(
      "Email verification token is invalid or expired.",
      400
    );
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    }
  );
};

/**
 * Resend email verification token.
 */
export const resendEmailVerification = async (
  email: string
): Promise<string | null> => {
  const user = await UserModel.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (!user || user.isEmailVerified) {
    return null;
  }

  return createEmailVerificationToken(user._id.toString());
};
