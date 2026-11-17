import {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";

import { z, ZodType } from "zod";

import AppError from "../utils/AppError";

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validate = (
  schemas: ValidationSchemas | ZodType
): RequestHandler => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // A Zod object may either be a complete request schema, such as
      // z.object({ body: z.object({ ... }) }), or a schema for req.body
      // itself. Do not treat every ZodObject as a body schema: doing so
      // makes wrapped schemas validate req.body against { body: ... },
      // which produces "expected object, received undefined".
      const isRequestSchema =
        schemas instanceof z.ZodObject &&
        ["body", "query", "params"].some((key) =>
          Object.prototype.hasOwnProperty.call(schemas.shape, key)
        );

      const normalizedSchemas: ValidationSchemas = isRequestSchema
        ? (schemas.shape as ValidationSchemas)
        : schemas instanceof z.ZodType
          ? { body: schemas }
          : schemas;

      const validated: Record<string, unknown> = {};

      if (normalizedSchemas.params) {
        const result = normalizedSchemas.params.safeParse(req.params);

        if (!result.success) {
          throw new AppError(
            result.error.issues.map((issue) => issue.message).join(", "),
            400
          );
        }

        validated.params = result.data;
      }

      if (normalizedSchemas.query) {
        const result = normalizedSchemas.query.safeParse(req.query);

        if (!result.success) {
          throw new AppError(
            result.error.issues.map((issue) => issue.message).join(", "),
            400
          );
        }

        validated.query = result.data;
      }

      if (normalizedSchemas.body) {
        const result = normalizedSchemas.body.safeParse(req.body);

        if (!result.success) {
          throw new AppError(
            result.error.issues.map((issue) => issue.message).join(", "),
            400
          );
        }

        validated.body = result.data;
      }

      res.locals.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const getValidatedData = <T>(
  res: Response,
  key: "body" | "query" | "params"
): T => {
  const validated = res.locals.validated as
    | Record<string, unknown>
    | undefined;

  if (!validated || !(key in validated)) {
    throw new AppError(`Validated ${key} data not found`, 500);
  }

  return validated[key] as T;
};
