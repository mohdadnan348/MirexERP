
import { Router } from "express";

import {
  registerController,
  createSchoolAdminController,
  loginController,
  refreshTokenController,
  logoutController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
  verifyEmailController,
  resendVerificationController,
} from "./auth.controller";

import {
  loginSchema,
  registerSchema,
  createSchoolAdminSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "./auth.validation";

import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import {
  authRateLimiter,
  sensitiveOperationRateLimiter,
  adminAccountRateLimiter,
} from "../../middleware/rateLimiter";

import { USER_ROLES } from "../../config/constants";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/**
 * Public authentication routes.
 */

/**
 * Register a school-level user.
 *
 * POST /api/v1/auth/register
 *
 * Restricted to Super Admin to prevent unauthorized
 * creation of privileged school accounts.
 */
router.post(
  "/register",
  adminAccountRateLimiter,
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(registerSchema),
  asyncHandler(registerController)
);

/**
 * Create School Admin account for an existing school.
 * Restricted to authenticated Super Admins.
 *
 * POST /api/v1/auth/create-school-admin
 */
router.post(
  "/create-school-admin",
  adminAccountRateLimiter,
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  validate(createSchoolAdminSchema),
  asyncHandler(createSchoolAdminController)
);

/**
 * User login.
 *
 * POST /api/v1/auth/login
 */
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(loginController)
);

/**
 * Refresh access and refresh tokens.
 *
 * POST /api/v1/auth/refresh-token
 */
router.post(
  "/refresh-token",
  sensitiveOperationRateLimiter,
  validate(refreshTokenSchema),
  asyncHandler(refreshTokenController)
);

/**
 * Request password reset.
 *
 * POST /api/v1/auth/forgot-password
 */
router.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(forgotPasswordController)
);

/**
 * Reset password.
 *
 * POST /api/v1/auth/reset-password
 */
router.post(
  "/reset-password",
  sensitiveOperationRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(resetPasswordController)
);

/**
 * Verify email address.
 *
 * POST /api/v1/auth/verify-email
 */
router.post(
  "/verify-email",
  sensitiveOperationRateLimiter,
  validate(verifyEmailSchema),
  asyncHandler(verifyEmailController)
);

/**
 * Resend email verification.
 *
 * POST /api/v1/auth/resend-verification
 */
router.post(
  "/resend-verification",
  authRateLimiter,
  validate(resendVerificationSchema),
  asyncHandler(resendVerificationController)
);

/**
 * Protected authentication routes.
 */

/**
 * Logout authenticated user.
 *
 * POST /api/v1/auth/logout
 */
router.post(
  "/logout",
  authenticate,
  validate(logoutSchema),
  asyncHandler(logoutController)
);

/**
 * Change authenticated user's password.
 *
 * POST /api/v1/auth/change-password
 */
router.post(
  "/change-password",
  authenticate,
  sensitiveOperationRateLimiter,
  validate(changePasswordSchema),
  asyncHandler(changePasswordController)
);

/**
 * Export authentication router.
 */
export default router;
