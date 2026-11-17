
import { Request, Response } from "express";

import {
  registerUser,
  createSchoolAdminUser,
  loginUser,
  refreshAuthTokens,
  logoutUser,
  changeUserPassword,
  requestPasswordReset,
  resetUserPassword,
  createEmailVerificationToken,
  verifyUserEmail,
  resendEmailVerification,
} from "./auth.service";

import {
  LoginInput,
  RegisterInput,
  CreateSchoolAdminInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.validation";

import { getValidatedData } from "../../middleware/validate";
import { sendSuccess, sendCreated } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";

/**
 * Register a new school-level user.
 * POST /auth/register
 */
export const registerController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<RegisterInput>(res, "body");

  const user = await registerUser(body);

  sendCreated(
    res,
    "User account created successfully. The user can now log in.",
    user
  );
};

/**
 * Create a School Admin account for an existing school.
 * POST /auth/create-school-admin
 */
export const createSchoolAdminController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<CreateSchoolAdminInput>(res, "body");
  const user = await createSchoolAdminUser(body);

  sendCreated(
    res,
    "School Admin account created successfully. The user can now log in.",
    user
  );
};

/**
 * Login user.
 * POST /auth/login
 */
export const loginController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<LoginInput>(res, "body");

  const result = await loginUser(
    body.email,
    body.password
  );

  sendSuccess(
    res,
    "Login successful.",
    result
  );
};

/**
 * Refresh access and refresh tokens.
 * POST /auth/refresh-token
 */
export const refreshTokenController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<RefreshTokenInput>(
    res,
    "body"
  );

  const tokens = await refreshAuthTokens(
    body.refreshToken
  );

  sendSuccess(
    res,
    "Authentication tokens refreshed successfully.",
    tokens
  );
};

/**
 * Logout authenticated user.
 * POST /auth/logout
 */
export const logoutController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<{
    refreshToken: string;
  }>(res, "body");

  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  await logoutUser(
    req.user.userId,
    body.refreshToken
  );

  sendSuccess(
    res,
    "Logout successful.",
    null
  );
};

/**
 * Change authenticated user's password.
 * POST /auth/change-password
 */
export const changePasswordController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<ChangePasswordInput>(
    res,
    "body"
  );

  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  await changeUserPassword(
    req.user.userId,
    body.currentPassword,
    body.newPassword
  );

  sendSuccess(
    res,
    "Password changed successfully. Please login again.",
    null
  );
};

/**
 * Request password reset.
 * POST /auth/forgot-password
 */
export const forgotPasswordController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<ForgotPasswordInput>(
    res,
    "body"
  );

  const result = await requestPasswordReset(
    body.email
  );

  if (result) {
    // TODO: Send result.resetToken through the email service.
    // Never expose the raw reset token in the API response.
  }

  sendSuccess(
    res,
    "If an account exists with this email, password reset instructions will be sent.",
    null
  );
};

/**
 * Reset password using a reset token.
 * POST /auth/reset-password
 */
export const resetPasswordController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<ResetPasswordInput>(
    res,
    "body"
  );

  await resetUserPassword(
    body.token,
    body.password
  );

  sendSuccess(
    res,
    "Password reset successfully. Please login with your new password.",
    null
  );
};

/**
 * Verify user's email address.
 * POST /auth/verify-email
 */
export const verifyEmailController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<{
    token: string;
  }>(res, "body");

  await verifyUserEmail(body.token);

  sendSuccess(
    res,
    "Email address verified successfully.",
    null
  );
};

/**
 * Create and send a new email verification token.
 * POST /auth/resend-verification
 */
export const resendVerificationController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const body = getValidatedData<{
    email: string;
  }>(res, "body");

  const token = await resendEmailVerification(
    body.email
  );

  if (token) {
    // TODO: Send token through the email service.
    // Never expose the raw verification token in the response.
  }

  sendSuccess(
    res,
    "If verification is pending, a new verification email will be sent.",
    null
  );
};

/**
 * Generate email verification token for a user.
 * Internal use after account creation.
 */
export const generateVerificationTokenController = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }

  const token = await createEmailVerificationToken(
    req.user.userId
  );

  // TODO: Send token through the email service.
  // Do not return the raw token to the client.

  sendSuccess(
    res,
    "Email verification instructions requested successfully.",
    {
      emailVerificationRequested: true,
      tokenGenerated: Boolean(token),
    }
  );
};
