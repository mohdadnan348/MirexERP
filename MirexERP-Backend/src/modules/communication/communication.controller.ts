import type { Request, Response } from "express";

import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./communication.service";

const tenant = (req: Request, res: Response) => {
  const context = res.locals.tenant as { schoolId?: string | null } | undefined;
  return {
    schoolId: context?.schoolId ?? req.user?.schoolId ?? undefined,
    isPlatformAdmin: req.user?.role === "SUPER_ADMIN",
    role: req.user?.role,
    userId: req.user?.userId || req.user?.id,
  };
};

const getUserId = (req: Request): string | undefined =>
  req.user?.userId || req.user?.id;

const getRouteParam = (req: Request, key: string): string => {
  const value = req.params[key];
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }
  throw new AppError(`Invalid or missing route parameter: ${key}`, 400);
};

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(
    tenant(req, res),
    req.query as Record<string, unknown>
  );
  return sendPaginatedSuccess(
    res,
    "Communication records fetched successfully",
    result.items,
    result.pagination
  );
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.create(
    tenant(req, res),
    req.body as Record<string, unknown>,
    getUserId(req)
  );
  return sendCreated(res, "Communication created successfully", result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getById(tenant(req, res), getRouteParam(req, "id"));
  return sendSuccess(res, "Communication record fetched successfully", result);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.update(
    tenant(req, res),
    getRouteParam(req, "id"),
    req.body as Record<string, unknown>,
    getUserId(req)
  );
  return sendSuccess(res, "Communication updated successfully", result);
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.publish(
    tenant(req, res),
    getRouteParam(req, "id"),
    getUserId(req)
  );
  return sendSuccess(res, "Communication published successfully", result);
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.archive(
    tenant(req, res),
    getRouteParam(req, "id"),
    getUserId(req)
  );
  return sendSuccess(res, "Communication archived successfully", result);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(tenant(req, res), getRouteParam(req, "id"));
  return sendDeleted(res, "Communication deleted successfully");
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getHistory(
    tenant(req, res),
    getRouteParam(req, "id"),
    req.query as Record<string, unknown>
  );
  return sendPaginatedSuccess(
    res,
    "Communication delivery history fetched successfully",
    result.items,
    result.pagination
  );
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getSettings(tenant(req, res));
  return sendSuccess(res, "Communication settings fetched successfully", result);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.updateSettings(
    tenant(req, res),
    req.body as Record<string, unknown>
  );
  return sendSuccess(res, "Communication settings updated successfully", result);
});
