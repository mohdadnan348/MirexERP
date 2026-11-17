import { Request, Response, NextFunction } from "express";
import { SubscriptionFeatureEntitlement } from "./student-billing.model";
import { AppError } from "../../utils/AppError";

/**
 * Feature gate for routes that opt in. For compatibility with existing tenants,
 * no entitlement record means legacy access remains enabled; once a school has
 * an explicit feature record, disabled/expired records are denied server-side.
 */
export const requireSubscriptionFeature = (featureKey: string) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return next(new AppError("School context is required", 400));
    const record = await SubscriptionFeatureEntitlement.findOne({ schoolId, featureKey: featureKey.toUpperCase() }).lean();
    if (record && (!record.enabled || new Date(record.effectiveFrom) > new Date() || (record.effectiveUntil && new Date(record.effectiveUntil) < new Date()))) {
      return next(new AppError(`Your subscription does not include the ${featureKey.toLowerCase()} feature.`, 402));
    }
    return next();
  } catch (error) { return next(error); }
};
