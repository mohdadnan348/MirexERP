import mongoose, { Document, Schema, Types } from "mongoose";
import { AttendanceStatus } from "./attendance.model";

export type CorrectionDecision = "PENDING" | "APPROVED" | "REJECTED";
export interface IAttendanceCorrection extends Document {
  schoolId: Types.ObjectId;
  attendanceId: Types.ObjectId;
  sessionId: Types.ObjectId;
  previousStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  reason: string;
  requestedBy: Types.ObjectId;
  decision: CorrectionDecision;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<IAttendanceCorrection>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  attendanceId: { type: Schema.Types.ObjectId, ref: "Attendance", required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  previousStatus: { type: String, enum: ["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE","HOLIDAY"], required: true },
  requestedStatus: { type: String, enum: ["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE","HOLIDAY"], required: true },
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  decision: { type: String, enum: ["PENDING","APPROVED","REJECTED"], default: "PENDING", index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
  reviewRemarks: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });
schema.index({ schoolId: 1, attendanceId: 1, decision: 1 });
export default mongoose.models.AttendanceCorrection || mongoose.model<IAttendanceCorrection>("AttendanceCorrection", schema);
