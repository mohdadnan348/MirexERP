
import { z } from "zod";
import {
  BillingCycle,
  SubscriptionStatus,
  SubscriptionPaymentStatus,
} from "./subscriptions.model";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

const dateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const billingCycleSchema = z.nativeEnum(BillingCycle);

const subscriptionStatusSchema = z.nativeEnum(
  SubscriptionStatus
);

const paymentStatusSchema = z.nativeEnum(
  SubscriptionPaymentStatus
);

const createSubscriptionBodySchema = z.object({
  schoolId: objectIdSchema.optional(),

  planId: objectIdSchema,

  planName: z
    .string()
    .trim()
    .min(2)
    .max(100),

  billingCycle: billingCycleSchema,

  amount: z
    .number()
    .min(0),

  currency: z
    .string()
    .trim()
    .length(3)
    .default("INR")
    .optional(),

  startDate: dateSchema,

  endDate: dateSchema,

  trialEndsAt: dateSchema.optional(),

  autoRenew: z
    .boolean()
    .optional(),

  paymentReference: z
    .string()
    .trim()
    .max(150)
    .optional(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

const updateSubscriptionBodySchema = z.object({
  planId: objectIdSchema.optional(),

  planName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  billingCycle: billingCycleSchema.optional(),

  amount: z
    .number()
    .min(0)
    .optional(),

  currency: z
    .string()
    .trim()
    .length(3)
    .optional(),

  startDate: dateSchema.optional(),

  endDate: dateSchema.optional(),

  trialEndsAt: dateSchema.optional(),

  autoRenew: z
    .boolean()
    .optional(),

  paymentReference: z
    .string()
    .trim()
    .max(150)
    .optional(),

  status: subscriptionStatusSchema.optional(),

  paymentStatus: paymentStatusSchema.optional(),
});

const cancelSubscriptionBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional(),
});

export const createSubscriptionSchema = z.object({
  body: createSubscriptionBodySchema,
});

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: updateSubscriptionBodySchema,
});

export const subscriptionIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const cancelSubscriptionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: cancelSubscriptionBodySchema,
});

export const getSubscriptionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),

    limit: z.coerce.number().int().min(1).max(100).optional(),

    status: subscriptionStatusSchema.optional(),

    schoolId: objectIdSchema.optional(),

    planId: objectIdSchema.optional(),
  }),
});
