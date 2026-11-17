import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../auth/auth.model";
import School from "../schools/schools.model";
import Subscription from "../subscriptions/subscriptions.model";
import { SubscriptionPlan, PlatformRole, SupportTicket, PlatformSetting, AuditLog } from "./platform.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendCreated, sendPaginatedSuccess, sendSuccess } from "../../utils/apiResponse";
import { USER_ROLES } from "../../config/constants";

const actor = (req: Request) => {
  if (!req.user?.userId) throw new AppError("Authentication required", 401);
  return req.user;
};
const objectId = (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid resource ID", 400);
};
const paging = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const audit = async (req: Request, action: string, entity: string, entityId = "", before: any = null, after: any = null) => {
  const u = actor(req);
  await AuditLog.create({
    actorId: u.userId, actorName: u.email || "", actorRole: u.role,
    action, entity, entityId, before, after,
    description: `${action} ${entity}`, ip: req.ip || "",
  });
};
const paginated = async (res: Response, message: string, model: any, filter: any, req: Request, sort: any = { createdAt: -1 }, populate?: string[]) => {
  const { page, limit, skip } = paging(req);
  let query = model.find(filter).sort(sort).skip(skip).limit(limit);
  for (const p of populate || []) query = query.populate(p);
  const [items, total] = await Promise.all([query.lean(), model.countDocuments(filter)]);
  return sendPaginatedSuccess(res, message, items, { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 });
};

// ---------------- PLANS ----------------
export const listPlans = asyncHandler(async (_req: Request, res: Response) => sendSuccess(res, "Plans fetched", await SubscriptionPlan.find().sort({ sortOrder: 1, createdAt: -1 }).lean()));
export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body || {};
  if (!data.name || !data.code || data.monthlyPrice === undefined || data.yearlyPrice === undefined) throw new AppError("name, code, monthlyPrice and yearlyPrice are required", 400);
  const plan = await SubscriptionPlan.create({ ...data, code: String(data.code).trim().toUpperCase() });
  await audit(req, "CREATE", "SUBSCRIPTION_PLAN", String(plan._id), null, plan.toObject());
  return sendCreated(res, "Plan created successfully", plan);
});
export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const before = await SubscriptionPlan.findById(req.params.id).lean();
  if (!before) throw new AppError("Plan not found", 404);
  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  await audit(req, "UPDATE", "SUBSCRIPTION_PLAN", req.params.id, before, plan?.toObject());
  return sendSuccess(res, "Plan updated successfully", plan);
});
export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const linked = await Subscription.countDocuments({ planId: req.params.id });
  if (linked) throw new AppError("This plan is linked to subscriptions. Deactivate it instead of deleting.", 409);
  const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
  if (!plan) throw new AppError("Plan not found", 404);
  await audit(req, "DELETE", "SUBSCRIPTION_PLAN", req.params.id, plan.toObject(), null);
  return sendSuccess(res, "Plan deleted successfully", null);
});

// ---------------- PLATFORM REVENUE / PAYMENTS ----------------
export const platformRevenue = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = paging(req);
  const filter: any = {};
  if (req.query.paymentStatus) filter.paymentStatus = String(req.query.paymentStatus).toUpperCase();
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.schoolId) { objectId(String(req.query.schoolId)); filter.schoolId = req.query.schoolId; }
  const [summary, byMonth, items, total] = await Promise.all([
    Subscription.aggregate([{ $match: { paymentStatus: "PAID" } }, { $group: { _id: null, totalRevenue: { $sum: "$amount" }, paidCount: { $sum: 1 } } }]),
    Subscription.aggregate([{ $match: { paymentStatus: "PAID" } }, { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, revenue: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { "_id.year": -1, "_id.month": -1 } }, { $limit: 12 }]),
    Subscription.find(filter).populate("schoolId", "name code").populate("planId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscription.countDocuments(filter),
  ]);
  return sendSuccess(res, "Platform revenue and subscription payment records fetched", {
    summary: summary[0] || { totalRevenue: 0, paidCount: 0 }, byMonth, items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    note: "Revenue is calculated from Subscription records marked paymentStatus=PAID. This is not a separate payment-gateway settlement ledger.",
  });
});

// ---------------- PLATFORM USERS ----------------
export const listPlatformUsers = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = { isDeleted: { $ne: true } };
  if (req.query.role) filter.role = String(req.query.role).toUpperCase();
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query.search) {
    const s = String(req.query.search).trim();
    filter.$or = [{ name: { $regex: s, $options: "i" } }, { email: { $regex: s, $options: "i" } }, { phone: { $regex: s, $options: "i" } }];
  }
  return paginated(res, "Platform users fetched", User, filter, req);
});
export const updatePlatformUser = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const before: any = await User.findById(req.params.id).select("-password").lean();
  if (!before || before.isDeleted) throw new AppError("User not found", 404);
  if (req.body.permissions !== undefined && (!Array.isArray(req.body.permissions) || req.body.permissions.some((permission: unknown) => typeof permission !== "string" || !permission.trim()))) {
    throw new AppError("permissions must be an array of non-empty strings", 400);
  }
  if (before.role === "SUPER_ADMIN" && req.body.status && req.body.status !== "ACTIVE") {
    const activeAdmins = await User.countDocuments({ role: "SUPER_ADMIN", status: "ACTIVE", isDeleted: false });
    if (activeAdmins <= 1) throw new AppError("Cannot deactivate the last active Super Admin", 409);
  }
  const allowed: any = {};
  for (const key of ["name", "phone", "status", "isActive", "permissions"]) if (req.body[key] !== undefined) allowed[key] = req.body[key];
  const updated = await User.findByIdAndUpdate(req.params.id, { $set: allowed }, { new: true, runValidators: true }).select("-password");
  await audit(req, "UPDATE", "PLATFORM_USER", req.params.id, before, updated?.toObject());
  return sendSuccess(res, "Platform user updated", updated);
});
export const deactivatePlatformUser = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const target: any = await User.findById(req.params.id);
  if (!target || target.isDeleted) throw new AppError("User not found", 404);
  if (String(target._id) === actor(req).userId) throw new AppError("You cannot deactivate your own account", 409);
  if (target.role === "SUPER_ADMIN") {
    const count = await User.countDocuments({ role: "SUPER_ADMIN", status: "ACTIVE", isDeleted: false });
    if (count <= 1) throw new AppError("Cannot deactivate the last active Super Admin", 409);
  }
  target.isDeleted = true; target.deletedAt = new Date(); target.isActive = false; target.status = "INACTIVE";
  await target.save();
  await audit(req, "SOFT_DELETE", "PLATFORM_USER", req.params.id, { email: target.email }, null);
  return sendSuccess(res, "Platform user deactivated", { userId: req.params.id, deletedAt: target.deletedAt });
});

// ---------------- PLATFORM ROLES ----------------
export const listRoles = asyncHandler(async (_req: Request, res: Response) => sendSuccess(res, "Platform roles fetched", await PlatformRole.find().sort({ createdAt: -1 }).lean()));
export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const { name, code } = req.body || {};
  if (!name || !code) throw new AppError("Role name and code are required", 400);
  const scope = String(req.body.scope || "PLATFORM").toUpperCase();
  if (!["PLATFORM", "SCHOOL"].includes(scope)) throw new AppError("Role scope must be PLATFORM or SCHOOL", 400);
  const normalizedCode = String(code).trim().toUpperCase();
  if (scope === "SCHOOL" && !(Object.values(USER_ROLES) as string[]).includes(normalizedCode)) {
    throw new AppError("School role code must match a supported school account role so it can be assigned to users", 400);
  }
  if (scope === "SCHOOL" && normalizedCode === USER_ROLES.SUPER_ADMIN) {
    throw new AppError("Super Admin is a platform-only role", 400);
  }
  const permissions = req.body.permissions ?? [];
  if (!Array.isArray(permissions) || permissions.some((permission: unknown) => typeof permission !== "string" || !permission.trim())) {
    throw new AppError("permissions must be an array of non-empty strings", 400);
  }
  const role = await PlatformRole.create({
    name: String(name).trim(),
    code: normalizedCode,
    description: req.body.description || "",
    permissions: [...new Set(permissions.map((permission: string) => permission.trim()))],
    scope,
    isSystem: false,
    isActive: true,
  });
  await audit(req, "CREATE", "PLATFORM_ROLE", String(role._id), null, role.toObject());
  return sendCreated(res, "Platform role created", role);
});
export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  if (!Array.isArray(req.body.permissions) || req.body.permissions.some((permission: unknown) => typeof permission !== "string" || !permission.trim())) throw new AppError("permissions must be an array of non-empty strings", 400);
  const before = await PlatformRole.findById(req.params.id).lean();
  if (!before) throw new AppError("Role not found", 404);
  if (before.isSystem) throw new AppError("System role permissions cannot be changed", 409);
  const role = await PlatformRole.findByIdAndUpdate(req.params.id, { $set: { permissions: [...new Set(req.body.permissions.map((permission: string) => permission.trim()))] } }, { new: true, runValidators: true });
  await audit(req, "UPDATE_PERMISSIONS", "PLATFORM_ROLE", req.params.id, before, role?.toObject());
  return sendSuccess(res, "Role permissions updated", role);
});
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const role: any = await PlatformRole.findById(req.params.id);
  if (!role) throw new AppError("Role not found", 404);
  if (role.isSystem) throw new AppError("System roles cannot be deleted", 409);
  await role.deleteOne();
  await audit(req, "DELETE", "PLATFORM_ROLE", req.params.id, role.toObject(), null);
  return sendSuccess(res, "Role deleted", null);
});

// ---------------- SUPPORT TICKETS ----------------
export const listSupportTickets = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = {};
  for (const key of ["status", "priority", "category", "schoolId"]) if (req.query[key]) filter[key] = req.query[key];
  return paginated(res, "Support tickets fetched", SupportTicket, filter, req, { updatedAt: -1 }, ["schoolId", "createdBy", "assignedTo"]);
});
export const createSupportTicket = asyncHandler(async (req: Request, res: Response) => {
  const u = actor(req);
  if (!req.body.subject || !req.body.description) throw new AppError("Subject and description are required", 400);
  const ticket = await SupportTicket.create({
    ticketNumber: `MIR-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    schoolId: req.body.schoolId || null, createdBy: u.userId,
    subject: req.body.subject, description: req.body.description,
    category: req.body.category || "GENERAL", priority: req.body.priority || "MEDIUM",
  });
  await audit(req, "CREATE", "SUPPORT_TICKET", String(ticket._id), null, ticket.toObject());
  return sendCreated(res, "Support ticket created", ticket);
});
export const updateSupportTicket = asyncHandler(async (req: Request, res: Response) => {
  objectId(req.params.id);
  const ticket: any = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new AppError("Support ticket not found", 404);
  const before = ticket.toObject();
  for (const key of ["status", "priority", "assignedTo", "category"]) if (req.body[key] !== undefined) ticket[key] = req.body[key];
  if (req.body.status === "RESOLVED" || req.body.status === "CLOSED") ticket.resolvedAt = new Date();
  if (req.body.message) ticket.messages.push({ senderId: actor(req).userId, senderRole: actor(req).role, message: String(req.body.message) });
  await ticket.save();
  await audit(req, "UPDATE", "SUPPORT_TICKET", req.params.id, before, ticket.toObject());
  return sendSuccess(res, "Support ticket updated", ticket);
});

// ---------------- PLATFORM SETTINGS ----------------
export const getPlatformSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await PlatformSetting.findOne({ key: "GLOBAL" }).lean();
  return sendSuccess(res, "Platform settings fetched", settings?.values || {});
});
export const updatePlatformSettings = asyncHandler(async (req: Request, res: Response) => {
  const u = actor(req);
  const values = req.body?.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new AppError("values must be an object", 400);
  const before = await PlatformSetting.findOne({ key: "GLOBAL" }).lean();
  const settings = await PlatformSetting.findOneAndUpdate(
    { key: "GLOBAL" }, { $set: { values, updatedBy: u.userId } }, { upsert: true, new: true, runValidators: true }
  );
  await audit(req, "UPDATE", "PLATFORM_SETTINGS", "GLOBAL", before?.values || null, settings.values);
  return sendSuccess(res, "Platform settings updated", settings.values);
});

// ---------------- AUDIT LOGS ----------------
export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = {};
  for (const key of ["action", "entity", "actorRole"]) if (req.query[key]) filter[key] = req.query[key];
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(String(req.query.from));
    if (req.query.to) filter.createdAt.$lte = new Date(String(req.query.to));
  }
  return paginated(res, "Audit logs fetched", AuditLog, filter, req, { createdAt: -1 }, ["actorId"]);
});


// ---------------- SAAS PLATFORM OVERVIEW ----------------
export const platformOverview = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const nextThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [
    schoolCounts,
    subscriptionCounts,
    upcomingRenewals,
    activePlans,
    paidRevenue,
  ] = await Promise.all([
    School.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Subscription.find({
      status: { $in: ["ACTIVE", "TRIAL"] },
      endDate: { $gte: now, $lte: nextThirtyDays },
    })
      .populate("schoolId", "name code email")
      .populate("planId", "name code")
      .sort({ endDate: 1 })
      .limit(100)
      .lean(),
    SubscriptionPlan.countDocuments({ isActive: true }),
    Subscription.aggregate([
      { $match: { paymentStatus: "PAID" } },
      { $group: { _id: "$currency", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  return sendSuccess(res, "SaaS platform overview fetched", {
    generatedAt: now,
    schoolCounts,
    subscriptionCounts,
    upcomingRenewals,
    activePlans,
    paidRevenue,
  });
});
