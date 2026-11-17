import { Schema, model, models, Types, Document } from "mongoose";
export interface IEmployeePerformance extends Document {
  schoolId: Types.ObjectId; employeeId: Types.ObjectId; reviewPeriodStart: Date; reviewPeriodEnd: Date;
  rating: number; reviewerId: Types.ObjectId; feedback: string; strengths: string[]; improvements: string[];
  status: "DRAFT" | "PUBLISHED"; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IEmployeePerformance>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  reviewPeriodStart: { type: Date, required: true }, reviewPeriodEnd: { type: Date, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  feedback: { type: String, trim: true, maxlength: 3000, default: "" },
  strengths: { type: [String], default: [] }, improvements: { type: [String], default: [] },
  status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, employeeId: 1, reviewPeriodStart: -1 });
export const EmployeePerformance = models.EmployeePerformance || model<IEmployeePerformance>("EmployeePerformance", schema);
export default EmployeePerformance;
