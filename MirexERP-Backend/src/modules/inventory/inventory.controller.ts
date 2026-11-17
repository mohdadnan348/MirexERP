
import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPagination } from "../../utils/pagination";

import {
  createInventoryItemService,
  getInventoryItemsService,
  getInventoryItemByIdService,
  updateInventoryItemService,
  deleteInventoryItemService,
  adjustInventoryStockService,
  issueInventoryItemService,
  returnInventoryItemService,
  getInventoryTransactionsService,
} from "./inventory.service";

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid inventory ID is required", 400);
  }

  return id;
};

const getActor = (req: Request) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
    role: req.user.role,
    employeeId: req.user.employeeId ?? undefined,
  };
};

// Create inventory item
export const createInventoryItem = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await createInventoryItemService(
      req.body,
      getActor(req)
    );

    return sendCreated(res, "Inventory item created successfully", item);
  }
);

// Get all inventory items
export const getInventoryItems = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit } = getPagination({
      page: req.query.page,
      limit: req.query.limit,
    });

    const result = await getInventoryItemsService(
      {
        page,
        limit,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
        category:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
        lowStock: req.query.lowStock === "true",
      },
      getActor(req)
    );

    return sendPaginatedSuccess(
      res,
      "Inventory items fetched successfully",
      result.items,
      result.pagination
    );
  }
);

// Get inventory item by ID
export const getInventoryItemById = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await getInventoryItemByIdService(
      getId(req),
      getActor(req)
    );

    return sendSuccess(res, "Inventory item fetched successfully", item);
  }
);

// Update inventory item
export const updateInventoryItem = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await updateInventoryItemService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendSuccess(res, "Inventory item updated successfully", item);
  }
);

// Delete inventory item
export const deleteInventoryItem = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteInventoryItemService(getId(req), getActor(req));

    return sendDeleted(res, "Inventory item deleted successfully");
  }
);

// Adjust inventory stock
export const adjustInventoryStock = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await adjustInventoryStockService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendSuccess(res, "Inventory stock adjusted successfully", result);
  }
);

// Issue inventory item
export const issueInventoryItem = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await issueInventoryItemService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendCreated(res, "Inventory item issued successfully", result);
  }
);

// Return issued inventory item
export const returnInventoryItem = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await returnInventoryItemService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendSuccess(res, "Inventory item returned successfully", result);
  }
);

// Get inventory transaction history
export const getInventoryTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit } = getPagination({
      page: req.query.page,
      limit: req.query.limit,
    });

    const result = await getInventoryTransactionsService(
      getId(req),
      {
        page,
        limit,
        type:
          typeof req.query.type === "string"
            ? req.query.type
            : undefined,
      },
      getActor(req)
    );

    return sendPaginatedSuccess(
      res,
      "Inventory transactions fetched successfully",
      result.items,
      result.pagination
    );
  }
);