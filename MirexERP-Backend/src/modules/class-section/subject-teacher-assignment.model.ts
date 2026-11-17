import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISubjectTeacherAssignment extends Document {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classId: Types.ObjectId;
  sectionId?: Types.ObjectId | null;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId;
  isActive: boolean;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubjectTeacherAssignment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null, index: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedAt: { type: Date, default: Date.now },
  endedAt: Date,
}, { timestamps: true, versionKey: false, collection: "subject_teacher_assignments" });

schema.index({ schoolId: 1, sessionId: 1, classId: 1, sectionId: 1, subjectId: 1 }, {
  unique: true, partialFilterExpression: { isActive: true },
});
schema.index({ schoolId: 1, teacherId: 1, sessionId: 1, isActive: 1 });

export default mongoose.models.SubjectTeacherAssignment || mongoose.model<ISubjectTeacherAssignment>("SubjectTeacherAssignment", schema);
