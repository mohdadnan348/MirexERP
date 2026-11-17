import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISchoolBranch extends Document {
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address: { street?: string; city: string; state: string; country: string; postalCode: string };
  status: "ACTIVE" | "INACTIVE";
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISchoolBranch>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  phone: { type: String, trim: true, match: /^\+?[0-9\s-]{7,20}$/ },
  email: { type: String, trim: true, lowercase: true, maxlength: 150 },
  address: {
    street: { type: String, trim: true, maxlength: 150 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    country: { type: String, required: true, default: "India" },
    postalCode: { type: String, required: true, match: /^[0-9]{6}$/ },
  },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false, collection: "school_branches" });
schema.index({ schoolId:  1, code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
schema.index({ schoolId: 1, status: 1, isDeleted: 1 });
const SchoolBranch: Model<ISchoolBranch> = mongoose.models.SchoolBranch || mongoose.model<ISchoolBranch>("SchoolBranch", schema);
export default SchoolBranch;
