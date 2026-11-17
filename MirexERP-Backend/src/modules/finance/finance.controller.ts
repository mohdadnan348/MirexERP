
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  getFinanceDashboardService,
  createFinanceCategoryService,
  getFinanceCategoriesService,
  updateFinanceCategoryService,
  deleteFinanceCategoryService,
  createIncomeService,
  getIncomeRecordsService,
  getIncomeByIdService,
  updateIncomeService,
  deleteIncomeService,
  createExpenseService,
  getExpenseRecordsService,
  getExpenseByIdService,
  updateExpenseService,
  deleteExpenseService,
  getTransactionsService,
  getTransactionByIdService,
  getIncomeReportService,
  getExpenseReportService,
  getProfitLossReportService,
} from "./finance.service";
import { reconcileFinanceSourcePostingsService } from "./fee-posting.service";

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

const getActor = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError("Authentication required", 401);
  }

  return {
    userId: req.user.userId,
    role: req.user.role,
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

const getBody = (req: Request): Record<string, unknown> => {
  return req.body as Record<string, unknown>;
};

const getQuery = (req: Request): Record<string, unknown> => {
  return req.query as Record<string, unknown>;
};

// --------------------------------------------------
// 1. FINANCE DASHBOARD
// --------------------------------------------------

export const getFinanceDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getFinanceDashboardService(
      getActor(req),
      getQuery(req)
    );

    return sendSuccess(
      res,
      "Finance dashboard fetched successfully",
      data
    );
  }
);

// --------------------------------------------------
// 2. FINANCE CATEGORIES
// --------------------------------------------------

export const createFinanceCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createFinanceCategoryService(
      getBody(req),
      getActor(req)
    );

    return sendCreated(
      res,
      "Finance category created successfully",
      data
    );
  }
);

export const getFinanceCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getFinanceCategoriesService(
      getActor(req),
      getQuery(req)
    );

    return sendPaginatedSuccess(
      res,
      "Finance categories fetched successfully",
      result.items,
      result.pagination
    );
  }
);

export const updateFinanceCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateFinanceCategoryService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Finance category updated successfully",
      data
    );
  }
);

export const deleteFinanceCategory = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteFinanceCategoryService(
      getId(req),
      getActor(req)
    );

    return sendDeleted(
      res,
      "Finance category deleted successfully"
    );
  }
);

// --------------------------------------------------
// 3. INCOME MANAGEMENT
// --------------------------------------------------

export const createIncome = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createIncomeService(
      getBody(req),
      getActor(req)
    );

    return sendCreated(
      res,
      "Income record created successfully",
      data
    );
  }
);

export const getIncomeRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getIncomeRecordsService(
      getActor(req),
      getQuery(req)
    );

    return sendPaginatedSuccess(
      res,
      "Income records fetched successfully",
      result.items,
      result.pagination
    );
  }
);

export const getIncomeById = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getIncomeByIdService(
      getId(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Income record fetched successfully",
      data
    );
  }
);

export const updateIncome = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateIncomeService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Income record updated successfully",
      data
    );
  }
);

export const deleteIncome = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteIncomeService(
      getId(req),
      getActor(req)
    );

    return sendDeleted(
      res,
      "Income record deleted successfully"
    );
  }
);

// --------------------------------------------------
// 4. EXPENSE MANAGEMENT
// --------------------------------------------------

export const createExpense = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await createExpenseService(
      getBody(req),
      getActor(req)
    );

    return sendCreated(
      res,
      "Expense record created successfully",
      data
    );
  }
);

export const getExpenseRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getExpenseRecordsService(
      getActor(req),
      getQuery(req)
    );

    return sendPaginatedSuccess(
      res,
      "Expense records fetched successfully",
      result.items,
      result.pagination
    );
  }
);

export const getExpenseById = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getExpenseByIdService(
      getId(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Expense record fetched successfully",
      data
    );
  }
);

export const updateExpense = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await updateExpenseService(
      getId(req),
      getBody(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Expense record updated successfully",
      data
    );
  }
);

export const deleteExpense = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteExpenseService(
      getId(req),
      getActor(req)
    );

    return sendDeleted(
      res,
      "Expense record deleted successfully"
    );
  }
);

// --------------------------------------------------
// 5. FINANCIAL TRANSACTIONS
// --------------------------------------------------

export const getTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getTransactionsService(
      getActor(req),
      getQuery(req)
    );

    return sendPaginatedSuccess(
      res,
      "Financial transactions fetched successfully",
      result.items,
      result.pagination
    );
  }
);

export const getTransactionById = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getTransactionByIdService(
      getId(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Transaction fetched successfully",
      data
    );
  }
);

// --------------------------------------------------
// 6. FINANCIAL REPORTS
// --------------------------------------------------

export const getIncomeReport = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getIncomeReportService(
      getActor(req),
      getQuery(req)
    );

    return sendSuccess(
      res,
      "Income report generated successfully",
      data
    );
  }
);

export const getExpenseReport = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getExpenseReportService(
      getActor(req),
      getQuery(req)
    );

    return sendSuccess(
      res,
      "Expense report generated successfully",
      data
    );
  }
);

export const getProfitLossReport = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getProfitLossReportService(
      getActor(req),
      getQuery(req)
    );

    return sendSuccess(
      res,
      "Profit and loss report generated successfully",
      data
    );
  }
);

export const reconcileFeeFinancePostings = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (!actor.schoolId) throw new AppError("School context is required", 400);
  const data = await reconcileFinanceSourcePostingsService(actor.schoolId, actor.userId);
  return sendSuccess(res, "Fee-to-finance reconciliation completed", data);
});
