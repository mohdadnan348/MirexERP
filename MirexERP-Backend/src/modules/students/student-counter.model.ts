import { Schema, model, models, Types } from "mongoose";
const schema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  kind: { type: String, enum: ["TC"], required: true },
  year: { type: Number, required: true },
  sequence: { type: Number, default: 0, min: 0 },
}, { timestamps: true, versionKey: false, collection: "student_counters" });
schema.index({ schoolId: 1, kind: 1, year: 1 }, { unique: true });
export default models.StudentCounter || model("StudentCounter", schema);
