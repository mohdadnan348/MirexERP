import { requireSubscriptionFeature } from "../subscriptions/subscription-entitlement.middleware";

import { Router } from "express";
import {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  issueBook,
  returnBook,
  getBookIssues,
  getAllBookIssues,
  getStudentLibraryHistory,
} from "./library.controller";

import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { tenantContext, requireTenant } from "../../middleware/tenantContext";
import { validate } from "../../middleware/validate";
import {
  createBookSchema,
  updateBookSchema,
  getBooksSchema,
  issueBookSchema,
  returnBookSchema,
  getBookIssuesSchema,
  getStudentLibraryHistorySchema,
  getBookIssuesParamsSchema,
} from "./library.validation";

const router = Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireTenant);
router.use(requireSubscriptionFeature("LIBRARY"));

// Book management
router.post(
  "/books",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ body: createBookSchema }),
  createBook
);

router.get(
  "/books",
  authorize(
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "LIBRARIAN",
    "TEACHER"
  ),
  validate({ query: getBooksSchema }),
  getBooks
);

router.get(
  "/books/:id",
  authorize(
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "LIBRARIAN",
    "TEACHER"
  ),
  getBookById
);

router.patch(
  "/books/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ body: updateBookSchema }),
  updateBook
);

router.delete(
  "/books/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  deleteBook
);

// Book issue and return
router.post(
  "/issue",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ body: issueBookSchema }),
  issueBook
);

router.patch(
  "/return/:id",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ body: returnBookSchema }),
  returnBook
);

// Issue records
router.get(
  "/issues/all",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ query: getBookIssuesSchema }),
  getAllBookIssues
);

router.get(
  "/books/:id/issues",
  authorize("SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"),
  validate({ query: getBookIssuesSchema }),
  getBookIssues
);

// Student library history
router.get(
  "/students/:studentId/history",
  authorize(
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "LIBRARIAN",
    "TEACHER"
  ),
  validate({ params: getStudentLibraryHistorySchema }),
  getStudentLibraryHistory
);

export default router;
