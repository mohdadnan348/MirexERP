import { Schema, model, models, Types, Document } from "mongoose";
export interface ILeavePolicy extends Document {
  schoolId: Types.ObjectId; sessionId: Types.ObjectId; leaveType: string; annualEntitlement: number;
  isPaid: boolean; carryForward: boolean; status: "ACTIVE" | "INACTIVE"; createdBy: Types.ObjectId; updatedBy?: Types.ObjectId;
  createdAt: Date; updatedAt: Date;
}
const schema = new Schema<ILeavePolicy>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
  leaveType: { type: String, enum: ["CASUAL","SICK","EARNED","UNPAID","MATERNITY","PATERNITY","OTHER"], required: true },
  annualEntitlement: { type: Number, min: 0, max: 366, required: true },
  isPaid: { type: Boolean, default: true },
  carryForward: { type: Boolean, default: false },
  status: { type: String, enum: ["ACTIVE","INACTIVE"], default: "ACTIVE" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, sessionId: 1, leaveType: 1 }, { unique: true });
export const LeavePolicy = models.LeavePolicy || model<ILeavePolicy>("LeavePolicy", schema);
export default LeavePolicy;
