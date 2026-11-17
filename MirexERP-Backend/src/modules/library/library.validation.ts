
import { z } from "zod";
import {
  BookStatus,
  BookIssueStatus,
  LibraryMemberType,
} from "./library.model";

// Common MongoDB ObjectId validation
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID");

// Create Book
export const createBookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Book title must be at least 2 characters")
    .max(200),

  author: z
    .string()
    .trim()
    .min(2, "Author name is required")
    .max(150),

  isbn: z
    .string()
    .trim()
    .max(30)
    .optional(),

  publisher: z
    .string()
    .trim()
    .max(150)
    .optional(),

  edition: z
    .string()
    .trim()
    .max(50)
    .optional(),

  category: z
    .string()
    .trim()
    .min(2, "Category is required")
    .max(100),

  language: z
    .string()
    .trim()
    .max(50)
    .optional(),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional(),

  publicationYear: z
    .number()
    .int()
    .min(1000)
    .max(9999)
    .optional(),

  shelfNumber: z
    .string()
    .trim()
    .max(50)
    .optional(),

  rackNumber: z
    .string()
    .trim()
    .max(50)
    .optional(),

  totalQuantity: z
    .number()
    .int()
    .min(1)
    .default(1),

  price: z
    .number()
    .min(0)
    .optional(),
});

// Update Book
export const updateBookSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),

    author: z.string().trim().min(2).max(150).optional(),

    isbn: z.string().trim().max(30).optional(),

    publisher: z.string().trim().max(150).optional(),

    edition: z.string().trim().max(50).optional(),

    category: z.string().trim().min(2).max(100).optional(),

    language: z.string().trim().max(50).optional(),

    description: z.string().trim().max(2000).optional(),

    publicationYear: z
      .number()
      .int()
      .min(1000)
      .max(9999)
      .optional(),

    shelfNumber: z.string().trim().max(50).optional(),

    rackNumber: z.string().trim().max(50).optional(),

    totalQuantity: z.number().int().min(0).optional(),

    price: z.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

// Get Books
export const getBooksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  category: z.string().trim().max(100).optional(),

  status: z.nativeEnum(BookStatus).optional(),
});

// Issue Book
export const issueBookSchema = z.object({
  bookId: objectIdSchema,

  memberId: objectIdSchema,

  memberType: z.nativeEnum(LibraryMemberType),

  issueDate: z.coerce.date().optional(),

  dueDate: z.coerce.date(),

  remarks: z.string().trim().max(500).optional(),
  copyId: objectIdSchema.optional(),
});

// Return Book
export const returnBookSchema = z.object({
  fineAmount: z
    .number()
    .min(0)
    .optional()
    .default(0),

  finePaid: z
    .number()
    .min(0)
    .optional()
    .default(0),

  remarks: z
    .string()
    .trim()
    .max(500)
    .optional(),
  condition: z.enum(["GOOD","DAMAGED","LOST"]).optional(),
}).refine(
  (data) => data.finePaid <= data.fineAmount,
  {
    message: "Fine paid cannot exceed the total fine amount",
    path: ["finePaid"],
  }
);

// Get Book Issues
export const getBookIssuesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  status: z.nativeEnum(BookIssueStatus).optional(),
});

// Student Library History
export const getStudentLibraryHistorySchema = z.object({
  studentId: objectIdSchema,
});

// Inferred Types
export type CreateBookInput = z.infer<typeof createBookSchema>;

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export type GetBooksQuery = z.infer<typeof getBooksSchema>;

export type IssueBookInput = z.infer<typeof issueBookSchema>;

export type ReturnBookInput = z.infer<typeof returnBookSchema>;

export type GetBookIssuesQuery = z.infer<typeof getBookIssuesSchema>;
export const getBookIssuesParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
