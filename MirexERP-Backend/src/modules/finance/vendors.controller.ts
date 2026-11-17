import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendCreated, sendDeleted, sendPaginatedSuccess, sendSuccess } from "../../utils/apiResponse";
import { createVendorService, deactivateVendorService, listVendorsService, updateVendorService } from "./vendors.service";

const actor = (req: Request) => {
  if (!req.user?.userId || !req.user.schoolId) throw new AppError("Authenticated school user is required", 401);
  return { userId: req.user.userId, role: req.user.role, schoolId: req.user.schoolId };
};
const recordId = (req: Request) => {
  if (typeof req.params.id !== "string") throw new AppError("Valid vendor ID is required", 400);
  return req.params.id;
};

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await listVendorsService(actor(req), {
    page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 20,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
  return sendPaginatedSuccess(res, "Vendors fetched successfully", result.items, result.pagination);
});
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const result = await createVendorService(req.body as Record<string, unknown>, actor(req));
  return sendCreated(res, "Vendor created successfully", result);
});
export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateVendorService(recordId(req), req.body as Record<string, unknown>, actor(req));
  return sendSuccess(res, "Vendor updated successfully", result);
});
export const deactivateVendor = asyncHandler(async (req: Request, res: Response) => {
  await deactivateVendorService(recordId(req), actor(req));
  return sendDeleted(res, "Vendor deactivated successfully");
});
