import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { Report } from "./reports.model";
import { REPORT_CATALOG } from "./reports.catalog";
import { getDashboardReportService } from "./reports.service";

const actor = (req: Request) => {
  if (!req.user?.schoolId) throw new AppError("School context is required", 400);
  return { userId: String(req.user._id || req.user.id), schoolId: String(req.user.schoolId), role: req.user.role };
};
export const getReportCatalog = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req); const permissions = (req.user as any)?.permissions || [];
  const visible = REPORT_CATALOG.filter((r) => a.role === "SUPER_ADMIN" || !permissions.length || permissions.includes("*") || permissions.includes(`${r.module.toLowerCase()}.*`) || permissions.includes(r.key) || ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(a.role));
  return sendSuccess(res, "Available report catalog fetched", { totalAvailable: visible.length, reports: visible, note: "Only report families backed by existing database services are listed. Unsupported reports are not shown as fake placeholders." });
});
export const getReportsDashboard = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req); const today = new Date(); today.setHours(0,0,0,0); const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const [generatedToday, generatedThisMonth, recentExports, failedExports, mostUsed, schoolSummary] = await Promise.all([
    Report.countDocuments({ schoolId: a.schoolId, createdAt: { $gte: today } }),
    Report.countDocuments({ schoolId: a.schoolId, createdAt: { $gte: month } }),
    Report.find({ schoolId: a.schoolId }).sort({ createdAt: -1 }).limit(8).select("reportType format status title recordCount createdAt completedAt fileName errorMessage").lean(),
    Report.countDocuments({ schoolId: a.schoolId, status: "FAILED" }),
    Report.aggregate([{ $match: { schoolId: new Types.ObjectId(a.schoolId) } }, { $group: { _id: "$reportType", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    getDashboardReportService(a),
  ]);
  return sendSuccess(res, "Reports dashboard fetched", { totalAvailableReports: REPORT_CATALOG.length, generatedToday, generatedThisMonth, recentExports, failedExports, mostUsed, schoolSummary, scheduledReports: { supported: false, count: 0 } });
});
