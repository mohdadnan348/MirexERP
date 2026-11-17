
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import {
  getDashboardOverviewService,
  getDashboardAttendanceService,
  getDashboardFeesService,
  getDashboardRecentActivitiesService,
  getSuperAdminOverviewService,
  getSuperAdminSchoolsStatisticsService,
  getSuperAdminRevenueStatisticsService,
  getSuperAdminRecentActivitiesService,
  getPrincipalOverviewService,
  getPrincipalAcademicStatisticsService,
  getPrincipalPendingApprovalsService,
  getAccountantOverviewService,
  getAccountantCollectionStatisticsService,
  getAccountantRecentTransactionsService,
  getReceptionistOverviewService,
  getReceptionistPendingApplicationsService,
  getLibrarianOverviewService,
  getLibrarianOverdueBooksService,
  getTransportOverviewService,
  getTransportStudentStatisticsService,
  getTransportAlertsService
} from "./dashboard.service";

const getSchoolId = (req: Request): string => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    throw new AppError("School context is required", 400);
  }

  return schoolId;
};

export const getDashboardOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = getSchoolId(req);

    const data = await getDashboardOverviewService(schoolId);

    return sendSuccess(
      res,
      "Dashboard overview fetched successfully",
      data
    );
  }
);

export const getDashboardAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = getSchoolId(req);

    const data = await getDashboardAttendanceService(
      schoolId,
      req.query
    );

    return sendSuccess(
      res,
      "Dashboard attendance fetched successfully",
      data
    );
  }
);

export const getDashboardFees = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = getSchoolId(req);

    const data = await getDashboardFeesService(
      schoolId,
      req.query
    );

    return sendSuccess(
      res,
      "Dashboard fees summary fetched successfully",
      data
    );
  }
);

export const getDashboardRecentActivities = asyncHandler(
  async (req: Request, res: Response) => {
    const schoolId = getSchoolId(req);

    const data = await getDashboardRecentActivitiesService(
      schoolId,
      req.query
    );

    return sendSuccess(
      res,
      "Recent activities fetched successfully",
      data
    );
  }
);

const sendDashboard = (label: string, service: (...args: any[]) => Promise<any>, needsSchool = true, needsQuery = false) =>
  asyncHandler(async (req: Request, res: Response) => {
    const data = needsSchool
      ? await service(getSchoolId(req), ...(needsQuery ? [req.query] : []))
      : await service(...(needsQuery ? [req.query] : []));
    return sendSuccess(res, `${label} fetched successfully`, data);
  });

export const getSuperAdminOverview = sendDashboard("Platform overview", getSuperAdminOverviewService, false);
export const getSuperAdminSchoolsStatistics = sendDashboard("Platform school statistics", getSuperAdminSchoolsStatisticsService, false);
export const getSuperAdminRevenueStatistics = sendDashboard("Platform revenue statistics", getSuperAdminRevenueStatisticsService, false);
export const getSuperAdminRecentActivities = sendDashboard("Platform recent activities", getSuperAdminRecentActivitiesService, false, true);
export const getPrincipalOverview = sendDashboard("Principal overview", getPrincipalOverviewService);
export const getPrincipalAcademicStatistics = sendDashboard("Academic statistics", getPrincipalAcademicStatisticsService);
export const getPrincipalPendingApprovals = sendDashboard("Pending approvals", getPrincipalPendingApprovalsService);
export const getAccountantOverview = sendDashboard("Accountant overview", getAccountantOverviewService);
export const getAccountantCollectionStatistics = sendDashboard("Collection statistics", getAccountantCollectionStatisticsService);
export const getAccountantRecentTransactions = sendDashboard("Recent transactions", getAccountantRecentTransactionsService, true, true);
export const getReceptionistOverview = sendDashboard("Receptionist overview", getReceptionistOverviewService);
export const getReceptionistPendingApplications = sendDashboard("Pending applications", getReceptionistPendingApplicationsService, true, true);
export const getLibrarianOverview = sendDashboard("Librarian overview", getLibrarianOverviewService);
export const getLibrarianOverdueBooks = sendDashboard("Overdue books", getLibrarianOverdueBooksService, true, true);
export const getTransportOverview = sendDashboard("Transport overview", getTransportOverviewService);
export const getTransportStudentStatistics = sendDashboard("Transport student statistics", getTransportStudentStatisticsService);
export const getTransportAlerts = sendDashboard("Transport alerts", getTransportAlertsService);
