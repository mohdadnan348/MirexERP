
import { Schema, model, models } from "mongoose";

const tenant = {
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
};

const categorySchema = new Schema(
  {
    ...tenant,
    name: { type: String, required: true, trim: true },
    description: String,
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

categorySchema.index({ schoolId: 1, name: 1 }, { unique: true });

export const LibraryCategory =
  models.LibraryCategory || model("LibraryCategory", categorySchema);

const copySchema = new Schema(
  {
    ...tenant,
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    barcode: { type: String, required: true, trim: true, uppercase: true },
    accessionNumber: String,
    status: {
      type: String,
      enum: ["AVAILABLE", "ISSUED", "DAMAGED", "LOST", "WITHDRAWN"],
      default: "AVAILABLE",
      index: true,
    },
    condition: {
      type: String,
      enum: ["NEW", "GOOD", "FAIR", "DAMAGED"],
      default: "NEW",
    },
    shelfNumber: String,
    rackNumber: String,
    acquiredAt: Date,
    notes: String,
  },
  { timestamps: true }
);

copySchema.index({ schoolId: 1, barcode: 1 }, { unique: true });
copySchema.index({ schoolId: 1, bookId: 1, status: 1 });

export const BookCopy =
  models.BookCopy || model("BookCopy", copySchema);

const settingsSchema = new Schema(
  {
    ...tenant,
    maxBooksPerMember: { type: Number, default: 3, min: 1 },
    issueDurationDays: { type: Number, default: 14, min: 1 },
    renewalLimit: { type: Number, default: 1, min: 0 },
    finePerDay: { type: Number, default: 2, min: 0 },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    maximumFine: { type: Number, default: 500, min: 0 },
    lostBookCharge: { type: Number, default: 500, min: 0 },
    damagedBookCharge: { type: Number, default: 100, min: 0 },
    allowOverdueRenewal: { type: Boolean, default: false },
    reservationsEnabled: { type: Boolean, default: false },
    parentLibraryVisible: { type: Boolean, default: true },
    studentCatalogueVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingsSchema.index({ schoolId: 1 }, { unique: true });

export const LibrarySettings =
  models.LibrarySettings || model("LibrarySettings", settingsSchema);

const renewalSchema = new Schema(
  {
    ...tenant,
    issueId: { type: Schema.Types.ObjectId, ref: "BookIssue", required: true },
    oldDueDate: Date,
    newDueDate: Date,
    renewalNumber: Number,
    renewedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    renewedAt: { type: Date, default: Date.now },
    reason: String,
  },
  { timestamps: true }
);

renewalSchema.index(
  { schoolId: 1, issueId: 1, renewalNumber: 1 },
  { unique: true }
);

export const BookRenewalHistory =
  models.BookRenewalHistory || model("BookRenewalHistory", renewalSchema);

const fineSchema = new Schema(
  {
    ...tenant,
    issueId: { type: Schema.Types.ObjectId, ref: "BookIssue", required: true },
    memberId: { type: Schema.Types.ObjectId, required: true },
    memberType: String,
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    waivedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID", "WAIVED"],
      default: "PENDING",
    },
    reason: String,
    waivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    waiverReason: String,
  },
  { timestamps: true }
);

fineSchema.index({ schoolId: 1, issueId: 1 }, { unique: true });

export const LibraryFine =
  models.LibraryFine || model("LibraryFine", fineSchema);