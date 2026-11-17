import mongoose, { Document, Schema, Types } from "mongoose";

export interface FinanceVendorDocument extends Document {
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  notes?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const financeVendorSchema = new Schema<FinanceVendorDocument>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  contactPerson: { type: String, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 150 },
  address: { type: String, trim: true, maxlength: 500 },
  gstin: { type: String, trim: true, uppercase: true, maxlength: 15 },
  pan: { type: String, trim: true, uppercase: true, maxlength: 10 },
  notes: { type: String, trim: true, maxlength: 1000 },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

financeVendorSchema.index({ schoolId: 1, code: 1 }, { unique: true });
financeVendorSchema.index({ schoolId: 1, name: 1 });

export const FinanceVendor = mongoose.models.FinanceVendor ||
  mongoose.model<FinanceVendorDocument>("FinanceVendor", financeVendorSchema);
