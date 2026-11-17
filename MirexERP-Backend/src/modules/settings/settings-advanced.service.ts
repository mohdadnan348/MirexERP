import mongoose, { Types } from "mongoose";
import UserModel from "../auth/auth.model";
import { SchoolSettings } from "./settings.model";
import { SchoolSecurityPolicy } from "./security.model";
import { AuditLog } from "../platform/platform.model";
import { AppError } from "../../utils/AppError";

interface Actor { userId: string; schoolId: string; role: string; }
const oid = (v: string) => { if (!Types.ObjectId.isValid(v)) throw new AppError("Invalid identifier", 400); return new Types.ObjectId(v); };
const writeAudit = (actor: Actor, action: string, entity: string, entityId: string, description: string, after: unknown) => AuditLog.create({ actorId: oid(actor.userId), actorRole: actor.role, action, entity, entityId, description, after });

export async function settingsDashboardService(actor: Actor) {
  const schoolId = oid(actor.schoolId);
  const schoolUserIds = await UserModel.distinct("_id", { schoolId, isDeleted: false });
  const [users, roles, activeSessions, settings, recentAudit, latestBackup] = await Promise.all([
    UserModel.countDocuments({ schoolId, isDeleted: false, isActive: true }),
    UserModel.distinct("role", { schoolId, isDeleted: false }),
    mongoose.connection.collection("authsessions").countDocuments({ userId: { $in: schoolUserIds }, revokedAt: null, expiresAt: { $gt: new Date() } }),
    SchoolSettings.findOne({ schoolId }).select("general academic attendance fees notifications updatedAt").lean(),
    AuditLog.find({ actorId: { $in: schoolUserIds } }).sort({ createdAt: -1 }).limit(8).select("action entity description actorRole createdAt").lean(),
    mongoose.connection.collection("backupjobs").find({ schoolId }).sort({ createdAt: -1 }).limit(1).toArray().catch(() => []),
  ]);
  return { activeUsers: users, roleCount: roles.length, activeSessions, settingsConfigured: Boolean(settings), settingsUpdatedAt: settings?.updatedAt || null, recentAudit, lastBackup: latestBackup[0] || null, backupStatus: latestBackup.length ? "RECORDED" : "NO_BACKUP_RECORD_FOUND" };
}

export async function listSchoolUsersService(actor: Actor, search?: string, role?: string) {
  const query: Record<string, any> = { schoolId: oid(actor.schoolId), isDeleted: false };
  if (role) query.role = role;
  if (search?.trim()) query.$or = [{ name: { $regex: search.trim(), $options: "i" } }, { email: { $regex: search.trim(), $options: "i" } }];
  return UserModel.find(query).select("name email phone role status isActive lastLoginAt createdAt").sort({ name: 1 }).limit(250).lean();
}

export async function getSecurityPolicyService(actor: Actor) {
  const schoolId = oid(actor.schoolId);
  let policy = await SchoolSecurityPolicy.findOne({ schoolId }).lean();
  if (!policy) policy = await SchoolSecurityPolicy.create({ schoolId, updatedBy: oid(actor.userId) }).then((x: any) => x.toObject());
  return policy;
}

export async function updateSecurityPolicyService(actor: Actor, input: any) {
  const schoolId = oid(actor.schoolId);
  const allowed = ["minimumPasswordLength", "requireUppercase", "requireLowercase", "requireNumber", "requireSymbol", "passwordExpiryDays", "failedLoginLimit", "lockoutMinutes", "sessionMaxAgeDays"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (input[key] !== undefined) update[key] = input[key];
  if (!Object.keys(update).length) throw new AppError("No supported security policy fields supplied", 400);
  update.updatedBy = oid(actor.userId);
  const policy = await SchoolSecurityPolicy.findOneAndUpdate({ schoolId }, { $set: update, $setOnInsert: { schoolId } }, { upsert: true, new: true, runValidators: true });
  await writeAudit(actor, "SECURITY_POLICY_UPDATED", "SchoolSecurityPolicy", String(policy._id), "School security policy updated", update);
  return policy;
}

export async function listActiveSessionsService(actor: Actor) {
  const userIds = await UserModel.distinct("_id", { schoolId: oid(actor.schoolId), isDeleted: false });
  const rows = await mongoose.connection.collection("authsessions").find({ userId: { $in: userIds }, revokedAt: null, expiresAt: { $gt: new Date() } }, { projection: { userId: 1, expiresAt: 1, createdAt: 1, updatedAt: 1, revokedAt: 1 } }).sort({ createdAt: -1 }).limit(500).toArray();
  const users = await UserModel.find({ _id: { $in: rows.map((r: any) => r.userId) } }).select("name email role").lean();
  const byId = new Map<string, any>(users.map((u: any) => [String(u._id), u] as [string, any]));
  return rows.map((r: any) => ({ id: String(r._id), user: byId.get(String(r.userId)) || null, createdAt: r.createdAt, lastActivityAt: r.updatedAt, expiresAt: r.expiresAt, deviceInfo: null, ip: null, note: "Existing refresh-session records do not retain device/IP metadata." }));
}

export async function revokeSessionService(actor: Actor, sessionId: string) {
  const sessionObjectId = oid(sessionId);
  const userIds = await UserModel.distinct("_id", { schoolId: oid(actor.schoolId), isDeleted: false });
  const result = await mongoose.connection.collection("authsessions").updateOne({ _id: sessionObjectId, userId: { $in: userIds }, revokedAt: null }, { $set: { revokedAt: new Date(), updatedAt: new Date() } });
  if (!result.modifiedCount) throw new AppError("Active session not found in this school", 404);
  await writeAudit(actor, "SESSION_REVOKED", "AuthSession", sessionId, "Refresh session revoked by school administrator", null);
  return { revoked: true, sessionId };
}

export async function revokeUserSessionsService(actor: Actor, userId: string) {
  const user = await UserModel.findOne({ _id: oid(userId), schoolId: oid(actor.schoolId), isDeleted: false }).select("_id");
  if (!user) throw new AppError("User not found in this school", 404);
  const result = await mongoose.connection.collection("authsessions").updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), updatedAt: new Date() } });
  await writeAudit(actor, "USER_SESSIONS_REVOKED", "User", userId, "All refresh sessions revoked by school administrator", { revokedCount: result.modifiedCount });
  return { revokedCount: result.modifiedCount };
}

export async function listSchoolAuditLogsService(actor: Actor, page = 1, limit = 50) {
  const schoolUserIds = await UserModel.distinct("_id", { schoolId: oid(actor.schoolId) });
  const query = { actorId: { $in: schoolUserIds } };
  const [items, total] = await Promise.all([AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments(query)]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
