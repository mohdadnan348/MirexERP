import { Schema, model, models, Types, Document } from "mongoose";
export interface IParentChildRelationship extends Document {
  schoolId: Types.ObjectId; parentId: Types.ObjectId; studentId: Types.ObjectId; relationship: string;
  isPrimaryGuardian: boolean; isEmergencyContact: boolean; permissions: { attendance: boolean; timetable: boolean; homework: boolean; results: boolean; fees: boolean; communication: boolean };
  status: "ACTIVE" | "REVOKED"; changedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IParentChildRelationship>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Parent", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  relationship: { type: String, enum: ["FATHER","MOTHER","GUARDIAN","GRANDFATHER","GRANDMOTHER","OTHER"], default: "GUARDIAN" },
  isPrimaryGuardian: { type: Boolean, default: false }, isEmergencyContact: { type: Boolean, default: false },
  permissions: {
    attendance: { type: Boolean, default: true }, timetable: { type: Boolean, default: true },
    homework: { type: Boolean, default: true }, results: { type: Boolean, default: true },
    fees: { type: Boolean, default: true }, communication: { type: Boolean, default: true },
  },
  status: { type: String, enum: ["ACTIVE","REVOKED"], default: "ACTIVE" },
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, parentId: 1, studentId: 1 }, { unique: true });
schema.index({ schoolId: 1, studentId: 1, status: 1 });
export const ParentChildRelationship = models.ParentChildRelationship || model<IParentChildRelationship>("ParentChildRelationship", schema);
export default ParentChildRelationship;
