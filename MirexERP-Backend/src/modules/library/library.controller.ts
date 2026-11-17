
import type { Request, Response } from "express";

import { AppError } from "../../utils/AppError";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPagination } from "../../utils/pagination";

import {
  createBookService,
  getBooksService,
  getBookByIdService,
  updateBookService,
  deleteBookService,
  issueBookService,
  returnBookService,
  getBookIssuesService,
  getAllBookIssuesService,
  getStudentLibraryHistoryService,
} from "./library.service";

// GET ID
const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid ID is required", 400);
  }

  return id;
};

// GET ACTOR
const getActor = (req: Request) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!req.user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  const user = req.user as typeof req.user & {
    employeeId?: string;
  };

  return {
    userId: req.user.userId,
    schoolId: req.user.schoolId,
    role: req.user.role,
    employeeId: user.employeeId,
  };
};

// PAGINATION RESPONSE
const buildPagination = (result: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}) => ({
  ...result,
  hasNextPage: result.page < result.totalPages,
  hasPreviousPage: result.page > 1,
});

// CREATE BOOK
export const createBook = asyncHandler(
  async (req: Request, res: Response) => {
    const book = await createBookService(
      req.body,
      getActor(req)
    );

    return sendCreated(
      res,
      "Book created successfully",
      book
    );
  }
);

// GET ALL BOOKS
export const getBooks = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit } = getPagination(req);

    const result = await getBooksService(
      {
        page,
        limit,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
        category:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
      },
      getActor(req)
    );

    return sendPaginatedSuccess(
      res,
      "Books fetched successfully",
      result.items,
      buildPagination({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      })
    );
  }
);

// GET BOOK BY ID
export const getBookById = asyncHandler(
  async (req: Request, res: Response) => {
    const book = await getBookByIdService(
      getId(req),
      getActor(req)
    );

    return sendSuccess(
      res,
      "Book fetched successfully",
      book
    );
  }
);

// UPDATE BOOK
export const updateBook = asyncHandler(
  async (req: Request, res: Response) => {
    const book = await updateBookService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendSuccess(
      res,
      "Book updated successfully",
      book
    );
  }
);

// DELETE BOOK
export const deleteBook = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteBookService(
      getId(req),
      getActor(req)
    );

    return sendDeleted(
      res,
      "Book deleted successfully"
    );
  }
);

// ISSUE BOOK TO STUDENT
export const issueBook = asyncHandler(
  async (req: Request, res: Response) => {
    const issue = await issueBookService(
      req.body,
      getActor(req)
    );

    return sendCreated(
      res,
      "Book issued successfully",
      issue
    );
  }
);

// RETURN ISSUED BOOK
export const returnBook = asyncHandler(
  async (req: Request, res: Response) => {
    const issue = await returnBookService(
      getId(req),
      req.body,
      getActor(req)
    );

    return sendSuccess(
      res,
      "Book returned successfully",
      issue
    );
  }
);

// GET BOOK ISSUE RECORDS
export const getBookIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit } = getPagination(req);

    const result = await getBookIssuesService(
      getId(req),
      {
        page,
        limit,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
      },
      getActor(req)
    );

    return sendPaginatedSuccess(
      res,
      "Book issue records fetched successfully",
      result.items,
      buildPagination({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      })
    );
  }
);

// GET STUDENT LIBRARY HISTORY
export const getStudentLibraryHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const studentId = req.params.studentId;

    if (
      typeof studentId !== "string" ||
      !studentId.trim()
    ) {
      throw new AppError(
        "Valid student ID is required",
        400
      );
    }

    const result = await getStudentLibraryHistoryService(
      studentId,
      getActor(req)
    );

    return sendSuccess(
      res,
      "Student library history fetched successfully",
      result
    );
  }
);


export const getAllBookIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit } = getPagination(req);
    const result = await getAllBookIssuesService(
      {
        page,
        limit,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      },
      getActor(req)
    );
    return sendPaginatedSuccess(
      res,
      "Library issue records fetched successfully",
      result.items,
      buildPagination({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      })
    );
  }
);
