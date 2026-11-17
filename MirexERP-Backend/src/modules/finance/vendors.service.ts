import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import type { FinanceActor } from "./finance.model";
import { FinanceVendor } from "./vendors.model";

const context = (actor: FinanceActor) => {
  if (!actor.schoolId || !Types.ObjectId.isValid(actor.schoolId) || !Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Authenticated school context is required", 401);
  }
  return { schoolId: new Types.ObjectId(actor.schoolId), userId: new Types.ObjectId(actor.userId) };
};

export const listVendorsService = async (actor: FinanceActor, query: { page?: number; limit?: number; search?: string }) => {
  const { schoolId } = context(actor);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter: Record<string, unknown> = { schoolId };
  if (query.search?.trim()) {
    const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: safe, $options: "i" } }, { code: { $regex: safe, $options: "i" } }, { phone: { $regex: safe, $options: "i" } }];
  }
  const [items, total] = await Promise.all([
    FinanceVendor.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    FinanceVendor.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 } };
};

export const createVendorService = async (payload: Record<string, unknown>, actor: FinanceActor) => {
  const { schoolId, userId } = context(actor);
  const name = String(payload.name || "").trim();
  const code = String(payload.code || "").trim().toUpperCase();
  if (name.length < 2 || code.length < 2) throw new AppError("Vendor name and code are required", 400);
  if (await FinanceVendor.exists({ schoolId, code })) throw new AppError("Vendor code already exists", 409);
  return FinanceVendor.create({
    name,
    code,
    contactPerson: typeof payload.contactPerson === "string" ? payload.contactPerson.trim() : undefined,
    phone: typeof payload.phone === "string" ? payload.phone.trim() : undefined,
    email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : undefined,
    address: typeof payload.address === "string" ? payload.address.trim() : undefined,
    gstin: typeof payload.gstin === "string" ? payload.gstin.trim().toUpperCase() : undefined,
    pan: typeof payload.pan === "string" ? payload.pan.trim().toUpperCase() : undefined,
    notes: typeof payload.notes === "string" ? payload.notes.trim() : undefined,
    schoolId,
    createdBy: userId,
  });
};

export const updateVendorService = async (id: string, payload: Record<string, unknown>, actor: FinanceActor) => {
  const { schoolId, userId } = context(actor);
  if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid vendor ID", 400);
  const vendor = await FinanceVendor.findOne({ _id: id, schoolId });
  if (!vendor) throw new AppError("Vendor not found", 404);
  for (const key of ["name","contactPerson","phone","email","address","gstin","pan","notes"] as const) {
    if (payload[key] !== undefined) vendor[key] = String(payload[key]) as never;
  }
  if (payload.isActive !== undefined) vendor.isActive = Boolean(payload.isActive);
  vendor.updatedBy = userId;
  await vendor.save();
  return vendor;
};

export const deactivateVendorService = async (id: string, actor: FinanceActor) => {
  const { schoolId, userId } = context(actor);
  if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid vendor ID", 400);
  const vendor = await FinanceVendor.findOne({ _id: id, schoolId });
  if (!vendor) throw new AppError("Vendor not found", 404);
  vendor.isActive = false;
  vendor.updatedBy = userId;
  await vendor.save();
  return vendor;
};
