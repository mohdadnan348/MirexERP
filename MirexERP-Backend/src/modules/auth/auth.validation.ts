
import { z } from "zod";

/**
 * Common email validation.
 */
const emailSchema = z
  .string()
  .trim()
  .email("Please provide a valid email address.")
  .max(254)
  .transform((value) => value.toLowerCase());

/**
 * Strong password validation.
 */
const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters.")
  .max(128, "Password cannot exceed 128 characters.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain a special character."
  );

/**
 * Login validation.
 *
 * POST /auth/login
 */
export const loginSchema = z.object({
  body: z.object({
    // Accept email or school-issued student admission/login ID.
    email: z.string().trim().min(1, "Email or student ID is required.").max(254),

    password: z
      .string()
      .min(1, "Password is required.")
      .max(128),

    rememberMe: z.boolean().optional().default(false),
  }).strict(),
});

/**
 * Registration validation.
 *
 * POST /auth/register
 *
 * Public registration only supports school-level roles.
 * Super Admin accounts must be created through a secure
 * platform-level process.
 */
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(100),

    email: emailSchema,

    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9]{10,15}$/,
        "Please provide a valid phone number."
      )
      .optional(),

    password: passwordSchema,

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),

    schoolId: z
      .string()
      .regex(
        /^[a-fA-F0-9]{24}$/,
        "Invalid school ID."
      ),

    role: z.enum([
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "ACCOUNTANT",
      "RECEPTIONIST",
      "LIBRARIAN",
      "TRANSPORT_MANAGER",
    ]),
  }).strict().refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    }
  ),
});

/**
 * Super Admin creates a School Admin account for an existing school.
 * POST /auth/create-school-admin
 */
export const createSchoolAdminSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/).optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    schoolId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid school ID."),
  }).strict().refine(
    (data) => data.password === data.confirmPassword,
    { message: "Passwords do not match.", path: ["confirmPassword"] }
  ),
});

export type CreateSchoolAdminInput = z.infer<typeof createSchoolAdminSchema>["body"];

/**
 * Refresh token validation.
 *
 * POST /auth/refresh-token
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "Refresh token is required."),
  }).strict(),
});

/**
 * Forgot password validation.
 *
 * POST /auth/forgot-password
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }).strict(),
});

/**
 * Reset password validation.
 *
 * POST /auth/reset-password
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, "Password reset token is required."),

    password: passwordSchema,

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),
  }).strict().refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    }
  ),
});

/**
 * Change password validation.
 *
 * POST /auth/change-password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z
      .string()
      .min(1, "Current password is required."),

    newPassword: passwordSchema,

    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password."),
  }).strict().refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: "New passwords do not match.",
      path: ["confirmPassword"],
    }
  ).refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: "New password must be different from current password.",
      path: ["newPassword"],
    }
  ),
});

/**
 * Logout validation.
 *
 * POST /auth/logout
 */
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "Refresh token is required."),
  }).strict(),
});

/**
 * Email verification validation.
 *
 * POST /auth/verify-email
 */
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, "Verification token is required."),
  }).strict(),
});

/**
 * Resend verification email validation.
 *
 * POST /auth/resend-verification
 */
export const resendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema,
  }).strict(),
});

/**
 * Export inferred request types.
 */
export type LoginInput = z.infer<typeof loginSchema>["body"];

export type RegisterInput = z.infer<typeof registerSchema>["body"];

export type RefreshTokenInput = z.infer<
  typeof refreshTokenSchema
>["body"];

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>["body"];

export type ResetPasswordInput = z.infer<
  typeof resetPasswordSchema
>["body"];

export type ChangePasswordInput = z.infer<
  typeof changePasswordSchema
>["body"];
