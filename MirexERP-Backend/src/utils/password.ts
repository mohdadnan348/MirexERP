
import bcrypt from "bcryptjs";

import { env } from "../config/env";
import { AppError } from "./AppError";

/**
 * Password strength validation result.
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password strength.
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const validatePasswordStrength = (
  password: string
): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Password must contain at least 12 characters.");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain a number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain a special character.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate password and throw an error if it is weak.
 */
export const assertStrongPassword = (
  password: string
): void => {
  const validation = validatePasswordStrength(password);

  if (!validation.isValid) {
    throw new AppError(
      validation.errors.join(" "),
      400
    );
  }
};

/**
 * Hash a plain-text password using bcrypt.
 *
 * Never store the original password in the database.
 */
export const hashPassword = async (
  password: string
): Promise<string> => {
  if (!password || typeof password !== "string") {
    throw new AppError("Password is required.", 400);
  }

  assertStrongPassword(password);

  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
};

/**
 * Compare a plain-text password with its bcrypt hash.
 *
 * Returns false when the password does not match.
 */
export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  if (
    !plainPassword ||
    !hashedPassword ||
    typeof plainPassword !== "string" ||
    typeof hashedPassword !== "string"
  ) {
    return false;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Check whether a password matches the stored hash.
 *
 * Useful during login authentication.
 */
export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<void> => {
  const isMatch = await comparePassword(
    plainPassword,
    hashedPassword
  );

  if (!isMatch) {
    throw new AppError("Invalid email or password.", 401);
  }
};