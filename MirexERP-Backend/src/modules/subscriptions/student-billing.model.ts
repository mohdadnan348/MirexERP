import mongoose, { Schema, Types } from "mongoose";

const pricingSchema = new Schema({
  key: { type: String, default: "GLOBAL", unique: true, immutable: true },
  monthlyRatePaise: { type: Number, required: true, min: 0 },
  yearlyRatePaise: { type: Number, min: 0 },
  yearlyDiscountBps: { type: Number, min: 0, max: 10000, default: 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: "INR" },
  billingEnabled: { type: Boolean, default: true },
  yearlyEnabled: { type: Boolean, default: true },
  trialDays: { type: Number, min: 0, max: 365, default: 14 },
  graceDays: { type: Number, min: 0, max: 90, default: 7 },
  taxRateBps: { type: Number, min: 0, max: 10000, default: 0 },
  countingPolicy: { type: String, enum: ["CURRENT_SESSION", "ALL_ACTIVE_SESSIONS"], default: "CURRENT_SESSION" },
  effectiveFrom: { type: Date, required: true, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const pricingHistorySchema = new Schema({
  pricingId: { type: Schema.Types.ObjectId, ref: "SubscriptionPricing", required: true },
  monthlyRatePaise: { type: Number, required: true }, yearlyRatePaise: Number,
  yearlyDiscountBps: Number, currency: String, effectiveFrom: Date,
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, reason: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const schoolOverrideSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true },
  monthlyRatePaise: { type: Number, required: true, min: 0 }, yearlyRatePaise: Number,
  yearlyDiscountBps: Number, currency: String, effectiveFrom: { type: Date, required: true },
  isActive: { type: Boolean, default: true }, updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, reason: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const billingInvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  billingPeriodStart: { type: Date, required: true }, billingPeriodEnd: { type: Date, required: true },
  billingCycle: { type: String, enum: ["MONTHLY", "YEARLY"], required: true },
  billableStudentCount: { type: Number, required: true, min: 0 },
  studentIdsHash: { type: String, required: true },
  perStudentRatePaise: { type: Number, required: true, min: 0 }, baseAmountPaise: { type: Number, required: true, min: 0 },
  discountPaise: { type: Number, default: 0, min: 0 }, taxRateBps: { type: Number, default: 0 }, taxPaise: { type: Number, default: 0 }, totalPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true }, paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING", index: true },
  dueDate: { type: Date, required: true }, issuedAt: { type: Date, default: Date.now }, paymentReference: String, gatewayOrderId: String, gatewayOrderAmountPaise: Number,
  snapshot: { pricingSource: { type: String, enum: ["GLOBAL", "SCHOOL_OVERRIDE"], required: true }, countingPolicy: String, studentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }] },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });
billingInvoiceSchema.index({ schoolId: 1, billingPeriodStart: 1, billingPeriodEnd: 1, billingCycle: 1 }, { unique: true });

const subscriptionHistorySchema = new Schema({ schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true }, subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" }, action: { type: String, required: true }, fromStatus: String, toStatus: String, reason: { type: String, required: true, maxlength: 500 }, actorId: { type: Schema.Types.ObjectId, ref: "User", required: true }, metadata: { type: Schema.Types.Mixed, default: {} } }, { timestamps: true, versionKey: false });

export const SubscriptionPricing = mongoose.models.SubscriptionPricing || mongoose.model("SubscriptionPricing", pricingSchema);
export const SubscriptionPricingHistory = mongoose.models.SubscriptionPricingHistory || mongoose.model("SubscriptionPricingHistory", pricingHistorySchema);
export const SchoolPricingOverride = mongoose.models.SchoolPricingOverride || mongoose.model("SchoolPricingOverride", schoolOverrideSchema);
export const SubscriptionBillingInvoice = mongoose.models.SubscriptionBillingInvoice || mongoose.model("SubscriptionBillingInvoice", billingInvoiceSchema);
export const SubscriptionLifecycleHistory = mongoose.models.SubscriptionLifecycleHistory || mongoose.model("SubscriptionLifecycleHistory", subscriptionHistorySchema);

const featureEntitlementSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  featureKey: { type: String, required: true, uppercase: true, trim: true },
  enabled: { type: Boolean, default: true },
  effectiveFrom: { type: Date, required: true, default: Date.now },
  effectiveUntil: { type: Date, default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true, maxlength: 500 },
}, { timestamps: true, versionKey: false });
featureEntitlementSchema.index({ schoolId: 1, featureKey: 1 }, { unique: true });
export const SubscriptionFeatureEntitlement = mongoose.models.SubscriptionFeatureEntitlement || mongoose.model("SubscriptionFeatureEntitlement", featureEntitlementSchema);

const billingPaymentSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: "SubscriptionBillingInvoice", required: true, index: true },
  gateway: { type: String, enum: ["RAZORPAY"], required: true },
  gatewayOrderId: { type: String, required: true },
  gatewayPaymentId: { type: String, required: true, unique: true },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  status: { type: String, enum: ["CAPTURED", "FAILED", "REFUNDED"], required: true },
  verifiedAt: { type: Date, required: true },
  initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });
billingPaymentSchema.index({ schoolId: 1, invoiceId: 1, createdAt: -1 });
export const SubscriptionBillingPayment = mongoose.models.SubscriptionBillingPayment || mongoose.model("SubscriptionBillingPayment", billingPaymentSchema);
