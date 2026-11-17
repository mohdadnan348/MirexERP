
import { Router } from "express";
import { getReportCatalog, getReportsDashboard } from "./reports-advanced.controller";

import {
  getDashboardReport,
  getStudentReport,
  getAttendanceReport,
  getFeesReport,
  getEmployeeReport,
  getExamReport,
  getFinancialReport,
} from "./reports.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  reportFiltersSchema,
} from "./reports.validation";

const router = Router();

// Authentication and school tenant protection
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

router.get("/catalog", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), getReportCatalog);
router.get("/analytics-dashboard", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), getReportsDashboard);

// Dashboard Overview Report
router.get(
  "/dashboard",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  getDashboardReport
);

// Student Report
router.get(
  "/students",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ query: reportFiltersSchema }),
  getStudentReport
);

// Attendance Report
router.get(
  "/attendance",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ query: reportFiltersSchema }),
  getAttendanceReport
);

// Fees Collection Report
router.get(
  "/fees",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ query: reportFiltersSchema }),
  getFeesReport
);

// Employee Report
router.get(
  "/employees",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ query: reportFiltersSchema }),
  getEmployeeReport
);

// Examination Report
router.get(
  "/exams",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ query: reportFiltersSchema }),
  getExamReport
);

// Financial Report
router.get(
  "/financial",
  authorize("SCHOOL_ADMIN", "ACCOUNTANT"),
  validate({ query: reportFiltersSchema }),
  getFinancialReport
);

export default router;
