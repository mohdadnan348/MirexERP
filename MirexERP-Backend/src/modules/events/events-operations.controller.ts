import type { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { EventHistory } from "./event-operations.model";
export const getEventHistory = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = req.user?.schoolId, id = String(req.params.id || "");
  if (!schoolId || !Types.ObjectId.isValid(schoolId) || !Types.ObjectId.isValid(id)) throw new AppError("Valid school and event IDs are required", 400);
  const items = await EventHistory.find({ schoolId: new Types.ObjectId(schoolId), eventId: new Types.ObjectId(id) }).populate("actorId", "name email").sort({ createdAt: -1 }).limit(200).lean();
  return sendSuccess(res, "Event history fetched", items);
});
