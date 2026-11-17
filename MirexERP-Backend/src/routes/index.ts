
import { Router } from "express";

import admissionsRoutes from "../modules/admissions/admissions.routes";
import admissionsExtendedRoutes from "../modules/admissions/admissions-extended.routes";
import attendanceRoutes from "../modules/attendance/attendance.routes";
import authRoutes from "../modules/auth/auth.routes";
import certificatesRoutes from "../modules/certificates/certificates.routes";
import classesRoutes from "../modules/classes/classes.routes";
import classSectionOperationsRoutes from "../modules/class-section/class-section-operations.routes";
import communicationRoutes from "../modules/communication/communication.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import employeesRoutes from "../modules/employees/employees.routes";
import eventsRoutes from "../modules/events/events.routes";
import examsRoutes from "../modules/exams/exams.routes";
import feesRoutes from "../modules/fees/fees.routes";
import paymentWebhookRoutes from "../modules/fees/payment-webhook.routes";
import financeRoutes from "../modules/finance/finance.routes";
import healthRoutes from "../modules/health/health.routes";
import holidaysRoutes from "../modules/holidays/holidays.routes";
import leavesRoutes from "../modules/leaves/leaves.routes";
import homeworkRoutes from "../modules/homework/homework.routes";
import inventoryRoutes from "../modules/inventory/inventory.routes";
import inventoryOperationsRoutes from "../modules/inventory/inventory-operations.routes";
import libraryRoutes from "../modules/library/library.routes";
import libraryOperationsRoutes from "../modules/library/library-operations.routes";
import parentsRoutes from "../modules/parents/parents.routes";
import payrollRoutes from "../modules/payroll/payroll.routes";
import platformRoutes from "../modules/platform/platform.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import schoolsRoutes from "../modules/schools/schools.routes";
import schoolManagementRoutes from "../modules/school-management/school-management.routes";
import sectionsRoutes from "../modules/sections/sections.routes";
import sessionsRoutes from "../modules/sessions/sessions.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import studentPortalRoutes from "../modules/student-portal/student-portal.routes";
import studentsRoutes from "../modules/students/students.routes";
import studentManagementRoutes from "../modules/students/students-management.routes";
import subjectsRoutes from "../modules/subjects/subjects.routes";
import subjectsAdvancedRoutes from "../modules/subjects/subjects-advanced.routes";
import subscriptionsRoutes from "../modules/subscriptions/subscriptions.routes";
import studentBillingRoutes from "../modules/subscriptions/student-billing.routes";
import timetableRoutes from "../modules/timetable/timetable.routes";
import transportRoutes from "../modules/transport/transport.routes";
import transportOperationsRoutes from "../modules/transport/transport-operations.routes";
import requirementsRoutes from "../modules/requirements.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/holidays", holidaysRoutes);
router.use("/leaves", leavesRoutes);
router.use("/auth", authRoutes);
router.use("/schools", schoolsRoutes);
router.use("/school-management", schoolManagementRoutes);
router.use("/sessions", sessionsRoutes);
router.use("/subscriptions", studentBillingRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/platform", platformRoutes);

router.use("/admissions", admissionsExtendedRoutes);
router.use("/admissions", admissionsRoutes);
router.use("/students", studentManagementRoutes);
router.use("/students", studentsRoutes);
router.use("/parents", parentsRoutes);
router.use("/classes", classesRoutes);
router.use("/class-section", classSectionOperationsRoutes);
router.use("/sections", sectionsRoutes);
router.use("/subjects", subjectsAdvancedRoutes);
router.use("/subjects", subjectsRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/employees", employeesRoutes);

router.use("/exams", examsRoutes);
router.use("/homework", homeworkRoutes);
router.use("/timetable", timetableRoutes);
router.use("/certificates", certificatesRoutes);

router.use("/webhooks", paymentWebhookRoutes);
router.use("/fees", feesRoutes);
router.use("/finance", financeRoutes);
router.use("/payroll", payrollRoutes);

router.use("/library", libraryOperationsRoutes);
router.use("/library", libraryRoutes);
router.use("/inventory", inventoryOperationsRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/transport", transportOperationsRoutes);
router.use("/transport", transportRoutes);

router.use("/communication", communicationRoutes);
router.use("/communications", communicationRoutes);
router.use("/announcements", communicationRoutes);
router.use("/events", eventsRoutes);

router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);
router.use("/settings", settingsRoutes);

router.use("/student-portal", studentPortalRoutes);

// Additional PDF-blueprint endpoints implemented against the existing Mongoose models.
router.use(requirementsRoutes);

export default router;

export const apiRouter = router;
