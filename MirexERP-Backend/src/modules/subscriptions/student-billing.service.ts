import crypto from "crypto";
import { Types } from "mongoose";
import { SubscriptionPricing, SubscriptionPricingHistory, SchoolPricingOverride, SubscriptionBillingInvoice, SubscriptionLifecycleHistory, SubscriptionFeatureEntitlement } from "./student-billing.model";
import Student from "../students/students.model";
import School from "../schools/schools.model";
import { SchoolSettings } from "../settings/settings.model";
import Session from "../sessions/sessions.model";
import { AuditLog } from "../platform/platform.model";
import { AppError } from "../../utils/AppError";
import { calculateStudentBillingAmounts } from "./billing-calculation";

export interface BillingActor { userId: string; schoolId?: string | null; role: string; }
const id = (value: string, label: string) => { if (!Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, 400); return new Types.ObjectId(value); };
const toPaise = (value: unknown, label: string) => { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 100000000) throw new AppError(`${label} must be a valid non-negative amount`, 400); return Math.round((n + Number.EPSILON) * 100); };
const rupees = (paise: number) => Number((paise / 100).toFixed(2));
const audit = async (actor: BillingActor, action: string, entity: string, entityId: string, description: string, after: unknown = null) => AuditLog.create({ actorId: id(actor.userId, "user ID"), actorRole: actor.role, action, entity, entityId, description, after });

export async function getPricingService() {
  let pricing = await SubscriptionPricing.findOne({ key: "GLOBAL" }).lean();
  if (!pricing) return { configured: false, monthlyRatePerStudent: null, currency: "INR", note: "Super Admin must configure student-wise pricing before billing." };
  return { configured: true, ...pricing, monthlyRatePerStudent: rupees(pricing.monthlyRatePaise), yearlyRatePerStudent: pricing.yearlyRatePaise == null ? null : rupees(pricing.yearlyRatePaise) };
}

export async function updatePricingService(actor: BillingActor, input: any) {
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
  if (Number.isNaN(effectiveFrom.getTime())) throw new AppError("Invalid effective date", 400);
  if (effectiveFrom > new Date(Date.now() + 60000)) throw new AppError("Future-dated global pricing is not enabled yet; apply a rate when its effective date arrives", 400);
  const monthlyRatePaise = toPaise(input.monthlyRatePerStudent, "Monthly student rate");
  const yearlyRatePaise = input.yearlyRatePerStudent == null ? undefined : toPaise(input.yearlyRatePerStudent, "Yearly student rate");
  const current = await SubscriptionPricing.findOne({ key: "GLOBAL" });
  const yearlyDiscountPercent = Number(input.yearlyDiscountPercent || 0); const taxPercent = Number(input.taxPercent || 0);
  if (!Number.isFinite(yearlyDiscountPercent) || !Number.isFinite(taxPercent) || yearlyDiscountPercent < 0 || yearlyDiscountPercent > 100 || taxPercent < 0 || taxPercent > 100) throw new AppError("Discount and tax percentages must be between 0 and 100", 400);
  const payload = { monthlyRatePaise, yearlyRatePaise, yearlyDiscountBps: Math.round(yearlyDiscountPercent * 100), currency: String(input.currency || "INR").toUpperCase(), billingEnabled: input.billingEnabled !== false, yearlyEnabled: input.yearlyEnabled !== false, trialDays: Number(input.trialDays ?? 14), graceDays: Number(input.graceDays ?? 7), taxRateBps: Math.round(taxPercent * 100), countingPolicy: input.countingPolicy || "CURRENT_SESSION", effectiveFrom, updatedBy: id(actor.userId, "user ID") };
  if (payload.yearlyDiscountBps > 10000 || payload.taxRateBps > 10000 || payload.trialDays < 0 || payload.trialDays > 365 || payload.graceDays < 0 || payload.graceDays > 90) throw new AppError("Pricing configuration is outside supported limits", 400);
  const saved = current ? await SubscriptionPricing.findOneAndUpdate({ key: "GLOBAL" }, { $set: payload }, { new: true, runValidators: true }) : await SubscriptionPricing.create({ key: "GLOBAL", ...payload });
  if (current) await SubscriptionPricingHistory.create({ pricingId: current._id, monthlyRatePaise: current.monthlyRatePaise, yearlyRatePaise: current.yearlyRatePaise, yearlyDiscountBps: current.yearlyDiscountBps, currency: current.currency, effectiveFrom: current.effectiveFrom, changedBy: id(actor.userId, "user ID"), reason: String(input.reason || "Global student-wise pricing updated") });
  await audit(actor, "SUBSCRIPTION_PRICING_UPDATED", "SubscriptionPricing", String(saved?._id), String(input.reason || "Global student-wise pricing updated"), { monthlyRatePaise, yearlyRatePaise, currency: payload.currency, effectiveFrom });
  return getPricingService();
}

async function resolveRate(schoolId: Types.ObjectId) {
  const [global, override] = await Promise.all([SubscriptionPricing.findOne({ key: "GLOBAL" }).lean(), SchoolPricingOverride.findOne({ schoolId, isActive: true, effectiveFrom: { $lte: new Date() } }).lean()]);
  if (!override && !global) throw new AppError("Student-wise SaaS pricing has not been configured by Super Admin", 409);
  if (global && !global.billingEnabled) throw new AppError("SaaS billing is currently disabled", 409);
  const overrideValues = override ? Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined && value !== null)) : {};
  const chosen: any = override ? { ...(global || {}), ...overrideValues } : global;
  return { pricing: chosen, source: override ? "SCHOOL_OVERRIDE" as const : "GLOBAL" as const };
}

export async function countBillableStudents(schoolId: Types.ObjectId) {
  const [settings, school] = await Promise.all([SchoolSettings.findOne({ schoolId }).select("academic.currentSessionId").lean(), School.findById(schoolId).select("name code address contact currency").lean()]);
  if (!school || school.isDeleted) throw new AppError("School not found", 404);
  const pricing = await SubscriptionPricing.findOne({ key: "GLOBAL" }).lean();
  const match: Record<string, any> = { schoolId, status: "ACTIVE", isActive: true, isDeleted: false };
  let currentSession = settings?.academic?.currentSessionId;
  if ((pricing?.countingPolicy || "CURRENT_SESSION") === "CURRENT_SESSION") {
    if (currentSession) {
      const configuredSession = await Session.findOne({ _id: currentSession, schoolId, isActive: true, isClosed: false, isDeleted: false }).select("_id").lean();
      currentSession = configuredSession?._id as any;
    }
    if (!currentSession) {
      const activeSession = await Session.findOne({ schoolId, isActive: true, isClosed: false, isDeleted: false }).sort({ activatedAt: -1, startDate: -1 }).select("_id").lean();
      currentSession = activeSession?._id as any;
    }
    if (!currentSession) throw new AppError("No active academic session is configured; billable student count cannot be calculated", 409);
    match.sessionId = currentSession;
  }
  const studentIds = await Student.distinct("_id", match);
  return { school, count: studentIds.length, studentIds: studentIds as Types.ObjectId[], countingPolicy: pricing?.countingPolicy || "CURRENT_SESSION" };
}

export async function billingPreviewService(schoolIdRaw: string, cycle: "MONTHLY" | "YEARLY") {
  const schoolId = id(schoolIdRaw, "school ID");
  const [{ count, countingPolicy }, { pricing, source }] = await Promise.all([countBillableStudents(schoolId), resolveRate(schoolId)]);
  if (cycle === "YEARLY" && pricing.yearlyEnabled === false) throw new AppError("Yearly billing is not enabled", 409);
  const monthly = Number(pricing.monthlyRatePaise || 0);
  const amounts = calculateStudentBillingAmounts({ studentCount: count, monthlyRatePaise: monthly, yearlyRatePaise: pricing.yearlyRatePaise, yearlyDiscountBps: pricing.yearlyDiscountBps, taxRateBps: pricing.taxRateBps, cycle });
  return { schoolId: schoolIdRaw, billableStudentCount: count, countingPolicy, billingCycle: cycle, perStudentMonthlyRate: rupees(monthly), perStudentYearlyRate: pricing.yearlyRatePaise == null ? null : rupees(pricing.yearlyRatePaise), baseAmount: rupees(amounts.baseAmountPaise), discount: rupees(amounts.discountPaise), taxRatePercent: Number(pricing.taxRateBps || 0) / 100, tax: rupees(amounts.taxPaise), total: rupees(amounts.totalPaise), currency: pricing.currency || "INR", pricingSource: source, effectiveFrom: pricing.effectiveFrom };
}

function periodDates(cycle: "MONTHLY" | "YEARLY", startInput?: string) {
  const start = startInput ? new Date(startInput) : new Date();
  if (Number.isNaN(start.getTime())) throw new AppError("Invalid billing period start", 400);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  if (cycle === "MONTHLY") end.setUTCMonth(end.getUTCMonth() + 1); else end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

export async function createBillingInvoiceService(actor: BillingActor, schoolIdRaw: string, cycle: "MONTHLY" | "YEARLY", startInput?: string) {
  const schoolId = id(schoolIdRaw, "school ID");
  const { school, count, studentIds, countingPolicy } = await countBillableStudents(schoolId);
  const { pricing, source } = await resolveRate(schoolId);
  if (cycle === "YEARLY" && pricing.yearlyEnabled === false) throw new AppError("Yearly billing is not enabled", 409);
  const { start, end } = periodDates(cycle, startInput);
  const rate = Number(pricing.monthlyRatePaise || 0);
  const amounts = calculateStudentBillingAmounts({ studentCount: count, monthlyRatePaise: rate, yearlyRatePaise: pricing.yearlyRatePaise, yearlyDiscountBps: pricing.yearlyDiscountBps, taxRateBps: pricing.taxRateBps, cycle });
  const base = amounts.baseAmountPaise; const discount = amounts.discountPaise; const tax = amounts.taxPaise; const total = amounts.totalPaise;
  const hash = crypto.createHash("sha256").update(studentIds.map(String).sort().join(",")).digest("hex");
  const invoiceNumber = `MIR-${school.code}-${start.toISOString().slice(0, 7).replace("-", "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    const invoice = await SubscriptionBillingInvoice.create({ invoiceNumber, schoolId, billingPeriodStart: start, billingPeriodEnd: end, billingCycle: cycle, billableStudentCount: count, studentIdsHash: hash, perStudentRatePaise: amounts.perStudentRatePaise, baseAmountPaise: base, discountPaise: discount, taxRateBps: pricing.taxRateBps || 0, taxPaise: tax, totalPaise: total, currency: pricing.currency || "INR", dueDate: new Date(Date.now() + 7 * 86400000), snapshot: { pricingSource: source, countingPolicy, studentIds }, createdBy: id(actor.userId, "user ID") });
    await audit(actor, "SAAS_INVOICE_ISSUED", "SubscriptionBillingInvoice", String(invoice._id), `Invoice ${invoiceNumber} issued for ${count} billable students`, { invoiceNumber, count, totalPaise: total });
    return { ...invoice.toObject(), baseAmount: rupees(base), discount: rupees(discount), tax: rupees(tax), total: rupees(total) };
  } catch (error: any) { if (error?.code === 11000) throw new AppError("An invoice already exists for this school and billing period", 409); throw error; }
}

export async function listBillingInvoicesService(actor: BillingActor, schoolIdRaw?: string) {
  const filter: Record<string, unknown> = {};
  if (actor.role !== "SUPER_ADMIN") { if (!actor.schoolId) throw new AppError("School context required", 400); filter.schoolId = id(actor.schoolId, "school ID"); }
  else if (schoolIdRaw) filter.schoolId = id(schoolIdRaw, "school ID");
  const rows = await SubscriptionBillingInvoice.find(filter).sort({ issuedAt: -1 }).limit(200).populate("schoolId", "name code").lean();
  return rows.map((row: any) => ({ ...row, baseAmount: rupees(row.baseAmountPaise), discount: rupees(row.discountPaise), tax: rupees(row.taxPaise), total: rupees(row.totalPaise) }));
}

export async function setSchoolRateService(actor: BillingActor, input: any) {
  const schoolId = id(String(input.schoolId || ""), "school ID");
  if (!input.reason || String(input.reason).trim().length < 5) throw new AppError("A reason of at least 5 characters is required", 400);
  const school = await School.findById(schoolId).select("_id").lean(); if (!school) throw new AppError("School not found", 404);
  const discountPercent = input.yearlyDiscountPercent == null ? undefined : Number(input.yearlyDiscountPercent);
  if (discountPercent !== undefined && (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)) throw new AppError("Yearly discount must be between 0 and 100", 400);
  const effectiveFrom = new Date(input.effectiveFrom || Date.now()); if (Number.isNaN(effectiveFrom.getTime())) throw new AppError("Invalid effective date", 400);
  const currency = String(input.currency || "INR").toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new AppError("Currency must be a 3-letter code", 400);
  const payload = { schoolId, monthlyRatePaise: toPaise(input.monthlyRatePerStudent, "Monthly student rate"), yearlyRatePaise: input.yearlyRatePerStudent == null ? undefined : toPaise(input.yearlyRatePerStudent, "Yearly rate"), yearlyDiscountBps: discountPercent == null ? undefined : Math.round(discountPercent * 100), currency, effectiveFrom, isActive: true, updatedBy: id(actor.userId, "user ID"), reason: String(input.reason).trim() };
  const result = await SchoolPricingOverride.findOneAndUpdate({ schoolId }, { $set: payload }, { upsert: true, new: true, runValidators: true });
  await audit(actor, "SCHOOL_PRICING_OVERRIDE", "SchoolPricingOverride", String(result._id), payload.reason, { monthlyRatePaise: payload.monthlyRatePaise, effectiveFrom: payload.effectiveFrom });
  return result;
}

export async function recordManualActivationService(actor: BillingActor, input: any) {
  const schoolId = id(String(input.schoolId || ""), "school ID");
  const reason = String(input.reason || "").trim(); if (reason.length < 5) throw new AppError("Manual activation reason is required", 400);
  const school = await School.findById(schoolId); if (!school) throw new AppError("School not found", 404);
  const endDate = new Date(input.endDate); if (Number.isNaN(endDate.getTime()) || endDate <= new Date()) throw new AppError("A future subscription expiry date is required", 400);
  school.status = "ACTIVE" as any; school.subscriptionExpiresAt = endDate; school.statusHistory = school.statusHistory || []; school.statusHistory.push({ status: "ACTIVE" as any, changedBy: id(actor.userId, "user ID"), changedAt: new Date(), reason }); await school.save();
  await SubscriptionLifecycleHistory.create({ schoolId, action: "MANUAL_ACTIVATION", toStatus: "ACTIVE", reason, actorId: id(actor.userId, "user ID"), metadata: { endDate } });
  await audit(actor, "SUBSCRIPTION_MANUAL_ACTIVATION", "School", String(schoolId), reason, { endDate });
  return { schoolId, status: school.status, subscriptionExpiresAt: endDate, paymentRecorded: false, note: "Manual access activation recorded; no payment was fabricated or settled." };
}

export async function platformBillingDashboardService() {
  const [totalSchools, schools, invoices, activeStudents] = await Promise.all([
    School.countDocuments({ isDeleted: false }),
    School.find({ isDeleted: false }).select("name code status").lean(),
    SubscriptionBillingInvoice.find({}).select("paymentStatus totalPaise currency issuedAt schoolId").lean(),
    Student.aggregate([{ $match: { status: "ACTIVE", isActive: true, isDeleted: false } }, { $group: { _id: "$schoolId", count: { $addToSet: "$_id" } } }, { $project: { count: { $size: "$count" } } }]),
  ]);
  const paid = invoices.filter((i: any) => i.paymentStatus === "PAID").reduce((sum: number, i: any) => sum + i.totalPaise, 0);
  const pending = invoices.filter((i: any) => i.paymentStatus === "PENDING").reduce((sum: number, i: any) => sum + i.totalPaise, 0);
  const countBySchool = new Map(activeStudents.map((x: any) => [String(x._id), x.count]));
  return { totalSchools, activeSchools: schools.filter((s: any) => s.status === "ACTIVE").length, trialSchools: schools.filter((s: any) => s.status === "TRIAL").length, suspendedSchools: schools.filter((s: any) => s.status === "SUSPENDED").length, totalActiveStudents: activeStudents.reduce((n: number, x: any) => n + x.count, 0), invoicedSubscriptionPaise: invoices.reduce((n: number, x: any) => n + x.totalPaise, 0), collectedSubscriptionPaise: paid, outstandingSubscriptionPaise: pending, currency: "INR", schools: schools.map((s: any) => ({ ...s, billableActiveStudentsAcrossAllSessions: countBySchool.get(String((s as any)._id)) || 0 })), note: "MRR/ARR are not inferred from one-off invoices; payment collection remains pending until verified gateway integration records a PAID invoice." };
}

export async function setFeatureEntitlementService(actor: BillingActor, input: any) {
  const schoolId = id(String(input.schoolId || ""), "school ID");
  const featureKey = String(input.featureKey || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(featureKey)) throw new AppError("Invalid feature key", 400);
  const reason = String(input.reason || "").trim(); if (reason.length < 5) throw new AppError("A reason of at least 5 characters is required", 400);
  const effectiveFrom = new Date(input.effectiveFrom || Date.now());
  const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
  if (Number.isNaN(effectiveFrom.getTime()) || (effectiveUntil && (Number.isNaN(effectiveUntil.getTime()) || effectiveUntil <= effectiveFrom))) throw new AppError("Invalid entitlement effective dates", 400);
  const result = await SubscriptionFeatureEntitlement.findOneAndUpdate({ schoolId, featureKey }, { $set: { enabled: Boolean(input.enabled), effectiveFrom, effectiveUntil, updatedBy: id(actor.userId, "user ID"), reason } }, { upsert: true, new: true, runValidators: true });
  await audit(actor, "SUBSCRIPTION_FEATURE_ENTITLEMENT_CHANGED", "SubscriptionFeatureEntitlement", String(result._id), reason, { schoolId, featureKey, enabled: result.enabled, effectiveFrom, effectiveUntil });
  return result;
}
