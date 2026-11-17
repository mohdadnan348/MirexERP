import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { tenantContext, requireTenant } from "../middleware/tenantContext";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { generateAndSendPdf } from "../utils/pdf";
import Student from "./students/students.model";
import Session from "./sessions/sessions.model";
import Timetable from "./timetable/timetable.model";
import Exam from "./exams/exams.model";
import { ExamMark } from "./exams/exam-mark.model";
import { ExamStatus } from "./exams/exams.model";
import { Payroll } from "./payroll/payroll.model";
import { Certificate } from "./certificates/certificates.model";
import { Event } from "./events/events.model";
import { Attendance } from "./attendance/attendance.model";
import { Parent } from "./parents/parents.model";
import ParentChildRelationship from "./parents/parent-child-relationship.model";
import StudentPortal from "./student-portal/student-portal.model";
import User from "./auth/auth.model";
import { getHomeworksService } from "./homework/homework.service";
import { FeeInvoice, FeeInvoice as FeeInvoiceModel } from "./fees/fees.model";
import { createRazorpayFeeOrderService, verifyRazorpayFeePaymentService } from "./fees/payment-gateway.service";
import Class from "./classes/classes.model";
import Section from "./sections/sections.model";
import { downloadStudentIdCard } from "./students/students.controller";
import { transferStudentAllocation } from "./class-section/class-section.service";
import { closeAcademicSession } from "./sessions/sessions-advanced.service";
import { FinanceTransaction } from "./finance/finance.model";
import Transport from "./transport/transport.model";
import { Communication, CommunicationDelivery } from "./communication/communication.model";

const router = Router();
router.use(authenticate, tenantContext, requireTenant);

const school = (req: Request): Types.ObjectId => {
  const id = req.user?.schoolId;
  if (!id || !Types.ObjectId.isValid(id)) throw new AppError("Valid school context is required", 400);
  return new Types.ObjectId(id);
};
const actor = (req: Request): Types.ObjectId => {
  const id = req.user?.userId || req.user?.id;
  if (!id || !Types.ObjectId.isValid(id)) throw new AppError("Valid authenticated user is required", 401);
  return new Types.ObjectId(id);
};
const oid = (value: unknown, label: string): Types.ObjectId => {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) throw new AppError(`Valid ${label} is required`, 400);
  return new Types.ObjectId(value);
};
const param = (req: Request, key: string): string => {
  const value = req.params[key];
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) throw new AppError(`Valid ${key} is required`, 400);
  return value;
};
const sendPdf = (res: Response, title: string, lines: string[], filename: string) =>
  generateAndSendPdf(res, (doc) => {
    doc.fontSize(18).fillColor("#18223a").text(title, { align: "center" });
    doc.moveDown();
    lines.forEach((line) => doc.fontSize(10).fillColor("#344054").text(line, { lineGap: 5 }));
  }, filename, { title, author: "MirexERP" });

// Student transfer: validate target class/section/session are within the same school.
router.get("/students/:id/id-card/pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST", "TEACHER"), downloadStudentIdCard);

router.post("/students/:id/transfer", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const schoolId = school(req); const studentId = param(req, "id");
  const { classId, sectionId, sessionId, reason } = req.body ?? {};
  const result = await transferStudentAllocation(studentId, {
    classId: String(classId || ""), sectionId: String(sectionId || ""), sessionId: String(sessionId || ""),
    reason: typeof reason === "string" && reason.trim() ? reason : "Legacy student transfer endpoint",
  }, { userId: actor(req).toString(), schoolId: schoolId.toString(), role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_") });
  res.json({ success: true, message: "Student transferred successfully", data: result });
}));

// Academic session close (retains the record and only deactivates it).
router.post("/sessions/:id/close", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const result = await closeAcademicSession(param(req, "id"), req.body?.confirmation, {
    userId: actor(req).toString(), schoolId: school(req).toString(),
    role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_"),
  });
  res.json({ success: true, message: "Academic session closed permanently", data: result });
}));

// Validate timetable entries for class-period and teacher time conflicts.
router.post("/timetables/validate", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const schoolId = school(req); const entries = req.body?.entries;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 300) throw new AppError("entries must contain 1–300 timetable rows", 400);
  const conflicts: Array<Record<string, unknown>> = [];
  const seenClass = new Set<string>(); const seenTeacher = new Set<string>();
  for (const [index, row] of entries.entries()) {
    if (!row || !row.sessionId || !row.classId || !row.sectionId || !row.dayOfWeek || !Number.isInteger(row.periodNumber) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endTime || "") || row.startTime >= row.endTime) throw new AppError(`Invalid timetable entry at index ${index}`, 400);
    const classKey = `${row.sessionId}:${row.classId}:${row.sectionId}:${row.dayOfWeek}:${row.periodNumber}`;
    if (seenClass.has(classKey)) conflicts.push({ index, type: "CLASS_PERIOD_DUPLICATE" }); seenClass.add(classKey);
    if (row.teacherId) { const teacherKey = `${row.sessionId}:${row.teacherId}:${row.dayOfWeek}:${row.startTime}`; if (seenTeacher.has(teacherKey)) conflicts.push({ index, type: "TEACHER_PERIOD_DUPLICATE" }); seenTeacher.add(teacherKey); }
    const common = { schoolId, sessionId: oid(row.sessionId, "session ID"), dayOfWeek: row.dayOfWeek, isActive: true, startTime: { $lt: row.endTime }, endTime: { $gt: row.startTime } };
    const classConflicts = await Timetable.find({ ...common, classId: oid(row.classId, "class ID"), sectionId: oid(row.sectionId, "section ID") }).select("classId sectionId teacherId dayOfWeek periodNumber startTime endTime").lean();
    if (classConflicts.length) conflicts.push({ index, type: "CLASS_TIME_OVERLAP", records: classConflicts });
    if (row.teacherId) {
      const teacherConflicts = await Timetable.find({ ...common, teacherId: oid(row.teacherId, "teacher ID") }).select("classId sectionId teacherId dayOfWeek periodNumber startTime endTime").lean();
      if (teacherConflicts.length) conflicts.push({ index, type: "TEACHER_TIME_OVERLAP", records: teacherConflicts });
    }
  }
  res.json({ success: true, data: { valid: conflicts.length === 0, conflicts } });
}));

router.get("/timetables/:id/pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const rows = await Timetable.find({ schoolId: school(req), _id: param(req, "id") }).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name").populate("teacherId", "firstName lastName").lean();
  if (!rows.length) throw new AppError("Timetable not found", 404);
  const lines = rows.map((r: any) => `${r.dayOfWeek} | Period ${r.periodNumber} | ${r.startTime}-${r.endTime} | ${r.subjectId?.name || r.breakName || "Break"} | ${r.teacherId ? `${r.teacherId.firstName || ""} ${r.teacherId.lastName || ""}` : "—"}`);
  return sendPdf(res, "Class Timetable", lines, `timetable-${req.params.id}.pdf`);
}));

router.post("/exams/:id/approve", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: param(req, "id"), schoolId: school(req) });
  if (!exam) throw new AppError("Exam not found", 404);
  if (exam.status === "CANCELLED") throw new AppError("Cancelled exams cannot be approved", 409);
  if (exam.marksWorkflowStatus !== "VERIFIED") throw new AppError("Only verified marks can be approved; use the exam workflow first", 409);
  exam.marksWorkflowStatus = "APPROVED" as typeof exam.marksWorkflowStatus; exam.approvedAt = new Date(); exam.approvedBy = actor(req); exam.updatedBy = actor(req); await exam.save();
  res.json({ success: true, message: "Examination results approved; publication is a separate authorized step", data: exam });
}));

router.get("/exams/:id/report-cards/pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const schoolId = school(req); const exam = await Exam.findOne({ _id: param(req, "id"), schoolId, isPublished: true, marksWorkflowStatus: "PUBLISHED" }).lean();
  if (!exam) throw new AppError("Published exam not found", 404);
  const enrolled = await Student.countDocuments({ schoolId, sessionId: exam.sessionId, classId: exam.classId, isActive: true, isDeleted: false });
  const expectedMarks = enrolled * exam.subjects.length;
  const actualMarks = await ExamMark.countDocuments({ schoolId, examId: exam._id });
  if (!expectedMarks || actualMarks < expectedMarks) throw new AppError("Report cards are unavailable because marks are incomplete", 409);
  const marks = await ExamMark.find({ schoolId, examId: exam._id }).populate("studentId", "firstName lastName admissionNumber").populate("subjectId", "name").sort({ studentId: 1 }).lean();
  const lines = marks.map((m: any) => `${m.studentId?.admissionNumber || ""} ${m.studentId?.firstName || ""} ${m.studentId?.lastName || ""} | ${m.subjectId?.name || "Subject"} | ${m.marksObtained}`);
  return sendPdf(res, `${exam.examName} — Result Report`, lines.length ? lines : ["No marks have been entered."], `report-cards-${req.params.id}.pdf`);
}));

router.get("/exams/:id/merit-list", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const schoolId = school(req); const examId = oid(param(req, "id"), "exam ID");
  const exam = await Exam.findOne({ _id: examId, schoolId, isPublished: true, marksWorkflowStatus: "PUBLISHED" }).lean(); if (!exam) throw new AppError("Published exam not found", 404);
  const enrolled = await Student.countDocuments({ schoolId, sessionId: exam.sessionId, classId: exam.classId, isActive: true, isDeleted: false });
  const expectedMarks = enrolled * exam.subjects.length;
  const actualMarks = await ExamMark.countDocuments({ schoolId, examId });
  if (!expectedMarks || actualMarks < expectedMarks) throw new AppError("Merit list is unavailable because marks are incomplete", 409);
  const rows = await ExamMark.aggregate([{ $match: { schoolId, examId } }, { $group: { _id: "$studentId", totalMarks: { $sum: "$marksObtained" }, subjects: { $sum: 1 } } }, { $sort: { totalMarks: -1 } }, { $limit: 500 }, { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } }, { $unwind: "$student" }, { $project: { studentId: "$_id", totalMarks: 1, subjects: 1, admissionNumber: "$student.admissionNumber", firstName: "$student.firstName", lastName: "$student.lastName" } }]);
  res.json({ success: true, data: rows.map((r, i) => ({ rank: i + 1, ...r })) });
}));

router.get("/payroll/slips/:id/pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const payroll = await Payroll.findOne({ _id: param(req, "id"), schoolId: school(req) }).populate("employeeId", "firstName lastName employeeCode designation").lean() as any;
  if (!payroll) throw new AppError("Payroll record not found", 404);
  const lines = [`Employee: ${payroll.employeeId?.firstName || ""} ${payroll.employeeId?.lastName || ""}`, `Employee Code: ${payroll.employeeId?.employeeCode || "—"}`, `Period: ${payroll.payrollMonth}/${payroll.payrollYear}`, `Basic salary: INR ${payroll.basicSalary}`, `Gross salary: INR ${payroll.grossSalary}`, `Deductions: INR ${payroll.deductions?.total || 0}`, `Net salary: INR ${payroll.netSalary}`, `Status: ${payroll.paymentStatus}`];
  return sendPdf(res, "Salary Slip", lines, `salary-slip-${req.params.id}.pdf`);
}));

router.post("/certificates/:id/approve", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ _id: param(req, "id"), schoolId: school(req) }); if (!cert) throw new AppError("Certificate not found", 404);
  if (cert.status === "REVOKED") throw new AppError("Revoked certificate cannot be approved", 409);
  cert.isVerified = true; cert.approvalStatus = "APPROVED"; cert.approvedBy = actor(req); cert.approvedAt = new Date(); cert.updatedBy = actor(req); await cert.save();
  res.json({ success: true, message: "Certificate approved", data: cert });
}));

router.get("/calendar/pdf", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Valid calendar year is required", 400);
  const events = await Event.find({ schoolId: school(req), isPublished: true, startDate: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) } }).sort({ startDate: 1 }).limit(1000).lean();
  const lines = events.map((event) => `${new Date(event.startDate).toLocaleDateString("en-IN")} – ${event.title} (${event.category})${event.venue ? ` | ${event.venue}` : ""}`);
  return sendPdf(res, `Academic Calendar ${year}`, lines.length ? lines : ["No published events for this year."], `academic-calendar-${year}.pdf`);
}));

router.get("/calendar", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const from = typeof req.query.startDate === "string" ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = typeof req.query.endDate === "string" ? new Date(req.query.endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new AppError("Invalid calendar date range", 400);
  const events = await Event.find({ schoolId: school(req), isPublished: true, startDate: { $lte: to }, endDate: { $gte: from } }).sort({ startDate: 1 }).limit(500).lean();
  res.json({ success: true, data: events });
}));

router.get("/attendance/reports/monthly", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const month = Number(req.query.month); const year = Number(req.query.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Valid month and year are required", 400);
  const start = new Date(year, month - 1, 1); const end = new Date(year, month, 1);
  const data = await Attendance.aggregate([{ $match: { schoolId: school(req), attendanceType: "STUDENT", isDeleted: false, attendanceDate: { $gte: start, $lt: end } } }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  res.json({ success: true, data: { month, year, totals: data } });
}));

router.get("/reports/cashbook", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const start = typeof req.query.startDate === "string" ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = typeof req.query.endDate === "string" ? new Date(req.query.endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new AppError("Invalid date range", 400);
  const transactions = await FinanceTransaction.find({ schoolId: school(req), paymentMethod: "CASH", status: "ACTIVE", transactionDate: { $gte: start, $lte: end } }).sort({ transactionDate: 1 }).limit(5000).lean();
  res.json({ success: true, data: transactions });
}));

// Parent/student self-service endpoints. Student account is resolved by matching the authenticated email.
const getLinkedStudents = async (req: Request, permission?: "attendance" | "timetable" | "homework" | "results" | "fees" | "communication") => {
  const schoolId = school(req), userId = actor(req);
  const requestedId = typeof req.query.studentId === "string" ? req.query.studentId : typeof req.query.childId === "string" ? req.query.childId : undefined;
  if (req.user?.role === "PARENT") {
    const parent = await Parent.findOne({ schoolId, userId, isActive: true }).select("_id studentIds").lean();
    if (!parent) throw new AppError("Parent profile is not linked to this account", 404);
    const allMappings = await ParentChildRelationship.find({ schoolId, parentId: parent._id }).select("studentId status permissions").lean();
    const mappedIds = new Set((allMappings as any[]).map((item) => String(item.studentId)));
    const allowedMappings = (allMappings as any[]).filter((item) => item.status === "ACTIVE" && (!permission || item.permissions?.[permission] === true)).map((item) => String(item.studentId));
    const legacyIds = parent.studentIds.map((id) => String(id)).filter((id) => !mappedIds.has(id));
    let ids = [...allowedMappings, ...legacyIds];
    if (requestedId) {
      if (!Types.ObjectId.isValid(requestedId) || !ids.includes(requestedId)) throw new AppError("You do not have permission to access this child data", 403);
      ids = [requestedId];
    }
    return Student.find({ schoolId, _id: { $in: ids }, isDeleted: false }).lean();
  }
  if (req.user?.role === "STUDENT") {
    let portal = await StudentPortal.findOne({ schoolId, userId }).select("studentId").lean();
    if (!portal) {
      const user = await User.findById(userId).select("email").lean();
      if (user?.email) {
        const matches = await Student.find({ schoolId, email: user.email.toLowerCase(), isActive: true, isDeleted: false, status: "ACTIVE" }).limit(2).select("_id").lean();
        if (matches.length === 1) {
          portal = await StudentPortal.findOneAndUpdate({ schoolId, studentId: matches[0]._id }, { $set: { userId } }, { new: true, upsert: true, setDefaultsOnInsert: true }).select("studentId").lean() as any;
        }
      }
    }
    if (!portal?.studentId) throw new AppError("Student portal account is not linked", 403);
    const student = await Student.findOne({ _id: portal.studentId, schoolId, isActive: true, isDeleted: false, status: "ACTIVE" }).lean();
    if (!student) throw new AppError("Student profile is not active", 403);
    if (requestedId && requestedId !== String(student._id)) throw new AppError("Students can only access their own records", 403);
    return [student];
  }
  throw new AppError("Parent or student role required", 403);
};
router.get("/me/profile", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const linked = await getLinkedStudents(req); const user = await User.findById(actor(req)).select("name email phone role avatar").lean();
  res.json({ success: true, data: { account: user, students: linked } });
}));
router.get("/me/attendance", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req, "attendance"); const ids = students.map((s) => s._id);
  const data = await Attendance.find({ schoolId: school(req), studentId: { $in: ids }, attendanceType: "STUDENT", isDeleted: false }).sort({ attendanceDate: -1 }).limit(366).lean();
  res.json({ success: true, data });
}));
router.get("/me/homework", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const result = await getHomeworksService({
    userId: actor(req).toString(),
    schoolId: school(req).toString(),
    role: String(req.user?.role || "").toUpperCase(),
    email: req.user?.email,
  }, req.query);
  res.json({ success: true, data: result.items, pagination: result.pagination });
}));
router.get("/me/exams", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req, "results");
  const classSessionPairs = new Map<string, { sessionId: Types.ObjectId; classId: Types.ObjectId }>();
  for (const student of students) classSessionPairs.set(`${String(student.sessionId)}:${String(student.classId)}`, { sessionId: student.sessionId as Types.ObjectId, classId: student.classId as Types.ObjectId });
  const clauses = [...classSessionPairs.values()].map((pair) => ({ sessionId: pair.sessionId, classId: pair.classId }));
  if (!clauses.length) return res.json({ success: true, data: [] });
  const exams = await Exam.find({ schoolId: school(req), $or: clauses, status: { $nin: ["DRAFT", "CANCELLED"] } }).populate("subjects.subjectId", "name subjectName code subjectCode").sort({ startDate: 1 }).limit(300).lean();
  return res.json({ success: true, data: exams });
}));
router.get("/me/results", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req, "results"); const marks = await ExamMark.find({ schoolId: school(req), studentId: { $in: students.map((s) => s._id) } }).populate("examId", "examName isPublished marksWorkflowStatus startDate").populate("subjectId", "name").sort({ createdAt: -1 }).limit(500).lean();
  res.json({ success: true, data: marks.filter((m: any) => m.examId?.isPublished && m.examId?.marksWorkflowStatus === "PUBLISHED") });
}));
router.get("/me/fees", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req, "fees"); const data = await FeeInvoice.find({ schoolId: school(req), studentId: { $in: students.map((s) => s._id) } }).sort({ dueDate: -1 }).limit(200).lean();
  res.json({ success: true, data });
}));
router.post("/me/fees/pay", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req, "fees"); const invoiceId = req.body?.invoiceId;
  if (typeof invoiceId !== "string" || !Types.ObjectId.isValid(invoiceId)) throw new AppError("Valid invoiceId is required", 400);
  const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: school(req), studentId: { $in: students.map((s) => s._id) }, isDeleted: false }).select("_id");
  if (!invoice) throw new AppError("Fee invoice is not linked to this parent/student account", 404);
  const result = await createRazorpayFeeOrderService(invoiceId, req.body?.amount, { userId: String(actor(req)), schoolId: String(school(req)) });
  res.status(201).json({ success: true, message: "Payment order created", data: result });
}));
router.post("/me/fees/pay/verify", authorize("PARENT", "STUDENT"), asyncHandler(async (req, res) => {
  const students = await getLinkedStudents(req); const invoiceId = req.body?.invoiceId;
  if (typeof invoiceId !== "string" || !Types.ObjectId.isValid(invoiceId)) throw new AppError("Valid invoiceId is required", 400);
  const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: school(req), studentId: { $in: students.map((s) => s._id) }, isDeleted: false }).select("_id");
  if (!invoice) throw new AppError("Fee invoice is not linked to this parent/student account", 404);
  const result = await verifyRazorpayFeePaymentService({ invoiceId, razorpayOrderId: req.body?.razorpayOrderId, razorpayPaymentId: req.body?.razorpayPaymentId, razorpaySignature: req.body?.razorpaySignature }, { userId: String(actor(req)), schoolId: String(school(req)) });
  res.json({ success: true, message: "Fee payment verified", data: result });
}));

// Class/section endpoint shapes used by the PDF blueprint.
router.get("/classes/:id/sections", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"), asyncHandler(async (req, res) => {
  const classId = oid(param(req, "id"), "class ID");
  const classDoc = await Class.findOne({ _id: classId, schoolId: school(req) }).select("_id");
  if (!classDoc) throw new AppError("Class not found", 404);
  const sections = await Section.find({ schoolId: school(req), classId }).sort({ name: 1 }).lean();
  res.json({ success: true, data: sections });
}));
router.post("/classes/:id/sections", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const classId = oid(param(req, "id"), "class ID"); const schoolId = school(req);
  const sessionId = oid(req.body?.sessionId, "session ID");
  const [classDoc, session] = await Promise.all([
    Class.findOne({ _id: classId, schoolId, sessionId, isDeleted: false }),
    Session.findOne({ _id: sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }),
  ]);
  if (!classDoc) throw new AppError("Class not found in the selected session", 404);
  if (!session) throw new AppError("Academic session not found or closed", 404);
  if (typeof req.body?.name !== "string" || typeof req.body?.code !== "string") throw new AppError("Section name and code are required", 400);
  const section = await Section.create({ schoolId, sessionId, classId, name: req.body.name, code: req.body.code, displayName: req.body.displayName, roomNumber: req.body.roomNumber, capacity: req.body.capacity, description: req.body.description, classTeacherId: req.body.classTeacherId ? oid(req.body.classTeacherId, "class teacher ID") : null, isActive: true, isDeleted: false, createdBy: actor(req) });
  res.status(201).json({ success: true, message: "Section created", data: section });
}));
router.post("/sections/:id/students", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const sectionId = param(req, "id"); const studentId = oid(req.body?.studentId, "student ID");
  const section = await Section.findOne({ _id: sectionId, schoolId: school(req), isDeleted: false }).select("classId sessionId");
  if (!section) throw new AppError("Section not found", 404);
  const result = await transferStudentAllocation(String(studentId), {
    sessionId: String(section.sessionId), classId: String(section.classId), sectionId,
    reason: "Legacy section assignment endpoint",
  }, { userId: actor(req).toString(), schoolId: school(req).toString(), role: String(req.user?.role || "").toUpperCase().replaceAll(" ", "_") });
  res.json({ success: true, message: "Student assigned to section", data: result });
}));

// CSV export for the report datasets supported by the current MongoDB models.
router.post("/reports/:reportKey/export", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"), asyncHandler(async (req, res) => {
  const key = req.params.reportKey; const schoolId = school(req); const from = req.body?.startDate ? new Date(req.body.startDate) : new Date(new Date().getFullYear(), 0, 1); const to = req.body?.endDate ? new Date(req.body.endDate) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new AppError("Invalid export date range", 400);
  let rows: any[];
  if (key === "students") rows = await Student.find({ schoolId }).select("admissionNumber firstName lastName email phone status").lean();
  else if (key === "attendance") rows = await Attendance.find({ schoolId, attendanceDate: { $gte: from, $lte: to }, isDeleted: false }).select("attendanceType studentId employeeId attendanceDate status").lean();
  else if (key === "payroll") rows = await Payroll.find({ schoolId, createdAt: { $gte: from, $lte: to } }).select("employeeId payrollMonth payrollYear grossSalary deductions.total netSalary paymentStatus").lean();
  else if (key === "fees") rows = await FeeInvoiceModel.find({ schoolId, createdAt: { $gte: from, $lte: to }, isDeleted: false }).select("invoiceNumber studentId totalAmount paidAmount balanceAmount status dueDate").lean();
  else if (key === "finance" || key === "cashbook") rows = await FinanceTransaction.find({ schoolId, transactionDate: { $gte: from, $lte: to } }).select("transactionNumber type title amount paymentMethod transactionDate status").lean();
  else throw new AppError("Unsupported reportKey. Supported: students, attendance, payroll, fees, finance, cashbook", 400);
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const csvCell = (value: unknown) => `"${String(value instanceof Date ? value.toISOString() : value ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.map(csvCell).join(","), ...rows.map((row) => keys.map((k) => csvCell(row[k] && typeof row[k] === "object" && !(row[k] instanceof Date) ? JSON.stringify(row[k]) : row[k])).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", `attachment; filename="${key}-report.csv"`); res.status(200).send(csv);
}));


// Transport blueprint aliases backed by the existing transport collection and embedded route stops.
router.post("/transport/vehicles", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"), asyncHandler(async (req, res) => {
  const vehicle = await Transport.create({ ...req.body, schoolId: school(req), createdBy: actor(req) });
  res.status(201).json({ success: true, message: "Vehicle created", data: vehicle });
}));
router.post("/transport/routes", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"), asyncHandler(async (req, res) => {
  const vehicleId = oid(req.body?.vehicleId, "vehicle ID");
  if (typeof req.body?.routeName !== "string" || !req.body.routeName.trim() || !Array.isArray(req.body?.stops)) throw new AppError("routeName and stops array are required", 400);
  const vehicle = await Transport.findOne({ _id: vehicleId, schoolId: school(req) });
  if (!vehicle) throw new AppError("Vehicle not found", 404);
  vehicle.routeName = req.body.routeName.trim(); vehicle.stops = req.body.stops; vehicle.updatedBy = actor(req); await vehicle.save();
  res.json({ success: true, message: "Transport route updated", data: vehicle });
}));

// In-app notifications use the existing communication and delivery collections.
router.get("/notifications", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "RECEPTIONIST", "PARENT", "STUDENT", "LIBRARIAN", "TRANSPORT_MANAGER"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { schoolId: school(req), recipientId: actor(req) };
  const [items, total] = await Promise.all([CommunicationDelivery.find(filter).populate({ path: "communicationId", match: { deletedAt: null } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CommunicationDelivery.countDocuments(filter)]);
  res.json({ success: true, data: items.filter((item: any) => item.communicationId), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
router.post("/notifications", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : ""; const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const recipientIds = req.body?.recipientIds;
  if (!title || !message || !Array.isArray(recipientIds) || recipientIds.length < 1 || recipientIds.length > 500 || recipientIds.some((id: unknown) => typeof id !== "string" || !Types.ObjectId.isValid(id))) throw new AppError("title, message and 1–500 valid recipientIds are required", 400);
  const ids = [...new Set(recipientIds as string[])].map((id) => new Types.ObjectId(id));
  const validUsers = await User.countDocuments({ _id: { $in: ids }, schoolId: school(req), isDeleted: false, isActive: true });
  if (validUsers !== ids.length) throw new AppError("Every notification recipient must be an active user in this school", 400);
  const communication = await Communication.create({ schoolId: school(req), title, message, type: "GENERAL", audiences: ["INDIVIDUAL"], recipientIds: ids, channels: ["IN_APP"], status: "PUBLISHED", priority: req.body?.priority || "NORMAL", publishedAt: new Date(), createdBy: actor(req) });
  await CommunicationDelivery.insertMany(ids.map((recipientId) => ({ schoolId: school(req), communicationId: communication._id, recipientId, channel: "IN_APP", status: "QUEUED" })));
  res.status(201).json({ success: true, message: "In-app notification queued", data: communication });
}));
router.get("/notifications/:id/delivery", authorize("SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "RECEPTIONIST", "PARENT", "STUDENT", "LIBRARIAN", "TRANSPORT_MANAGER"), asyncHandler(async (req, res) => {
  const communicationId = oid(param(req, "id"), "notification ID"); const filter: Record<string, unknown> = { schoolId: school(req), communicationId };
  if (!["SCHOOL_ADMIN", "PRINCIPAL"].includes(req.user?.role || "")) filter.recipientId = actor(req);
  const data = await CommunicationDelivery.find(filter).populate("recipientId", "name email").sort({ createdAt: -1 }).lean();
  if (!data.length) throw new AppError("Notification delivery records not found", 404);
  res.json({ success: true, data });
}));


// Parent-student linking and documented section transfer workflow.
router.post("/parents/:id/students", authorize("SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"), asyncHandler(async (req, res) => {
  const parentId = oid(param(req, "id"), "parent ID"); const studentId = oid(req.body?.studentId, "student ID");
  const [parent, student] = await Promise.all([Parent.findOne({ _id: parentId, schoolId: school(req), isActive: true }), Student.findOne({ _id: studentId, schoolId: school(req) })]);
  if (!parent || !student) throw new AppError("Parent or student not found in this school", 404);
  student.parentId = parent._id; student.updatedBy = actor(req); await student.save();
  if (!parent.studentIds.some((id) => id.equals(student._id))) { parent.studentIds.push(student._id); parent.updatedBy = actor(req); await parent.save(); }
  res.json({ success: true, message: "Student linked to parent", data: { parentId: parent._id, studentId: student._id } });
}));
router.post("/sections/:id/transfer", authorize("SCHOOL_ADMIN", "PRINCIPAL"), asyncHandler(async (req, res) => {
  const sourceSectionId = oid(param(req, "id"), "source section ID"); const targetSectionId = oid(req.body?.targetSectionId, "target section ID");
  const [source, target] = await Promise.all([Section.findOne({ _id: sourceSectionId, schoolId: school(req) }), Section.findOne({ _id: targetSectionId, schoolId: school(req) })]);
  if (!source || !target || !source.classId.equals(target.classId)) throw new AppError("Source and target sections must exist in the same school and class", 400);
  const result = await Student.updateMany({ schoolId: school(req), sectionId: source._id, ...(Array.isArray(req.body?.studentIds) && req.body.studentIds.length ? { _id: { $in: req.body.studentIds.map((id: string) => oid(id, "student ID")) } } : {}) }, { $set: { sectionId: target._id, updatedBy: actor(req) } }, { runValidators: true });
  res.json({ success: true, message: "Section transfer completed", data: { matched: result.matchedCount, modified: result.modifiedCount } });
}));
router.post("/transport/assignments", authorize("SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"), asyncHandler(async (req, res) => {
  const vehicleId = oid(req.body?.vehicleId, "vehicle ID"); const studentId = oid(req.body?.studentId, "student ID"); const stopId = oid(req.body?.stopId, "stop ID");
  const [vehicle, student] = await Promise.all([Transport.findOne({ _id: vehicleId, schoolId: school(req) }), Student.findOne({ _id: studentId, schoolId: school(req) })]);
  if (!vehicle || !student) throw new AppError("Vehicle or student not found in this school", 404);
  if (!vehicle.stops.some((stop) => stop._id?.equals(stopId))) throw new AppError("Stop does not belong to this vehicle", 400);
  vehicle.studentAssignments = vehicle.studentAssignments.filter((a) => !a.studentId.equals(studentId));
  vehicle.studentAssignments.push({ studentId, stopId, assignedAt: new Date(), assignedBy: actor(req) });
  if (!vehicle.assignedStudents.some((id) => id.equals(studentId))) vehicle.assignedStudents.push(studentId);
  vehicle.updatedBy = actor(req); await vehicle.save();
  res.json({ success: true, message: "Student transport assigned", data: { vehicleId, studentId, stopId } });
}));

export default router;
