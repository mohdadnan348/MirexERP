
import { Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import { Event, EventStatus, EventCategory } from "./events.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import UserModel from "../auth/auth.model";
import { EventHistory } from "./event-operations.model";
import { Communication, COMMUNICATION_STATUSES } from "../communication/communication.model";

interface EventActor {
  id: string;
  schoolId: string | null;
  role: string;
}

interface EventInput {
  sessionId?: string;
  title: string;
  description?: string;
  category:
    | "ACADEMIC"
    | "CULTURAL"
    | "SPORTS"
    | "CELEBRATION"
    | "MEETING"
    | "WORKSHOP"
    | "HOLIDAY"
    | "OTHER";
  startDate: string | Date;
  endDate: string | Date;
  startTime?: string;
  endTime?: string;
  venue?: string;
  organizer?: string;
  targetAudience?: string[];
  classIds?: string[];
  sectionIds?: string[];
  recipientIds?: string[];
  status?: EventStatus;
  isPublished?: boolean;
  attachments?: {
    name: string;
    url: string;
  }[];
}

interface EventFilters {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

const validateObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const getSchoolObjectId = (schoolId: string) => {
  validateObjectId(schoolId, "school ID");
  return new Types.ObjectId(schoolId);
};

const validateDates = (
  startDate: string | Date,
  endDate: string | Date
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new AppError("Invalid event date", 400);
  }

  if (start > end) {
    throw new AppError(
      "Event end date cannot be before start date",
      400
    );
  }

  return { start, end };
};

const normalizeClassIds = (classIds: string[] = []) => {
  const uniqueIds = new Set<string>();

  return classIds.map((id) => {
    validateObjectId(id, "class ID");

    if (uniqueIds.has(id)) {
      throw new AppError("Duplicate class ID is not allowed", 400);
    }

    uniqueIds.add(id);
    return new Types.ObjectId(id);
  });
};

const validateEventTimes = (
  startTime?: string,
  endTime?: string
) => {
  if (startTime && endTime && startTime >= endTime) {
    throw new AppError(
      "Event end time must be after start time",
      400
    );
  }
};

const validateAttachments = (
  attachments?: { name: string; url: string }[]
) => {
  if (!attachments) return [];

  if (attachments.length > 10) {
    throw new AppError("Maximum 10 attachments are allowed", 400);
  }

  for (const attachment of attachments) {
    try {
      const url = new URL(attachment.url);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      throw new AppError("Invalid attachment URL", 400);
    }
  }

  return attachments;
};

const syncPublishedEventCommunication = async (event: any, actorId: Types.ObjectId, shouldPublish: boolean) => {
  const existing = await Communication.findOne({ schoolId: event.schoolId, sourceEventId: event._id });
  if (!shouldPublish) {
    if (existing && existing.status !== COMMUNICATION_STATUSES.ARCHIVED) { existing.status = COMMUNICATION_STATUSES.ARCHIVED; existing.updatedBy = actorId; await existing.save(); }
    return;
  }
  const audiences = (event.targetAudience || ["ALL"]).map((value: string) => value === "EMPLOYEES" ? "STAFF" : value).filter((value: string) => ["ALL", "PARENTS", "STUDENTS", "TEACHERS", "STAFF", "CLASS", "SECTION", "INDIVIDUAL"].includes(value));
  const expiresAt = new Date(event.endDate); expiresAt.setHours(23, 59, 59, 999);
  const values = { title: event.title, message: event.description || `${event.title} — ${new Date(event.startDate).toLocaleDateString("en-IN")}`, type: "EVENT", audiences: audiences.length ? audiences : ["ALL"], classIds: event.classIds || [], sectionIds: event.sectionIds || [], recipientIds: event.recipientIds || [], channels: ["IN_APP"], priority: "NORMAL", attachments: event.attachments || [], status: COMMUNICATION_STATUSES.PUBLISHED, publishedAt: new Date(), expiresAt, updatedBy: actorId } as any;
  if (existing) { Object.assign(existing, values); await existing.save(); }
  else await Communication.create({ schoolId: event.schoolId, sourceEventId: event._id, createdBy: actorId, ...values });
};

export const createEventService = async (
  actor: EventActor,
  input: EventInput
) => {
  if (!actor.schoolId) {
    throw new AppError("School context is required", 400);
  }

  validateObjectId(actor.id, "user ID");

  const schoolId = getSchoolObjectId(actor.schoolId);
  const { start, end } = validateDates(
    input.startDate,
    input.endDate
  );

  validateEventTimes(input.startTime, input.endTime);

  let sessionId: Types.ObjectId | undefined;

  if (input.sessionId) {
    validateObjectId(input.sessionId, "session ID");
    sessionId = new Types.ObjectId(input.sessionId);
  }

  const classIds = normalizeClassIds(input.classIds);
  const sectionIds = normalizeClassIds(input.sectionIds);
  const recipientIds = normalizeClassIds(input.recipientIds);
  if (classIds.length && await Class.countDocuments({ _id: { $in: classIds }, schoolId }) !== classIds.length) throw new AppError("One or more selected classes do not belong to this school", 400);
  if (sectionIds.length && await Section.countDocuments({ _id: { $in: sectionIds }, schoolId }) !== sectionIds.length) throw new AppError("One or more selected sections do not belong to this school", 400);
  if (recipientIds.length && await UserModel.countDocuments({ _id: { $in: recipientIds }, schoolId, isActive: true }) !== recipientIds.length) throw new AppError("One or more selected users are inactive or outside this school", 400);
  const targetAudience = input.targetAudience?.length ? input.targetAudience : classIds.length ? ["CLASS"] : sectionIds.length ? ["SECTION"] : recipientIds.length ? ["INDIVIDUAL"] : ["ALL"];
  if (targetAudience.includes("CLASS") && !classIds.length) throw new AppError("Select at least one class for class-targeted events", 400);
  if (targetAudience.includes("SECTION") && !sectionIds.length) throw new AppError("Select at least one section for section-targeted events", 400);
  if (targetAudience.includes("INDIVIDUAL") && !recipientIds.length) throw new AppError("Select recipients for individual events", 400);
  const attachments = validateAttachments(input.attachments);

  const created = await Event.create({
    schoolId,
    sessionId,
    title: input.title,
    description: input.description,
    category: input.category,
    startDate: start,
    endDate: end,
    startTime: input.startTime,
    endTime: input.endTime,
    venue: input.venue,
    organizer: input.organizer,
    targetAudience,
    classIds,
    sectionIds,
    recipientIds,
    status: input.status ?? EventStatus.UPCOMING,
    isPublished: input.isPublished ?? false,
    attachments,
    createdBy: new Types.ObjectId(actor.id),
  });
  await EventHistory.create({ schoolId, eventId: created._id, action: "CREATED", newValues: created.toObject(), actorId: new Types.ObjectId(actor.id) });
  if (created.isPublished) await syncPublishedEventCommunication(created, new Types.ObjectId(actor.id), true);
  return created;
};

export const getEventsService = async (
  schoolId: string,
  filters: EventFilters
) => {
  const filter: Record<string, unknown> = {
    schoolId: getSchoolObjectId(schoolId),
  };

  if (filters.category) {
    filter.category = filters.category;
  }

  if (filters.status) {
    filter.status = filters.status;
  }

  if (filters.search) {
    filter.$or = [
      { title: { $regex: filters.search, $options: "i" } },
      { description: { $regex: filters.search, $options: "i" } },
      { venue: { $regex: filters.search, $options: "i" } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    const start = filters.startDate
      ? new Date(filters.startDate)
      : undefined;

    const end = filters.endDate
      ? new Date(filters.endDate)
      : undefined;

    if (
      (start && Number.isNaN(start.getTime())) ||
      (end && Number.isNaN(end.getTime()))
    ) {
      throw new AppError("Invalid date filter", 400);
    }

    filter.startDate = {
      ...(start ? { $gte: start } : {}),
      ...(end ? { $lte: end } : {}),
    };
  }

  const page = Math.max(1, filters.page);
  const limit = Math.min(100, Math.max(1, filters.limit));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Event.find(filter)
      .populate("sessionId", "sessionName")
      .populate("classIds", "className")
      .populate("createdBy", "name email")
      .sort({ startDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getEventByIdService = async (
  schoolId: string,
  id: string
) => {
  validateObjectId(id, "event ID");

  const event = await Event.findOne({
    _id: new Types.ObjectId(id),
    schoolId: getSchoolObjectId(schoolId),
  })
    .populate("sessionId", "sessionName")
    .populate("classIds", "className")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  return event;
};

export const updateEventService = async (
  schoolId: string,
  id: string,
  input: Partial<EventInput> & { updatedBy?: string }
) => {
  validateObjectId(id, "event ID");

  const schoolObjectId = getSchoolObjectId(schoolId);

  const event = await Event.findOne({
    _id: new Types.ObjectId(id),
    schoolId: schoolObjectId,
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }
  const previousValues = event.toObject();

  if (input.sessionId !== undefined) {
    if (input.sessionId) {
      validateObjectId(input.sessionId, "session ID");
      event.sessionId = new Types.ObjectId(input.sessionId);
    } else {
      event.sessionId = undefined;
    }
  }

  if (input.title !== undefined) event.title = input.title;
  if (input.description !== undefined) {
    event.description = input.description;
  }
  if (input.category !== undefined) {
    event.category = input.category as EventCategory;
  }

  if (input.startDate !== undefined) {
    event.startDate = new Date(input.startDate);
  }

  if (input.endDate !== undefined) {
    event.endDate = new Date(input.endDate);
  }

  if (input.startTime !== undefined) {
    event.startTime = input.startTime;
  }

  if (input.endTime !== undefined) {
    event.endTime = input.endTime;
  }

  if (input.venue !== undefined) event.venue = input.venue;
  if (input.organizer !== undefined) {
    event.organizer = input.organizer;
  }

  if (input.targetAudience !== undefined) {
    event.targetAudience = input.targetAudience;
  } else if (input.classIds !== undefined || input.sectionIds !== undefined || input.recipientIds !== undefined) {
    event.targetAudience = input.classIds?.length ? ["CLASS"] : input.sectionIds?.length ? ["SECTION"] : input.recipientIds?.length ? ["INDIVIDUAL"] : ["ALL"];
  }

  if (input.classIds !== undefined) {
    const ids = normalizeClassIds(input.classIds);
    if (ids.length && await Class.countDocuments({ _id: { $in: ids }, schoolId: schoolObjectId }) !== ids.length) throw new AppError("One or more selected classes do not belong to this school", 400);
    event.classIds = ids;
  }
  if (input.sectionIds !== undefined) {
    const ids = normalizeClassIds(input.sectionIds);
    if (ids.length && await Section.countDocuments({ _id: { $in: ids }, schoolId: schoolObjectId }) !== ids.length) throw new AppError("One or more selected sections do not belong to this school", 400);
    event.sectionIds = ids;
  }
  if (input.recipientIds !== undefined) {
    const ids = normalizeClassIds(input.recipientIds);
    if (ids.length && await UserModel.countDocuments({ _id: { $in: ids }, schoolId: schoolObjectId, isActive: true }) !== ids.length) throw new AppError("One or more selected users are inactive or outside this school", 400);
    event.recipientIds = ids;
  }

  if (input.status !== undefined) {
    event.status = input.status;
  }

  if (input.isPublished !== undefined) {
    event.isPublished = input.isPublished;
  }

  if (input.attachments !== undefined) {
    event.attachments = validateAttachments(input.attachments);
  }

  if (input.updatedBy) {
    validateObjectId(input.updatedBy, "user ID");
    event.updatedBy = new Types.ObjectId(input.updatedBy);
  }

  if (event.targetAudience.includes("CLASS") && !event.classIds.length) throw new AppError("Class-targeted event requires at least one class", 400);
  if (event.targetAudience.includes("SECTION") && !event.sectionIds.length) throw new AppError("Section-targeted event requires at least one section", 400);
  if (event.targetAudience.includes("INDIVIDUAL") && !event.recipientIds.length) throw new AppError("Individual event requires at least one recipient", 400);
  validateDates(event.startDate, event.endDate);
  validateEventTimes(event.startTime, event.endTime);

  await event.save();
  const actorId = input.updatedBy && Types.ObjectId.isValid(input.updatedBy) ? new Types.ObjectId(input.updatedBy) : event.createdBy;
  await EventHistory.create({ schoolId: schoolObjectId, eventId: event._id, action: input.isPublished === true && previousValues.isPublished !== true ? "PUBLISHED" : "UPDATED", previousValues, newValues: event.toObject(), actorId });
  if (event.isPublished) await syncPublishedEventCommunication(event, actorId, true);
  else if (previousValues.isPublished) await syncPublishedEventCommunication(event, actorId, false);

  return event;
};

export const deleteEventService = async (
  schoolId: string,
  id: string,
  actorId?: string
) => {
  validateObjectId(id, "event ID");

  const schoolObjectId = getSchoolObjectId(schoolId);
  const event = await Event.findOne({ _id: new Types.ObjectId(id), schoolId: schoolObjectId });
  if (!event) throw new AppError("Event not found", 404);
  if (event.status === EventStatus.CANCELLED) throw new AppError("Event is already cancelled", 409);
  const previousValues = event.toObject();
  event.status = EventStatus.CANCELLED;
  event.isPublished = false;
  if (actorId && Types.ObjectId.isValid(actorId)) event.updatedBy = new Types.ObjectId(actorId);
  await event.save();
  const actorObjectId = actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : event.createdBy;
  await EventHistory.create({ schoolId: schoolObjectId, eventId: event._id, action: "CANCELLED", previousValues, newValues: event.toObject(), actorId: actorObjectId });
  await syncPublishedEventCommunication(event, actorObjectId, false);
  return event;
};
