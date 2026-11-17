import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { Exam, ExamMarksWorkflowStatus } from "./exams.model";
import { ExamMark } from "./exam-mark.model";
import { Student } from "../students/students.model";

export interface ExamWorkflowActor { userId: string; schoolId: string; role: string; }
const context = (actor: ExamWorkflowActor) => {
  if (!Types.ObjectId.isValid(actor.userId) || !Types.ObjectId.isValid(actor.schoolId)) throw new AppError("Valid authenticated school context is required", 401);
  return { userId: new Types.ObjectId(actor.userId), schoolId: new Types.ObjectId(actor.schoolId) };
};

export const transitionExamWorkflowService = async (examId: string, action: "submit" | "verify" | "approve" | "publish", actor: ExamWorkflowActor) => {
  const { userId, schoolId } = context(actor);
  if (!Types.ObjectId.isValid(examId)) throw new AppError("Invalid exam ID", 400);
  const exam = await Exam.findOne({ _id: examId, schoolId });
  if (!exam) throw new AppError("Exam not found", 404);
  if (exam.status === "CANCELLED") throw new AppError("Cancelled examinations cannot enter result workflow", 409);
  const admin = ["SCHOOL_ADMIN", "PRINCIPAL"].includes(actor.role);
  if (action !== "submit" && !admin) throw new AppError("Only principal or school admin can verify, approve or publish results", 403);
  if (action === "submit") {
    if (!admin) throw new AppError("Only principal or school admin can submit the completed marks register", 403);
    const activeStudents = await Student.countDocuments({ schoolId, sessionId: exam.sessionId, classId: exam.classId, isActive: true, isDeleted: false });
    const expected = activeStudents * exam.subjects.length;
    const saved = await ExamMark.countDocuments({ schoolId, examId: exam._id });
    if (expected === 0 || saved < expected) throw new AppError(`Marks are incomplete: ${saved} of ${expected} student-subject entries are saved`, 409);
    if (exam.marksWorkflowStatus !== ExamMarksWorkflowStatus.DRAFT) throw new AppError("Only draft marks can be submitted", 409);
    exam.marksWorkflowStatus = ExamMarksWorkflowStatus.SUBMITTED;
    exam.submittedAt = new Date(); exam.submittedBy = userId;
  } else if (action === "verify") {
    if (exam.marksWorkflowStatus !== ExamMarksWorkflowStatus.SUBMITTED) throw new AppError("Only submitted marks can be verified", 409);
    exam.marksWorkflowStatus = ExamMarksWorkflowStatus.VERIFIED;
    exam.verifiedAt = new Date(); exam.verifiedBy = userId;
  } else if (action === "approve") {
    if (exam.marksWorkflowStatus !== ExamMarksWorkflowStatus.VERIFIED) throw new AppError("Only verified results can be approved", 409);
    exam.marksWorkflowStatus = ExamMarksWorkflowStatus.APPROVED;
    exam.approvedAt = new Date(); exam.approvedBy = userId;
  } else {
    if (exam.marksWorkflowStatus !== ExamMarksWorkflowStatus.APPROVED) throw new AppError("Only approved results can be published", 409);
    exam.marksWorkflowStatus = ExamMarksWorkflowStatus.PUBLISHED;
    exam.isPublished = true; exam.publishedAt = new Date(); exam.publishedBy = userId;
    exam.status = "COMPLETED" as typeof exam.status;
  }
  exam.updatedBy = userId;
  await exam.save();
  return exam;
};

export const getExamDashboardService = async (actor: ExamWorkflowActor) => {
  const { schoolId } = context(actor);
  const now = new Date();
  const [total, upcoming, ongoing, completed, pendingVerification, pendingApproval, published, studentCounts] = await Promise.all([
    Exam.countDocuments({ schoolId }),
    Exam.countDocuments({ schoolId, startDate: { $gt: now }, status: "SCHEDULED" }),
    Exam.countDocuments({ schoolId, startDate: { $lte: now }, endDate: { $gte: now }, status: "ONGOING" }),
    Exam.countDocuments({ schoolId, status: "COMPLETED" }),
    Exam.countDocuments({ schoolId, marksWorkflowStatus: "SUBMITTED" }),
    Exam.countDocuments({ schoolId, marksWorkflowStatus: "VERIFIED" }),
    Exam.countDocuments({ schoolId, marksWorkflowStatus: "PUBLISHED", isPublished: true }),
    Exam.aggregate([{ $match: { schoolId } }, { $lookup: { from: "students", let: { classId: "$classId", sessionId: "$sessionId", schoolId: "$schoolId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$classId", "$$classId"] }, { $eq: ["$sessionId", "$$sessionId"] }, { $eq: ["$schoolId", "$$schoolId"] }, { $eq: ["$isActive", true] }, { $eq: ["$isDeleted", false] }] } } }, { $count: "count" }], as: "studentCount" } }, { $addFields: { studentsAppearing: { $ifNull: [{ $arrayElemAt: ["$studentCount.count", 0] }, 0] } } }, { $group: { _id: "$classId", examinations: { $sum: 1 }, studentsAppearing: { $sum: "$studentsAppearing" } } }, { $sort: { examinations: -1 } }]),
  ]);
  const studentsAppearing = studentCounts.reduce((sum: number, row: { studentsAppearing?: number }) => sum + (row.studentsAppearing || 0), 0);
  return { totalExaminations: total, upcoming, ongoing, completed, resultsPendingVerification: pendingVerification, resultsPendingApproval: pendingApproval, publishedResults: published, studentsAppearing, classWise: studentCounts };
};
