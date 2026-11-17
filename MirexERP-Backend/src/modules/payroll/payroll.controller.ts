
import { Request, Response } from "express";

import {
  createPayrollService,
  getPayrollsService,
  getPayrollByIdService,
  updatePayrollService,
  deletePayrollService,
  getEmployeePayrollHistoryService,
  approvePayrollService,
  finalizePayrollService,
  generateMonthlyPayrollService,
  markPayrollPaidService,
  getPayrollSummaryService,
} from "./payroll.service";

import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

interface PayrollActor {
  userId: string;
  schoolId: string;
  role: string;
}

const getActor = (req: Request): PayrollActor => {
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

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid payroll ID is required", 400);
  }

  return id;
};

// CREATE PAYROLL
export const createPayroll = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const payroll = await createPayrollService(
      req.body,
      actor
    );

    return sendCreated(
      res,
      "Payroll record created successfully",
      payroll
    );
  }
);

// GET ALL PAYROLL RECORDS
export const getPayrolls = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const result = await getPayrollsService(
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
        month:
          typeof req.query.month === "string"
            ? req.query.month
            : undefined,
        year:
          typeof req.query.year === "string"
            ? Number(req.query.year)
            : undefined,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
        employeeId:
          typeof req.query.employeeId === "string"
            ? req.query.employeeId
            : undefined,
      },
      actor
    );

    const totalPages = Math.ceil(
      result.total / result.limit
    );

    return sendPaginatedSuccess(
      res,
      "Payroll records fetched successfully",
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      }
    );
  }
);

// GET PAYROLL BY ID
export const getPayrollById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const payroll = await getPayrollByIdService(
      getId(req),
      actor
    );

    return sendSuccess(
      res,
      "Payroll details fetched successfully",
      payroll
    );
  }
);

// UPDATE PAYROLL
export const updatePayroll = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const payroll = await updatePayrollService(
      getId(req),
      req.body,
      actor
    );

    return sendSuccess(
      res,
      "Payroll updated successfully",
      payroll
    );
  }
);

// DELETE PAYROLL
export const deletePayroll = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deletePayrollService(getId(req), actor);

    return sendDeleted(res, "Payroll deleted successfully");
  }
);

// GET EMPLOYEE PAYROLL HISTORY
export const getEmployeePayrollHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const employeeId = req.params.employeeId;

    if (
      typeof employeeId !== "string" ||
      !employeeId.trim()
    ) {
      throw new AppError("Valid employee ID is required", 400);
    }

    const result = await getEmployeePayrollHistoryService(
      employeeId,
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      },
      actor
    );

    const totalPages = Math.ceil(
      result.total / result.limit
    );

    return sendPaginatedSuccess(
      res,
      "Employee payroll history fetched successfully",
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      }
    );
  }
);

// PHASE 6 — payroll summary, approval and payment actions.
export const getPayrollSummary = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const month = req.query.month === undefined ? undefined : Number(req.query.month);
  const year = req.query.year === undefined ? undefined : Number(req.query.year);
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new AppError("Invalid month", 400);
  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) throw new AppError("Invalid year", 400);
  return sendSuccess(res, "Payroll summary fetched successfully", await getPayrollSummaryService(month, year, actor));
});

export const approvePayroll = asyncHandler(async (req: Request, res: Response) => {
  const result = await approvePayrollService(getId(req), getActor(req));
  return sendSuccess(res, "Payroll approved successfully", result);
});

export const markPayrollPaid = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { paymentMethod: string; paymentDate?: string; transactionReference?: string };
  if (!body.paymentMethod) throw new AppError("Payment method is required", 400);
  const result = await markPayrollPaidService(getId(req), body, getActor(req));
  return sendSuccess(res, "Payroll payment recorded successfully", result);
});

// Generate one monthly payroll record per active employee using recorded attendance and effective salary data.
export const generateMonthlyPayroll = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  const month = Number(req.body?.month), year = Number(req.body?.year);
  const result = await generateMonthlyPayrollService(month, year, actor);
  return sendSuccess(res, "Monthly payroll generation completed", result);
});

export const finalizePayroll = asyncHandler(async (req: Request, res: Response) => {
  const result = await finalizePayrollService(getId(req), getActor(req));
  return sendSuccess(res, "Payroll finalized and locked", result);
});
