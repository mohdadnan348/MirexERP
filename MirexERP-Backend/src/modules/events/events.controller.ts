
import type { Request, Response } from "express";

import { USER_ROLES } from "../../config/constants";
import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { createPaginationMeta } from "../../utils/pagination";

import {
  createEventService,
  deleteEventService,
  getEventByIdService,
  getEventsService,
  updateEventService,
} from "./events.service";

const getRouteParam = (req: Request, key: string): string => {
  const value = req.params[key];
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0];
  throw new AppError(`Invalid or missing route parameter: ${key}`, 400);
};

interface EventActor {
  id: string;
  schoolId: string | null;
  role: string;
}

const getActor = (req: Request): EventActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    !req.user.schoolId
  ) {
    throw new AppError("School context is required", 400);
  }

  return {
    id: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

export const createEvent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const event = await createEventService(actor, req.body);

    return sendCreated(res, "Event created successfully", event);
  }
);

export const getEvents = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    const query = req.query;

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const result = await getEventsService(actor.schoolId, {
      page,
      limit,
      search:
        typeof query.search === "string"
          ? query.search
          : undefined,
      category:
        typeof query.category === "string"
          ? query.category
          : undefined,
      status:
        typeof query.status === "string"
          ? query.status
          : undefined,
      startDate:
        typeof query.startDate === "string"
          ? query.startDate
          : undefined,
      endDate:
        typeof query.endDate === "string"
          ? query.endDate
          : undefined,
    });

    return sendPaginatedSuccess(
      res,
      "Events fetched successfully",
      result.items,
      createPaginationMeta(
        result.page,
        result.limit,
        result.total
      )
    );
  }
);

export const getEventById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    const event = await getEventByIdService(
      actor.schoolId,
      getRouteParam(req, "id")
    );

    return sendSuccess(res, "Event fetched successfully", event);
  }
);

export const updateEvent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    const event = await updateEventService(
      actor.schoolId,
      getRouteParam(req, "id"),
      {
        ...req.body,
        updatedBy: actor.id,
      }
    );

    return sendSuccess(res, "Event updated successfully", event);
  }
);

export const deleteEvent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    if (!actor.schoolId) {
      throw new AppError("School context is required", 400);
    }

    await deleteEventService(actor.schoolId, getRouteParam(req, "id"), actor.id);

    return sendDeleted(res, "Event deleted successfully");
  }
);
