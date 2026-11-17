import { Types, startSession } from "mongoose";
import Student, { StudentStatus } from "./students.model";
import StudentRecord from "./student-records.model";
import StudentCounter from "./student-counter.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Session from "../sessions/sessions.model";
import { transferStudentAllocation, promoteStudents } from "../class-section/class-section.service";
import { Parent } from "../parents/parents.model";
import { AppError } from "../../utils/AppError";

type Actor = { userId: string; schoolId: string; role: string };
const ids = (a: Actor) => {
  if (!Types.ObjectId.isValid(a.userId) || !Types.ObjectId.isValid(a.schoolId)) throw new AppError("Invalid user or school context", 400);
  return { schoolId: new Types.ObjectId(a.schoolId), userId: new Types.ObjectId(a.userId) };
};
const oid = (v: unknown, label: string) => {
  if (typeof v !== "string" || !Types.ObjectId.isValid(v)) throw new AppError(`Invalid ${label}`, 400);
  return new Types.ObjectId(v);
};
const getStudent = async (id: string, a: Actor) => {
  const { schoolId } = ids(a);
  const student = await Student.findOne({ _id: oid(id, "student ID"), schoolId, isDeleted: { $ne: true } });
  if (!student) throw new AppError("Student not found", 404);
  return student;
};
const ensureStudentSessionOpen = async (student: { sessionId: Types.ObjectId; schoolId: Types.ObjectId }) => {
  const session = await Session.findOne({ _id: student.sessionId, schoolId: student.schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Student records in a closed academic session cannot be changed", 409);
};
const record = (a: Actor, studentId: Types.ObjectId, sessionId: Types.ObjectId | undefined, recordType: any, title: string, details: any) =>
  StudentRecord.create({ schoolId: new Types.ObjectId(a.schoolId), sessionId, studentId, recordType, title, details, uploadedBy: new Types.ObjectId(a.userId) });

export async function listStudentRecords(id: string, type: string | undefined, a: Actor) {
  const student = await getStudent(id, a);
  const filter: any = { schoolId: student.schoolId, studentId: student._id, isDeleted: false };
  if (type) filter.recordType = type;
  return StudentRecord.find(filter).sort({ createdAt: -1 }).select("-storagePath").lean();
}
export async function setStudentPhoto(id: string, file: Express.Multer.File, a: Actor) {
  const student = await getStudent(id, a);
  if (student.tcLocked) throw new AppError("Student record is locked after TC issuance", 409);
  const previous = await StudentRecord.findOne({ schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", "details.category": "PHOTO", isDeleted: false }).select("+storagePath");
  if (previous) { previous.isDeleted = true; await previous.save(); }
  const photo = await StudentRecord.create({
    schoolId: student.schoolId, sessionId: student.sessionId, studentId: student._id,
    recordType: "DOCUMENT", title: "Student profile photo",
    details: { category: "PHOTO", verificationStatus: "VERIFIED", uploadedAt: new Date() },
    storagePath: file.path, fileName: file.originalname, mimeType: file.mimetype, uploadedBy: new Types.ObjectId(a.userId),
  });
  student.profileImage = `/api/v1/students/${student._id}/photo`;
  student.updatedBy = new Types.ObjectId(a.userId);
  await student.save();
  return { photoId: photo._id, profileImage: student.profileImage };
}
export async function getStudentPhoto(id: string, a: Actor) {
  const student = await getStudent(id, a);
  const photo = await StudentRecord.findOne({ schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", "details.category": "PHOTO", isDeleted: false }).sort({ createdAt: -1 }).select("+storagePath");
  if (!photo?.storagePath) throw new AppError("Student photo not found", 404);
  return photo;
}
export async function addStudentDocument(id: string, file: Express.Multer.File, data: any, a: Actor) {
  const student = await getStudent(id, a);
  const doc = await StudentRecord.create({
    schoolId: student.schoolId, sessionId: student.sessionId, studentId: student._id,
    recordType: "DOCUMENT", title: String(data.documentName || file.originalname).slice(0, 180),
    details: { category: String(data.category || "OTHER").slice(0, 60), verificationStatus: "PENDING", uploadedAt: new Date() },
    storagePath: file.path, fileName: file.originalname, mimeType: file.mimetype, uploadedBy: new Types.ObjectId(a.userId),
  });
  return { _id: doc._id, title: doc.title, category: doc.details.category, fileName: doc.fileName, createdAt: doc.createdAt, verificationStatus: "PENDING" };
}
export async function replaceStudentDocument(id: string, docId: string, file: Express.Multer.File, a: Actor) {
  const student = await getStudent(id, a);
  const doc = await StudentRecord.findOne({ _id: oid(docId, "document ID"), schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", isDeleted: false }).select("+storagePath");
  if (!doc) throw new AppError("Student document not found", 404);
  const previousPath = doc.storagePath;
  doc.storagePath = file.path; doc.fileName = file.originalname; doc.mimeType = file.mimetype;
  doc.details = { ...doc.details, verificationStatus: "PENDING", replacedAt: new Date(), replacedBy: a.userId };
  await doc.save();
  if (previousPath) {
    const fs = await import("fs/promises");
    await fs.unlink(previousPath).catch(() => undefined);
  }
  return { _id: doc._id, fileName: doc.fileName, verificationStatus: "PENDING" };
}
export async function getStudentDocument(id: string, docId: string, a: Actor) {
  const student = await getStudent(id, a);
  const doc = await StudentRecord.findOne({ _id: oid(docId, "document ID"), schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", isDeleted: false }).select("+storagePath");
  if (!doc || !doc.storagePath) throw new AppError("Student document not found", 404);
  return doc;
}
export async function updateStudentDocument(id: string, docId: string, data: any, a: Actor) {
  const student = await getStudent(id, a);
  const doc = await StudentRecord.findOne({ _id: oid(docId, "document ID"), schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", isDeleted: false });
  if (!doc) throw new AppError("Student document not found", 404);
  if (!["VERIFIED", "REJECTED", "PENDING"].includes(data.verificationStatus)) throw new AppError("Invalid document verification status", 400);
  doc.details = { ...doc.details, verificationStatus: data.verificationStatus, verificationRemarks: String(data.remarks || "").slice(0, 1000), verifiedBy: a.userId, verifiedAt: new Date() };
  await doc.save();
  return doc;
}
export async function softDeleteStudentDocument(id: string, docId: string, a: Actor) {
  const student = await getStudent(id, a);
  const doc = await StudentRecord.findOneAndUpdate({ _id: oid(docId, "document ID"), schoolId: student.schoolId, studentId: student._id, recordType: "DOCUMENT", isDeleted: false }, { $set: { isDeleted: true } }, { new: true });
  if (!doc) throw new AppError("Student document not found", 404);
  return doc;
}
export async function getMedicalInformation(id: string, a: Actor) {
  const student = await getStudent(id, a);
  return student.medicalInformation || { allergies: [], conditions: [], notes: "" };
}
export async function updatePreviousSchoolDetails(id: string, data: any, a: Actor) {
  const student = await getStudent(id, a);
  if (student.tcLocked) throw new AppError("Student record is locked after TC issuance", 409);
  (student as any).previousSchoolDetails = {
    name: String(data.name || "").slice(0, 200), board: String(data.board || "").slice(0, 100),
    previousClass: String(data.previousClass || "").slice(0, 50), academicSession: String(data.academicSession || "").slice(0, 50),
    tcNumber: String(data.tcNumber || "").slice(0, 100), address: String(data.address || "").slice(0, 500),
    notes: String(data.notes || "").slice(0, 1000),
  };
  student.previousSchool = (student as any).previousSchoolDetails.name;
  student.updatedBy = new Types.ObjectId(a.userId);
  await student.save();
  await record(a, student._id, student.sessionId, "STATUS", "Previous school details updated", { changedAt: new Date(), changedBy: a.userId });
  return (student as any).previousSchoolDetails;
}
export async function updateMedicalInformation(id: string, data: any, a: Actor) {
  const student = await getStudent(id, a);
  if (student.tcLocked) throw new AppError("Student record is locked after TC issuance", 409);
  student.medicalInformation = { allergies: data.allergies || [], conditions: data.conditions || [], notes: data.notes || "" };
  student.updatedBy = new Types.ObjectId(a.userId);
  await student.save();
  await record(a, student._id, student.sessionId, "STATUS", "Medical information updated", { changedAt: new Date(), changedBy: a.userId });
  return student.medicalInformation;
}
export async function transferStudent(id: string, data: any, a: Actor) {
  const student = await getStudent(id, a);
  if (!data.reason || !String(data.reason).trim()) throw new AppError("Transfer reason is required", 400);
  if (student.tcLocked || student.status !== StudentStatus.ACTIVE) throw new AppError("Only active students can be transferred", 409);
  if (data.transferDate && Number.isNaN(new Date(data.transferDate).getTime())) throw new AppError("Invalid transfer date", 400);
  await transferStudentAllocation(id, {
    sessionId: String(data.sessionId || student.sessionId),
    classId: String(data.classId || ""),
    sectionId: String(data.sectionId || ""),
    reason: String(data.reason).trim().slice(0, 500),
  }, a);
  return Student.findById(student._id).populate("classId", "name").populate("sectionId", "name").lean();
}
export async function withdrawStudent(id: string, data: any, a: Actor) {
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(a.role)) throw new AppError("Only School Admin or Principal can withdraw a student", 403);
  const student = await getStudent(id, a);
  await ensureStudentSessionOpen(student);
  if (!data.reason || !String(data.reason).trim()) throw new AppError("Withdrawal reason is required", 400);
  if (student.tcLocked || student.status !== StudentStatus.ACTIVE) throw new AppError("Only active students can be withdrawn", 409);
  const mongoSession = await startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const updated = await Student.findOneAndUpdate({ _id: student._id, schoolId: student.schoolId, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } }, { $set: { status: StudentStatus.WITHDRAWN, isActive: false, updatedBy: new Types.ObjectId(a.userId) } }, { new: true, session: mongoSession });
      if (!updated) throw new AppError("Student status changed; reload and retry", 409);
      await StudentRecord.create([{ schoolId: student.schoolId, sessionId: student.sessionId, studentId: student._id, recordType: "STATUS", title: "Student withdrawn", details: { previousStatus: StudentStatus.ACTIVE, newStatus: StudentStatus.WITHDRAWN, reason: String(data.reason || "").slice(0, 1000), withdrawalDate: data.date ? new Date(data.date) : new Date(), requestedBy: a.userId, approvedBy: a.userId }, uploadedBy: new Types.ObjectId(a.userId) }], { session: mongoSession });
    });
  } finally { await mongoSession.endSession(); }
  return Student.findById(student._id).lean();
}
export async function issueTransferCertificate(id: string, data: any, a: Actor) {
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(a.role)) throw new AppError("TC issuance requires School Admin or Principal permission", 403);
  const student = await getStudent(id, a);
  await ensureStudentSessionOpen(student);
  if (!data.reason || !String(data.reason).trim()) throw new AppError("Reason for leaving is required", 400);
  if (student.tcLocked || student.status !== StudentStatus.ACTIVE) throw new AppError("TC can only be issued once for an active student", 409);
  const year = new Date().getFullYear();
  try {
    await StudentCounter.updateOne(
      { schoolId: student.schoolId, kind: "TC", year },
      { $setOnInsert: { schoolId: student.schoolId, kind: "TC", year, sequence: 0 } },
      { upsert: true }
    );
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }
  const counter: any = await StudentCounter.findOneAndUpdate(
    { schoolId: student.schoolId, kind: "TC", year },
    { $inc: { sequence: 1 } },
    { new: true }
  );
  const school = await import("../schools/schools.model").then(m => m.default.findById(student.schoolId).select("code name").lean());
  if (!(school as any)?.code) throw new AppError("School code is required before issuing a TC", 400);
  const code = String((school as any).code).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const tcNumber = `${code}TC${year}${String(counter.sequence).padStart(5, "0")}`;
  const mongoSession = await startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const updated = await Student.findOneAndUpdate({ _id: student._id, schoolId: student.schoolId, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } }, { $set: { status: StudentStatus.TC, isActive: false, tcNumber, tcIssuedAt: new Date(), tcLocked: true, updatedBy: new Types.ObjectId(a.userId) } }, { new: true, session: mongoSession });
      if (!updated) throw new AppError("TC was already issued or student status changed", 409);
      await StudentRecord.create([{ schoolId: student.schoolId, sessionId: student.sessionId, studentId: student._id, recordType: "TC", title: tcNumber, details: { tcNumber, issueDate: new Date(), reason: String(data.reason || "").slice(0, 1000), conduct: String(data.conduct || "").slice(0, 500), remarks: String(data.remarks || "").slice(0, 1000), issuedBy: a.userId }, uploadedBy: new Types.ObjectId(a.userId) }], { session: mongoSession });
    });
  } finally { await mongoSession.endSession(); }
  return { tcNumber, studentId: student._id, issuedAt: new Date() };
}
export async function promoteStudent(id: string, data: any, a: Actor) {
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(a.role)) throw new AppError("Promotion requires School Admin or Principal permission", 403);
  const student = await getStudent(id, a);
  if (student.status !== StudentStatus.ACTIVE || student.tcLocked) throw new AppError("Withdrawn, inactive or TC-issued students cannot be promoted", 409);
  const promotionStatus = ["DETAINED", "NOT_PROMOTED"].includes(String(data.promotionStatus || "").toUpperCase()) ? "DETAINED" : "PROMOTED";
  const result = await promoteStudents({
    fromSessionId: String(student.sessionId),
    toSessionId: String(data.sessionId || ""),
    promotions: [{
      studentId: String(student._id),
      classId: data.classId ? String(data.classId) : undefined,
      sectionId: data.sectionId ? String(data.sectionId) : undefined,
      status: promotionStatus,
      reason: data.reason ? String(data.reason).slice(0, 500) : undefined,
    }],
  }, a);
  return { studentId: student._id, previous: { sessionId: student.sessionId, classId: student.classId, sectionId: student.sectionId }, ...result };
}
export async function studentReports(query: any, a: Actor) {
  const { schoolId } = ids(a); const match: any = { schoolId, isDeleted: { $ne: true } };
  if (query.sessionId) match.sessionId = oid(query.sessionId, "session ID");
  else {
    const activeSession = await Session.findOne({ schoolId, isActive: true, isDeleted: false }).select("_id").lean();
    match.sessionId = activeSession?._id || { $in: [] };
  }
  if (query.classId) match.classId = oid(query.classId, "class ID");
  if (query.sectionId) match.sectionId = oid(query.sectionId, "section ID");
  if (query.status) {
    if (!Object.values(StudentStatus).includes(query.status as StudentStatus)) throw new AppError("Invalid student status filter", 400);
    match.status = query.status;
  }
  if (query.from || query.to) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) throw new AppError("Invalid report date filter", 400);
    if (from && to && from > to) throw new AppError("Report start date cannot be after end date", 400);
    match.admissionDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  const [total, byClass, gender, tcRegister] = await Promise.all([
    Student.countDocuments(match),
    Student.aggregate([{ $match: match }, { $group: { _id: "$classId", count: { $sum: 1 } } }, { $lookup: { from: "classes", localField: "_id", foreignField: "_id", as: "class" } }, { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } }, { $project: { className: "$class.name", count: 1 } }]),
    Student.aggregate([{ $match: match }, { $group: { _id: "$gender", count: { $sum: 1 } } }]),
    StudentRecord.find({ schoolId, recordType: "TC", isDeleted: false, sessionId: match.sessionId }).sort({ createdAt: -1 }).limit(500).populate("studentId", "admissionNumber firstName lastName").lean(),
  ]);
  return { totalStudents: total, classWiseStrength: byClass, genderRatio: gender, tcRegister, formula: "Gender ratio is grouped by the stored gender field; TC register includes issued TC records." };
}

export async function getParentLinkedChildren(a: Actor) {
  const { schoolId, userId } = ids(a);
  const parent = await Parent.findOne({ schoolId, userId, isActive: true }).select("_id studentIds").lean();
  if (!parent) throw new AppError("No parent profile is linked to this account", 404);
  return Student.find({ schoolId, parentId: parent._id, isDeleted: { $ne: true } })
    .select("-medicalInformation -previousSchoolDetails")
    .populate("classId", "name").populate("sectionId", "name").populate("sessionId", "name")
    .sort({ firstName: 1, lastName: 1 }).lean();
}

export async function markStudentAlumni(id: string, data: any, a: Actor) {
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(a.role)) throw new AppError("Only School Admin or Principal can mark a student as Alumni", 403);
  if (!data.reason || !String(data.reason).trim()) throw new AppError("Alumni transition reason is required", 400);
  const student = await getStudent(id, a);
  await ensureStudentSessionOpen(student);
  if (student.status !== StudentStatus.ACTIVE || student.tcLocked) throw new AppError("Only active students can be marked as Alumni", 409);
  const mongoSession = await startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const updated = await Student.findOneAndUpdate(
        { _id: student._id, schoolId: student.schoolId, sessionId: student.sessionId, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } },
        { $set: { status: StudentStatus.ALUMNI, isActive: false, updatedBy: new Types.ObjectId(a.userId) } },
        { new: true, session: mongoSession }
      );
      if (!updated) throw new AppError("Student status changed; reload and retry", 409);
      await StudentRecord.create([{
        schoolId: student.schoolId, sessionId: student.sessionId, studentId: student._id,
        recordType: "STATUS", title: "Student marked as Alumni",
        details: { previousStatus: StudentStatus.ACTIVE, newStatus: StudentStatus.ALUMNI, reason: String(data.reason).slice(0, 1000), changedBy: a.userId, changedAt: new Date() },
        uploadedBy: new Types.ObjectId(a.userId),
      }], { session: mongoSession });
    });
  } finally { await mongoSession.endSession(); }
  return Student.findById(student._id).lean();
}
