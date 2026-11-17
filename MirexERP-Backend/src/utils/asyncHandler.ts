
import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

/**
 * Async controller function type.
 */
type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wrap asynchronous Express controllers.
 *
 * Automatically forwards rejected promises
 * to the global error handler.
 *
 * Example:
 * router.get("/", asyncHandler(getStudents));
 */
export const asyncHandler = (
  controller: AsyncController
): RequestHandler => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
};

/**
 * Wrap asynchronous middleware.
 *
 * Useful for async authentication,
 * tenant checks and other middleware.
 */
export const asyncMiddleware = (
  middleware: AsyncController
): RequestHandler => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    Promise.resolve(middleware(req, res, next)).catch(next);
  };
};
