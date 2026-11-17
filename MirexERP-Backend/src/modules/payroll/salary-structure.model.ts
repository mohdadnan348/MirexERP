import { Schema, model, models, Types, Document } from "mongoose";

export interface ISalaryStructure extends Document {
  schoolId: Types.ObjectId; employeeId: Types.ObjectId; basicSalary: number;
  allowances: Map<string, number>; deductions: Map<string, number>;
  effectiveFrom: Date; effectiveTo?: Date | null; paymentFrequency: "MONTHLY" | "WEEKLY";
  statutorySettings: { pfEnabled: boolean; pfRate?: number; esiEnabled: boolean; esiRate?: number; professionalTax?: number };
  status: "ACTIVE" | "INACTIVE"; createdBy: Types.ObjectId; updatedBy?: Types.ObjectId;
  createdAt: Date; updatedAt: Date;
}
const schema = new Schema<ISalaryStructure>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  basicSalary: { type: Number, required: true, min: 0 },
  allowances: { type: Map, of: { type: Number, min: 0 }, default: {} },
  deductions: { type: Map, of: { type: Number, min: 0 }, default: {} },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  paymentFrequency: { type: String, enum: ["MONTHLY", "WEEKLY"], default: "MONTHLY" },
  statutorySettings: {
    pfEnabled: { type: Boolean, default: false }, pfRate: { type: Number, min: 0, max: 100 },
    esiEnabled: { type: Boolean, default: false }, esiRate: { type: Number, min: 0, max: 100 },
    professionalTax: { type: Number, min: 0, default: 0 },
  },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, employeeId: 1, effectiveFrom: -1 });
schema.index({ schoolId: 1, employeeId: 1, status: 1, effectiveFrom: 1 });
export const SalaryStructure = models.SalaryStructure || model<ISalaryStructure>("SalaryStructure", schema);
export default SalaryStructure;
