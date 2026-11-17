import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import Exam from "./exams.model";
import Session from "../sessions/sessions.model";
import { Student } from "../students/students.model";
import { ExamMark } from "./exam-mark.model";
import Employee from "../employees/employees.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import type { SaveExamMarksInput } from "./exam-mark.validation";

export interface ExamMarkActor { userId: string; schoolId: string; role?: string; }

export const saveExamMarksService = async (
  examId: string,
  input: SaveExamMarksInput,
  actor: ExamMarkActor
) => {
  if (!Types.ObjectId.isValid(examId) || !Types.ObjectId.isValid(actor.schoolId) || !Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Invalid exam or user context", 400);
  }
  const schoolId = new Types.ObjectId(actor.schoolId);
  const exam = await Exam.findOne({ _id: examId, schoolId });
  if (!exam) throw new AppError("Exam not found", 404);
  const session = await Session.findOne({ _id: exam.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Marks cannot be changed for a closed academic session", 409);
  if (exam.status === "CANCELLED" || exam.isPublished || ["SUBMITTED", "VERIFIED", "APPROVED", "PUBLISHED"].includes(exam.marksWorkflowStatus)) throw new AppError("Marks are locked after marks submission; use the authorized correction process", 409);
  let teacherAssignments: Array<{ subjectId: Types.ObjectId; sectionId?: Types.ObjectId | null }> = [];
  if (actor.role === "TEACHER") {
    const employee = await Employee.findOne({ schoolId, userId: new Types.ObjectId(actor.userId), status: "ACTIVE", isActive: true, isDeleted: false, employeeType: "TEACHING" }).select("_id").lean();
    if (!employee) throw new AppError("Teacher employee profile is not linked to this account", 403);
    const requestedSubjects = [...new Set(input.marks.map((item) => item.subjectId))].map((id) => new Types.ObjectId(id));
    teacherAssignments = await SubjectTeacherAssignment.find({ schoolId, sessionId: exam.sessionId, classId: exam.classId, teacherId: employee._id, subjectId: { $in: requestedSubjects }, isActive: true }).select("subjectId sectionId").lean();
    const assigned = new Set(teacherAssignments.map((item) => String(item.subjectId)));
    if (requestedSubjects.some((id) => !assigned.has(String(id)))) throw new AppError("You can enter marks only for subjects assigned to you in this class", 403);
  }

  const subjectRules = new Map(exam.subjects.map((item) => [String(item.subjectId), item]));
  const studentIds = [...new Set(input.marks.map((item) => item.studentId))];
  const students = await Student.find({
    _id: { $in: studentIds.map((id) => new Types.ObjectId(id)) },
    schoolId,
    sessionId: exam.sessionId,
    classId: exam.classId,
    isActive: true,
    isDeleted: false,
  }).select("_id sectionId").lean();
  const validStudents = new Map(students.map((item) => [String(item._id), item]));
  const uniqueEntries = new Set<string>();
  for (const entry of input.marks) {
    const entryKey = `${entry.studentId}:${entry.subjectId}`;
    if (uniqueEntries.has(entryKey)) throw new AppError("Duplicate student and subject entry in this marks batch", 400);
    uniqueEntries.add(entryKey);
    const rule = subjectRules.get(entry.subjectId);
    if (!rule) throw new AppError("Subject is not scheduled in this examination", 400);
    const student = validStudents.get(entry.studentId);
    if (!student) throw new AppError("Student does not belong to this exam class and session", 400);
    if (actor.role === "TEACHER") {
      const hasScope = teacherAssignments.some((assignment) => String(assignment.subjectId) === entry.subjectId && (!assignment.sectionId || String(assignment.sectionId) === String(student.sectionId || "")));
      if (!hasScope) throw new AppError("You are not assigned to this student section for the selected subject", 403);
    }
    if (entry.marksObtained > rule.maxMarks) throw new AppError(`Marks cannot exceed ${rule.maxMarks}`, 400);
  }

  const operations = input.marks.map((entry) => ({
    updateOne: {
      filter: { schoolId, examId: exam._id, studentId: new Types.ObjectId(entry.studentId), subjectId: new Types.ObjectId(entry.subjectId) },
      update: { $set: { marksObtained: entry.isAbsent ? 0 : entry.marksObtained, isAbsent: Boolean(entry.isAbsent), remarks: entry.remarks, enteredBy: new Types.ObjectId(actor.userId) } },
      upsert: true,
    },
  }));
  await ExamMark.bulkWrite(operations, { ordered: true });
  return ExamMark.find({ schoolId, examId: exam._id, studentId: { $in: studentIds } })
    .populate("studentId", "admissionNumber rollNumber firstName lastName")
    .populate("subjectId", "subjectName subjectCode")
    .sort({ studentId: 1, subjectId: 1 }).lean();
};

export const getExamMarksService = async (
  examId: string,
  query: { page: number; limit: number; subjectId?: string; studentId?: string },
  actor: ExamMarkActor
) => {
  if (!Types.ObjectId.isValid(examId) || !Types.ObjectId.isValid(actor.schoolId)) throw new AppError("Invalid exam context", 400);
  const schoolId = new Types.ObjectId(actor.schoolId);
  const exam = await Exam.findOne({ _id: examId, schoolId }).select("_id subjects classId sessionId").lean();
  if (!exam) throw new AppError("Exam not found", 404);
  const filter: Record<string, unknown> = { schoolId, examId: exam._id };
  if (actor.role === "TEACHER") {
    const employee = await Employee.findOne({ schoolId, userId: new Types.ObjectId(actor.userId), status: "ACTIVE", isActive: true, isDeleted: false, employeeType: "TEACHING" }).select("_id").lean();
    if (!employee) throw new AppError("Teacher employee profile is not linked to this account", 403);
    const assignments = await SubjectTeacherAssignment.find({ schoolId, sessionId: exam.sessionId, classId: exam.classId, teacherId: employee._id, isActive: true }).select("subjectId sectionId").lean();
    const assignedSubjectIds = [...new Set(assignments.map((item) => String(item.subjectId)))].map((id) => new Types.ObjectId(id));
    if (query.subjectId && !assignedSubjectIds.some((id) => String(id) === query.subjectId)) throw new AppError("You are not assigned to this examination subject", 403);
    if (query.subjectId) filter.subjectId = new Types.ObjectId(query.subjectId);
    const sectionIds = [...new Set(assignments.filter((item) => item.sectionId).map((item) => String(item.sectionId)))].map((id) => new Types.ObjectId(id));
    const classStudents = await Student.find({ schoolId, sessionId: exam.sessionId, classId: exam.classId, isActive: true, isDeleted: false }).select("_id sectionId").lean();
    const studentSubjectScopes: Record<string, unknown>[] = [];
    for (const assignment of assignments) {
      if (!assignment.sectionId) studentSubjectScopes.push({ subjectId: assignment.subjectId });
      else {
        const sectionStudentIds = classStudents.filter((student) => String(student.sectionId || "") === String(assignment.sectionId)).map((student) => student._id);
        if (sectionStudentIds.length) studentSubjectScopes.push({ subjectId: assignment.subjectId, studentId: { $in: sectionStudentIds } });
      }
    }
    filter.$or = studentSubjectScopes.length ? studentSubjectScopes : [{ _id: null }];
    if (query.studentId) {
      const selectedStudent = classStudents.find((student) => String(student._id) === query.studentId);
      const allowed = selectedStudent && assignments.some((assignment) => !assignment.sectionId || String(assignment.sectionId) === String(selectedStudent.sectionId || ""));
      if (!allowed) throw new AppError("You are not assigned to this student section", 403);
    }
  }
  if (query.subjectId) filter.subjectId = new Types.ObjectId(query.subjectId);
  if (query.studentId) filter.studentId = new Types.ObjectId(query.studentId);
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    ExamMark.find(filter).populate("studentId", "admissionNumber rollNumber firstName lastName").populate("subjectId", "subjectName subjectCode").sort({ studentId: 1 }).skip(skip).limit(query.limit).lean(),
    ExamMark.countDocuments(filter),
  ]);
  return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
};

export const getExamResultsService = async (examId: string, schoolIdValue: string) => {
  if (!Types.ObjectId.isValid(examId) || !Types.ObjectId.isValid(schoolIdValue)) throw new AppError("Invalid exam context", 400);
  const schoolId = new Types.ObjectId(schoolIdValue);
  const exam = await Exam.findOne({ _id: examId, schoolId }).lean();
  if (!exam) throw new AppError("Exam not found", 404);
  if (!exam.isPublished || exam.marksWorkflowStatus !== "PUBLISHED") throw new AppError("Results have not been published", 409);
  const marks = await ExamMark.find({ schoolId, examId: exam._id })
    .populate("studentId", "admissionNumber rollNumber firstName lastName")
    .populate("subjectId", "subjectName subjectCode").lean();
  const byStudent = new Map<string, { student: unknown; totalObtained: number; totalMaximum: number; subjects: Array<Record<string, unknown>>; failed: boolean }>();
  for (const mark of marks) {
    const key = String((mark.studentId as unknown as { _id: Types.ObjectId })._id);
    const rule = exam.subjects.find((item) => String(item.subjectId) === String(mark.subjectId && (mark.subjectId as unknown as { _id: Types.ObjectId })._id));
    if (!rule) continue;
    const record: { student: unknown; totalObtained: number; totalMaximum: number; subjects: Array<Record<string, unknown>>; failed: boolean } = byStudent.get(key) || { student: mark.studentId, totalObtained: 0, totalMaximum: 0, subjects: [], failed: false };
    record.totalObtained += mark.marksObtained;
    record.totalMaximum += rule.maxMarks;
    record.failed ||= Boolean(mark.isAbsent) || mark.marksObtained < rule.passingMarks;
    record.subjects.push({ subject: mark.subjectId, marksObtained: mark.marksObtained, isAbsent: Boolean(mark.isAbsent), maxMarks: rule.maxMarks, passingMarks: rule.passingMarks, passed: !mark.isAbsent && mark.marksObtained >= rule.passingMarks });
    byStudent.set(key, record);
  }
  return [...byStudent.values()].map((record) => ({
    ...record,
    percentage: record.totalMaximum ? Number(((record.totalObtained / record.totalMaximum) * 100).toFixed(2)) : 0,
    result: record.failed ? "FAIL" : "PASS",
  })).sort((a, b) => b.percentage - a.percentage);
};
