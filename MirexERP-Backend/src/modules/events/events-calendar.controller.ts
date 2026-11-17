import type { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { Event } from "./events.model";
import Holiday from "../holidays/holidays.model";
import Exam from "../exams/exams.model";
import StudentPortal from "../student-portal/student-portal.model";
import Parent from "../parents/parents.model";
import ParentChildRelationship from "../parents/parent-child-relationship.model";
import Student from "../students/students.model";

export const getAcademicCalendar = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = req.user?.schoolId;
  if (!schoolId || !Types.ObjectId.isValid(schoolId)) throw new AppError("School context is required", 403);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0, 23, 59, 59, 999);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new AppError("Invalid calendar date range", 400);
  const school = new Types.ObjectId(schoolId), role = String(req.user?.role || ""), userId = req.user?.userId;
  const audience = role === "PARENT" ? "PARENTS" : role === "STUDENT" ? "STUDENTS" : role === "TEACHER" ? "TEACHERS" : "EMPLOYEES";
  const isPortalRole = ["PARENT", "STUDENT", "TEACHER"].includes(role);
  let linkedStudents: any[] = [];
  if (role === "STUDENT" && userId && Types.ObjectId.isValid(userId)) {
    const portal = await StudentPortal.findOne({ schoolId: school, userId: new Types.ObjectId(userId) }).select("studentId").lean();
    if (portal) { const student = await Student.findOne({ _id: portal.studentId, schoolId: school, isDeleted: false }).select("_id classId sectionId sessionId").lean(); if (student) linkedStudents = [student]; }
  } else if (role === "PARENT" && userId && Types.ObjectId.isValid(userId)) {
    const parent = await Parent.findOne({ schoolId: school, userId: new Types.ObjectId(userId), isActive: true }).select("_id studentIds").lean();
    if (parent) {
      const links = await ParentChildRelationship.find({ schoolId: school, parentId: parent._id }).select("studentId status permissions.communication").lean();
      const mappedIds = new Set(links.map((x: any) => String(x.studentId)));
      const activeIds = links.filter((x: any) => x.status === "ACTIVE" && x.permissions?.communication !== false).map((x: any) => String(x.studentId));
      const legacyIds = (parent.studentIds || []).map(String).filter((id: string) => !mappedIds.has(id));
      const linkedIds = [...new Set([...activeIds, ...legacyIds])].map((id) => new Types.ObjectId(id));
      linkedStudents = await Student.find({ _id: { $in: linkedIds }, schoolId: school, isDeleted: false }).select("_id classId sectionId sessionId").lean();
    }
  }
  const linkedClassIds = [...new Set(linkedStudents.map((s: any) => String(s.classId)).filter(Boolean))].map((id) => new Types.ObjectId(id));
  const linkedSectionIds = [...new Set(linkedStudents.map((s: any) => String(s.sectionId)).filter(Boolean))].map((id) => new Types.ObjectId(id));
  const linkedSessionIds = [...new Set(linkedStudents.map((s: any) => String(s.sessionId)).filter(Boolean))].map((id) => new Types.ObjectId(id));
  const requestedSessionId = req.query.sessionId && Types.ObjectId.isValid(String(req.query.sessionId)) ? new Types.ObjectId(String(req.query.sessionId)) : undefined;
  const sessionScope = isPortalRole ? (requestedSessionId ? linkedSessionIds.filter((id) => String(id) === String(requestedSessionId)) : linkedSessionIds) : requestedSessionId ? [requestedSessionId] : undefined;
  const eventFilter: Record<string, unknown> = { schoolId: school, isPublished: true, status: { $nin: ["CANCELLED", "DRAFT"] }, startDate: { $lte: to }, endDate: { $gte: from }, ...(sessionScope ? { sessionId: { $in: sessionScope } } : {}) };
  if (isPortalRole) {
    const visibleBranches: Record<string, unknown>[] = [{ targetAudience: { $in: ["ALL", audience] }, classIds: { $size: 0 } }];
    if (linkedClassIds.length) visibleBranches.push({ targetAudience: { $in: ["ALL", audience, "CLASS"] }, classIds: { $in: linkedClassIds } });
    if (linkedSectionIds.length) visibleBranches.push({ targetAudience: { $in: ["ALL", audience, "SECTION"] }, sectionIds: { $in: linkedSectionIds } });
    if (userId && Types.ObjectId.isValid(userId)) visibleBranches.push({ targetAudience: "INDIVIDUAL", recipientIds: new Types.ObjectId(userId) });
    eventFilter.$or = visibleBranches;
  }
  const [events, holidays, exams] = await Promise.all([
    Event.find(eventFilter).sort({ startDate: 1 }).lean(),
    Holiday.find({ schoolId: school, isDeleted: false, isActive: true, startDate: { $lte: to }, endDate: { $gte: from }, ...(["PARENT", "STUDENT"].includes(role) ? { applicableTo: { $in: ["STUDENTS", "BOTH"] } } : role === "TEACHER" ? { applicableTo: { $in: ["EMPLOYEES", "BOTH"] } } : {}), ...(sessionScope ? { sessionId: { $in: sessionScope } } : {}) }).sort({ startDate: 1 }).lean(),
    Exam.find({ schoolId: school, isPublished: true, status: { $nin: ["CANCELLED", "DRAFT"] }, startDate: { $lte: to }, endDate: { $gte: from }, ...(isPortalRole ? { classId: { $in: linkedClassIds } } : {}), ...(sessionScope ? { sessionId: { $in: sessionScope } } : {}) }).select("examName examType classId sessionId subjects startDate endDate").populate("classId", "name className").populate("subjects.subjectId", "name subjectName").lean(),
  ]);
  const eventItems = events.map((e: any) => ({ id: String(e._id), source: "EVENT", title: e.title, description: e.description, category: e.category, start: e.startDate, end: e.endDate, startTime: e.startTime, endTime: e.endTime, venue: e.venue, status: e.status }));
  const holidayItems = holidays.map((h: any) => ({ id: String(h._id), source: "HOLIDAY", title: h.name, description: h.description, category: "HOLIDAY", start: h.startDate, end: h.endDate, applicableTo: h.applicableTo }));
  const examItems = exams.flatMap((exam: any) => (exam.subjects || []).map((subject: any) => ({ id: `${String(exam._id)}:${String(subject._id)}`, source: "EXAM", title: `${exam.examName} — ${subject.subjectId?.name || "Subject"}`, category: "EXAMINATION", start: subject.examDate, end: subject.examDate, startTime: subject.startTime, endTime: subject.endTime, class: exam.classId?.className || exam.classId?.name, examId: String(exam._id) })));
  const items = [...eventItems, ...holidayItems, ...examItems].filter((item: any) => new Date(item.start) <= to && new Date(item.end) >= from).sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return sendSuccess(res, "Academic calendar fetched from existing event, holiday and examination records", { from, to, total: items.length, items, visibility: isPortalRole ? "Filtered to linked student class/section/session and active parent-child permissions." : "School management view" });
});
