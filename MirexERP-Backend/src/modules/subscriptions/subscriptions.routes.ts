
import { Router } from "express";

import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  cancelSubscription,
  getMySubscription,
} from "./subscriptions.controller";

import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  subscriptionIdSchema,
  getSubscriptionsSchema,
  cancelSubscriptionSchema,
} from "./subscriptions.validation";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import { USER_ROLES } from "../../config/constants";

const router = Router();

const {
  SUPER_ADMIN,
  SCHOOL_ADMIN,
} = USER_ROLES;

// All subscription routes require authentication.
router.use(authenticate);
router.use(tenantContext);

// Super Admin: create subscription.
router.post(
  "/",
  authorize(SUPER_ADMIN),
  validate(createSubscriptionSchema),
  createSubscription
);

// List subscriptions.
router.get(
  "/",
  authorize(SUPER_ADMIN),
  validate(getSubscriptionsSchema),
  getSubscriptions
);

// Current school's subscription.
router.get(
  "/my-subscription",
  authorize(SCHOOL_ADMIN),
  requireTenant,
  getMySubscription
);

// Get subscription details.
router.get(
  "/:id",
  authorize(SUPER_ADMIN),
  validate(subscriptionIdSchema),
  getSubscriptionById
);

// Update subscription.
router.patch(
  "/:id",
  authorize(SUPER_ADMIN),
  validate(updateSubscriptionSchema),
  updateSubscription
);

// Cancel subscription.
router.patch(
  "/:id/cancel",
  authorize(SUPER_ADMIN),
  validate(cancelSubscriptionSchema),
  cancelSubscription
);

export default router;
