
import { Request, Response } from "express";

import {
  getSettingsService,
  updateSettingsService,
  getAcademicSettingsService,
  updateAcademicSettingsService,
  getAttendanceSettingsService,
  updateAttendanceSettingsService,
  getFeeSettingsService,
  updateFeeSettingsService,
  getNotificationSettingsService,
  updateNotificationSettingsService,
} from "./settings.service";

import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  sendSuccess,
} from "../../utils/apiResponse";

interface SettingsActor {
  userId: string;
  schoolId: string;
  role: string;
}

const getActor = (req: Request): SettingsActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  return {
    userId: String(req.user._id),
    schoolId: String(req.user.schoolId),
    role: req.user.role,
  };
};

// GET GENERAL SETTINGS
export const getSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await getSettingsService(actor);

    return sendSuccess(
      res,
      "School settings fetched successfully",
      settings
    );
  }
);

// UPDATE GENERAL SETTINGS
export const updateSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await updateSettingsService(
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "School settings updated successfully",
      settings
    );
  }
);

// GET ACADEMIC SETTINGS
export const getAcademicSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await getAcademicSettingsService(actor);

    return sendSuccess(
      res,
      "Academic settings fetched successfully",
      settings
    );
  }
);

// UPDATE ACADEMIC SETTINGS
export const updateAcademicSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await updateAcademicSettingsService(
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "Academic settings updated successfully",
      settings
    );
  }
);

// GET ATTENDANCE SETTINGS
export const getAttendanceSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await getAttendanceSettingsService(actor);

    return sendSuccess(
      res,
      "Attendance settings fetched successfully",
      settings
    );
  }
);

// UPDATE ATTENDANCE SETTINGS
export const updateAttendanceSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await updateAttendanceSettingsService(
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "Attendance settings updated successfully",
      settings
    );
  }
);

// GET FEE SETTINGS
export const getFeeSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await getFeeSettingsService(actor);

    return sendSuccess(
      res,
      "Fee settings fetched successfully",
      settings
    );
  }
);

// UPDATE FEE SETTINGS
export const updateFeeSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings = await updateFeeSettingsService(
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "Fee settings updated successfully",
      settings
    );
  }
);

// GET NOTIFICATION SETTINGS
export const getNotificationSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings =
      await getNotificationSettingsService(actor);

    return sendSuccess(
      res,
      "Notification settings fetched successfully",
      settings
    );
  }
);

// UPDATE NOTIFICATION SETTINGS
export const updateNotificationSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const settings =
      await updateNotificationSettingsService(
        req.body,
        actor
      );

    return sendSuccess(
      res,
      "Notification settings updated successfully",
      settings
    );
  }
);
