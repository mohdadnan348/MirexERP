import { Types } from "mongoose";
import fs from "fs";
import path from "path";
import { AppError } from "../../utils/AppError";
import UserModel from "../auth/auth.model";
import { env } from "../../config/env";
import { getRelativeFilePath } from "../../utils/fileStorage";
import ClassSubjectMapping from "../subjects/class-subject-mapping.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Subject from "../subjects/subjects.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import Employee from "../employees/employees.model";
import Student, { StudentStatus } from "../students/students.model";
import { Parent } from "../parents/parents.model";
import ParentChildRelationship from "../parents/parent-child-relationship.model";
import Session from "../sessions/sessions.model";
import School from "../schools/schools.model";
import StudentPortal from "../student-portal/student-portal.model";
import { Communication, CommunicationDelivery, CommunicationSettings } from "../communication/communication.model";
import {
  Homework, HomeworkSubmission, HOMEWORK_STATUS, HOMEWORK_SUBMISSION_STATUS,
  type HomeworkAttachment,
} from "./homework.model";
import { HomeworkNotificationLog } from "./homework-notification.model";

export type HomeworkActor = {
  userId: string;
  schoolId: string;
  role: string;
  email?: string;
};

type Query = Record<string, any>;
type Payload = Record<string, any>;

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
const isAdmin = (actor: HomeworkActor) => ADMIN_ROLES.includes(actor.role);
const oid = (value: unknown, label = "ID"): Types.ObjectId => {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, 400);
  return new Types.ObjectId(value);
};
const schoolOid = (actor: HomeworkActor) => oid(actor.schoolId, "school ID");
const userOid = (actor: HomeworkActor) => oid(actor.userId, "user ID");
const parseDate = (value: unknown, label: string) => {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid ${label}`, 400);
  return d;
};
const localDateKey = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const localDateTimeToUtc = (date: string, time: string, timezone: string) => {
  const targetUtc = new Date(`${date}T${time}Z`).getTime();
  let candidate = targetUtc;
  // Iterate so time-zone offset changes around daylight-saving boundaries
  // are resolved against the requested local wall-clock time.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const values: Record<string, number> = {};
    for (const part of parts) if (part.type !== "literal") values[part.type] = Number(part.value);
    const representedLocalAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    const correction = targetUtc - representedLocalAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
};
const parseSchoolDueDate = (value: unknown, timezone: string) => {
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return localDateTimeToUtc(raw, "23:59:59", timezone);
  const localDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localDateTime && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return localDateTimeToUtc(localDateTime[1], `${localDateTime[2]}:${localDateTime[3] || "00"}`, timezone);
  }
  return parseDate(value, "due date");
};
const parseSchoolDateBound = (value: unknown, timezone: string, endOfDay = false) => {
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return localDateTimeToUtc(raw, endOfDay ? "23:59:59" : "00:00:00", timezone);
  return parseDate(value, endOfDay ? "end date" : "start date");
};
const normalizeTimezone = (timezone?: string) => {
  try {
    const candidate = timezone || "Asia/Kolkata";
    new Intl.DateTimeFormat("en-IN", { timeZone: candidate });
    return candidate;
  } catch {
    return "Asia/Kolkata";
  }
};
const getSchool = async (schoolId: Types.ObjectId) => {
  const school = await School.findOne({ _id: schoolId, isDeleted: false }).select("timezone");
  if (!school) throw new AppError("School not found", 404);
  return { timezone: normalizeTimezone(school.timezone) };
};
const getEmployeeId = async (actor: HomeworkActor) => {
  const employee = await Employee.findOne({
    schoolId: schoolOid(actor), userId: userOid(actor), status: "ACTIVE",
    isActive: true, isDeleted: false, employeeType: "TEACHING",
  }).select("_id").lean();
  if (!employee) throw new AppError("Teacher employee profile is not linked to this account", 403);
  return employee._id as Types.ObjectId;
};
const ensureTeacherAccess = async (homework: any, actor: HomeworkActor) => {
  if (isAdmin(actor)) return;
  if (actor.role !== "TEACHER") throw new AppError("You are not allowed to manage homework", 403);
  const teacherId = await getEmployeeId(actor);
  if (String(homework.teacherId) !== String(teacherId)) throw new AppError("You can only manage homework assigned to you", 403);
  const sections: Types.ObjectId[] = homework.sectionIds?.length ? homework.sectionIds : homework.sectionId ? [homework.sectionId] : [];
  const assignments = await SubjectTeacherAssignment.find({
    schoolId: homework.schoolId, sessionId: homework.academicSessionId, classId: homework.classId,
    subjectId: homework.subjectId, teacherId, isActive: true,
    $or: [{ sectionId: null }, ...(sections.length ? [{ sectionId: { $in: sections } }] : [])],
  }).select("sectionId").lean();
  const hasGeneralAssignment = assignments.some((assignment: any) => !assignment.sectionId);
  const assignedSections = new Set(assignments.map((assignment: any) => String(assignment.sectionId)));
  if (!assignments.length || (sections.length && !hasGeneralAssignment && sections.some((sectionId) => !assignedSections.has(String(sectionId))))) {
    throw new AppError("Your active subject/class assignment no longer grants access to this homework", 403);
  }
};
const resolveStudent = async (actor: HomeworkActor, requestedStudentId?: string) => {
  const schoolId = schoolOid(actor);
  if (actor.role === "STUDENT") {
    let student: any = await StudentPortal.findOne({ schoolId, userId: userOid(actor) }).select("studentId").lean();
    if (student?.studentId) {
      const profile = await Student.findOne({ _id: student.studentId, schoolId, isDeleted: false, isActive: true, status: StudentStatus.ACTIVE });
      if (profile) return profile;
    }
    if (actor.email) {
      const matches = await Student.find({ schoolId, email: actor.email.toLowerCase(), isDeleted: false, isActive: true, status: StudentStatus.ACTIVE }).limit(2);
      if (matches.length === 1) return matches[0];
    }
    throw new AppError("Student profile is not linked to this login. Ask School Admin to link the student portal account.", 403);
  }
  if (actor.role === "PARENT") {
    const parent = await Parent.findOne({ schoolId, userId: userOid(actor), isActive: true }).select("_id studentIds");
    if (!parent) throw new AppError("Parent profile is not linked to this account", 403);
    let ids = parent.studentIds.map((id) => String(id));
    if (requestedStudentId) {
      const mapping = await ParentChildRelationship.findOne({ schoolId, parentId: parent._id, studentId: requestedStudentId }).select("status permissions").lean();
      if (mapping) {
        if (mapping.status !== "ACTIVE" || mapping.permissions?.homework === false) throw new AppError("You do not have homework access for this child", 403);
      } else if (!ids.includes(requestedStudentId)) {
        throw new AppError("You do not have homework access for this child", 403);
      }
    } else {
      const allMappings = await ParentChildRelationship.find({ schoolId, parentId: parent._id }).select("studentId status permissions").lean();
      const mappedIds = new Set((allMappings as any[]).map((item: any) => String(item.studentId)));
      const permittedMappedIds = (allMappings as any[]).filter((item: any) => item.status === "ACTIVE" && item.permissions?.homework !== false).map((item: any) => String(item.studentId));
      const legacyIds = ids.filter((id) => !mappedIds.has(id));
      ids = [...permittedMappedIds, ...legacyIds];
    }
    if (!requestedStudentId && ids.length !== 1) throw new AppError("Select one of your permitted linked children using studentId", 400);
    const id = requestedStudentId || ids[0];
    const student = await Student.findOne({ _id: oid(id, "student ID"), schoolId, isDeleted: false });
    if (!student) throw new AppError("Linked student was not found", 404);
    return student;
  }
  throw new AppError("Student or parent access is required", 403);
};
const resolveStudentSet = async (actor: HomeworkActor, requestedStudentId?: string) => {
  if (actor.role === "STUDENT") return [await resolveStudent(actor)];
  if (actor.role === "PARENT") {
    const parent = await Parent.findOne({ schoolId: schoolOid(actor), userId: userOid(actor), isActive: true }).select("_id studentIds");
    if (!parent) throw new AppError("Parent profile is not linked to this account", 403);
    if (requestedStudentId) return [await resolveStudent(actor, requestedStudentId)];
    const allMappings = await ParentChildRelationship.find({ schoolId: schoolOid(actor), parentId: parent._id }).select("studentId status permissions").lean();
    const mappedIds = new Set((allMappings as any[]).map((item: any) => String(item.studentId)));
    const permittedMappedIds = (allMappings as any[]).filter((item: any) => item.status === "ACTIVE" && item.permissions?.homework !== false).map((item: any) => item.studentId);
    const legacyIds = parent.studentIds.filter((id: any) => !mappedIds.has(String(id)));
    const permittedIds = [...permittedMappedIds, ...legacyIds];
    const students = await Student.find({ _id: { $in: permittedIds }, schoolId: schoolOid(actor), isDeleted: false });
    return students;
  }
  return [];
};
const validateClassSessionSubject = async (schoolId: Types.ObjectId, sessionId: Types.ObjectId, classId: Types.ObjectId, subjectId: Types.ObjectId, sectionIds: Types.ObjectId[]) => {
  const [session, klass, subject] = await Promise.all([
    Session.findOne({ _id: sessionId, schoolId, isDeleted: false, isClosed: false }).select("_id"),
    Class.findOne({ _id: classId, schoolId, sessionId, isDeleted: false, isActive: true }).select("_id subjects"),
    Subject.findOne({ _id: subjectId, schoolId, isDeleted: false, isActive: true }).select("_id"),
  ]);
  if (!session) throw new AppError("Academic session is inactive, closed or does not belong to this school", 400);
  if (!klass) throw new AppError("Class does not belong to the selected academic session", 400);
  if (!subject) throw new AppError("Subject is inactive or unavailable", 400);
  const mapped = await ClassSubjectMapping.exists({ schoolId, sessionId, classId, subjectId, isActive: true, effectiveFrom: { $lte: new Date() } });
  if (!mapped && !(klass.subjects || []).some((id: Types.ObjectId) => String(id) === String(subjectId))) throw new AppError("Subject is not mapped to this class and academic session", 400);
  if (sectionIds.length) {
    const sections = await Section.find({ _id: { $in: sectionIds }, schoolId, classId, sessionId, isDeleted: false, isActive: true }).select("_id");
    if (sections.length !== sectionIds.length) throw new AppError("One or more sections do not belong to the selected class/session", 400);
  }
};
const validateTeacherAssignment = async (schoolId: Types.ObjectId, sessionId: Types.ObjectId, classId: Types.ObjectId, subjectId: Types.ObjectId, teacherId: Types.ObjectId, sectionIds: Types.ObjectId[]) => {
  const employee = await Employee.findOne({ _id: teacherId, schoolId, status: "ACTIVE", isActive: true, isDeleted: false, employeeType: "TEACHING" }).select("_id");
  if (!employee) throw new AppError("Assigned teacher is not an active teaching employee of this school", 400);
  const assignments = await SubjectTeacherAssignment.find({
    schoolId, sessionId, classId, subjectId, teacherId, isActive: true,
    $or: [{ sectionId: null }, ...(sectionIds.length ? [{ sectionId: { $in: sectionIds } }] : [])],
  }).select("sectionId").lean();
  if (!assignments.length) throw new AppError("Teacher is not assigned to this class and subject", 400);
  if (sectionIds.length) {
    const hasGeneral = assignments.some((a: any) => !a.sectionId);
    const allowed = new Set(assignments.map((a: any) => String(a.sectionId)));
    if (!hasGeneral && sectionIds.some((id) => !allowed.has(String(id)))) throw new AppError("Teacher is not assigned to every selected section", 400);
  }
};
const parseSectionIds = (payload: Payload): Types.ObjectId[] => {
  const raw = Array.isArray(payload.sectionIds) ? payload.sectionIds : payload.sectionId ? [payload.sectionId] : [];
  const ids = [...new Set(raw.map((id: unknown) => String(id)))];
  return ids.map((id) => oid(id, "section ID"));
};
const validateAttachments = (items: HomeworkAttachment[] = []) => {
  if (!Array.isArray(items) || items.length > 10) throw new AppError("A maximum of 10 attachments is allowed", 400);
  for (const file of items) {
    if (!file.name?.trim() || !file.url?.startsWith("/api/v1/homework/files/")) throw new AppError("Attachments must be uploaded through the secure homework upload endpoint", 400);
    if ((file.size || 0) > 10 * 1024 * 1024) throw new AppError("Each attachment must be 10 MB or smaller", 400);
  }
  return items;
};
const fileAttachments = (files: Express.Multer.File[] = []) => files.map((file) => ({
  name: path.basename(file.originalname.replace(/\\/g, "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200),
  url: `/api/v1/homework/files/${path.basename(file.filename)}`,
  type: file.mimetype,
  size: file.size,
  storagePath: getRelativeFilePath(file.path),
}));
const stripStoragePaths = (document: any) => {
  const value = document?.toObject ? document.toObject() : { ...document };
  const stripFiles = (items: any[] = []) => items.map((file) => {
    const safe = { ...file };
    delete safe.storagePath;
    return safe;
  });
  if (Array.isArray(value.attachments)) value.attachments = stripFiles(value.attachments);
  if (Array.isArray(value.attempts)) value.attempts = value.attempts.map((attempt: any) => ({
    ...attempt,
    attachments: stripFiles(attempt.attachments || []),
  }));
  return value;
};
const pageArgs = (query: Query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const pagination = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page < Math.ceil(total / limit), hasPreviousPage: page > 1 && total > 0 });

async function queueParentNotifications(
  schoolId: Types.ObjectId, homework: any, studentIds: Types.ObjectId[],
  type: "NEW_HOMEWORK" | "PENDING_REMINDER" | "GRADED", actorUserId: Types.ObjectId,
  extra: { marks?: number } = {},
) {
  try {
    const settings = await CommunicationSettings.findOne({ schoolId }).lean();
    if (settings && !settings.inAppEnabled) return;
    const [parents, studentPortals, enrolledStudents] = await Promise.all([
      settings?.parentNotifications === false ? [] : Parent.find({
        schoolId, studentIds: { $in: studentIds }, isActive: true, userId: { $ne: null },
      }).select("userId studentIds notificationPreferences").lean(),
      settings?.studentNotifications === false ? [] : StudentPortal.find({
        schoolId, studentId: { $in: studentIds },
      }).select("userId studentId preferences").lean(),
      settings?.studentNotifications === false ? [] : Student.find({ _id: { $in: studentIds }, schoolId }).select("_id email").lean(),
    ]);
    const relationshipRows = (parents as any[]).length ? await ParentChildRelationship.find({
      schoolId, parentId: { $in: (parents as any[]).map((parent: any) => parent._id) },
      studentId: { $in: studentIds },
    }).select("parentId studentId status permissions").lean() : [];
    const studentEmails = (enrolledStudents as any[]).map((student) => student.email).filter(Boolean);
    const studentUsers = studentEmails.length ? await UserModel.find({
      schoolId, role: "STUDENT", email: { $in: studentEmails }, isDeleted: false, isActive: true, status: "ACTIVE",
    }).select("_id email").lean() : [];
    const timezone = (await getSchool(schoolId)).timezone;
    const dayKey = type === "PENDING_REMINDER" ? localDateKey(new Date(), timezone) : type;
    const dueLabel = new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium" }).format(new Date(homework.dueDate));
    const subject = await Subject.findOne({ _id: homework.subjectId, schoolId }).select("name").lean();
    const subjectName = subject?.name || "the assigned subject";
    const recipients: Array<{ userId: Types.ObjectId; studentId: Types.ObjectId; role: "PARENT" | "STUDENT" }> = [];
    for (const parent of parents as any[]) {
      if (!parent.userId || parent.notificationPreferences?.homework === false) continue;
      const mappings = (relationshipRows as any[]).filter((item) => String(item.parentId) === String(parent._id));
      for (const studentId of studentIds) {
        const sid = String(studentId);
        const mapping = mappings.find((item) => String(item.studentId) === sid);
        const permitted = mapping
          ? mapping.status === "ACTIVE" && mapping.permissions?.homework !== false
          : parent.studentIds.some((legacyId: any) => String(legacyId) === sid);
        if (permitted) recipients.push({ userId: parent.userId, studentId: new Types.ObjectId(sid), role: "PARENT" });
      }
    }
    const portalLinkedIds = new Set<string>();
    const studentOptOutIds = new Set<string>();
    for (const portal of studentPortals as any[]) {
      const studentKey = String(portal.studentId);
      if (portal.preferences?.notificationsEnabled === false) studentOptOutIds.add(studentKey);
      if (portal.userId) {
        portalLinkedIds.add(studentKey);
        if (portal.preferences?.notificationsEnabled !== false) {
          recipients.push({ userId: portal.userId, studentId: portal.studentId, role: "STUDENT" });
        }
      }
    }
    for (const user of studentUsers as any[]) {
      const student: any = (enrolledStudents as any[]).find((item) => item.email?.toLowerCase() === user.email?.toLowerCase());
      if (student && !studentOptOutIds.has(String(student._id)) && !portalLinkedIds.has(String(student._id))) {
        recipients.push({ userId: user._id, studentId: student._id, role: "STUDENT" });
      }
    }
    for (const recipient of recipients) {
      const student = type === "PENDING_REMINDER"
        ? await Student.findOne({ _id: recipient.studentId, schoolId }).select("firstName lastName").lean()
        : null;
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : "Your child";
      const message = type === "NEW_HOMEWORK"
        ? `New homework assigned: ${homework.title} for ${subjectName}. Due date: ${dueLabel}.`
        : type === "GRADED"
          ? `Your homework ${homework.title} has been evaluated. Marks: ${extra.marks ?? "See student portal"}.`
          : `Reminder: ${studentName} has pending homework: ${homework.title}. Due date: ${dueLabel}.`;
      const notificationKey = {
        schoolId, homeworkId: homework._id, studentId: recipient.studentId,
        recipientUserId: recipient.userId, recipientRole: recipient.role,
        type, periodKey: dayKey,
      };
      let log: any = await HomeworkNotificationLog.findOne(notificationKey);
      if (log) {
        if (log.status !== "FAILED") continue;
        log.status = "QUEUED";
        log.error = undefined;
        await log.save();
      } else {
        try {
          log = await HomeworkNotificationLog.create({ ...notificationKey, status: "QUEUED" });
        } catch (error: any) {
          if (error?.code === 11000) continue;
          throw error;
        }
      }
      try {
        const communication = await Communication.create({
          schoolId,
          title: type === "NEW_HOMEWORK" ? "New homework assigned" : type === "GRADED" ? "Homework evaluated" : "Homework reminder",
          message, type: "GENERAL", audiences: [recipient.role === "PARENT" ? "PARENTS" : "STUDENTS"],
          recipientIds: [recipient.userId], channels: ["IN_APP"],
          status: "PUBLISHED", priority: "NORMAL", publishedAt: new Date(),
          createdBy: actorUserId, updatedBy: actorUserId,
        });
        await CommunicationDelivery.updateOne(
          { communicationId: communication._id, recipientId: recipient.userId, channel: "IN_APP" },
          { $setOnInsert: { schoolId, communicationId: communication._id, recipientId: recipient.userId, channel: "IN_APP", status: "QUEUED" } },
          { upsert: true },
        );
        await HomeworkNotificationLog.updateOne({ _id: log._id }, { $set: { communicationId: communication._id, status: "QUEUED" } });
      } catch (error: any) {
        await HomeworkNotificationLog.updateOne({ _id: log._id }, { $set: { status: "FAILED", error: String(error?.message || error).slice(0, 500) } });
      }
    }
  } catch (error) {
    console.error("[homework] Notification queue failed", error);
  }
}

export const createHomeworkService = async (payload: Payload, actor: HomeworkActor, files: Express.Multer.File[] = []) => {
  const schoolId = schoolOid(actor);
  if (!isAdmin(actor) && actor.role !== "TEACHER") throw new AppError("You are not allowed to create homework", 403);
  const sessionId = oid(payload.academicSessionId, "academic session ID");
  const classId = oid(payload.classId, "class ID");
  const subjectId = oid(payload.subjectId, "subject ID");
  const sectionIds = parseSectionIds(payload);
  await validateClassSessionSubject(schoolId, sessionId, classId, subjectId, sectionIds);
  const teacherId = actor.role === "TEACHER" ? await getEmployeeId(actor) : oid(payload.teacherId, "teacher ID");
  await validateTeacherAssignment(schoolId, sessionId, classId, subjectId, teacherId, sectionIds);
  const school = await getSchool(schoolId);
  const assignedDate = payload.assignedDate ? parseDate(payload.assignedDate, "assigned date") : new Date();
  const dueDate = parseSchoolDueDate(payload.dueDate, school.timezone);
  if (localDateKey(dueDate, school.timezone) < localDateKey(new Date(), school.timezone)) throw new AppError("Due date must be today or a future date in the school's timezone", 400);
  if (dueDate < assignedDate) throw new AppError("Due date cannot be before the assigned date", 400);
  const totalMarks = payload.totalMarks === "" || payload.totalMarks == null ? undefined : Number(payload.totalMarks);
  if (totalMarks !== undefined && (!Number.isFinite(totalMarks) || totalMarks < 0)) throw new AppError("Maximum marks must be zero or greater", 400);
  const status = payload.status === HOMEWORK_STATUS.PUBLISHED ? HOMEWORK_STATUS.PUBLISHED : HOMEWORK_STATUS.DRAFT;
  const homework = await Homework.create({
    schoolId, academicSessionId: sessionId, classId, sectionId: sectionIds.length === 1 ? sectionIds[0] : undefined,
    sectionIds, subjectId, teacherId, title: String(payload.title).trim(), description: String(payload.description).trim(),
    instructions: payload.instructions?.trim(), assignedDate, dueDate, totalMarks,
    attachments: [...validateAttachments(payload.attachments || []), ...fileAttachments(files)],
    allowSubmission: payload.allowSubmission !== false,
    allowLateSubmission: payload.allowLateSubmission === true,
    allowResubmission: payload.allowResubmission === true,
    status, publishedAt: status === HOMEWORK_STATUS.PUBLISHED ? new Date() : undefined,
    createdBy: userOid(actor),
  });
  if (status === HOMEWORK_STATUS.PUBLISHED) {
    const students = await Student.find({ schoolId, sessionId, classId, isDeleted: false, isActive: true, status: StudentStatus.ACTIVE, ...(sectionIds.length ? { sectionId: { $in: sectionIds } } : {}) }).select("_id").lean();
    await queueParentNotifications(schoolId, homework, students.map((s: any) => s._id), "NEW_HOMEWORK", userOid(actor));
  }
  return stripStoragePaths(homework);
};

const visibleHomeworkFilter = async (actor: HomeworkActor, query: Query) => {
  const schoolId = schoolOid(actor);
  const filter: any = { schoolId, isDeleted: { $ne: true } };
  if (actor.role === "TEACHER") {
    const teacherId = await getEmployeeId(actor);
    filter.teacherId = teacherId;
    const assignments = await SubjectTeacherAssignment.find({ schoolId, teacherId, isActive: true })
      .select("sessionId classId sectionId subjectId").lean();
    const visibleAssignments = assignments.map((assignment: any) => {
      const branch: any = {
        academicSessionId: assignment.sessionId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
      };
      if (assignment.sectionId) branch.$or = [{ sectionId: assignment.sectionId }, { sectionIds: assignment.sectionId }];
      return branch;
    });
    filter.$and = [{ $or: visibleAssignments }];
    if (!visibleAssignments.length) filter._id = { $in: [] };
  }
  if (actor.role === "STUDENT" || actor.role === "PARENT") {
    const students = await resolveStudentSet(actor, query.studentId);
    const timezone = query.startDate || query.endDate ? (await getSchool(schoolId)).timezone : "Asia/Kolkata";
    if (!students.length) throw new AppError("No linked student profiles were found", 403);
    filter.status = HOMEWORK_STATUS.PUBLISHED;
    filter.$or = students.map((student: any) => ({
      classId: student.classId,
      academicSessionId: student.sessionId,
      $or: [
        { sectionIds: { $size: 0 }, sectionId: { $exists: false } },
        { sectionIds: student.sectionId },
        { sectionId: student.sectionId },
      ],
    }));
    if (query.startDate || query.endDate) {
      filter.dueDate = {};
      if (query.startDate) filter.dueDate.$gte = parseSchoolDateBound(query.startDate, timezone, false);
      if (query.endDate) filter.dueDate.$lte = parseSchoolDateBound(query.endDate, timezone, true);
    }
    if (query.search?.trim()) {
      const escaped = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$and = [{ $or: [{ title: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }] }];
    }
    return filter;
  }
  const timezone = query.startDate || query.endDate ? (await getSchool(schoolId)).timezone : "Asia/Kolkata";
  for (const key of ["classId", "subjectId", "academicSessionId"]) {
    if (query[key]) filter[key] = oid(query[key], key);
  }
  if (query.teacherId && isAdmin(actor)) filter.teacherId = oid(query.teacherId, "teacher ID");
  if (query.sectionId) filter.$or = [{ sectionId: oid(query.sectionId) }, { sectionIds: oid(query.sectionId) }];
  if (query.status) filter.status = String(query.status);
  if (query.startDate || query.endDate) {
    filter.dueDate = {};
    if (query.startDate) filter.dueDate.$gte = parseSchoolDateBound(query.startDate, timezone, false);
    if (query.endDate) filter.dueDate.$lte = parseSchoolDateBound(query.endDate, timezone, true);
  }
  if (query.search?.trim()) {
    const escaped = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$and = [...(filter.$and || []), { $or: [{ title: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }] }];
  }
  return filter;
};

export const getHomeworksService = async (actor: HomeworkActor, query: Query) => {
  const { page, limit, skip } = pageArgs(query);
  const filter = await visibleHomeworkFilter(actor, query);
  const [items, total] = await Promise.all([
    Homework.find(filter).populate("classId", "name").populate("sectionId", "name").populate("sectionIds", "name")
      .populate("subjectId", "name code").populate("teacherId", "firstName lastName employeeId")
      .sort({ assignedDate: -1 }).skip(skip).limit(limit).lean(),
    Homework.countDocuments(filter),
  ]);
  if (actor.role === "STUDENT" || actor.role === "PARENT") {
    const students = await resolveStudentSet(actor, query.studentId);
    const studentIds = students.map((student: any) => student._id);
    const submissions = await HomeworkSubmission.find({ schoolId: schoolOid(actor), homeworkId: { $in: items.map((item: any) => item._id) }, studentId: { $in: studentIds } }).lean();
    const byKey = new Map(submissions.map((item: any) => [`${String(item.homeworkId)}:${String(item.studentId)}`, item]));
    return {
      items: items.map((item: any) => ({
        ...item,
        childSubmissions: students.map((student: any) => {
          const raw: any = byKey.get(`${String(item._id)}:${String(student._id)}`) || null;
          const evaluated = raw && [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED].includes(raw.status);
          return {
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            submission: raw ? { ...raw, evaluationHistory: undefined, marksObtained: evaluated ? raw.marksObtained : undefined, feedback: evaluated ? raw.feedback : undefined } : null,
          };
        }),
        mySubmission: actor.role === "STUDENT" ? (() => {
          const raw: any = byKey.get(`${String(item._id)}:${String(studentIds[0])}`) || null;
          const evaluated = raw && [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED].includes(raw.status);
          return raw ? { ...raw, evaluationHistory: undefined, marksObtained: evaluated ? raw.marksObtained : undefined, feedback: evaluated ? raw.feedback : undefined } : null;
        })() : undefined,
      })),
      pagination: pagination(page, limit, total),
    };
  }
  const submissionCounts = await HomeworkSubmission.aggregate([
    { $match: { schoolId: schoolOid(actor), homeworkId: { $in: items.map((item: any) => item._id) } } },
    { $group: {
      _id: "$homeworkId",
      totalSubmissions: { $sum: 1 },
      completedSubmissions: { $sum: { $cond: [{ $ne: ["$status", HOMEWORK_SUBMISSION_STATUS.RESUBMISSION_REQUESTED] }, 1, 0] } },
      lateSubmissions: { $sum: { $cond: [{ $eq: ["$isLate", true] }, 1, 0] } },
      evaluatedSubmissions: { $sum: { $cond: [{ $in: ["$status", [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED]] }, 1, 0] } },
    } },
  ]);
  const countByHomework = new Map<string, any>(submissionCounts.map((row: any) => [String(row._id), row] as [string, any]));
  const itemsWithCounts = await Promise.all(items.map(async (item: any) => {
    const row: any = countByHomework.get(String(item._id)) || {};
    const studentFilter: any = { schoolId: schoolOid(actor), sessionId: item.academicSessionId, classId: item.classId?._id || item.classId, isDeleted: false, isActive: true, status: StudentStatus.ACTIVE };
    const targetSections = item.sectionIds?.length ? item.sectionIds.map((v: any) => v._id || v) : item.sectionId ? [item.sectionId?._id || item.sectionId] : [];
    if (targetSections.length) studentFilter.sectionId = { $in: targetSections };
    const assignedStudents = await Student.countDocuments(studentFilter);
    return { ...item, totalSubmissions: row.totalSubmissions || 0, pendingSubmissions: Math.max(0, assignedStudents - (row.completedSubmissions || 0)), lateSubmissions: row.lateSubmissions || 0, evaluatedSubmissions: row.evaluatedSubmissions || 0 };
  }));
  return { items: itemsWithCounts, pagination: pagination(page, limit, total) };
};

export const getHomeworkByIdService = async (id: string, actor: HomeworkActor, requestedStudentId?: string) => {
  const homework = await Homework.findOne({ _id: oid(id, "homework ID"), schoolId: schoolOid(actor), isDeleted: { $ne: true } })
    .populate("classId", "name").populate("sectionId", "name").populate("sectionIds", "name").populate("subjectId", "name code").populate("teacherId", "firstName lastName employeeId");
  if (!homework) throw new AppError("Homework not found", 404);
  if (actor.role === "TEACHER") await ensureTeacherAccess(homework, actor);
  if (actor.role === "STUDENT" || actor.role === "PARENT") {
    if (homework.status !== HOMEWORK_STATUS.PUBLISHED) throw new AppError("Homework is not available", 404);
    const student = await resolveStudent(actor, requestedStudentId);
    if (String(student.classId) !== String(homework.classId?._id || homework.classId)) throw new AppError("Homework is not assigned to this student", 404);
    const targets = ((homework as any).sectionIds || []).map((s: any) => String(s._id || s));
    const legacySection = (homework as any).sectionId?._id || (homework as any).sectionId;
    if (targets.length && !targets.includes(String(student.sectionId)) && String(legacySection || "") !== String(student.sectionId)) throw new AppError("Homework is not assigned to this student's section", 404);
    const submission: any = await HomeworkSubmission.findOne({ schoolId: schoolOid(actor), homeworkId: homework._id, studentId: student._id }).lean();
    const evaluated = submission && [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED].includes(submission.status);
    return { ...homework.toObject(), mySubmission: submission ? {
      ...submission, evaluationHistory: undefined,
      marksObtained: evaluated ? submission.marksObtained : undefined,
      feedback: evaluated ? submission.feedback : undefined,
    } : null };
  }
  return homework;
};

export const updateHomeworkService = async (id: string, payload: Payload, actor: HomeworkActor, files: Express.Multer.File[] = []) => {
  const homework = await Homework.findOne({ _id: oid(id, "homework ID"), schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  await ensureTeacherAccess(homework, actor);
  if ([HOMEWORK_STATUS.ARCHIVED, HOMEWORK_STATUS.CANCELLED].includes(homework.status as any)) throw new AppError("Archived homework cannot be edited", 409);
  const nextSessionId = payload.academicSessionId ? oid(payload.academicSessionId) : homework.academicSessionId;
  const nextClassId = payload.classId ? oid(payload.classId) : homework.classId;
  const nextSubjectId = payload.subjectId ? oid(payload.subjectId) : homework.subjectId;
  const nextSectionIds = payload.sectionIds !== undefined || payload.sectionId !== undefined ? parseSectionIds(payload) : (homework.sectionIds?.length ? homework.sectionIds : homework.sectionId ? [homework.sectionId] : []);
  const nextTeacherId = payload.teacherId ? oid(payload.teacherId) : homework.teacherId;
  await validateClassSessionSubject(schoolOid(actor), nextSessionId, nextClassId, nextSubjectId, nextSectionIds);
  if (actor.role === "TEACHER" && String(nextTeacherId) !== String(await getEmployeeId(actor))) throw new AppError("Teachers cannot reassign homework to another teacher", 403);
  await validateTeacherAssignment(schoolOid(actor), nextSessionId, nextClassId, nextSubjectId, nextTeacherId, nextSectionIds);
  if (payload.title !== undefined) homework.title = String(payload.title).trim();
  if (payload.description !== undefined) homework.description = String(payload.description).trim();
  if (payload.instructions !== undefined) homework.instructions = String(payload.instructions).trim();
  if (payload.academicSessionId) homework.academicSessionId = nextSessionId;
  if (payload.classId) homework.classId = nextClassId;
  if (payload.subjectId) homework.subjectId = nextSubjectId;
  if (payload.teacherId) homework.teacherId = nextTeacherId;
  if (payload.sectionIds !== undefined || payload.sectionId !== undefined) {
    homework.sectionIds = nextSectionIds;
    homework.sectionId = nextSectionIds.length === 1 ? nextSectionIds[0] : undefined;
  }
  if (payload.assignedDate) homework.assignedDate = parseDate(payload.assignedDate, "assigned date");
  if (payload.dueDate) {
    const school = await getSchool(schoolOid(actor));
    homework.dueDate = parseSchoolDueDate(payload.dueDate, school.timezone);
    if (localDateKey(homework.dueDate, school.timezone) < localDateKey(new Date(), school.timezone)) throw new AppError("Due date must be today or a future date", 400);
  }
  if (homework.dueDate < homework.assignedDate) throw new AppError("Due date cannot be before assigned date", 400);
  if (payload.totalMarks !== undefined) {
    const marks = payload.totalMarks === "" || payload.totalMarks == null ? undefined : Number(payload.totalMarks);
    if (marks !== undefined && (!Number.isFinite(marks) || marks < 0)) throw new AppError("Maximum marks must be zero or greater", 400);
    homework.totalMarks = marks;
  }
  for (const key of ["allowSubmission", "allowLateSubmission", "allowResubmission"] as const) if (payload[key] !== undefined) (homework as any)[key] = payload[key] === true;
  if (payload.attachments !== undefined) homework.attachments = validateAttachments(payload.attachments);
  if (files.length) homework.attachments.push(...fileAttachments(files));
  const wasPublished = homework.status === HOMEWORK_STATUS.PUBLISHED;
  if (payload.status === HOMEWORK_STATUS.PUBLISHED) {
    homework.status = HOMEWORK_STATUS.PUBLISHED;
    if (!homework.publishedAt) homework.publishedAt = new Date();
  } else if (payload.status === HOMEWORK_STATUS.DRAFT) homework.status = HOMEWORK_STATUS.DRAFT;
  homework.updatedBy = userOid(actor);
  await homework.save();
  if (!wasPublished && homework.status === HOMEWORK_STATUS.PUBLISHED) {
    const students = await Student.find({ schoolId: schoolOid(actor), sessionId: homework.academicSessionId, classId: homework.classId, isDeleted: false, isActive: true, status: StudentStatus.ACTIVE, ...(homework.sectionIds.length ? { sectionId: { $in: homework.sectionIds } } : homework.sectionId ? { sectionId: homework.sectionId } : {}) }).select("_id").lean();
    await queueParentNotifications(schoolOid(actor), homework, students.map((s: any) => s._id), "NEW_HOMEWORK", userOid(actor));
  }
  return stripStoragePaths(homework);
};

export const publishHomeworkService = async (id: string, actor: HomeworkActor) => updateHomeworkService(id, { status: HOMEWORK_STATUS.PUBLISHED }, actor);
export const archiveHomeworkService = async (id: string, actor: HomeworkActor) => {
  const homework = await Homework.findOne({ _id: oid(id, "homework ID"), schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  await ensureTeacherAccess(homework, actor);
  homework.status = HOMEWORK_STATUS.ARCHIVED;
  homework.isDeleted = false;
  homework.updatedBy = userOid(actor);
  await homework.save();
  return homework;
};
export const deleteHomeworkService = async (id: string, actor: HomeworkActor) => archiveHomeworkService(id, actor);

export const submitHomeworkService = async (id: string, payload: Payload, actor: HomeworkActor, files: Express.Multer.File[] = [], requestedStudentId?: string) => {
  if (actor.role !== "STUDENT" && actor.role !== "PARENT") throw new AppError("Only students or linked parents can submit homework", 403);
  const schoolId = schoolOid(actor);
  const student = await resolveStudent(actor, requestedStudentId);
  if (!student.isActive || student.status !== StudentStatus.ACTIVE) throw new AppError("Only active enrolled students can submit homework", 403);
  const homework = await Homework.findOne({ _id: oid(id, "homework ID"), schoolId, status: HOMEWORK_STATUS.PUBLISHED, isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Published homework not found", 404);
  const openSession = await Session.exists({ _id: homework.academicSessionId, schoolId, isDeleted: false, isClosed: false, isActive: true });
  if (!openSession) throw new AppError("Submissions are unavailable because the academic session is closed or inactive", 409);
  if (!homework.allowSubmission) throw new AppError("Submissions are disabled for this homework", 409);
  if (String(student.classId) !== String(homework.classId)) throw new AppError("Homework is not assigned to this student", 403);
  const targetSections = homework.sectionIds?.length ? homework.sectionIds.map(String) : homework.sectionId ? [String(homework.sectionId)] : [];
  if (targetSections.length && !targetSections.includes(String(student.sectionId))) throw new AppError("Homework is not assigned to this student's section", 403);
  if (String(student.sessionId) !== String(homework.academicSessionId)) throw new AppError("Student is not enrolled in the homework academic session", 403);
  const school = await getSchool(schoolId);
  const now = new Date();
  const late = now.getTime() > homework.dueDate.getTime();
  if (late && !homework.allowLateSubmission) throw new AppError("The submission deadline has passed and late submissions are disabled", 409);
  const attachments = [...validateAttachments(payload.attachments || []), ...fileAttachments(files)];
  if (!String(payload.answer || "").trim() && !attachments.length) throw new AppError("Provide an answer or upload at least one attachment", 400);
  const filter = { schoolId, homeworkId: homework._id, studentId: student._id };
  let submission = await HomeworkSubmission.findOne(filter);
  const status = late ? HOMEWORK_SUBMISSION_STATUS.LATE : HOMEWORK_SUBMISSION_STATUS.SUBMITTED;
  if (!submission) {
    try {
      submission = await HomeworkSubmission.create({
        ...filter, academicSessionId: homework.academicSessionId, classId: student.classId, sectionId: student.sectionId,
        submittedAt: now, answer: String(payload.answer || "").trim(), attachments, status, isLate: late, attemptNumber: 1,
        attempts: [{ attemptNumber: 1, answer: String(payload.answer || "").trim(), attachments, submittedAt: now, status, isLate: late }],
      });
    } catch (error: any) {
      if (error?.code === 11000) throw new AppError("A submission already exists for this homework. Resubmit only if resubmission is enabled.", 409);
      throw error;
    }
  } else {
    if (!homework.allowResubmission) throw new AppError("A submission already exists and resubmission is disabled", 409);
    // Backfill the current pre-Module-11 submission as attempt 1 before
    // replacing it, so earlier student work is not lost on upgrade.
    if (submission.attempts.length === 0 && submission.submittedAt) {
      const previousAttemptNumber = Math.max(1, submission.attemptNumber || 1);
      submission.attempts.push({
        attemptNumber: previousAttemptNumber,
        answer: submission.answer,
        attachments: submission.attachments,
        submittedAt: submission.submittedAt,
        status: submission.status,
        isLate: submission.isLate,
      } as any);
      submission.attemptNumber = previousAttemptNumber;
    }
    const attemptNumber = submission.attemptNumber + 1;
    submission.attemptNumber = attemptNumber;
    submission.submittedAt = now;
    submission.answer = String(payload.answer || "").trim();
    submission.attachments = attachments;
    submission.status = status;
    submission.isLate = late;
    submission.marksObtained = undefined;
    submission.feedback = undefined;
    submission.reviewedAt = undefined;
    submission.reviewedBy = undefined;
    submission.attempts.push({ attemptNumber, answer: submission.answer, attachments, submittedAt: now, status, isLate: late } as any);
    await submission.save();
  }
  return stripStoragePaths(submission);
};

export const getHomeworkSubmissionsService = async (id: string, actor: HomeworkActor, query: Query) => {
  const homework = await Homework.findOne({ _id: oid(id), schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  await ensureTeacherAccess(homework, actor);
  const { page, limit, skip } = pageArgs(query);
  const filter: any = { schoolId: schoolOid(actor), homeworkId: homework._id };
  if (query.studentId) filter.studentId = oid(query.studentId, "student ID");
  if (query.status) filter.status = String(query.status);
  const [items, total] = await Promise.all([
    HomeworkSubmission.find(filter).populate("studentId", "firstName lastName admissionNumber classId sectionId")
      .populate("reviewedBy", "name email").sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
    HomeworkSubmission.countDocuments(filter),
  ]);
  return { items, pagination: pagination(page, limit, total) };
};

export const reviewHomeworkSubmissionService = async (homeworkId: string, submissionId: string, payload: Payload, actor: HomeworkActor) => {
  const homework = await Homework.findOne({ _id: oid(homeworkId), schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  await ensureTeacherAccess(homework, actor);
  const submission = await HomeworkSubmission.findOne({ _id: oid(submissionId, "submission ID"), homeworkId: homework._id, schoolId: schoolOid(actor) });
  if (!submission) throw new AppError("Homework submission not found", 404);
  const marks = payload.marksObtained === undefined || payload.marksObtained === "" ? undefined : Number(payload.marksObtained);
  if (marks !== undefined && (!Number.isFinite(marks) || marks < 0 || (homework.totalMarks !== undefined && marks > homework.totalMarks))) throw new AppError("Marks must be zero or greater and cannot exceed maximum marks", 400);
  const evaluatorId = userOid(actor);
  const action = payload.requestResubmission === true ? "RESUBMISSION_REQUESTED" : "EVALUATED";
  if (action === "RESUBMISSION_REQUESTED" && !homework.allowResubmission) throw new AppError("Resubmission is disabled for this homework", 409);
  if (action === "EVALUATED" && marks === undefined && payload.feedback === undefined) throw new AppError("Marks or feedback is required", 400);
  if (submission.evaluationHistory.length === 0 && [HOMEWORK_SUBMISSION_STATUS.REVIEWED, HOMEWORK_SUBMISSION_STATUS.EVALUATED].includes(submission.status as any) && submission.reviewedAt && submission.reviewedBy) {
    submission.evaluationHistory.push({
      evaluatorId: submission.reviewedBy,
      marksObtained: submission.marksObtained,
      feedback: submission.feedback,
      action: "EVALUATED",
      evaluatedAt: submission.reviewedAt,
    } as any);
  }
  submission.evaluationHistory.push({ evaluatorId, marksObtained: marks, feedback: payload.feedback === undefined ? undefined : String(payload.feedback).trim(), action, evaluatedAt: new Date() } as any);
  if (marks !== undefined) submission.marksObtained = marks;
  if (payload.feedback !== undefined) submission.feedback = String(payload.feedback).trim();
  submission.status = action === "RESUBMISSION_REQUESTED" ? HOMEWORK_SUBMISSION_STATUS.RESUBMISSION_REQUESTED : HOMEWORK_SUBMISSION_STATUS.EVALUATED;
  submission.reviewedBy = evaluatorId;
  submission.reviewedAt = new Date();
  await submission.save();
  if (action === "EVALUATED") await queueParentNotifications(schoolOid(actor), homework, [submission.studentId], "GRADED", evaluatorId, { marks: submission.marksObtained });
  return submission;
};

export const getMySubmissionsService = async (actor: HomeworkActor, query: Query) => {
  const student = await resolveStudent(actor, query.studentId);
  const { page, limit, skip } = pageArgs(query);
  const filter: any = { schoolId: schoolOid(actor), studentId: student._id };
  const [items, total] = await Promise.all([
    HomeworkSubmission.find(filter).populate("homeworkId").sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
    HomeworkSubmission.countDocuments(filter),
  ]);
  const safeItems = items.map((item: any) => {
    const evaluated = [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED].includes(item.status);
    return { ...item, evaluationHistory: undefined, marksObtained: evaluated ? item.marksObtained : undefined, feedback: evaluated ? item.feedback : undefined };
  });
  return { items: safeItems, pagination: pagination(page, limit, total) };
};

export const getPendingHomeworkService = async (id: string, actor: HomeworkActor, query: Query = {}) => {
  const homework = await Homework.findOne({ _id: oid(id), schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  await ensureTeacherAccess(homework, actor);
  const studentFilter: any = { schoolId: schoolOid(actor), sessionId: homework.academicSessionId, classId: homework.classId, isDeleted: false, isActive: true, status: StudentStatus.ACTIVE };
  const sections = homework.sectionIds?.length ? homework.sectionIds : homework.sectionId ? [homework.sectionId] : [];
  if (sections.length) studentFilter.sectionId = { $in: sections };
  const students = await Student.find(studentFilter).select("firstName lastName admissionNumber classId sectionId").populate("classId", "name").populate("sectionId", "name").lean();
  const submissions = await HomeworkSubmission.find({ schoolId: schoolOid(actor), homeworkId: homework._id }).lean();
  const byStudent = new Map(submissions.map((s: any) => [String(s.studentId), s]));
  const rows = students.map((student: any) => {
    const submission: any = byStudent.get(String(student._id));
    const status = submission?.status || (new Date() > homework.dueDate ? HOMEWORK_SUBMISSION_STATUS.OVERDUE : "PENDING");
    return {
      studentId: student._id, studentName: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber,
      class: student.classId?.name, section: student.sectionId?.name, subjectId: homework.subjectId, homeworkTitle: homework.title,
      dueDate: homework.dueDate, status, submittedAt: submission?.submittedAt, isLate: submission?.isLate || status === HOMEWORK_SUBMISSION_STATUS.LATE,
      marksObtained: submission?.marksObtained, feedback: submission?.status === HOMEWORK_SUBMISSION_STATUS.EVALUATED ? submission.feedback : undefined,
    };
  });
  const filtered = query.status === "LATE"
    ? rows.filter((row) => row.isLate)
    : query.status === "PENDING"
      ? rows.filter((row) => row.status === "PENDING" || row.status === HOMEWORK_SUBMISSION_STATUS.RESUBMISSION_REQUESTED)
      : query.status ? rows.filter((row) => row.status === query.status) : rows;
  return { items: filtered, counts: {
    total: rows.length, pending: rows.filter((r) => r.status === "PENDING" || r.status === HOMEWORK_SUBMISSION_STATUS.OVERDUE || r.status === HOMEWORK_SUBMISSION_STATUS.RESUBMISSION_REQUESTED).length,
    submitted: rows.filter((r) => r.status === HOMEWORK_SUBMISSION_STATUS.SUBMITTED).length,
    late: rows.filter((r) => r.isLate).length,
    overdue: rows.filter((r) => r.status === HOMEWORK_SUBMISSION_STATUS.OVERDUE).length,
    evaluated: rows.filter((r) => r.status === HOMEWORK_SUBMISSION_STATUS.EVALUATED || r.status === HOMEWORK_SUBMISSION_STATUS.REVIEWED).length,
  } };
};

export const getHomeworkSummaryService = async (actor: HomeworkActor, query: Query) => {
  const homeworkFilter = await visibleHomeworkFilter(actor, query);
  const [homeworkIds, publishedItems, draft] = await Promise.all([
    Homework.find(homeworkFilter).distinct("_id"),
    Homework.find({ ...homeworkFilter, status: HOMEWORK_STATUS.PUBLISHED }).select("academicSessionId classId sectionId sectionIds dueDate").lean(),
    Homework.countDocuments({ ...homeworkFilter, status: HOMEWORK_STATUS.DRAFT }),
  ]);
  const submissionFilter: any = { schoolId: schoolOid(actor), homeworkId: { $in: homeworkIds } };
  const [total, rows, lateCount] = await Promise.all([
    Homework.countDocuments(homeworkFilter),
    HomeworkSubmission.aggregate([{ $match: submissionFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    HomeworkSubmission.countDocuments({ ...submissionFilter, isLate: true }),
  ]);
  const statusCounts = Object.fromEntries(rows.map((r: any) => [r._id, r.count]));
  let pending = 0;
  let overdue = 0;
  for (const item of publishedItems as any[]) {
    const studentFilter: any = {
      schoolId: schoolOid(actor), sessionId: item.academicSessionId, classId: item.classId,
      isDeleted: false, isActive: true, status: StudentStatus.ACTIVE,
    };
    const sections = item.sectionIds?.length ? item.sectionIds : item.sectionId ? [item.sectionId] : [];
    if (sections.length) studentFilter.sectionId = { $in: sections };
    const [assigned, submitted] = await Promise.all([
      Student.countDocuments(studentFilter),
      HomeworkSubmission.countDocuments({ schoolId: schoolOid(actor), homeworkId: item._id, status: { $in: [
        HOMEWORK_SUBMISSION_STATUS.SUBMITTED, HOMEWORK_SUBMISSION_STATUS.LATE,
        HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED,
      ] } }),
    ]);
    const missing = Math.max(0, assigned - submitted);
    pending += missing;
    if (new Date(item.dueDate) < new Date()) overdue += missing;
  }
  return {
    total, published: publishedItems.length, draft, pending,
    submitted: statusCounts.SUBMITTED || 0,
    late: lateCount,
    evaluated: (statusCounts.EVALUATED || 0) + (statusCounts.REVIEWED || 0),
    overdue,
    resubmissionRequested: statusCounts.RESUBMISSION_REQUESTED || 0,
  };
};
export const getHomeworkReportService = async (actor: HomeworkActor, groupBy: "classId" | "subjectId", query: Query) => {
  const filter = await visibleHomeworkFilter(actor, query);
  const lookup = groupBy === "classId"
    ? { from: "classes", localField: "_id", foreignField: "_id", as: "group" }
    : { from: "subjects", localField: "_id", foreignField: "_id", as: "group" };
  return Homework.aggregate([
    { $match: filter },
    { $group: { _id: `$${groupBy}`, homeworkCount: { $sum: 1 }, overdueCount: { $sum: { $cond: [{ $lt: ["$dueDate", new Date()] }, 1, 0] } } } },
    { $lookup: lookup },
    { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 1, name: "$group.name", code: "$group.code", homeworkCount: 1, overdueCount: 1 } },
    { $sort: { homeworkCount: -1 } },
  ]);
};
export const getLateSubmissionsService = async (actor: HomeworkActor, query: Query) => {
  const homeworkFilter = await visibleHomeworkFilter(actor, query);
  if (query.homeworkId) {
    homeworkFilter.$and = [...(homeworkFilter.$and || []), { _id: oid(query.homeworkId, "homework ID") }];
  }
  const allowedHomeworkIds = await Homework.find(homeworkFilter).distinct("_id");
  return HomeworkSubmission.find({ schoolId: schoolOid(actor), homeworkId: { $in: allowedHomeworkIds }, isLate: true })
    .populate("homeworkId", "title dueDate").populate("studentId", "firstName lastName admissionNumber")
    .sort({ submittedAt: -1 }).limit(500).lean();
};
export const getEvaluationReportService = async (actor: HomeworkActor, query: Query) => {
  const homeworkFilter = await visibleHomeworkFilter(actor, query);
  const homeworkIds = await Homework.find(homeworkFilter).distinct("_id");
  const { page, limit, skip } = pageArgs(query);
  const filter: any = {
    schoolId: schoolOid(actor),
    homeworkId: { $in: homeworkIds },
    status: { $in: [HOMEWORK_SUBMISSION_STATUS.EVALUATED, HOMEWORK_SUBMISSION_STATUS.REVIEWED] },
  };
  const [items, total] = await Promise.all([
    HomeworkSubmission.find(filter)
      .populate("homeworkId", "title dueDate totalMarks subjectId classId")
      .populate("studentId", "firstName lastName admissionNumber classId sectionId")
      .populate("reviewedBy", "name email")
      .sort({ reviewedAt: -1 }).skip(skip).limit(limit).lean(),
    HomeworkSubmission.countDocuments(filter),
  ]);
  return { items, pagination: pagination(page, limit, total) };
};

export const sendPendingHomeworkRemindersService = async (actor: HomeworkActor, homeworkId?: string) => {
  if (!isAdmin(actor) && actor.role !== "TEACHER") throw new AppError("Not allowed to send homework reminders", 403);
  const filter: any = { schoolId: schoolOid(actor), status: HOMEWORK_STATUS.PUBLISHED, isDeleted: { $ne: true } };
  if (actor.role === "TEACHER") filter.teacherId = await getEmployeeId(actor);
  if (homeworkId) filter._id = oid(homeworkId);
  const homeworks = await Homework.find(filter).limit(100);
  let queued = 0;
  for (const homework of homeworks) {
    const pending = await getPendingHomeworkService(String(homework._id), actor);
    const studentIds = pending.items.filter((row: any) => ["PENDING", HOMEWORK_SUBMISSION_STATUS.OVERDUE].includes(row.status)).map((row: any) => row.studentId as Types.ObjectId);
    await queueParentNotifications(schoolOid(actor), homework, studentIds, "PENDING_REMINDER", userOid(actor));
    queued += studentIds.length;
  }
  return { considered: homeworks.length, pendingStudentRecords: queued, deliveryState: "QUEUED_WHERE_PARENT_ACCOUNT_AND_OPT_IN_EXIST" };
};

export const getSubmissionHistoryService = async (submissionId: string, actor: HomeworkActor) => {
  const submission = await HomeworkSubmission.findOne({ _id: oid(submissionId, "submission ID"), schoolId: schoolOid(actor) });
  if (!submission) throw new AppError("Submission not found", 404);
  const homework = await Homework.findOne({ _id: submission.homeworkId, schoolId: schoolOid(actor), isDeleted: { $ne: true } });
  if (!homework) throw new AppError("Homework not found", 404);
  if (actor.role === "TEACHER") await ensureTeacherAccess(homework, actor);
  else if (actor.role === "STUDENT" || actor.role === "PARENT") {
    const students = await resolveStudentSet(actor);
    if (!students.some((student: any) => String(student._id) === String(submission.studentId))) throw new AppError("You cannot view another student's submission history", 403);
  } else if (!isAdmin(actor)) throw new AppError("Not allowed to view submission history", 403);
  const visibleEvaluations = actor.role === "STUDENT" || actor.role === "PARENT"
    ? submission.evaluationHistory.filter((entry: any) => entry.action === "EVALUATED")
    : submission.evaluationHistory;
  return {
    attempts: submission.attempts,
    evaluationHistory: visibleEvaluations,
    current: {
      status: submission.status,
      submittedAt: submission.submittedAt,
      attemptNumber: submission.attemptNumber,
      marksObtained: ["EVALUATED", "REVIEWED"].includes(submission.status) ? submission.marksObtained : undefined,
      feedback: ["EVALUATED", "REVIEWED"].includes(submission.status) ? submission.feedback : undefined,
    },
  };
};

export const getHomeworkFileService = async (filename: string, actor: HomeworkActor) => {
  if (!/^[a-f0-9-]{20,80}\.(pdf|png|jpe?g|webp|docx?|xlsx?|txt)$/i.test(filename)) throw new AppError("Invalid attachment key", 400);
  const schoolId = schoolOid(actor);
  const storagePath = `homework/${filename}`;
  const homework = await Homework.findOne({ schoolId, "attachments.storagePath": storagePath, isDeleted: { $ne: true } }).select("+attachments.storagePath");
  let owner: any = homework;
  let attachment: any = homework?.attachments.find((item: any) => item.storagePath === storagePath);
  if (!attachment) {
    const submission = await HomeworkSubmission.findOne({
      schoolId, $or: [{ "attachments.storagePath": storagePath }, { "attempts.attachments.storagePath": storagePath }],
    }).select("+attachments.storagePath +attempts.attachments.storagePath");
    if (submission) {
      const parentHomework = await Homework.findOne({ _id: submission.homeworkId, schoolId, isDeleted: { $ne: true } });
      if (!parentHomework) throw new AppError("Attachment not found", 404);
      if (actor.role === "TEACHER") await ensureTeacherAccess(parentHomework, actor);
      else if (actor.role === "STUDENT" || actor.role === "PARENT") {
        const students = await resolveStudentSet(actor);
        if (!students.some((student: any) => String(student._id) === String(submission.studentId))) throw new AppError("You cannot access another student's submission", 403);
      } else if (!isAdmin(actor)) throw new AppError("Not allowed to access this attachment", 403);
      owner = submission;
      attachment = submission.attachments.find((item: any) => item.storagePath === storagePath)
        || submission.attempts.flatMap((attempt: any) => attempt.attachments || []).find((item: any) => item.storagePath === storagePath);
    }
  } else if (actor.role === "TEACHER") await ensureTeacherAccess(homework, actor);
  else if (actor.role === "STUDENT" || actor.role === "PARENT") {
    const students = await resolveStudentSet(actor);
    const targets = homework.sectionIds?.length ? homework.sectionIds.map(String) : homework.sectionId ? [String(homework.sectionId)] : [];
    const hasAssignedChild = students.some((student: any) => String(student.classId) === String(homework.classId) && String(student.sessionId) === String(homework.academicSessionId) && (!targets.length || targets.includes(String(student.sectionId))));
    if (!hasAssignedChild || homework.status !== HOMEWORK_STATUS.PUBLISHED) throw new AppError("You cannot access this attachment", 403);
  } else if (!isAdmin(actor)) throw new AppError("Not allowed to access this attachment", 403);
  if (!owner || !attachment?.storagePath) throw new AppError("Attachment not found", 404);
  const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const absolute = path.resolve(root, attachment.storagePath);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new AppError("Invalid attachment path", 400);
  try {
    await fs.promises.access(absolute);
  } catch {
    throw new AppError("Attachment file is no longer available", 404);
  }
  return { path: absolute, name: attachment.name, type: attachment.type || "application/octet-stream" };
};
