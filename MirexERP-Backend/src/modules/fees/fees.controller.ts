
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import School from "../schools/schools.model";
import { sendFeeInvoicePdf, sendFeeReceiptPdf } from "./fees.pdf";
import { createRazorpayFeeOrderService, getRazorpayConfigurationStatus, verifyRazorpayFeePaymentService } from "./payment-gateway.service";

import {
  sendSuccess,
  sendCreated,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  getFeeDashboardService,
  createFeeHeadService,
  getFeeHeadsService,
  updateFeeHeadService,
  deleteFeeHeadService,
  createFeeStructureService,
  getFeeStructuresService,
  getFeeStructureByIdService,
  updateFeeStructureService,
  deleteFeeStructureService,
  assignStudentFeeService,
  getFeeAssignmentsService,
  getStudentFeesService,
  generateFeeInvoiceService,
  generateExamFeeInvoicesService,
  getExamFeeStatusService,
  getFeeInvoicesService,
  getFeeInvoiceByIdService,
  updateFeeInvoiceService,
  cancelFeeInvoiceService,
  collectFeePaymentService,
  getFeePaymentsService,
  getFeePaymentByIdService,
  createFeeDiscountService,
  getFeeDiscountsService,
  approveFeeDiscountService,
  rejectFeeDiscountService,
  createFeeRefundService,
  getFeeRefundsService,
  approveFeeRefundService,
  rejectFeeRefundService,
  processFeeRefundService,
  getStudentFeeSummaryService,
  getFeeCollectionReportService,
  getOutstandingFeesReportService,
  applyLateFinesService,
} from "./fees.service";

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

interface FeeActor {
  userId: string;
  schoolId: string;
}

const getActor = (req: Request): FeeActor => {
  if (!req.user?.userId || !req.user.schoolId) {
    throw new AppError("Authenticated school user is required", 401);
  }

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid ID is required", 400);
  }

  return id;
};

const getStudentId = (req: Request): string => {
  const studentId = req.params.studentId;

  if (typeof studentId !== "string" || !studentId.trim()) {
    throw new AppError("Valid student ID is required", 400);
  }

  return studentId;
};

const getBody = <T>(req: Request): T => req.body as T;

const getQuery = <T>(req: Request): T =>
  req.query as unknown as T;

// --------------------------------------------------
// 1. FEE DASHBOARD
// --------------------------------------------------

export const getFeeDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeDashboardService(getActor(req));

    sendSuccess(res, "Fee dashboard fetched successfully", result);
  }
);

// --------------------------------------------------
// 2. FEE HEADS
// --------------------------------------------------

export const createFeeHead = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createFeeHeadService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee head created successfully", result);
  }
);

export const getFeeHeads = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeHeadsService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee heads fetched successfully", result);
  }
);

export const updateFeeHead = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await updateFeeHeadService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    sendSuccess(res, "Fee head updated successfully", result);
  }
);

export const deleteFeeHead = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteFeeHeadService(getId(req), getActor(req));

    sendDeleted(res, "Fee head deleted successfully");
  }
);

// --------------------------------------------------
// 3. FEE STRUCTURES
// --------------------------------------------------

export const createFeeStructure = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createFeeStructureService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee structure created successfully", result);
  }
);

export const getFeeStructures = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeStructuresService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee structures fetched successfully", result);
  }
);

export const getFeeStructureById = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeStructureByIdService(
      getId(req),
      getActor(req)
    );

    sendSuccess(res, "Fee structure fetched successfully", result);
  }
);

export const updateFeeStructure = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await updateFeeStructureService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    sendSuccess(res, "Fee structure updated successfully", result);
  }
);

export const deleteFeeStructure = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteFeeStructureService(getId(req), getActor(req));

    sendDeleted(res, "Fee structure deleted successfully");
  }
);

// --------------------------------------------------
// 4. STUDENT FEE ASSIGNMENTS
// --------------------------------------------------

export const assignStudentFee = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await assignStudentFeeService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee assigned to student successfully", result);
  }
);

export const getFeeAssignments = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeAssignmentsService(getQuery<Record<string, any>>(req), getActor(req));
    return sendSuccess(res, "Student fee assignments fetched successfully", result);
  }
);

export const getStudentFees = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getStudentFeesService(
      getStudentId(req),
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Student fees fetched successfully", result);
  }
);

// --------------------------------------------------
// 5. FEE INVOICES
// --------------------------------------------------

export const generateFeeInvoice = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await generateFeeInvoiceService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee invoice generated successfully", result);
  }
);

export const getFeeInvoices = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeInvoicesService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee invoices fetched successfully", result);
  }
);

export const getFeeInvoiceById = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeInvoiceByIdService(
      getId(req),
      getActor(req)
    );

    sendSuccess(res, "Fee invoice fetched successfully", result);
  }
);

export const updateFeeInvoice = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await updateFeeInvoiceService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    sendSuccess(res, "Fee invoice updated successfully", result);
  }
);

export const cancelFeeInvoice = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await cancelFeeInvoiceService(
      getId(req),
      getActor(req)
    );

    sendSuccess(res, "Fee invoice cancelled successfully", result);
  }
);

// --------------------------------------------------
// 6. FEE PAYMENTS
// --------------------------------------------------

export const collectFeePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await collectFeePaymentService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee payment collected successfully", result);
  }
);

export const getFeePayments = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeePaymentsService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee payments fetched successfully", result);
  }
);

export const getFeePaymentById = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeePaymentByIdService(
      getId(req),
      getActor(req)
    );

    sendSuccess(res, "Fee payment fetched successfully", result);
  }
);

// --------------------------------------------------
// 7. FEE DISCOUNTS
// --------------------------------------------------

export const createFeeDiscount = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createFeeDiscountService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee discount created successfully", result);
  }
);

export const getFeeDiscounts = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeDiscountsService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee discounts fetched successfully", result);
  }
);

export const approveFeeDiscount = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await approveFeeDiscountService(
      getId(req),
      getActor(req)
    );

    sendSuccess(res, "Fee discount approved successfully", result);
  }
);

export const rejectFeeDiscount = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await rejectFeeDiscountService(
      getId(req),
      getActor(req),
      getBody<{ remarks?: string }>(req)
    );

    sendSuccess(res, "Fee discount rejected successfully", result);
  }
);

// --------------------------------------------------
// 8. FEE REFUNDS
// --------------------------------------------------

export const createFeeRefund = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createFeeRefundService(
      getBody(req),
      getActor(req)
    );

    sendCreated(res, "Fee refund request created successfully", result);
  }
);

export const getFeeRefunds = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeRefundsService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee refunds fetched successfully", result);
  }
);

export const approveFeeRefund = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await approveFeeRefundService(
      getId(req),
      getActor(req),
      getBody<{ remarks?: string }>(req)
    );

    sendSuccess(res, "Fee refund approved successfully", result);
  }
);

export const rejectFeeRefund = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await rejectFeeRefundService(
      getId(req),
      getActor(req),
      getBody<{ remarks: string }>(req)
    );

    sendSuccess(res, "Fee refund rejected successfully", result);
  }
);

export const processFeeRefund = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await processFeeRefundService(
      getId(req),
      getActor(req),
      getBody(req)
    );

    sendSuccess(res, "Fee refund processed successfully", result);
  }
);

// --------------------------------------------------
// 9. STUDENT FEE SUMMARY
// --------------------------------------------------

export const getStudentFeeSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getStudentFeeSummaryService(
      getStudentId(req),
      getActor(req)
    );

    sendSuccess(res, "Student fee summary fetched successfully", result);
  }
);

// --------------------------------------------------
// 10. FEE REPORTS
// --------------------------------------------------

export const getFeeCollectionReport = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFeeCollectionReportService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Fee collection report fetched successfully", result);
  }
);

export const getOutstandingFeesReport = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getOutstandingFeesReportService(
      getQuery(req),
      getActor(req)
    );

    sendSuccess(res, "Outstanding fees report fetched successfully", result);
  }
);


/**
 * Download a school-branded fee invoice PDF.
 */
export const downloadFeeInvoicePdf = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const invoice = await getFeeInvoiceByIdService(getId(req), actor);
    const school = await School.findById(actor.schoolId).lean();
    if (!school) throw new AppError("School profile not found", 404);
    return sendFeeInvoicePdf(res, school as unknown as Record<string, unknown>, invoice as unknown as Record<string, unknown>);
  }
);

/**
 * Download a school-branded payment receipt PDF.
 */
export const downloadFeeReceiptPdf = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const payment = await getFeePaymentByIdService(getId(req), actor);
    if (payment.paymentStatus !== "SUCCESS") {
      throw new AppError("Only successful payments have a receipt", 409);
    }
    const school = await School.findById(actor.schoolId).lean();
    if (!school) throw new AppError("School profile not found", 404);
    return sendFeeReceiptPdf(res, school as unknown as Record<string, unknown>, payment as unknown as Record<string, unknown>);
  }
);


export const applyLateFines = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await applyLateFinesService(getActor(req));
    return sendSuccess(res, "Late fines applied to eligible overdue invoices", result);
  }
);


export const getFeePaymentGatewayStatus = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, "Payment gateway configuration status fetched", getRazorpayConfigurationStatus());
});

export const createFeePaymentGatewayOrder = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const body = getBody<{ invoiceId: string; amount?: number }>(req);
  const result = await createRazorpayFeeOrderService(body.invoiceId, body.amount, actor);
  return sendCreated(res, "Razorpay order created successfully", result);
});

export const verifyFeePaymentGatewayPayment = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const body = getBody<{ invoiceId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }>(req);
  const result = await verifyRazorpayFeePaymentService(body, actor);
  return sendSuccess(res, "Online fee payment verified and recorded", result);
});

export const generateExamFeeInvoices = asyncHandler(async (req: Request, res: Response) => {
  const result = await generateExamFeeInvoicesService({ ...req.body, examId: req.params.examId }, getActor(req));
  return sendCreated(res, "Examination fee invoices generated", result);
});

export const getExamFeeStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await getExamFeeStatusService(req.params.examId, getActor(req));
  return sendSuccess(res, "Examination fee status fetched successfully", result);
});
