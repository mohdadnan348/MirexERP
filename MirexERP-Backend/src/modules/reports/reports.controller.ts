
import { Request, Response } from "express";

import {
  getDashboardReportService,
  getStudentReportService,
  getAttendanceReportService,
  getFeesReportService,
  getEmployeeReportService,
  getExamReportService,
  getFinancialReportService,
} from "./reports.service";

import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";

import { sendSuccess } from "../../utils/apiResponse";

interface ReportActor {
  userId: string;
  schoolId: string;
  role: string;
}

const getActor = (req: Request): ReportActor => {
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

const getReportFilters = (req: Request) => {
  const filters: Record<string, unknown> = {};

  if (typeof req.query.startDate === "string") {
    filters.startDate = req.query.startDate;
  }

  if (typeof req.query.endDate === "string") {
    filters.endDate = req.query.endDate;
  }

  if (typeof req.query.sessionId === "string") {
    filters.sessionId = req.query.sessionId;
  }

  if (typeof req.query.classId === "string") {
    filters.classId = req.query.classId;
  }

  if (typeof req.query.sectionId === "string") {
    filters.sectionId = req.query.sectionId;
  }

  if (typeof req.query.month === "string") {
    filters.month = Number(req.query.month);
  }

  if (typeof req.query.year === "string") {
    filters.year = Number(req.query.year);
  }

  return filters;
};

// DASHBOARD REPORT
export const getDashboardReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const report = await getDashboardReportService(actor);

    return sendSuccess(
      res,
      "Dashboard report generated successfully",
      report
    );
  }
);

// STUDENT REPORT
export const getStudentReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getStudentReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Student report generated successfully",
      report
    );
  }
);

// ATTENDANCE REPORT
export const getAttendanceReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getAttendanceReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Attendance report generated successfully",
      report
    );
  }
);

// FEES REPORT
export const getFeesReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getFeesReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Fees report generated successfully",
      report
    );
  }
);

// EMPLOYEE REPORT
export const getEmployeeReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getEmployeeReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Employee report generated successfully",
      report
    );
  }
);

// EXAMINATION REPORT
export const getExamReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getExamReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Examination report generated successfully",
      report
    );
  }
);

// FINANCIAL REPORT
export const getFinancialReport = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const filters = getReportFilters(req);

    const report = await getFinancialReportService(
      filters,
      actor
    );

    return sendSuccess(
      res,
      "Financial report generated successfully",
      report
    );
  }
);
