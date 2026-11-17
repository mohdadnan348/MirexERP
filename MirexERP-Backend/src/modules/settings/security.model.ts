import mongoose, { Schema } from "mongoose";

const securityPolicySchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
  minimumPasswordLength: { type: Number, min: 8, max: 128, default: 8 },
  requireUppercase: { type: Boolean, default: true }, requireLowercase: { type: Boolean, default: true }, requireNumber: { type: Boolean, default: true }, requireSymbol: { type: Boolean, default: false },
  passwordExpiryDays: { type: Number, min: 0, max: 365, default: 0 }, failedLoginLimit: { type: Number, min: 3, max: 20, default: 5 }, lockoutMinutes: { type: Number, min: 1, max: 1440, default: 15 },
  sessionMaxAgeDays: { type: Number, min: 1, max: 90, default: 30 }, updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });
export const SchoolSecurityPolicy = mongoose.models.SchoolSecurityPolicy || mongoose.model("SchoolSecurityPolicy", securityPolicySchema);
