import { createSubscriptionPaymentOrder, verifySubscriptionPayment } from "./student-billing.gateway.service";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess, sendCreated } from "../../utils/apiResponse";
import { getPricingService, updatePricingService, billingPreviewService, createBillingInvoiceService, listBillingInvoicesService, setSchoolRateService, recordManualActivationService, platformBillingDashboardService, setFeatureEntitlementService } from "./student-billing.service";

const actor = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { userId: String(req.user._id || req.user.id), schoolId: req.user.schoolId ? String(req.user.schoolId) : null, role: req.user.role };
};
const selectedSchool = (req: Request) => {
  const a = actor(req);
  if (a.role === "SUPER_ADMIN") {
    const requested = String(req.body?.schoolId || req.query.schoolId || req.get("x-school-id") || "");
    if (!requested) throw new AppError("schoolId is required for this platform action", 400);
    return requested;
  }
  if (!a.schoolId) throw new AppError("School context is required", 400);
  return a.schoolId;
};

export const getStudentPricing = asyncHandler(async (_req: Request, res: Response) => sendSuccess(res, "Student-wise pricing fetched", await getPricingService()));
export const updateStudentPricing = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Student-wise pricing updated", await updatePricingService(actor(req), req.body)));
export const getBillingPreview = asyncHandler(async (req: Request, res: Response) => {
  const cycle = String(req.query.cycle || "MONTHLY").toUpperCase();
  if (cycle !== "MONTHLY" && cycle !== "YEARLY") throw new AppError("cycle must be MONTHLY or YEARLY", 400);
  return sendSuccess(res, "Billing preview calculated from database student records", await billingPreviewService(selectedSchool(req), cycle));
});
export const createStudentBillingInvoice = asyncHandler(async (req: Request, res: Response) => {
  const cycle = String(req.body.billingCycle || "MONTHLY").toUpperCase();
  if (cycle !== "MONTHLY" && cycle !== "YEARLY") throw new AppError("billingCycle must be MONTHLY or YEARLY", 400);
  const result = await createBillingInvoiceService(actor(req), selectedSchool(req), cycle, req.body.billingPeriodStart);
  return sendCreated(res, "Immutable SaaS subscription invoice created", result);
});
export const getStudentBillingInvoices = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "SaaS subscription invoices fetched", await listBillingInvoicesService(actor(req), typeof req.query.schoolId === "string" ? req.query.schoolId : undefined)));
export const updateSchoolPricing = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "School-specific pricing override saved", await setSchoolRateService(actor(req), req.body)));
export const manualSubscriptionActivation = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Manual activation recorded", await recordManualActivationService(actor(req), req.body)));
export const getSaasDashboard = asyncHandler(async (_req: Request, res: Response) => sendSuccess(res, "Platform subscription dashboard fetched", await platformBillingDashboardService()));

export const setFeatureEntitlement = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, "Feature entitlement saved", await setFeatureEntitlementService(actor(req), req.body)));

export const createSaasPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req); if (!a.schoolId) throw new AppError("School context is required", 400);
  return sendSuccess(res, "Razorpay subscription payment order created", await createSubscriptionPaymentOrder(req.params.invoiceId, { userId: a.userId, schoolId: a.schoolId, role: a.role }));
});
export const verifySaasPayment = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req); if (!a.schoolId) throw new AppError("School context is required", 400);
  return sendSuccess(res, "Subscription payment verified with Razorpay", await verifySubscriptionPayment({ invoiceId: req.params.invoiceId, razorpayOrderId: req.body.razorpayOrderId, razorpayPaymentId: req.body.razorpayPaymentId, razorpaySignature: req.body.razorpaySignature }, { userId: a.userId, schoolId: a.schoolId, role: a.role }));
});
