import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/authenticate";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { USER_ROLES } from "../../config/constants";
import { validate } from "../../middleware/validate";
import {
  getDashboardOverview, getDashboardAttendance, getDashboardFees, getDashboardRecentActivities,
  getSuperAdminOverview, getSuperAdminSchoolsStatistics, getSuperAdminRevenueStatistics, getSuperAdminRecentActivities,
  getPrincipalOverview, getPrincipalAcademicStatistics, getPrincipalPendingApprovals,
  getAccountantOverview, getAccountantCollectionStatistics, getAccountantRecentTransactions,
  getReceptionistOverview, getReceptionistPendingApplications,
  getLibrarianOverview, getLibrarianOverdueBooks,
  getTransportOverview, getTransportStudentStatistics, getTransportAlerts,
} from "./dashboard.controller";
import { dashboardAttendanceSchema, dashboardFeesSchema, dashboardActivitiesSchema } from "./dashboard.validation";

const router = Router();
const allowRoles = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(String(req.user.role))) {
    res.status(403).json({ success: false, message: "You do not have permission to access this dashboard." });
    return;
  }
  next();
};

router.use(authenticate);
router.use(tenantContext);

// Platform endpoints deliberately run before requireTenant: Super Admin has no schoolId.
router.get("/super-admin/overview", allowRoles(USER_ROLES.SUPER_ADMIN), getSuperAdminOverview);
router.get("/super-admin/schools-statistics", allowRoles(USER_ROLES.SUPER_ADMIN), getSuperAdminSchoolsStatistics);
router.get("/super-admin/revenue-statistics", allowRoles(USER_ROLES.SUPER_ADMIN), getSuperAdminRevenueStatistics);
router.get("/super-admin/recent-activities", allowRoles(USER_ROLES.SUPER_ADMIN), getSuperAdminRecentActivities);

router.use(requireTenant);

// Existing school dashboard endpoints retained for backward compatibility.
router.get("/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), getDashboardOverview);
router.get("/attendance", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate(dashboardAttendanceSchema), getDashboardAttendance);
router.get("/fees", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.ACCOUNTANT), validate(dashboardFeesSchema), getDashboardFees);
router.get("/activities", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), validate(dashboardActivitiesSchema), getDashboardRecentActivities);

// Principal dashboard
router.get("/principal/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), getPrincipalOverview);
router.get("/principal/academic-statistics", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), getPrincipalAcademicStatistics);
router.get("/principal/pending-approvals", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PRINCIPAL), getPrincipalPendingApprovals);

// Accountant dashboard
router.get("/accountant/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.ACCOUNTANT), getAccountantOverview);
router.get("/accountant/collection-statistics", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.ACCOUNTANT), getAccountantCollectionStatistics);
router.get("/accountant/recent-transactions", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.ACCOUNTANT), getAccountantRecentTransactions);

// Receptionist dashboard
router.get("/receptionist/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.RECEPTIONIST), getReceptionistOverview);
router.get("/receptionist/pending-applications", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.RECEPTIONIST), getReceptionistPendingApplications);

// Librarian dashboard
router.get("/librarian/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.LIBRARIAN), getLibrarianOverview);
router.get("/librarian/overdue-books", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.LIBRARIAN), getLibrarianOverdueBooks);

// Transport manager dashboard
router.get("/transport/overview", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.TRANSPORT_MANAGER), getTransportOverview);
router.get("/transport/student-statistics", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.TRANSPORT_MANAGER), getTransportStudentStatistics);
router.get("/transport/alerts", allowRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.TRANSPORT_MANAGER), getTransportAlerts);

export default router;
