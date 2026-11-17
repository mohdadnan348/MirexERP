
import mongoose, { Document, Schema, Types } from "mongoose";

export enum BookStatus {
  AVAILABLE = "AVAILABLE",
  ISSUED = "ISSUED",
  UNAVAILABLE = "UNAVAILABLE",
}

export enum BookIssueStatus {
  ISSUED = "ISSUED",
  RETURNED = "RETURNED",
  OVERDUE = "OVERDUE",
  LOST = "LOST",
}

export enum LibraryMemberType {
  STUDENT = "STUDENT",
  TEACHER = "TEACHER",
  EMPLOYEE = "EMPLOYEE",
}

export interface IBook extends Document {
  schoolId: Types.ObjectId;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  edition?: string;
  category: string;
  language?: string;
  description?: string;
  publicationYear?: number;
  shelfNumber?: string;
  rackNumber?: string;
  totalQuantity: number;
  availableQuantity: number;
  issuedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  price?: number;
  status: BookStatus;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookIssue extends Document {
  schoolId: Types.ObjectId;
  bookId: Types.ObjectId;
  memberId: Types.ObjectId;
  memberType: LibraryMemberType;
  copyId?: Types.ObjectId;
  renewalCount: number;
  issueDate: Date;
  dueDate: Date;
  returnDate?: Date;
  fineAmount: number;
  finePaid: number;
  status: BookIssueStatus;
  remarks?: string;
  issuedBy: Types.ObjectId;
  receivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: String,
      required: true,
      trim: true,
    },

    isbn: {
      type: String,
      trim: true,
      default: null,
    },

    publisher: {
      type: String,
      trim: true,
    },

    edition: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    language: {
      type: String,
      trim: true,
      default: "English",
    },

    description: {
      type: String,
      trim: true,
    },

    publicationYear: {
      type: Number,
      min: 1000,
      max: 9999,
    },

    shelfNumber: {
      type: String,
      trim: true,
    },

    rackNumber: {
      type: String,
      trim: true,
    },

    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    issuedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    damagedQuantity: { type: Number, min: 0, default: 0 },
    lostQuantity: { type: Number, min: 0, default: 0 },

    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(BookStatus),
      default: BookStatus.AVAILABLE,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bookSchema.index({ schoolId: 1, title: 1 });
bookSchema.index({ schoolId: 1, category: 1 });
bookSchema.index({ schoolId: 1, isActive: 1 });
bookSchema.index(
  { schoolId: 1, isbn: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isbn: { $type: "string" },
    },
  }
);

const bookIssueSchema = new Schema<IBookIssue>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },

    memberId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    memberType: {
      type: String,
      enum: Object.values(LibraryMemberType),
      required: true,
    },

    copyId: { type: Schema.Types.ObjectId, ref: "BookCopy" },
    renewalCount: { type: Number, min: 0, default: 0 },

    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    returnDate: {
      type: Date,
    },

    fineAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    finePaid: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(BookIssueStatus),
      default: BookIssueStatus.ISSUED,
      index: true,
    },

    remarks: {
      type: String,
      trim: true,
    },

    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bookIssueSchema.index({ schoolId: 1, memberId: 1, status: 1 });
bookIssueSchema.index({ schoolId: 1, bookId: 1, status: 1 });
bookIssueSchema.index({ schoolId: 1, dueDate: 1, status: 1 });

export const Book = mongoose.model<IBook>("Book", bookSchema);

export const BookIssue = mongoose.model<IBookIssue>(
  "BookIssue",
  bookIssueSchema
);
