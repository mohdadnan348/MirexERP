import { Types, type FilterQuery } from "mongoose";

import { AppError } from "../../utils/AppError";
import {
  Communication,
  CommunicationDelivery,
  CommunicationSettings,
  COMMUNICATION_STATUSES,
  type ICommunication,
} from "./communication.model";
import { NotificationPreference } from "./communication-advanced.model";

type Tenant = {
  schoolId?: string;
  isPlatformAdmin?: boolean;
  role?: string;
  userId?: string;
};

type ListQuery = Record<string, unknown>;

type CommunicationDeliveryRow = {
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  recipientId: ICommunication["recipientIds"][number];
  channel: ICommunication["channels"][number];
  status: "QUEUED";
};

const getSchoolObjectId = (schoolId?: string): Types.ObjectId => {
  if (!schoolId || !Types.ObjectId.isValid(schoolId)) {
    throw new AppError("Valid school context is required", 403);
  }
  return new Types.ObjectId(schoolId);
};

const getObjectId = (id: string, label = "ID"): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(id);
};

const getPage = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getScopedFilter = (tenant: Tenant): FilterQuery<ICommunication> => {
  const filter: FilterQuery<ICommunication> = { deletedAt: null };
  if (!tenant.isPlatformAdmin) {
    filter.schoolId = getSchoolObjectId(tenant.schoolId);
  } else if (tenant.schoolId) {
    filter.schoolId = getSchoolObjectId(tenant.schoolId);
  }
  return filter;
};

const applyViewerAudience = (filter: FilterQuery<ICommunication>, tenant: Tenant) => {
  if (!tenant.role || ["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(tenant.role)) return;
  const audience = tenant.role === "PARENT" ? "PARENTS" : tenant.role === "STUDENT" ? "STUDENTS" : tenant.role === "TEACHER" ? "TEACHERS" : "STAFF";
  const alternatives: Record<string, unknown>[] = [{ audiences: "ALL" }, { audiences: audience }];
  if (tenant.userId && Types.ObjectId.isValid(tenant.userId)) alternatives.push({ recipientIds: new Types.ObjectId(tenant.userId) });
  // CLASS/SECTION-targeted messages are not exposed until the portal's linked class context is resolved.
  filter.$and = [...(filter.$and || []), { $or: alternatives }, { $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }] }];
};

const findCommunicationOrFail = async (
  tenant: Tenant,
  id: string
) => {
  const filter = getScopedFilter(tenant);
  applyViewerAudience(filter, tenant);
  filter._id = getObjectId(id, "communication ID");

  const item = await Communication.findOne(filter);
  if (!item) {
    throw new AppError("Communication record not found", 404);
  }
  return item;
};

export async function list(tenant: Tenant, query: ListQuery) {
  const page = getPage(query.page, 1);
  const limit = Math.min(getPage(query.limit, 10), 100);
  const skip = (page - 1) * limit;
  const filter = getScopedFilter(tenant);
  applyViewerAudience(filter, tenant);

  if (typeof query.type === "string") filter.type = query.type as ICommunication["type"];
  if (typeof query.status === "string") filter.status = query.status as ICommunication["status"];
  if (typeof query.audience === "string") filter.audiences = [query.audience as ICommunication["audiences"][number]];

  if (typeof query.search === "string" && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { message: { $regex: escaped, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Communication.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name email")
      .lean(),
    Communication.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total > 0,
    },
  };
}

export async function create(
  tenant: Tenant,
  payload: Record<string, unknown>,
  userId?: string
) {
  const schoolId = getSchoolObjectId(tenant.schoolId);
  const creatorId = userId && Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : undefined;

  const scheduledAt = typeof payload.scheduledAt === "string"
    ? new Date(payload.scheduledAt)
    : undefined;
  const expiresAt = typeof payload.expiresAt === "string"
    ? new Date(payload.expiresAt)
    : undefined;

  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    throw new AppError("Invalid scheduled date", 400);
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError("Invalid expiry date", 400);
  }
  if (scheduledAt && expiresAt && expiresAt <= scheduledAt) {
    throw new AppError("Expiry date must be after scheduled date", 400);
  }

  const status = scheduledAt && scheduledAt.getTime() > Date.now()
    ? COMMUNICATION_STATUSES.SCHEDULED
    : COMMUNICATION_STATUSES.DRAFT;

  return Communication.create({
    schoolId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    audiences: payload.audiences,
    classIds: payload.classIds,
    sectionIds: payload.sectionIds,
    recipientIds: payload.recipientIds,
    channels: payload.channels,
    priority: payload.priority,
    attachments: payload.attachments,
    scheduledAt,
    expiresAt,
    isPinned: payload.isPinned,
    status,
    createdBy: creatorId,
    updatedBy: creatorId,
  });
}

export async function getById(tenant: Tenant, id: string) {
  return findCommunicationOrFail(tenant, id);
}

export async function update(
  tenant: Tenant,
  id: string,
  payload: Record<string, unknown>,
  userId?: string
) {
  const item = await findCommunicationOrFail(tenant, id);

  if (
    item.status === COMMUNICATION_STATUSES.PUBLISHED ||
    item.status === COMMUNICATION_STATUSES.ARCHIVED
  ) {
    throw new AppError("Published or archived communication cannot be edited", 409);
  }

  const allowedFields = [
    "title",
    "message",
    "type",
    "audiences",
    "classIds",
    "sectionIds",
    "recipientIds",
    "channels",
    "priority",
    "attachments",
    "isPinned",
  ] as const;

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      (item as unknown as Record<string, unknown>)[field] = payload[field];
    }
  }

  if (payload.scheduledAt !== undefined) {
    const date = payload.scheduledAt
      ? new Date(String(payload.scheduledAt))
      : undefined;
    if (date && Number.isNaN(date.getTime())) {
      throw new AppError("Invalid scheduled date", 400);
    }
    item.scheduledAt = date;
    item.status = date && date.getTime() > Date.now()
      ? COMMUNICATION_STATUSES.SCHEDULED
      : COMMUNICATION_STATUSES.DRAFT;
  }

  if (payload.expiresAt !== undefined) {
    const date = payload.expiresAt
      ? new Date(String(payload.expiresAt))
      : undefined;
    if (date && Number.isNaN(date.getTime())) {
      throw new AppError("Invalid expiry date", 400);
    }
    item.expiresAt = date;
  }

  if (
    item.scheduledAt &&
    item.expiresAt &&
    item.expiresAt <= item.scheduledAt
  ) {
    throw new AppError("Expiry date must be after scheduled date", 400);
  }

  if (userId && Types.ObjectId.isValid(userId)) {
    item.updatedBy = new Types.ObjectId(userId);
  }

  await item.save();
  return item;
}

export async function publish(
  tenant: Tenant,
  id: string,
  userId?: string
) {
  const item = await findCommunicationOrFail(tenant, id);

  if (item.status === COMMUNICATION_STATUSES.ARCHIVED) {
    throw new AppError("Archived communication cannot be published", 409);
  }
  if (item.expiresAt && item.expiresAt <= new Date()) {
    throw new AppError("Expired communication cannot be published", 409);
  }

  item.status = COMMUNICATION_STATUSES.PUBLISHED;
  item.publishedAt = new Date();
  item.scheduledAt = undefined;
  if (userId && Types.ObjectId.isValid(userId)) {
    item.updatedBy = new Types.ObjectId(userId);
  }
  await item.save();

  // Queue delivery records for explicitly selected recipients.
  // Audience-wide recipient resolution and external provider delivery
  // are handled by a separate worker/provider integration.
  if (item.recipientIds.length > 0 && item.channels.length > 0) {
    const schoolId = item.schoolId;
    const [preferences, settings] = await Promise.all([
      NotificationPreference.find({ schoolId, userId: { $in: item.recipientIds } }).lean(),
      CommunicationSettings.findOne({ schoolId }).lean(),
    ]);
    const preferenceByUser = new Map(preferences.map((p: any) => [String(p.userId), p]));
    const deliveryRows: CommunicationDeliveryRow[] = item.recipientIds.flatMap(
      (recipientId: ICommunication["recipientIds"][number]) => item.channels.flatMap(
        (channel: ICommunication["channels"][number]) => {
          const preference = preferenceByUser.get(String(recipientId)) as any;
          const enabledByUser = channel === "EMAIL" ? preference?.email !== false : channel === "SMS" ? preference?.sms !== false : channel === "PUSH" ? preference?.inApp !== false : preference?.inApp !== false;
          const enabledBySchool = channel === "EMAIL" ? settings?.emailEnabled !== false : channel === "SMS" ? settings?.smsEnabled !== false : channel === "PUSH" ? settings?.pushEnabled !== false : settings?.inAppEnabled !== false;
          if (!enabledByUser || !enabledBySchool) return [];
          return [{ schoolId, communicationId: item._id, recipientId, channel, status: "QUEUED" as const }];
        }
      )
    );

    await CommunicationDelivery.bulkWrite(
      deliveryRows.map((row: CommunicationDeliveryRow) => ({
        updateOne: {
          filter: {
            communicationId: row.communicationId,
            recipientId: row.recipientId,
            channel: row.channel,
          },
          update: { $setOnInsert: row },
          upsert: true,
        },
      }))
    );
  }

  return item;
}

export async function archive(tenant: Tenant, id: string, userId?: string) {
  const item = await findCommunicationOrFail(tenant, id);
  item.status = COMMUNICATION_STATUSES.ARCHIVED;
  if (userId && Types.ObjectId.isValid(userId)) {
    item.updatedBy = new Types.ObjectId(userId);
  }
  await item.save();
  return item;
}

export async function remove(tenant: Tenant, id: string) {
  const item = await findCommunicationOrFail(tenant, id);
  item.deletedAt = new Date();
  await item.save();
  return { id: item._id.toString(), deleted: true };
}

export async function getHistory(
  tenant: Tenant,
  id: string,
  query: ListQuery
) {
  const item = await findCommunicationOrFail(tenant, id);
  const page = getPage(query.page, 1);
  const limit = Math.min(getPage(query.limit, 20), 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    schoolId: item.schoolId,
    communicationId: item._id,
  };
  if (tenant.role && !["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(tenant.role)) {
    if (!tenant.userId || !Types.ObjectId.isValid(tenant.userId)) throw new AppError("Authenticated recipient context is required", 403);
    filter.recipientId = new Types.ObjectId(tenant.userId);
  }

  const [items, total] = await Promise.all([
    CommunicationDelivery.find(filter)
      .populate("recipientId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CommunicationDelivery.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total > 0,
    },
  };
}

export async function getSettings(tenant: Tenant) {
  const schoolId = getSchoolObjectId(tenant.schoolId);
  let settings = await CommunicationSettings.findOne({ schoolId });
  if (!settings) {
    settings = await CommunicationSettings.create({ schoolId });
  }
  return settings;
}

export async function updateSettings(
  tenant: Tenant,
  payload: Record<string, unknown>
) {
  const schoolId = getSchoolObjectId(tenant.schoolId);
  return CommunicationSettings.findOneAndUpdate(
    { schoolId },
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}
