import mongoose, { Document, Model, Schema, Types } from "mongoose";
export interface ISchoolDocument extends Document {
  schoolId: Types.ObjectId; category: string; title: string; originalName: string;
  storagePath: string; mimeType: string; size: number; isDeleted: boolean;
  deletedAt?: Date | null; uploadedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<ISchoolDocument>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  originalName: { type: String, required: true, maxlength: 255 },
  storagePath: { type: String, required: true, select: false },
  mimeType: { type: String, required: true }, size: { type: Number, required: true, min: 1 },
  isDeleted: { type: Boolean, default: false, index: true }, deletedAt: { type: Date, default: null },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false, collection: "school_documents" });
schema.index({ schoolId: 1, category: 1, isDeleted: 1, createdAt: -1 });
const SchoolDocument: Model<ISchoolDocument> = mongoose.models.SchoolDocument || mongoose.model<ISchoolDocument>("SchoolDocument", schema);
export default SchoolDocument;
