
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
} from "../../utils/apiResponse";

import {
  createSubscriptionService,
  getSubscriptionsService,
  getSubscriptionByIdService,
  updateSubscriptionService,
  cancelSubscriptionService,
  getMySubscriptionService,
} from "./subscriptions.service";

const getActor = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return {
    userId: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid subscription ID is required", 400);
  }

  return id;
};

/**
 * Create subscription
 * POST /api/subscriptions
 */
export const createSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const subscription = await createSubscriptionService(
      actor,
      req.body
    );

    return sendCreated(
      res,
      "Subscription created successfully",
      subscription
    );
  }
);

/**
 * Get all subscriptions
 * GET /api/subscriptions
 */
export const getSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const result = await getSubscriptionsService(actor, {
      page,
      limit,
      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
      schoolId:
        typeof req.query.schoolId === "string"
          ? req.query.schoolId
          : undefined,
      planId:
        typeof req.query.planId === "string"
          ? req.query.planId
          : undefined,
    });

    const items = Array.isArray(result)
      ? result
      : result.items;

    const total = Array.isArray(result)
      ? result.length
      : result.total;

    const totalPages = Math.ceil(total / limit);

    return sendPaginatedSuccess(
      res,
      "Subscriptions fetched successfully",
      items,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    );
  }
);

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 */
export const getSubscriptionById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const subscription = await getSubscriptionByIdService(
      actor,
      getId(req)
    );

    return sendSuccess(
      res,
      "Subscription fetched successfully",
      subscription
    );
  }
);

/**
 * Update subscription
 * PATCH /api/subscriptions/:id
 */
export const updateSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const subscription = await updateSubscriptionService(
      actor,
      getId(req),
      req.body
    );

    return sendSuccess(
      res,
      "Subscription updated successfully",
      subscription
    );
  }
);

/**
 * Cancel subscription
 * PATCH /api/subscriptions/:id/cancel
 */
export const cancelSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const subscription = await cancelSubscriptionService(
      actor,
      getId(req),
      req.body.reason
    );

    return sendSuccess(
      res,
      "Subscription cancelled successfully",
      subscription
    );
  }
);

/**
 * Get current school's subscription
 * GET /api/subscriptions/my-subscription
 */
export const getMySubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    const subscription = await getMySubscriptionService(
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Current subscription fetched successfully",
      subscription
    );
  }
);
