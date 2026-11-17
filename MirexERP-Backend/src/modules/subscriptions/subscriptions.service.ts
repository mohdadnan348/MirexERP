
import mongoose, { Types } from "mongoose";
import { SubscriptionPlan } from "../platform/platform.model";
import Subscription, {
  BillingCycle,
  SubscriptionStatus,
  SubscriptionPaymentStatus,
} from "./subscriptions.model";

import { AppError } from "../../utils/AppError";
import { USER_ROLES } from "../../config/constants";

interface SubscriptionActor {
  userId: string;
  schoolId?: string | null;
  role: string;
}

interface CreateSubscriptionInput {
  schoolId?: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency?: string;
  startDate: string | Date;
  endDate: string | Date;
  trialEndsAt?: string | Date;
  autoRenew?: boolean;
  paymentReference?: string;
}

interface SubscriptionFilters {
  page?: number;
  limit?: number;
  status?: string;
  schoolId?: string;
  planId?: string;
}

const isValidObjectId = (id: string): boolean =>
  Types.ObjectId.isValid(id);

const ensureObjectId = (id: string, field: string): void => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const getSchoolFilter = (actor: SubscriptionActor) => {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return {};
  }

  if (!actor.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return { schoolId: actor.schoolId };
};

/**
 * Create subscription
 */
export const createSubscriptionService = async (
  actor: SubscriptionActor,
  input: CreateSubscriptionInput
) => {
  const schoolId =
    actor.role === USER_ROLES.SUPER_ADMIN
      ? input.schoolId
      : actor.schoolId;

  if (!schoolId) {
    throw new AppError("School ID is required", 400);
  }

  ensureObjectId(schoolId, "school ID");
  ensureObjectId(input.planId, "plan ID");

  const selectedPlan = await SubscriptionPlan.findById(input.planId).lean();
  if (!selectedPlan || selectedPlan.isActive === false) {
    throw new AppError("Selected subscription plan does not exist or is inactive", 404);
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    throw new AppError("Invalid subscription dates", 400);
  }

  if (input.amount < 0) {
    throw new AppError("Subscription amount cannot be negative", 400);
  }

  const existingSubscription = await Subscription.findOne({
    schoolId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.PENDING,
      ],
    },
  });

  if (existingSubscription) {
    throw new AppError(
      "School already has an active or pending subscription",
      409
    );
  }

  const subscription = await Subscription.create({
    schoolId,
    planId: input.planId,
    planName: input.planName,
    billingCycle: input.billingCycle,
    amount: input.amount,
    currency: input.currency || "INR",
    status: SubscriptionStatus.PENDING,
    paymentStatus: SubscriptionPaymentStatus.PENDING,
    startDate,
    endDate,
    trialEndsAt: input.trialEndsAt
      ? new Date(input.trialEndsAt)
      : undefined,
    autoRenew: input.autoRenew ?? true,
    paymentReference: input.paymentReference,
    createdBy: actor.userId,
  });

  return subscription;
};

/**
 * Get all subscriptions
 */
export const getSubscriptionsService = async (
  actor: SubscriptionActor,
  filters: SubscriptionFilters
) => {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 10));

  const query: Record<string, unknown> = {
    ...getSchoolFilter(actor),
  };

  if (filters.schoolId && actor.role === USER_ROLES.SUPER_ADMIN) {
    ensureObjectId(filters.schoolId, "school ID");
    query.schoolId = filters.schoolId;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.planId) {
    ensureObjectId(filters.planId, "plan ID");
    query.planId = filters.planId;
  }

  const [items, total] = await Promise.all([
    Subscription.find(query)
      .populate("schoolId", "name email")
      .populate("planId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Subscription.countDocuments(query),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get subscription by ID
 */
export const getSubscriptionByIdService = async (
  actor: SubscriptionActor,
  subscriptionId: string
) => {
  ensureObjectId(subscriptionId, "subscription ID");

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    ...getSchoolFilter(actor),
  })
    .populate("schoolId", "name email")
    .populate("planId");

  if (!subscription) {
    throw new AppError("Subscription not found", 404);
  }

  return subscription;
};

/**
 * Update subscription
 */
export const updateSubscriptionService = async (
  actor: SubscriptionActor,
  subscriptionId: string,
  input: Partial<CreateSubscriptionInput> & {
    status?: SubscriptionStatus;
    paymentStatus?: SubscriptionPaymentStatus;
    updatedBy?: string;
  }
) => {
  ensureObjectId(subscriptionId, "subscription ID");

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    ...getSchoolFilter(actor),
  });

  if (!subscription) {
    throw new AppError("Subscription not found", 404);
  }

  const allowedFields = [
    "planId",
    "planName",
    "billingCycle",
    "amount",
    "currency",
    "startDate",
    "endDate",
    "trialEndsAt",
    "autoRenew",
    "paymentReference",
    "status",
    "paymentStatus",
  ] as const;

  for (const field of allowedFields) {
    const value = input[field];

    if (value !== undefined) {
      if (field === "planId" && typeof value === "string") {
        ensureObjectId(value, "plan ID");
      }

      if (
        field === "amount" &&
        (typeof value !== "number" || value < 0)
      ) {
        throw new AppError("Invalid subscription amount", 400);
      }

      if (
        field === "startDate" ||
        field === "endDate" ||
        field === "trialEndsAt"
      ) {
        if (
          typeof value !== "string" &&
          typeof value !== "number" &&
          !(value instanceof Date)
        ) {
          throw new AppError(`Invalid ${field}`, 400);
        }

        const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

        if (Number.isNaN(date.getTime())) {
          throw new AppError(`Invalid ${field}`, 400);
        }

        (subscription as any)[field] = date;
      } else {
        (subscription as any)[field] = value;
      }
    }
  }

  if (subscription.endDate <= subscription.startDate) {
    throw new AppError(
      "End date must be after start date",
      400
    );
  }

  subscription.updatedBy = new Types.ObjectId(actor.userId);

  await subscription.save();

  return subscription;
};

/**
 * Cancel subscription
 */
export const cancelSubscriptionService = async (
  actor: SubscriptionActor,
  subscriptionId: string,
  reason?: string
) => {
  ensureObjectId(subscriptionId, "subscription ID");

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    ...getSchoolFilter(actor),
  });

  if (!subscription) {
    throw new AppError("Subscription not found", 404);
  }

  if (
    subscription.status === SubscriptionStatus.CANCELLED
  ) {
    throw new AppError("Subscription is already cancelled", 400);
  }

  subscription.status = SubscriptionStatus.CANCELLED;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason?.trim();
  subscription.autoRenew = false;
  subscription.updatedBy = new Types.ObjectId(actor.userId);

  await subscription.save();

  return subscription;
};

/**
 * Get current school's subscription
 */
export const getMySubscriptionService = async (
  schoolId: string
) => {
  ensureObjectId(schoolId, "school ID");

  const subscription = await Subscription.findOne({
    schoolId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.PENDING,
      ],
    },
  })
    .populate("planId")
    .sort({ createdAt: -1 });

  if (!subscription) {
    throw new AppError("No subscription found for this school", 404);
  }

  return subscription;
};
