
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import { USER_ROLES } from "../../config/constants";
import {
  createFinanceCategorySchema, updateFinanceCategorySchema, getFinanceCategoriesSchema,
  createIncomeSchema, updateIncomeSchema, getIncomeRecordsSchema,
  createExpenseSchema, updateExpenseSchema, getExpenseRecordsSchema,
  getTransactionsSchema, financeIdSchema, financeReportSchema,
} from "./finance.validation";

import {
  getFinanceDashboard,
  createFinanceCategory,
  getFinanceCategories,
  updateFinanceCategory,
  deleteFinanceCategory,
  createIncome,
  getIncomeRecords,
  getIncomeById,
  updateIncome,
  deleteIncome,
  createExpense,
  getExpenseRecords,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getTransactions,
  getTransactionById,
  getIncomeReport,
  getExpenseReport,
  getProfitLossReport,
  reconcileFeeFinancePostings,
} from "./finance.controller";
import { listVendors, createVendor, updateVendor, deactivateVendor } from "./vendors.controller";
import { vendorListSchema, createVendorSchema, updateVendorSchema, vendorIdSchema } from "./vendors.validation";

const router = Router();

// --------------------------------------------------
// ROLE GROUPS
// --------------------------------------------------

const financeReadRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ACCOUNTANT,
] as const;

const financeWriteRoles = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.ACCOUNTANT,
] as const;

// --------------------------------------------------
// GLOBAL MIDDLEWARE
// --------------------------------------------------

router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);

// --------------------------------------------------
// VENDOR DIRECTORY
// --------------------------------------------------

router.get("/vendors", authorize(...financeReadRoles), validate(vendorListSchema), listVendors);
router.post("/vendors", authorize(...financeWriteRoles), validate(createVendorSchema), createVendor);
router.patch("/vendors/:id", authorize(...financeWriteRoles), validate(updateVendorSchema), updateVendor);
router.delete("/vendors/:id", authorize(...financeWriteRoles), validate(vendorIdSchema), deactivateVendor);

router.post("/reconciliation/source-postings", authorize(...financeWriteRoles), reconcileFeeFinancePostings);

// --------------------------------------------------
// 1. FINANCE DASHBOARD
// --------------------------------------------------

router.get(
  "/dashboard",
  authorize(...financeReadRoles),
  validate({ query: financeReportSchema.shape.query }),
  getFinanceDashboard
);

// --------------------------------------------------
// 2. FINANCE CATEGORIES
// --------------------------------------------------

router.post(
  "/categories",
  authorize(...financeWriteRoles),
  validate(createFinanceCategorySchema),
  createFinanceCategory
);

router.get(
  "/categories",
  authorize(...financeReadRoles),
  validate(getFinanceCategoriesSchema),
  getFinanceCategories
);

router.patch(
  "/categories/:id",
  authorize(...financeWriteRoles),
  validate(updateFinanceCategorySchema),
  updateFinanceCategory
);

router.delete(
  "/categories/:id",
  authorize(...financeWriteRoles),
  validate({ params: financeIdSchema.shape.params }),
  deleteFinanceCategory
);

// --------------------------------------------------
// 3. INCOME MANAGEMENT
// --------------------------------------------------

router.post(
  "/income",
  authorize(...financeWriteRoles),
  validate(createIncomeSchema),
  createIncome
);

router.get(
  "/income",
  authorize(...financeReadRoles),
  validate(getIncomeRecordsSchema),
  getIncomeRecords
);

router.get(
  "/income/:id",
  authorize(...financeReadRoles),
  validate({ params: financeIdSchema.shape.params }),
  getIncomeById
);

router.patch(
  "/income/:id",
  authorize(...financeWriteRoles),
  validate(updateIncomeSchema),
  updateIncome
);

router.delete(
  "/income/:id",
  authorize(...financeWriteRoles),
  validate({ params: financeIdSchema.shape.params }),
  deleteIncome
);

// --------------------------------------------------
// 4. EXPENSE MANAGEMENT
// --------------------------------------------------

router.post(
  "/expenses",
  authorize(...financeWriteRoles),
  validate(createExpenseSchema),
  createExpense
);

router.get(
  "/expenses",
  authorize(...financeReadRoles),
  validate(getExpenseRecordsSchema),
  getExpenseRecords
);

router.get(
  "/expenses/:id",
  authorize(...financeReadRoles),
  validate({ params: financeIdSchema.shape.params }),
  getExpenseById
);

router.patch(
  "/expenses/:id",
  authorize(...financeWriteRoles),
  validate(updateExpenseSchema),
  updateExpense
);

router.delete(
  "/expenses/:id",
  authorize(...financeWriteRoles),
  validate({ params: financeIdSchema.shape.params }),
  deleteExpense
);

// --------------------------------------------------
// 5. FINANCIAL TRANSACTIONS
// --------------------------------------------------

router.get(
  "/transactions",
  authorize(...financeReadRoles),
  validate(getTransactionsSchema),
  getTransactions
);

router.get(
  "/transactions/:id",
  authorize(...financeReadRoles),
  validate({ params: financeIdSchema.shape.params }),
  getTransactionById
);

// --------------------------------------------------
// 6. FINANCIAL REPORTS
// --------------------------------------------------

router.get(
  "/reports/income",
  authorize(...financeReadRoles),
  validate({ query: financeReportSchema.shape.query }),
  getIncomeReport
);

router.get(
  "/reports/expenses",
  authorize(...financeReadRoles),
  validate({ query: financeReportSchema.shape.query }),
  getExpenseReport
);

router.get(
  "/reports/profit-loss",
  authorize(...financeReadRoles),
  validate({ query: financeReportSchema.shape.query }),
  getProfitLossReport
);

export default router;
