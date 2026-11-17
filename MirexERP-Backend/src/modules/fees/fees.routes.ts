
import { Router } from "express";

import {
  getFeeDashboard,
  createFeeHead,
  getFeeHeads,
  updateFeeHead,
  deleteFeeHead,
  createFeeStructure,
  getFeeStructures,
  getFeeStructureById,
  updateFeeStructure,
  deleteFeeStructure,
  assignStudentFee,
  getFeeAssignments,
  getStudentFees,
  generateFeeInvoice,
  generateExamFeeInvoices,
  getExamFeeStatus,
  getFeeInvoices,
  getFeeInvoiceById,
  updateFeeInvoice,
  cancelFeeInvoice,
  collectFeePayment,
  getFeePayments,
  getFeePaymentById,
  createFeeDiscount,
  getFeeDiscounts,
  approveFeeDiscount,
  rejectFeeDiscount,
  createFeeRefund,
  getFeeRefunds,
  approveFeeRefund,
  rejectFeeRefund,
  processFeeRefund,
  getStudentFeeSummary,
  getFeeCollectionReport,
  getOutstandingFeesReport,
  downloadFeeInvoicePdf,
  downloadFeeReceiptPdf,
  applyLateFines,
  getFeePaymentGatewayStatus,
  createFeePaymentGatewayOrder,
  verifyFeePaymentGatewayPayment,
} from "./fees.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import {
  tenantContext,
  requireTenant,
} from "../../middleware/tenantContext";

import { USER_ROLES } from "../../config/constants";
import { validate } from "../../middleware/validate";
import {
  createFeeHeadSchema, updateFeeHeadSchema, feeHeadIdParamSchema, feeHeadListQuerySchema,
  createFeeStructureSchema, updateFeeStructureSchema, feeStructureIdParamSchema, feeStructureListQuerySchema,
  assignStudentFeeSchema, feeAssignmentListQuerySchema, studentFeeParamsSchema, studentFeeQuerySchema,
  generateFeeInvoiceSchema, updateFeeInvoiceSchema, feeInvoiceIdParamSchema, feeInvoiceListQuerySchema,
  collectFeePaymentSchema, feePaymentIdParamSchema, feePaymentListQuerySchema,
  createFeeDiscountSchema, feeDiscountIdParamSchema, feeDiscountListQuerySchema, reviewFeeDiscountSchema,
  createFeeRefundSchema, feeRefundIdParamSchema, feeRefundListQuerySchema, reviewFeeRefundSchema, rejectFeeRefundSchema, processFeeRefundSchema,
  feeReportQuerySchema, feeDashboardQuerySchema,
  createGatewayOrderSchema, verifyGatewayPaymentSchema, createExamFeeInvoicesSchema,
} from "./fees.validation";

const router = Router();

// Authentication and tenant security.
router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// Role groups.
const feeManagers = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL
);

const feeStaff = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ACCOUNTANT
);

const feeViewers = authorize(
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ACCOUNTANT,
  USER_ROLES.RECEPTIONIST
);

// Dashboard.
router.get(
  "/dashboard",
  feeViewers,
  validate({ query: feeDashboardQuerySchema }),
  getFeeDashboard
);

// Fee heads.
router.post(
  "/heads",
  feeManagers,
  validate({ body: createFeeHeadSchema }),
  createFeeHead
);

router.get(
  "/heads",
  feeViewers,
  validate({ query: feeHeadListQuerySchema }),
  getFeeHeads
);

router.patch(
  "/heads/:id",
  feeManagers,
  validate({ params: feeHeadIdParamSchema, body: updateFeeHeadSchema }),
  updateFeeHead
);

router.delete(
  "/heads/:id",
  feeManagers,
  validate({ params: feeHeadIdParamSchema }),
  deleteFeeHead
);

// Fee structures.
router.post(
  "/structures",
  feeManagers,
  validate({ body: createFeeStructureSchema }),
  createFeeStructure
);

router.get(
  "/structures",
  feeViewers,
  validate({ query: feeStructureListQuerySchema }),
  getFeeStructures
);

router.get(
  "/structures/:id",
  feeViewers,
  validate({ params: feeStructureIdParamSchema }),
  getFeeStructureById
);

router.patch(
  "/structures/:id",
  feeStaff,
  validate({ params: feeStructureIdParamSchema, body: updateFeeStructureSchema }),
  updateFeeStructure
);

router.delete(
  "/structures/:id",
  feeManagers,
  validate({ params: feeStructureIdParamSchema }),
  deleteFeeStructure
);

// Student fee assignment.
router.post(
  "/assignments",
  feeManagers,
  validate({ body: assignStudentFeeSchema }),
  assignStudentFee
);

router.get(
  "/assignments",
  feeViewers,
  validate({ query: feeAssignmentListQuerySchema }),
  getFeeAssignments
);

router.get(
  "/students/:studentId",
  feeViewers,
  validate({ params: studentFeeParamsSchema, query: studentFeeQuerySchema }),
  getStudentFees
);

router.get(
  "/students/:studentId/summary",
  feeViewers,
  validate({ params: studentFeeParamsSchema }),
  getStudentFeeSummary
);

// Apply configured late fines to overdue invoices (bounded batch).
router.post("/invoices/apply-late-fines", feeManagers, applyLateFines);

router.post("/exams/:examId/invoices", feeManagers, validate(createExamFeeInvoicesSchema), generateExamFeeInvoices);
router.get("/exams/:examId/status", feeViewers, getExamFeeStatus);

// Fee invoices and downloadable PDF.
router.get(
  "/invoices/:id/pdf",
  feeViewers,
  validate({ params: feeInvoiceIdParamSchema }),
  downloadFeeInvoicePdf
);

// Fee invoices.
router.post(
  "/invoices",
  feeStaff,
  validate({ body: generateFeeInvoiceSchema }),
  generateFeeInvoice
);

router.get(
  "/invoices",
  feeViewers,
  validate({ query: feeInvoiceListQuerySchema }),
  getFeeInvoices
);

router.get(
  "/invoices/:id",
  feeViewers,
  validate({ params: feeInvoiceIdParamSchema }),
  getFeeInvoiceById
);

router.patch(
  "/invoices/:id",
  feeManagers,
  validate({ params: feeInvoiceIdParamSchema, body: updateFeeInvoiceSchema }),
  updateFeeInvoice
);

router.patch(
  "/invoices/:id/cancel",
  feeManagers,
  validate({ params: feeInvoiceIdParamSchema }),
  cancelFeeInvoice
);

// Razorpay order creation and signature-verified payment confirmation.
router.get("/gateway/status", feeViewers, getFeePaymentGatewayStatus);
router.post("/gateway/orders", feeStaff, validate(createGatewayOrderSchema), createFeePaymentGatewayOrder);
router.post("/gateway/verify", feeStaff, validate(verifyGatewayPaymentSchema), verifyFeePaymentGatewayPayment);

// Payment receipt PDF.
router.get(
  "/payments/:id/receipt.pdf",
  feeViewers,
  validate({ params: feePaymentIdParamSchema }),
  downloadFeeReceiptPdf
);

// Fee payments.
router.post(
  "/payments",
  feeStaff,
  validate({ body: collectFeePaymentSchema }),
  collectFeePayment
);

router.get(
  "/payments",
  feeViewers,
  validate({ query: feePaymentListQuerySchema }),
  getFeePayments
);

router.get(
  "/payments/:id",
  feeViewers,
  validate({ params: feePaymentIdParamSchema }),
  getFeePaymentById
);

// Fee discounts.
router.post(
  "/discounts",
  feeStaff,
  validate({ body: createFeeDiscountSchema }),
  createFeeDiscount
);

router.get(
  "/discounts",
  feeViewers,
  validate({ query: feeDiscountListQuerySchema }),
  getFeeDiscounts
);

router.patch(
  "/discounts/:id/approve",
  feeManagers,
  validate({ params: feeDiscountIdParamSchema, body: reviewFeeDiscountSchema }),
  approveFeeDiscount
);

router.patch(
  "/discounts/:id/reject",
  feeManagers,
  validate({ params: feeDiscountIdParamSchema, body: reviewFeeDiscountSchema }),
  rejectFeeDiscount
);

// Fee refunds.
router.post(
  "/refunds",
  feeStaff,
  validate({ body: createFeeRefundSchema }),
  createFeeRefund
);

router.get(
  "/refunds",
  feeViewers,
  validate({ query: feeRefundListQuerySchema }),
  getFeeRefunds
);

router.patch(
  "/refunds/:id/approve",
  feeManagers,
  validate({ params: feeRefundIdParamSchema, body: reviewFeeRefundSchema }),
  approveFeeRefund
);

router.patch(
  "/refunds/:id/reject",
  feeManagers,
  validate({ params: feeRefundIdParamSchema, body: rejectFeeRefundSchema }),
  rejectFeeRefund
);

router.patch(
  "/refunds/:id/process",
  feeManagers,
  validate({ params: feeRefundIdParamSchema, body: processFeeRefundSchema }),
  processFeeRefund
);

// Reports.
router.get(
  "/reports/collection",
  feeViewers,
  validate({ query: feeReportQuerySchema }),
  getFeeCollectionReport
);

router.get(
  "/reports/outstanding",
  feeViewers,
  validate({ query: feeReportQuerySchema }),
  getOutstandingFeesReport
);

export default router;
