import { Schema, model, models, Types, Document } from "mongoose";
export interface IStudyMaterial extends Document {
  schoolId: Types.ObjectId; sessionId: Types.ObjectId; classId: Types.ObjectId; sectionIds: Types.ObjectId[];
  subjectId: Types.ObjectId; title: string; description?: string; fileUrl: string; fileName: string; mimeType: string;
  uploadedBy: Types.ObjectId; status: "ACTIVE" | "INACTIVE"; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IStudyMaterial>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
  sectionIds: [{ type: Schema.Types.ObjectId, ref: "Section" }],
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000 },
  fileUrl: { type: String, required: true, trim: true },
  fileName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["ACTIVE","INACTIVE"], default: "ACTIVE" },
}, { timestamps: true, versionKey: false });
schema.index({ schoolId: 1, sessionId: 1, classId: 1, status: 1, createdAt: -1 });
export const StudyMaterial = models.StudyMaterial || model<IStudyMaterial>("StudyMaterial", schema);
export default StudyMaterial;
