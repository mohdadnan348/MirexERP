import mongoose, { Types } from "mongoose";
import Student, { StudentStatus } from "../students/students.model";
import StudentRecord from "../students/student-records.model";
import StudentEnrollment from "./student-enrollment.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Session from "../sessions/sessions.model";
import Employee from "../employees/employees.model";
import Subject from "../subjects/subjects.model";
import Timetable from "../timetable/timetable.model";
import ClassSectionHistory from "./class-section-history.model";
import SubjectTeacherAssignment from "./subject-teacher-assignment.model";
import { AppError } from "../../utils/AppError";

export interface ClassSectionActor { userId: string; schoolId: string; role: string; }
const id = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, 400);
  return new Types.ObjectId(value);
};
const actorIds = (actor: ClassSectionActor) => ({ schoolId: id(actor.schoolId, "school context"), actorId: id(actor.userId, "user context") });

async function validSession(sessionId: string, schoolId: Types.ObjectId, allowClosed = false) {
  const session = await Session.findOne({ _id: id(sessionId, "academic session"), schoolId, isDeleted: false }).lean();
  if (!session) throw new AppError("Academic session not found in this school", 404);
  if (session.isClosed && !allowClosed) throw new AppError("Academic session is closed; allocations are not allowed", 409);
  return session;
}
async function validDestination(sessionId: string, classId: string, sectionId: string, schoolId: Types.ObjectId) {
  const [cls, section] = await Promise.all([
    Class.findOne({ _id: id(classId, "class"), schoolId, sessionId, isDeleted: false, isActive: true }).lean(),
    Section.findOne({ _id: id(sectionId, "section"), schoolId, sessionId, classId, isDeleted: false, isActive: true }).lean(),
  ]);
  if (!cls) throw new AppError("Class does not belong to the selected school/session or is inactive", 400);
  if (!section) throw new AppError("Section does not belong to the selected class/session or is inactive", 400);
  return { cls, section };
}
async function capacityCheck(sectionId: Types.ObjectId, schoolId: Types.ObjectId, requested: number, confirmed: boolean, role: string) {
  const section = await Section.findOne({ _id: sectionId, schoolId, isDeleted: false }).lean();
  if (!section) throw new AppError("Section not found", 404);
  const enrolled = await Student.countDocuments({ schoolId, sectionId, status: StudentStatus.ACTIVE, isDeleted: { $ne: true } });
  const capacity = section.capacity ?? null;
  const exceeds = capacity !== null && enrolled + requested > capacity;
  if (exceeds && !(confirmed && ["SCHOOL_ADMIN", "PRINCIPAL"].includes(role))) {
    throw new AppError(`Section capacity warning: ${enrolled}/${capacity} enrolled; ${Math.max(0, capacity - enrolled)} seats available. An authorized user must confirm over-capacity allocation.`, 409);
  }
  return { enrolled, capacity, availableSeats: capacity === null ? null : Math.max(0, capacity - enrolled), exceedsCapacity: exceeds };
}

export async function allocateStudents(data: { sessionId: string; classId: string; sectionId: string; studentIds: string[]; confirmOverCapacity?: boolean }, actor: ClassSectionActor) {
  const { schoolId, actorId } = actorIds(actor);
  if (!Array.isArray(data.studentIds) || data.studentIds.length < 1 || data.studentIds.length > 100) throw new AppError("Select between 1 and 100 students", 400);
  const studentIds = [...new Set(data.studentIds)].map(v => id(v, "student"));
  if (studentIds.length !== data.studentIds.length) throw new AppError("Duplicate student IDs are not allowed", 400);
  await validSession(data.sessionId, schoolId);
  const { section } = await validDestination(data.sessionId, data.classId, data.sectionId, schoolId);
  const cap = await capacityCheck(section._id, schoolId, studentIds.length, !!data.confirmOverCapacity, actor.role);
  const students = await Student.find({ _id: { $in: studentIds }, schoolId, isDeleted: { $ne: true }, status: StudentStatus.ACTIVE }).select("_id sessionId classId sectionId status tcLocked").lean();
  if (students.length !== studentIds.length) throw new AppError("One or more students are missing, ineligible, withdrawn or belong to another school", 400);
  const conflicts = students.filter(s => String(s.sessionId) === data.sessionId && String(s.classId) === data.classId && String(s.sectionId) === data.sectionId);
  if (conflicts.length) throw new AppError("One or more students are already allocated to this section", 409);
  const moved = students.filter(s => String(s.sessionId) === data.sessionId && (String(s.classId) !== data.classId || String(s.sectionId) !== data.sectionId));
  if (moved.length) throw new AppError("Students already allocated in this session must use the transfer workflow", 409);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const student of students) {
        const targetEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: id(data.sessionId, "session"), status: "ACTIVE" }).session(session);
        if (targetEnrollment) throw new AppError("Student already has an active enrollment in the selected session", 409);
        const previousEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: student.sessionId, status: "ACTIVE" }).session(session);
        if (previousEnrollment) {
          previousEnrollment.status = "COMPLETED"; previousEnrollment.endedAt = new Date(); previousEnrollment.updatedBy = actorId;
          await previousEnrollment.save({ session });
        } else {
          const previousAny = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: student.sessionId }).session(session);
          if (!previousAny) await StudentEnrollment.create([{ schoolId, studentId: student._id, sessionId: student.sessionId, classId: student.classId, sectionId: student.sectionId, status: "COMPLETED", enrolledAt: student.createdAt || new Date(), endedAt: new Date(), createdBy: actorId, updatedBy: actorId }], { session });
        }
        await StudentEnrollment.create([{ schoolId, studentId: student._id, sessionId: id(data.sessionId, "session"), classId: id(data.classId, "class"), sectionId: section._id, status: "ACTIVE", enrolledAt: new Date(), createdBy: actorId }], { session });
        const current = await Student.findOneAndUpdate(
          { _id: student._id, schoolId, status: StudentStatus.ACTIVE, sessionId: student.sessionId, classId: student.classId, sectionId: student.sectionId, tcLocked: { $ne: true } },
          { $set: { sessionId: id(data.sessionId, "session"), classId: id(data.classId, "class"), sectionId: section._id, updatedBy: actorId } },
          { new: true, session }
        );
        if (!current) throw new AppError("A student changed while allocation was in progress; retry", 409);
        await ClassSectionHistory.create([{ schoolId, sessionId: id(data.sessionId, "session"), studentId: student._id, classId: id(data.classId, "class"), sectionId: section._id, event: "ALLOCATED", previous: { sessionId: student.sessionId, classId: student.classId, sectionId: student.sectionId }, next: { sessionId: data.sessionId, classId: data.classId, sectionId: String(section._id) }, actorId }], { session });
      }
    });
  } finally { await session.endSession(); }
  return { allocated: students.length, capacity: { ...cap, enrolledAfter: cap.enrolled + students.length } };
}

export async function transferStudentAllocation(studentId: string, data: { sessionId: string; classId: string; sectionId: string; reason: string; confirmOverCapacity?: boolean }, actor: ClassSectionActor) {
  const { schoolId, actorId } = actorIds(actor);
  if (!data.reason?.trim()) throw new AppError("Transfer reason is required", 400);
  await validSession(data.sessionId, schoolId);
  const { cls, section } = await validDestination(data.sessionId, data.classId, data.sectionId, schoolId);
  const student = await Student.findOne({ _id: id(studentId, "student"), schoolId, isDeleted: { $ne: true }, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } });
  if (!student) throw new AppError("Eligible active student not found", 404);
  if (String(student.sessionId) === data.sessionId && String(student.classId) === data.classId && String(student.sectionId) === data.sectionId) throw new AppError("Student is already allocated to this class and section", 409);
  const cap = await capacityCheck(section._id, schoolId, 1, !!data.confirmOverCapacity, actor.role);
  const previous = { sessionId: student.sessionId, classId: student.classId, sectionId: student.sectionId };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const targetSessionId = id(data.sessionId, "session");
      const currentEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: previous.sessionId, status: "ACTIVE" }).session(session);
      if (String(previous.sessionId) === data.sessionId) {
        if (currentEnrollment) {
          currentEnrollment.classId = cls._id; currentEnrollment.sectionId = section._id; currentEnrollment.updatedBy = actorId;
          await currentEnrollment.save({ session });
        } else {
          await StudentEnrollment.create([{ schoolId, studentId: student._id, sessionId: targetSessionId, classId: cls._id, sectionId: section._id, status: "ACTIVE", enrolledAt: new Date(), createdBy: actorId }], { session });
        }
      } else {
        const existingTarget = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: targetSessionId, status: "ACTIVE" }).session(session);
        if (existingTarget) throw new AppError("Student already has an active enrollment in the destination session", 409);
        if (currentEnrollment) { currentEnrollment.status = "COMPLETED"; currentEnrollment.endedAt = new Date(); currentEnrollment.updatedBy = actorId; await currentEnrollment.save({ session }); }
        else {
          const previousAny = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: previous.sessionId }).session(session);
          if (!previousAny) await StudentEnrollment.create([{ schoolId, studentId: student._id, sessionId: previous.sessionId, classId: previous.classId, sectionId: previous.sectionId, status: "COMPLETED", enrolledAt: p.student.createdAt || new Date(), endedAt: new Date(), createdBy: actorId }], { session });
        }
        await StudentEnrollment.create([{ schoolId, studentId: student._id, sessionId: targetSessionId, classId: cls._id, sectionId: section._id, status: "ACTIVE", enrolledAt: new Date(), createdBy: actorId }], { session });
      }
      const updated = await Student.findOneAndUpdate({ _id: student._id, schoolId, sessionId: previous.sessionId, classId: previous.classId, sectionId: previous.sectionId, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } }, { $set: { sessionId: id(data.sessionId, "session"), classId: cls._id, sectionId: section._id, updatedBy: actorId } }, { new: true, session });
      if (!updated) throw new AppError("Student allocation changed; reload and retry", 409);
      await ClassSectionHistory.create([{ schoolId, sessionId: id(data.sessionId, "session"), studentId: student._id, classId: cls._id, sectionId: section._id, event: "TRANSFERRED", previous, next: { sessionId: data.sessionId, classId: String(cls._id), sectionId: String(section._id) }, reason: data.reason.trim(), actorId }], { session });
      await StudentRecord.create([{ schoolId, sessionId: id(data.sessionId, "session"), studentId: student._id, recordType: "TRANSFER", title: "Class/section transfer", details: { previous, next: { sessionId: data.sessionId, classId: String(cls._id), sectionId: String(section._id) }, reason: data.reason.trim(), transferDate: new Date() }, uploadedBy: actorId }], { session });
    });
  } finally { await session.endSession(); }
  return { studentId: student._id, previous, next: { sessionId: data.sessionId, classId: cls._id, sectionId: section._id }, capacity: cap };
}

export async function promoteStudents(data: { fromSessionId: string; toSessionId: string; promotions: Array<{ studentId: string; classId?: string; sectionId?: string; status?: "PROMOTED" | "DETAINED"; reason?: string }> ; confirmOverCapacity?: boolean }, actor: ClassSectionActor) {
  const { schoolId, actorId } = actorIds(actor);
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(actor.role)) throw new AppError("Only authorized academic administrators can promote students", 403);
  if (data.fromSessionId === data.toSessionId) throw new AppError("Source and destination academic sessions must be different", 400);
  if (!data.promotions?.length || data.promotions.length > 100) throw new AppError("Select between 1 and 100 students", 400);
  await validSession(data.fromSessionId, schoolId, true);
  await validSession(data.toSessionId, schoolId);
  const ids = data.promotions.map(x => id(x.studentId, "student"));
  if (new Set(ids.map(String)).size !== ids.length) throw new AppError("Duplicate student IDs are not allowed", 400);
  const prepared: any[] = [];
  for (const item of data.promotions) {
    const student = await Student.findOne({ _id: id(item.studentId, "student"), schoolId, sessionId: data.fromSessionId, status: StudentStatus.ACTIVE, tcLocked: { $ne: true }, isDeleted: { $ne: true } }).lean();
    if (!student) throw new AppError(`Student ${item.studentId} is not eligible for promotion`, 409);
    const priorDetention = await StudentEnrollment.findOne({ schoolId, studentId: student._id, sessionId: id(data.fromSessionId, "source session"), status: "DETAINED" }).lean();
    const priorDetentionHistory = await ClassSectionHistory.findOne({ schoolId, studentId: student._id, sessionId: id(data.fromSessionId, "source session"), event: "PROMOTED", "next.promotionStatus": "DETAINED" }).lean();
    if ((priorDetention || priorDetentionHistory) && item.status !== "DETAINED") throw new AppError(`Student ${item.studentId} is already marked detained for this source session`, 409);
    if (item.status === "DETAINED") {
      const alreadyDetained = await ClassSectionHistory.findOne({ schoolId, studentId: student._id, sessionId: id(data.fromSessionId, "source session"), event: "PROMOTED", "next.promotionStatus": "DETAINED" }).lean();
      if (alreadyDetained) throw new AppError(`Student ${item.studentId} is already marked detained for this session`, 409);
      prepared.push({ student, item, detained: true }); continue;
    }
    const { cls, section } = await validDestination(data.toSessionId, item.classId!, item.sectionId!, schoolId);
    const existing = await ClassSectionHistory.findOne({ schoolId, studentId: student._id, sessionId: id(data.toSessionId, "session"), event: "PROMOTED" }).lean();
    const priorPromotion = await StudentRecord.findOne({ schoolId, studentId: student._id, recordType: "PROMOTION", "details.newSessionId": id(data.toSessionId, "session"), isDeleted: false }).lean();
    if (existing || priorPromotion) throw new AppError(`Student ${item.studentId} already has promotion history for this session`, 409);
    prepared.push({ student, item, cls, section, detained: false });
  }
  const counts = new Map<string, number>();
  for (const p of prepared) if (!p.detained && p.section) counts.set(String(p.section._id), (counts.get(String(p.section._id)) || 0) + 1);
  for (const [sectionId, count] of counts) await capacityCheck(id(sectionId, "section"), schoolId, count, !!data.confirmOverCapacity, actor.role);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const p of prepared) {
        if (p.detained) {
          const existingEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: p.student._id, sessionId: id(data.fromSessionId, "source session"), status: "ACTIVE" }).session(session);
          if (existingEnrollment) { existingEnrollment.status = "DETAINED"; existingEnrollment.endedAt = new Date(); existingEnrollment.detentionReason = p.item.reason?.trim() || "Student marked as detained/not promoted"; existingEnrollment.detainedAt = new Date(); existingEnrollment.detainedBy = actorId; existingEnrollment.updatedBy = actorId; await existingEnrollment.save({ session }); }
          else {
            const priorDetained = await StudentEnrollment.findOne({ schoolId, studentId: p.student._id, sessionId: id(data.fromSessionId, "source session"), status: "DETAINED" }).session(session);
            if (!priorDetained) await StudentEnrollment.create([{ schoolId, studentId: p.student._id, sessionId: id(data.fromSessionId, "source session"), classId: p.student.classId, sectionId: p.student.sectionId, status: "DETAINED", enrolledAt: p.student.createdAt || new Date(), endedAt: new Date(), detentionReason: p.item.reason?.trim() || "Student marked as detained/not promoted", detainedAt: new Date(), detainedBy: actorId, createdBy: actorId }], { session });
          }
          await ClassSectionHistory.create([{ schoolId, sessionId: id(data.fromSessionId, "source session"), studentId: p.student._id, classId: p.student.classId, sectionId: p.student.sectionId, event: "PROMOTED", previous: { sessionId: p.student.sessionId, classId: p.student.classId, sectionId: p.student.sectionId }, next: { sessionId: data.fromSessionId, promotionStatus: "DETAINED" }, reason: p.item.reason?.trim() || "Student marked as detained/not promoted", actorId }], { session });
          continue;
        }
        const fromSession = id(data.fromSessionId, "from session"), toSession = id(data.toSessionId, "to session");
        const previousEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: p.student._id, sessionId: fromSession, status: "ACTIVE" }).session(session);
        if (previousEnrollment) { previousEnrollment.status = "COMPLETED"; previousEnrollment.endedAt = new Date(); previousEnrollment.updatedBy = actorId; await previousEnrollment.save({ session }); }
        else {
          const previousAny = await StudentEnrollment.findOne({ schoolId, studentId: p.student._id, sessionId: fromSession }).session(session);
          if (!previousAny) await StudentEnrollment.create([{ schoolId, studentId: p.student._id, sessionId: fromSession, classId: p.student.classId, sectionId: p.student.sectionId, status: "COMPLETED", enrolledAt: p.student.createdAt || new Date(), endedAt: new Date(), createdBy: actorId }], { session });
        }
        const targetEnrollment = await StudentEnrollment.findOne({ schoolId, studentId: p.student._id, sessionId: toSession, status: "ACTIVE" }).session(session);
        if (targetEnrollment) throw new AppError("Student already has an active enrollment in the destination session", 409);
        await StudentEnrollment.create([{ schoolId, studentId: p.student._id, sessionId: toSession, classId: p.cls!._id, sectionId: p.section!._id, status: "ACTIVE", enrolledAt: new Date(), createdBy: actorId }], { session });
        const updated = await Student.findOneAndUpdate({ _id: p.student._id, schoolId, sessionId: fromSession, status: StudentStatus.ACTIVE, tcLocked: { $ne: true } }, { $set: { sessionId: id(data.toSessionId, "to session"), classId: p.cls!._id, sectionId: p.section!._id, updatedBy: actorId } }, { new: true, session });
        if (!updated) throw new AppError("Student changed during promotion; retry", 409);
        await ClassSectionHistory.create([{ schoolId, sessionId: id(data.toSessionId, "to session"), studentId: p.student._id, classId: p.cls!._id, sectionId: p.section!._id, event: "PROMOTED", previous: { sessionId: p.student.sessionId, classId: p.student.classId, sectionId: p.student.sectionId }, next: { sessionId: data.toSessionId, classId: p.cls!._id, sectionId: p.section!._id, promotionStatus: "PROMOTED" }, actorId }], { session });
        await StudentRecord.create([{ schoolId, sessionId: id(data.toSessionId, "to session"), studentId: p.student._id, recordType: "PROMOTION", title: "Academic promotion", details: { previousSessionId: p.student.sessionId, previousClassId: p.student.classId, previousSectionId: p.student.sectionId, newSessionId: id(data.toSessionId, "to session"), newClassId: p.cls!._id, newSectionId: p.section!._id, promotionDate: new Date(), promotedBy: actorId, promotionStatus: "PROMOTED" }, uploadedBy: actorId }], { session });
      }
    });
  } finally { await session.endSession(); }
  return { processed: prepared.length, promoted: prepared.filter(x => !x.detained).length, detained: prepared.filter(x => x.detained).length };
}

export async function assignSubjectTeacher(data: { sessionId: string; classId: string; sectionId?: string; subjectId: string; teacherId: string }, actor: ClassSectionActor) {
  const { schoolId, actorId } = actorIds(actor);
  await validSession(data.sessionId, schoolId);
  const cls = await Class.findOne({ _id: id(data.classId, "class"), schoolId, sessionId: data.sessionId, isDeleted: false, isActive: true });
  if (!cls) throw new AppError("Class not found in selected session", 404);
  const subjectId = id(data.subjectId, "subject");
  const subject = await Subject.findOne({ _id: subjectId, schoolId, isDeleted: false, isActive: true }).select("_id").lean();
  if (!subject) throw new AppError("Subject not found in this school", 404);
  if (!cls.subjects.some((x: Types.ObjectId) => String(x) === String(subjectId))) throw new AppError("Assign this subject to the class first", 409);
  let sectionId: Types.ObjectId | null = null;
  if (data.sectionId) {
    const { section } = await validDestination(data.sessionId, data.classId, data.sectionId, schoolId);
    sectionId = section._id;
  }
  const teacherId = id(data.teacherId, "teacher");
  const teacher = await Employee.findOne({ _id: teacherId, schoolId, isDeleted: false, isActive: true, status: "ACTIVE", employeeType: "TEACHING" }).select("_id fullName").lean();
  if (!teacher) throw new AppError("Teacher must be an active teaching employee of this school", 400);
  if (sectionId) {
    const targetPeriods = await Timetable.find({ schoolId, sessionId: data.sessionId, sectionId, subjectId, isBreak: false, isActive: true }).select("dayOfWeek periodNumber classId sectionId").lean();
    if (targetPeriods.length) {
      const conflicts = await Timetable.find({ schoolId, sessionId: data.sessionId, teacherId, isBreak: false, isActive: true, $or: targetPeriods.map(p => ({ dayOfWeek: p.dayOfWeek, periodNumber: p.periodNumber, sectionId: { $ne: sectionId } })) }).populate("classId", "name").populate("sectionId", "name").lean();
      if (conflicts.length) throw new AppError(`Teacher timetable conflict: ${conflicts.map(c => `${(c.classId as any)?.name || "Class"} ${(c.sectionId as any)?.name || "Section"} ${c.dayOfWeek} period ${c.periodNumber}`).join("; ")}`, 409);
    }
  }
  const transaction = await mongoose.startSession();
  let assignment: any;
  try {
    await transaction.withTransaction(async () => {
      const existing = await SubjectTeacherAssignment.findOne({ schoolId, sessionId: data.sessionId, classId: cls._id, sectionId, subjectId, isActive: true }).session(transaction);
      if (existing && String(existing.teacherId) === String(teacherId)) throw new AppError("This teacher is already assigned to the subject", 409);
      if (existing) { existing.isActive = false; existing.endedAt = new Date(); await existing.save({ session: transaction }); }
      const created = await SubjectTeacherAssignment.create([{ schoolId, sessionId: id(data.sessionId, "session"), classId: cls._id, sectionId, subjectId, teacherId, assignedBy: actorId }], { session: transaction });
      assignment = created[0];
      await ClassSectionHistory.create([{ schoolId, sessionId: assignment.sessionId, classId: cls._id, sectionId: sectionId || undefined, event: "SUBJECT_TEACHER_ASSIGNED", previous: existing ? { teacherId: existing.teacherId } : undefined, next: { subjectId, teacherId }, actorId }], { session: transaction });
    });
  } finally { await transaction.endSession(); }
  return assignment.populate([{ path: "teacherId", select: "fullName employeeId" }, { path: "subjectId", select: "name code" }]);
}

export async function classSectionReports(query: any, actor: ClassSectionActor) {
  const { schoolId } = actorIds(actor);
  const sessionId = id(query.sessionId, "academic session");
  const selectedSession = await validSession(query.sessionId, schoolId, true);
  const classFilter: any = { schoolId, sessionId, isDeleted: false };
  if (query.classId) classFilter._id = id(query.classId, "class");
  const classes = await Class.find(classFilter).select("name code numericLevel isActive").sort({ numericLevel: 1 }).lean();
  const classIds = classes.map(c => c._id);
  const sectionFilter: any = { schoolId, sessionId, classId: { $in: classIds }, isDeleted: false };
  if (query.sectionId) sectionFilter._id = id(query.sectionId, "section");
  if (query.teacherId) sectionFilter.classTeacherId = id(query.teacherId, "teacher");
  const sections = await Section.find(sectionFilter).populate("classTeacherId", "fullName employeeId").lean();
  const studentMatch: any = { schoolId, sessionId, classId: { $in: classIds }, status: StudentStatus.ACTIVE, isDeleted: { $ne: true } };
  if (query.sectionId) studentMatch.sectionId = id(query.sectionId, "section");
  const assignmentFilter: any = { schoolId, sessionId, isActive: true };
  if (query.classId) assignmentFilter.classId = id(query.classId, "class");
  if (query.sectionId) assignmentFilter.sectionId = id(query.sectionId, "section");
  if (query.teacherId) assignmentFilter.teacherId = id(query.teacherId, "teacher");
  if (query.subjectId) assignmentFilter.subjectId = id(query.subjectId, "subject");
  const [students, assignments] = await Promise.all([
    selectedSession.isActive
      ? Student.aggregate([{ $match: studentMatch }, { $group: { _id: { classId: "$classId", sectionId: "$sectionId" }, count: { $sum: 1 } } }])
      : StudentEnrollment.aggregate([{ $match: { schoolId, sessionId, classId: { $in: classIds }, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] }, ...(query.sectionId ? { sectionId: id(query.sectionId, "section") } : {}) } }, { $group: { _id: { classId: "$classId", sectionId: "$sectionId" }, count: { $sum: 1 } } }]),
    SubjectTeacherAssignment.find(assignmentFilter).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name code").populate("teacherId", "fullName employeeId").lean(),
  ]);
  const countMap = new Map(students.map(s => [`${s._id.classId}:${s._id.sectionId}`, s.count]));
  const sectionRows = sections.map(s => {
    const enrolled = countMap.get(`${s.classId}:${s._id}`) || 0;
    return { ...s, enrolledStudents: enrolled, availableSeats: s.capacity == null ? null : Math.max(0, s.capacity - enrolled), capacityUtilization: s.capacity ? Math.round((enrolled / s.capacity) * 100) : null, isFull: s.capacity != null && enrolled >= s.capacity };
  });
  return {
    summary: { totalClasses: classes.length, totalSections: sections.length, totalAllocatedStudents: students.reduce((n, x) => n + x.count, 0), availableSeats: sectionRows.reduce((n, s) => n + (s.availableSeats ?? 0), 0), fullSections: sectionRows.filter(s => s.isFull).length },
    classes: classes.map(c => ({ ...c, sections: sectionRows.filter(s => String(s.classId) === String(c._id)), totalStudents: sectionRows.filter(s => String(s.classId) === String(c._id)).reduce((n, s) => n + s.enrolledStudents, 0) })),
    sections: sectionRows,
    subjectTeacherAssignments: assignments,
  };
}

export async function listStudentsForPlacement(kind: "class" | "section", targetId: string, query: any, actor: ClassSectionActor) {
  const { schoolId } = actorIds(actor);
  const filter: any = { schoolId, isDeleted: { $ne: true } };
  if (query.sessionId) filter.sessionId = id(query.sessionId, "session");
  if (kind === "class") filter.classId = id(targetId, "class"); else filter.sectionId = id(targetId, "section");
  if (actor.role === "TEACHER") {
    const teacher = await Employee.findOne({ schoolId, userId: id(actor.userId, "user"), isDeleted: false, isActive: true, employeeType: "TEACHING" }).select("_id").lean();
    if (!teacher) throw new AppError("No active teaching employee is linked to this account", 404);
    const assignedSubjectSections = await SubjectTeacherAssignment.find({ schoolId, teacherId: teacher._id, isActive: true, ...(query.sessionId ? { sessionId: id(query.sessionId, "session") } : {}) }).distinct("sectionId");
    const assignedFilter: any = { schoolId, isDeleted: false, isActive: true, $or: [{ classTeacherId: teacher._id }, { _id: { $in: assignedSubjectSections.filter(Boolean) } }] };
    if (kind === "class") assignedFilter.classId = id(targetId, "class");
    else assignedFilter._id = id(targetId, "section");
    const assignedSections = await Section.find(assignedFilter).select("_id").lean();
    if (!assignedSections.length) throw new AppError("You are not assigned to this class or section", 403);
    filter.sectionId = { $in: assignedSections.map(section => section._id) };
  }
  if (query.status) filter.status = query.status;
  if (query.search) filter.$or = [{ firstName: new RegExp(query.search, "i") }, { lastName: new RegExp(query.search, "i") }, { admissionNumber: new RegExp(query.search, "i") }];
  const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const [items, total] = await Promise.all([Student.find(filter).select("admissionNumber firstName middleName lastName classId sectionId sessionId status rollNumber").populate("classId", "name").populate("sectionId", "name").sort({ firstName: 1 }).skip((page - 1) * limit).limit(limit).lean(), Student.countDocuments(filter)]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function eligibleStudentsForSession(query: any, actor: ClassSectionActor) {
  const { schoolId } = actorIds(actor);
  const sessionId = id(query.sessionId, "academic session");
  await validSession(query.sessionId, schoolId);
  const filter: any = { schoolId, sessionId: { $ne: sessionId }, status: StudentStatus.ACTIVE, isDeleted: { $ne: true }, tcLocked: { $ne: true } };
  if (query.search) {
    const safe = String(query.search).trim().replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    filter.$or = [{ firstName: new RegExp(safe, "i") }, { lastName: new RegExp(safe, "i") }, { admissionNumber: new RegExp(safe, "i") }];
  }
  const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const [items, total] = await Promise.all([
    Student.find(filter).select("admissionNumber firstName middleName lastName sessionId classId sectionId status").populate("sessionId", "name").populate("classId", "name").populate("sectionId", "name").sort({ firstName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function myTeachingAssignments(actor: ClassSectionActor) {
  const { schoolId } = actorIds(actor);
  const teacher = await Employee.findOne({ schoolId, userId: id(actor.userId, "user"), isDeleted: false, isActive: true, employeeType: "TEACHING" }).select("_id fullName employeeId").lean();
  if (!teacher) throw new AppError("No active teaching employee is linked to this account", 404);
  const [classTeacherSections, subjectAssignments] = await Promise.all([
    Section.find({ schoolId, classTeacherId: teacher._id, isDeleted: false, isActive: true }).populate("classId", "name code").populate("sessionId", "name").lean(),
    SubjectTeacherAssignment.find({ schoolId, teacherId: teacher._id, isActive: true }).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name code").populate("sessionId", "name").lean(),
  ]);
  return { teacher, classTeacherSections, subjectAssignments };
}
