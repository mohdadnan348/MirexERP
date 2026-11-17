
import { Request, Response, NextFunction } from "express";

import { AppError } from "../utils/AppError";

/**
 * Handles requests to undefined API routes.
 *
 * Register this middleware after all application routes
 * and before the global errorHandler.
 */
export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const message = `Route not found: ${req.method} ${req.originalUrl}`;

  next(new AppError(message, 404));
};
