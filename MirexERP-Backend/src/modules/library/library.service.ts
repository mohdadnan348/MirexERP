
import mongoose, { Types } from "mongoose";
import {
  Book,
  BookIssue,
  BookStatus,
  BookIssueStatus,
  LibraryMemberType,
} from "./library.model";
import Student from "../students/students.model";
import Employee from "../employees/employees.model";
import { LibrarySettings, BookCopy, LibraryFine } from "./library-operations.model";
import { AppError } from "../../utils/AppError";

interface LibraryActor {
  userId: string;
  schoolId: string;
  role: string;
  employeeId?: string | null;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  memberId?: string;
}

interface BookIssueInput {
  bookId: string;
  memberId: string;
  memberType: LibraryMemberType;
  issueDate?: string | Date;
  dueDate: string | Date;
  remarks?: string;
  copyId?: string;
}

interface ReturnBookInput {
  fineAmount?: number;
  finePaid?: number;
  remarks?: string;
  condition?: "GOOD" | "DAMAGED" | "LOST";
}

const isValidId = (id: string): boolean =>
  Types.ObjectId.isValid(id);

const normalizeIsbn = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
const isValidIsbn = (value: string) => {
  const isbn = normalizeIsbn(value);
  if (/^[0-9]{9}[0-9X]$/.test(isbn)) {
    const sum = isbn.split("").reduce((total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
    return sum % 11 === 0;
  }
  if (/^[0-9]{13}$/.test(isbn)) {
    const sum = isbn.split("").reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }
  return false;
};


const getPagination = (query: PaginationQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getSchoolId = (actor: LibraryActor) => {
  if (!actor.schoolId || !isValidId(actor.schoolId)) {
    throw new AppError("Valid school ID is required", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getObjectId = (id: string, field = "ID") => {
  if (!isValidId(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }

  return new Types.ObjectId(id);
};

// CREATE BOOK
export const createBookService = async (
  data: Record<string, unknown>,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);

  const isbn =
    typeof data.isbn === "string" ? data.isbn.trim() : "";

  if (isbn) {
    if (!isValidIsbn(isbn)) throw new AppError("ISBN must be a valid ISBN-10 or ISBN-13", 400);
    const existingBook = await Book.findOne({
      schoolId,
      isbn,
    });

    if (existingBook) {
      throw new AppError("A book with this ISBN already exists", 409);
    }
  }

  const totalQuantity = Number(data.totalQuantity ?? 1);

  if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
    throw new AppError("Total quantity must be at least 1", 400);
  }

  const book = await Book.create({
    ...data,
    schoolId,
    isbn: isbn ? normalizeIsbn(isbn) : undefined,
    totalQuantity,
    availableQuantity: totalQuantity,
    issuedQuantity: 0,
    status: BookStatus.AVAILABLE,
    createdBy: getObjectId(actor.userId, "user ID"),
  });

  return book;
};

// GET ALL BOOKS
export const getBooksService = async (
  query: PaginationQuery,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);

  const filter: Record<string, unknown> = {
    schoolId,
    isActive: true,
  };

  if (query.category) {
    filter.category = query.category;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search?.trim()) {
    const search = query.search.trim();

    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { author: { $regex: search, $options: "i" } },
      { isbn: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Book.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Book.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// GET BOOK BY ID
export const getBookByIdService = async (
  id: string,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const bookId = getObjectId(id, "book ID");

  const book = await Book.findOne({
    _id: bookId,
    schoolId,
    isActive: true,
  });

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return book;
};

// UPDATE BOOK
export const updateBookService = async (
  id: string,
  data: Record<string, unknown>,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const bookId = getObjectId(id, "book ID");

  const book = await Book.findOne({
    _id: bookId,
    schoolId,
    isActive: true,
  });

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  const allowedFields = [
    "title",
    "author",
    "isbn",
    "publisher",
    "edition",
    "category",
    "language",
    "description",
    "publicationYear",
    "shelfNumber",
    "rackNumber",
    "price",
    "totalQuantity",
  ];

  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }

  if (updates.totalQuantity !== undefined) {
    const newQuantity = Number(updates.totalQuantity);

    if (
      !Number.isInteger(newQuantity) ||
      newQuantity < book.issuedQuantity + (book.damagedQuantity || 0) + (book.lostQuantity || 0)
    ) {
      throw new AppError(
        "Total quantity cannot be less than issued quantity",
        400
      );
    }

    updates.availableQuantity =
      newQuantity - book.issuedQuantity - (book.damagedQuantity || 0) - (book.lostQuantity || 0);
  }

  if (updates.isbn) {
    updates.isbn = normalizeIsbn(String(updates.isbn));
    if (!isValidIsbn(String(updates.isbn))) throw new AppError("ISBN must be a valid ISBN-10 or ISBN-13", 400);
    const existingBook = await Book.findOne({
      schoolId,
      isbn: updates.isbn,
      _id: { $ne: bookId },
    });

    if (existingBook) {
      throw new AppError("This ISBN is already registered", 409);
    }
  }

  updates.updatedBy = getObjectId(actor.userId, "user ID");

  Object.assign(book, updates);
  await book.save();

  return book;
};

// DELETE BOOK (SOFT DELETE)
export const deleteBookService = async (
  id: string,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const bookId = getObjectId(id, "book ID");

  const book = await Book.findOne({
    _id: bookId,
    schoolId,
    isActive: true,
  });

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  if (book.issuedQuantity > 0) {
    throw new AppError(
      "Cannot delete a book while copies are issued",
      400
    );
  }

  book.isActive = false;
  book.status = BookStatus.UNAVAILABLE;
  book.updatedBy = getObjectId(actor.userId, "user ID");

  await book.save();

  return book;
};

// ISSUE BOOK
export const issueBookService = async (
  data: BookIssueInput,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const bookId = getObjectId(data.bookId, "book ID");
  const memberId = getObjectId(data.memberId, "member ID");

  if (
    !Object.values(LibraryMemberType).includes(data.memberType)
  ) {
    throw new AppError("Invalid library member type", 400);
  }

  const dueDate = new Date(data.dueDate);
  const issueDate = data.issueDate
    ? new Date(data.issueDate)
    : new Date();

  if (
    Number.isNaN(dueDate.getTime()) ||
    Number.isNaN(issueDate.getTime())
  ) {
    throw new AppError("Invalid issue or due date", 400);
  }

  if (dueDate <= issueDate) {
    throw new AppError("Due date must be after issue date", 400);
  }

  if (data.memberType === LibraryMemberType.STUDENT) {
    const member = await Student.findOne({ _id: memberId, schoolId, isActive: true }).select("_id");
    if (!member) throw new AppError("Active student not found in this school", 404);
  } else {
    const member = await Employee.findOne({ _id: memberId, schoolId, isDeleted: false }).select("_id");
    if (!member) throw new AppError("Active employee not found in this school", 404);
  }

  const settings = await LibrarySettings.findOne({ schoolId });
  const activeIssues = await BookIssue.countDocuments({
    schoolId, memberId, memberType: data.memberType,
    status: { $in: [BookIssueStatus.ISSUED, BookIssueStatus.OVERDUE] },
  });
  if (activeIssues >= (settings?.maxBooksPerMember ?? 3)) {
    throw new AppError("Member has reached the configured book issue limit", 409);
  }
  const physicalCopiesExist = await BookCopy.exists({ schoolId, bookId });
  if (physicalCopiesExist && !data.copyId) {
    throw new AppError("Select a specific available copy for this title", 400);
  }

  // Atomically reserve one available copy.
  const book = await Book.findOneAndUpdate(
    {
      _id: bookId,
      schoolId,
      isActive: true,
      availableQuantity: { $gt: 0 },
    },
    {
      $inc: {
        availableQuantity: -1,
        issuedQuantity: 1,
      },
    },
    { new: true }
  );

  if (!book) {
    throw new AppError(
      "Book not found or no copies are available",
      404
    );
  }

  try {
    if (data.copyId) {
      const copy = await BookCopy.findOneAndUpdate(
        { _id: getObjectId(data.copyId, "copy ID"), schoolId, bookId, status: "AVAILABLE" },
        { $set: { status: "ISSUED" } },
        { new: true }
      );
      if (!copy) throw new AppError("Selected physical copy is unavailable", 409);
    }
    const issue = await BookIssue.create({
      schoolId,
      bookId,
      memberId,
      memberType: data.memberType,
      copyId: data.copyId ? getObjectId(data.copyId, "copy ID") : undefined,
      issueDate,
      dueDate,
      fineAmount: 0,
      finePaid: 0,
      status: BookIssueStatus.ISSUED,
      remarks: data.remarks,
      issuedBy: getObjectId(actor.userId, "user ID"),
    });

    await Book.updateOne(
      { _id: bookId, schoolId },
      {
        $set: {
          status:
            book.availableQuantity === 0
              ? BookStatus.ISSUED
              : BookStatus.AVAILABLE,
        },
      }
    );

    return issue;
  } catch (error) {
    // Restore stock if issue record creation fails.
    await Book.updateOne(
      { _id: bookId, schoolId },
      { $inc: { availableQuantity: 1, issuedQuantity: -1 } }
    );
    if (data.copyId) await BookCopy.updateOne({ _id: data.copyId, schoolId }, { $set: { status: "AVAILABLE" } });
    throw error;
  }
};

// RETURN BOOK
export const returnBookService = async (
  id: string,
  data: ReturnBookInput,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const issueId = getObjectId(id, "issue ID");

  const existingIssue = await BookIssue.findOne({ _id: issueId, schoolId });
  if (!existingIssue) throw new AppError("Issue record not found", 404);
  const settings = await LibrarySettings.findOne({ schoolId });
  const returnedAt = new Date();
  const due = new Date(existingIssue.dueDate);
  const grace = settings?.gracePeriodDays ?? 0;
  const overdueDays = Math.max(0, Math.ceil((returnedAt.getTime() - due.getTime()) / 86400000) - grace);
  const replacementCharge = data.condition === "LOST"
    ? (settings?.lostBookCharge ?? 500)
    : data.condition === "DAMAGED"
      ? (settings?.damagedBookCharge ?? 100)
      : 0;
  const calculatedFine = Math.min(settings?.maximumFine ?? 500, overdueDays * (settings?.finePerDay ?? 2) + replacementCharge);
  const fineAmount = data.fineAmount === undefined ? calculatedFine : Math.max(calculatedFine, Number(data.fineAmount));
  if (!Number.isFinite(fineAmount) || fineAmount < 0) throw new AppError("Invalid fine amount", 400);
  const issue = await BookIssue.findOneAndUpdate(
    {
      _id: issueId,
      schoolId,
      status: {
        $in: [
          BookIssueStatus.ISSUED,
          BookIssueStatus.OVERDUE,
        ],
      },
    },
    {
      $set: {
        returnDate: returnedAt,
        fineAmount,
        finePaid: Math.min(fineAmount, Math.max(0, Number(data.finePaid ?? 0))),
        status: data.condition === "LOST" ? BookIssueStatus.LOST : BookIssueStatus.RETURNED,
        remarks: data.remarks,
        receivedBy: getObjectId(actor.userId, "user ID"),
      },
    },
    { new: true }
  );

  if (!issue) {
    throw new AppError(
      "Issue record not found or book already returned",
      404
    );
  }

  const condition = data.condition || "GOOD";
  const stockDelta: Record<string, number> = { issuedQuantity: -1 };
  if (condition === "DAMAGED") stockDelta.damagedQuantity = 1;
  else if (condition === "LOST") stockDelta.lostQuantity = 1;
  else stockDelta.availableQuantity = 1;
  const book = await Book.findOneAndUpdate(
    { _id: issue.bookId, schoolId, issuedQuantity: { $gt: 0 } },
    { $inc: stockDelta },
    { new: true }
  );

  if (!book) {
    // Restore issue status if stock update fails.
    await BookIssue.updateOne(
      { _id: issue._id, schoolId },
      {
        $set: {
          status: BookIssueStatus.ISSUED,
          returnDate: null,
          receivedBy: null,
        },
      }
    );

    throw new AppError("Unable to update book stock", 500);
  }

  await Book.updateOne(
    { _id: book._id, schoolId },
    { $set: { status: book.availableQuantity > 0 ? BookStatus.AVAILABLE : book.issuedQuantity > 0 ? BookStatus.ISSUED : BookStatus.UNAVAILABLE } }
  );
  if (issue.copyId) {
    await BookCopy.updateOne(
      { _id: issue.copyId, schoolId, status: "ISSUED" },
      { $set: { status: condition === "LOST" ? "LOST" : condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE", condition: condition === "DAMAGED" ? "DAMAGED" : condition === "LOST" ? "DAMAGED" : "GOOD" } }
    );
  }
  if (fineAmount > 0) {
    await LibraryFine.findOneAndUpdate(
      { schoolId, issueId: issue._id },
      { $setOnInsert: { schoolId, issueId: issue._id, memberId: issue.memberId, memberType: issue.memberType, amount: fineAmount, paidAmount: issue.finePaid, status: issue.finePaid >= fineAmount ? "PAID" : issue.finePaid > 0 ? "PARTIALLY_PAID" : "PENDING", reason: `${data.condition === "LOST" ? "Lost book replacement charge; " : data.condition === "DAMAGED" ? "Damaged book charge; " : ""}Overdue by ${overdueDays} day(s)` } },
      { upsert: true, new: true }
    );
  }

  return issue;
};

// GET BOOK ISSUE RECORDS
export const getBookIssuesService = async (
  bookId: string,
  query: PaginationQuery,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);

  const filter: Record<string, unknown> = {
    schoolId,
    bookId: getObjectId(bookId, "book ID"),
  };

  if (query.status) {
    filter.status = query.status;
  }

  const [items, total] = await Promise.all([
    BookIssue.find(filter)
      .populate("bookId", "title author isbn")
      .populate("issuedBy", "name email")
      .populate("receivedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    BookIssue.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// GET STUDENT LIBRARY HISTORY
export const getStudentLibraryHistoryService = async (
  studentId: string,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const memberId = getObjectId(studentId, "student ID");

  const history = await BookIssue.find({
    schoolId,
    memberId,
    memberType: LibraryMemberType.STUDENT,
  })
    .populate("bookId", "title author isbn category")
    .sort({ issueDate: -1 })
    .lean();

  return {
    items: history,
    total: history.length,
  };
};


/** School-scoped issue register used by the Librarian workspace. */
export const getAllBookIssuesService = async (
  query: PaginationQuery,
  actor: LibraryActor
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { schoolId };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    BookIssue.find(filter)
      .populate("bookId", "title author isbn category")
      .populate("issuedBy", "name email")
      .populate("receivedBy", "name email")
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BookIssue.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};
