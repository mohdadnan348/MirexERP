
import { Router } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import Employee from "../employees/employees.model";
import SalaryStructure from "./salary-structure.model";
import { Payroll } from "./payroll.model";

import {
  createPayroll,
  getPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  getEmployeePayrollHistory,
  getPayrollSummary,
  approvePayroll,
  finalizePayroll,
  generateMonthlyPayroll,
  markPayrollPaid,
} from "./payroll.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";

import {
  createPayrollSchema,
  updatePayrollSchema,
  getPayrollsSchema,
  payrollIdSchema,
  employeePayrollHistorySchema,
} from "./payroll.validation";

const router = Router();

// Authentication and school tenant protection
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Effective-dated salary structures preserve the rates used by historical payroll.
router.get("/salary-structures/:employeeId", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const { employeeId } = req.params, schoolId = req.user?.schoolId;
  if (!mongoose.isValidObjectId(employeeId) || !mongoose.isValidObjectId(schoolId)) throw new AppError("Invalid employee or school ID", 400);
  const employee = await Employee.findOne({ _id: employeeId, schoolId }).select("_id");
  if (!employee) throw new AppError("Employee not found", 404);
  const items = await SalaryStructure.find({ schoolId, employeeId }).sort({ effectiveFrom: -1 }).lean();
  res.json({ success: true, data: items });
}));
router.post("/salary-structures", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  const { employeeId, basicSalary, allowances = {}, deductions = {}, effectiveFrom, effectiveTo, paymentFrequency = "MONTHLY", statutorySettings = {} } = req.body || {};
  if (!mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(employeeId)) throw new AppError("Valid employee context is required", 400);
  const employee = await Employee.findOne({ _id: employeeId, schoolId, isActive: true }).select("_id");
  if (!employee) throw new AppError("Active employee not found", 404);
  const start = new Date(effectiveFrom);
  const end = effectiveTo ? new Date(effectiveTo) : null;
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end < start))) throw new AppError("Invalid salary effective date range", 400);
  const basic = Number(basicSalary);
  if (!Number.isFinite(basic) || basic < 0) throw new AppError("Basic salary must be a non-negative amount", 400);
  const normalize = (value: unknown, label: string) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError(`${label} must be an object`, 400);
    const output: Record<string, number> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const amount = Number(raw);
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !Number.isFinite(amount) || amount < 0) throw new AppError(`Invalid ${label} component`, 400);
      output[key] = Math.round(amount * 100) / 100;
    }
    return output;
  };
  const allowanceMap = normalize(allowances, "allowances"), deductionMap = normalize(deductions, "deductions");
  const overlap = await SalaryStructure.findOne({ schoolId, employeeId, status: "ACTIVE", effectiveFrom: { $lte: end || new Date("9999-12-31") }, $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }] }).select("_id effectiveFrom effectiveTo");
  if (overlap) throw new AppError("Salary structure overlaps an existing effective period. Close the previous period before adding another.", 409);
  const doc = await SalaryStructure.create({ schoolId, employeeId, basicSalary: basic, allowances: allowanceMap, deductions: deductionMap, effectiveFrom: start, effectiveTo: end, paymentFrequency, statutorySettings, createdBy: userId });
  res.status(201).json({ success: true, data: doc });
}));
router.patch("/salary-structures/:id", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const { id } = req.params, schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(schoolId) || !mongoose.isValidObjectId(userId)) throw new AppError("Invalid salary structure context", 400);
  const item = await SalaryStructure.findOne({ _id: id, schoolId, status: "ACTIVE" });
  if (!item) throw new AppError("Salary structure not found", 404);
  if (req.body?.effectiveTo !== undefined) {
    const date = req.body.effectiveTo ? new Date(req.body.effectiveTo) : null;
    if (date && (!Number.isFinite(date.getTime()) || date < item.effectiveFrom)) throw new AppError("Invalid effectiveTo date", 400);
    item.effectiveTo = date;
  }
  if (req.body?.status !== undefined) {
    if (!["ACTIVE","INACTIVE"].includes(req.body.status)) throw new AppError("Invalid salary structure status", 400);
    item.status = req.body.status;
  }
  item.updatedBy = new mongoose.Types.ObjectId(userId);
  await item.save();
  res.json({ success: true, data: item });
}));

router.post(
  "/runs/generate-monthly",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  generateMonthlyPayroll
);

// Create Payroll
router.post(
  "/",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ body: createPayrollSchema }),
  createPayroll
);

// Get All Payroll Records
router.get(
  "/",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ query: getPayrollsSchema }),
  getPayrolls
);

// PDF blueprint-compatible /runs resource aliases. Keep before /:id.
router.post(
  "/runs",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ body: createPayrollSchema }),
  createPayroll
);
router.get(
  "/runs",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ query: getPayrollsSchema }),
  getPayrolls
);
router.get(
  "/runs/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ params: payrollIdSchema }),
  getPayrollById
);

router.get("/reports/register.csv", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, month = Number(req.query.month), year = Number(req.query.year);
  if (!mongoose.isValidObjectId(schoolId) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Valid month and year are required", 400);
  const rows: any[] = await Payroll.find({ schoolId, payrollMonth: month, payrollYear: year, isActive: true }).populate("employeeId", "employeeId firstName lastName designation").sort({ employeeId: 1 }).lean() as any[];
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = ["Employee ID,Employee Name,Month,Year,Working Days,Present,Absent,Half Days,Gross Salary,Deductions,Net Salary,Status", ...rows.map((row) => [
    row.employeeId?.employeeId || row.employeeId?._id, `${row.employeeId?.firstName || ""} ${row.employeeId?.lastName || ""}`.trim(),
    month, year, row.workingDays, row.presentDays, row.absentDays, row.halfDayDays || 0, row.grossSalary, row.deductions?.total, row.netSalary, row.paymentStatus,
  ].map(quote).join(","))].join("\\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="payroll-register-${year}-${String(month).padStart(2,"0")}.csv"`);
  res.send(csv);
}));
router.get("/reports/bank-transfer.csv", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId, month = Number(req.query.month), year = Number(req.query.year);
  if (!mongoose.isValidObjectId(schoolId) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Valid month and year are required", 400);
  const rows: any[] = await Payroll.find({ schoolId, payrollMonth: month, payrollYear: year, paymentStatus: "FINALIZED", isActive: true }).populate("employeeId", "employeeId firstName lastName bankDetails").lean() as any[];
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = ["Employee ID,Employee Name,Amount,Payment Mode,Transaction Reference", ...rows.map((row) => [
    row.employeeId?.employeeId || row.employeeId?._id, `${row.employeeId?.firstName || ""} ${row.employeeId?.lastName || ""}`.trim(),
    row.netSalary, row.paymentMethod || "BANK_TRANSFER", row.transactionReference,
  ].map(quote).join(","))].join("\\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="payroll-bank-transfer-${year}-${String(month).padStart(2,"0")}.csv"`);
  res.send(csv);
}));

router.get(
  "/summary",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  getPayrollSummary
);
router.patch(
  "/:id/approve",
  authorize("SCHOOL_ADMIN", "PRINCIPAL"),
  validate({ params: payrollIdSchema }),
  approvePayroll
);
router.patch(
  "/:id/paid",
  authorize("SCHOOL_ADMIN", "ACCOUNTANT"),
  validate({ params: payrollIdSchema }),
  markPayrollPaid
);

router.patch(
  "/:id/finalize",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ params: payrollIdSchema }),
  finalizePayroll
);

// Employee Payroll History
router.get(
  "/employee/:employeeId/history",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ params: employeePayrollHistorySchema }),
  getEmployeePayrollHistory
);

// Get Payroll By ID
router.get("/:id/salary-slip.pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER"), asyncHandler(async (req, res) => {
  const { id } = req.params, schoolId = req.user?.schoolId, userId = req.user?.userId || req.user?.id;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(schoolId)) throw new AppError("Invalid payroll context", 400);
  const payroll: any = await Payroll.findOne({ _id: id, schoolId, isActive: true }).populate("employeeId").lean();
  if (!payroll) throw new AppError("Payroll record not found", 404);
  const employee: any = payroll.employeeId;
  if (String(req.user?.role).toUpperCase() === "TEACHER" && String(employee?.userId || "") !== String(userId)) throw new AppError("You can only download your own salary slip", 403);
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="salary-slip-${payroll.payrollYear}-${String(payroll.payrollMonth).padStart(2,"0")}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).text("SALARY SLIP", { align: "center" });
  doc.moveDown().fontSize(11).text(`Salary Period: ${payroll.payrollMonth}/${payroll.payrollYear}`);
  doc.text(`Employee: ${[employee?.firstName, employee?.lastName].filter(Boolean).join(" ")}`);
  doc.text(`Employee ID: ${employee?.employeeId || employee?._id || ""}`);
  doc.text(`Designation: ${employee?.designation || "—"}    Department: ${employee?.department || "—"}`);
  doc.moveDown().fontSize(13).text("Attendance");
  doc.fontSize(10).text(`Working days: ${payroll.workingDays} | Present: ${payroll.presentDays} | Absent: ${payroll.absentDays} | Half days: ${payroll.halfDayDays || 0}`);
  doc.text(`Paid leave: ${payroll.paidLeaveDays} | Unpaid leave: ${payroll.unpaidLeaveDays}`);
  doc.moveDown().fontSize(13).text("Earnings");
  doc.fontSize(10).text(`Basic salary: INR ${Number(payroll.basicSalary || 0).toFixed(2)}`);
  for (const [key, value] of Object.entries(payroll.allowances || {})) if (key !== "total") doc.text(`${key}: INR ${Number(value || 0).toFixed(2)}`);
  doc.text(`Gross salary: INR ${Number(payroll.grossSalary || 0).toFixed(2)}`);
  doc.moveDown().fontSize(13).text("Deductions");
  doc.fontSize(10);
  for (const [key, value] of Object.entries(payroll.deductions || {})) if (key !== "total") doc.text(`${key}: INR ${Number(value || 0).toFixed(2)}`);
  doc.text(`Total deductions: INR ${Number(payroll.deductions?.total || 0).toFixed(2)}`);
  doc.moveDown().fontSize(15).text(`Net salary: INR ${Number(payroll.netSalary || 0).toFixed(2)}`);
  doc.fontSize(10).text(`Payment status: ${payroll.paymentStatus}`);
  doc.text(`Payment date: ${payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString("en-IN") : "Not paid"}`);
  doc.moveDown(3).text("Authorized Signature: __________________________");
  doc.end();
}));

router.get(
  "/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({ params: payrollIdSchema }),
  getPayrollById
);

// Update Payroll
router.patch(
  "/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  validate({
    params: payrollIdSchema,
    body: updatePayrollSchema,
  }),
  updatePayroll
);

// Delete Payroll
router.delete(
  "/:id",
  authorize("SCHOOL_ADMIN", "ACCOUNTANT"),
  validate({ params: payrollIdSchema }),
  deletePayroll
);

export default router;
