
/**
 * Custom application error class.
 *
 * Used for operational errors such as:
 * - Authentication failures
 * - Authorization failures
 * - Validation errors
 * - Resource not found
 * - Duplicate records
 * - Business rule violations
 */
export class AppError extends Error {
  public readonly statusCode: number;

  public readonly status: "fail" | "error";

  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? "error" : "fail";
    this.isOperational = isOperational;

    // Maintain correct prototype chain.
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace.
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Throw a 400 Bad Request error.
 */
export const BadRequestError = (
  message = "Bad request."
): AppError => {
  return new AppError(message, 400);
};

/**
 * Throw a 401 Unauthorized error.
 */
export const UnauthorizedError = (
  message = "Authentication required."
): AppError => {
  return new AppError(message, 401);
};

/**
 * Throw a 403 Forbidden error.
 */
export const ForbiddenError = (
  message = "Access denied."
): AppError => {
  return new AppError(message, 403);
};

/**
 * Throw a 404 Not Found error.
 */
export const NotFoundError = (
  message = "Resource not found."
): AppError => {
  return new AppError(message, 404);
};

/**
 * Throw a 409 Conflict error.
 */
export const ConflictError = (
  message = "Resource already exists."
): AppError => {
  return new AppError(message, 409);
};

/**
 * Throw a 422 Unprocessable Entity error.
 */
export const UnprocessableEntityError = (
  message = "Unable to process the request."
): AppError => {
  return new AppError(message, 422);
};

/**
 * Throw a 429 Too Many Requests error.
 */
export const TooManyRequestsError = (
  message = "Too many requests. Please try again later."
): AppError => {
  return new AppError(message, 429);
};

/**
 * Throw a 500 Internal Server Error.
 */
export const InternalServerError = (
  message = "Internal server error."
): AppError => {
  return new AppError(message, 500, false);
};

export default AppError;
