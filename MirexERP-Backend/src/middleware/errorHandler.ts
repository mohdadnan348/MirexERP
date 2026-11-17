
import {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";

import { AppError } from "../utils/AppError";
import { isDevelopment } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Standard API error response.
 */
interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  errors?: unknown;
  stack?: string;
}

/**
 * Extract a safe error message.
 */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
};

/**
 * Handle MongoDB duplicate key errors.
 */
const isDuplicateKeyError = (
  error: unknown
): error is Error & { code: number; keyValue?: Record<string, unknown> } => {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code?: number }).code === 11000
  );
};

/**
 * Handle Mongoose validation errors.
 */
const isMongooseValidationError = (
  error: unknown
): error is Error & {
  name: string;
  errors: Record<string, { message: string }>;
} => {
  return (
    error instanceof Error &&
    error.name === "ValidationError" &&
    "errors" in error
  );
};

/**
 * Handle Mongoose cast errors.
 */
const isCastError = (
  error: unknown
): error is Error & { name: string; path?: string; value?: unknown } => {
  return error instanceof Error && error.name === "CastError";
};

/**
 * Convert unknown errors into a standard API response.
 */
const normalizeError = (
  error: unknown
): {
  statusCode: number;
  message: string;
  errors?: unknown;
} => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  if (isDuplicateKeyError(error)) {
    const duplicateField = Object.keys(error.keyValue ?? {})[0];

    return {
      statusCode: 409,
      message: duplicateField
        ? `${duplicateField} already exists.`
        : "A record with this value already exists.",
    };
  }

  if (isMongooseValidationError(error)) {
    const validationErrors = Object.values(error.errors).map(
      (item) => item.message
    );

    return {
      statusCode: 400,
      message: "Database validation failed.",
      errors: validationErrors,
    };
  }

  if (isCastError(error)) {
    return {
      statusCode: 400,
      message: "Invalid resource identifier or data format.",
    };
  }

  if (error instanceof SyntaxError && "body" in error) {
    return {
      statusCode: 400,
      message: "Invalid JSON request body.",
    };
  }

  return {
    statusCode: 500,
    message: "Internal server error.",
  };
};

/**
 * Global Express error handler.
 *
 * Must be registered after all routes.
 */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const normalizedError = normalizeError(error);

  const statusCode = normalizedError.statusCode;

  const response: ErrorResponse = {
    success: false,
    message: normalizedError.message,
    statusCode,
  };

  if (normalizedError.errors !== undefined) {
    response.errors = normalizedError.errors;
  }

 if (isDevelopment) {
  response.stack = error instanceof Error ? error.stack : undefined;
}

  if (statusCode >= 500) {
    logger.error("API Error", {
      message: getErrorMessage(error),
      method: req.method,
      url: req.originalUrl,
      statusCode,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    logger.warn("API Client Error", {
      message: normalizedError.message,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    });
  }

  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json(response);
};

