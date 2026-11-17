import mongoose, { Types } from "mongoose";
import Session from "./sessions.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Student from "../students/students.model";
import StudentEnrollment from "../class-section/student-enrollment.model";
import ClassSectionHistory from "../class-section/class-section-history.model";
import StudentRecord from "../students/student-records.model";
import School from "../schools/schools.model";
import { FeeStructure, FeeHead } from "../fees/fees.model";
import { AppError } from "../../utils/AppError";
import { promoteStudents, eligibleStudentsForSession } from "../class-section/class-section.service";

export interface SessionActor { userId: string; schoolId: string; role: string; }
const oid = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, 400);
  return new Types.ObjectId(value);
};
const actorIds = (actor: SessionActor) => ({ schoolId: oid(actor.schoolId, "school context"), userId: oid(actor.userId, "user context") });
const parseSchoolDate = (value: string, timezone: string, endOfDay: boolean): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new AppError("Invalid academic session date", 400);
    return parsed;
  }
  const [year, month, day] = value.split("-").map(Number);
  const hour = endOfDay ? 23 : 0, minute = endOfDay ? 59 : 0, second = endOfDay ? 59 : 0, millisecond = endOfDay ? 999 : 0;
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let guess = targetUtc;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess));
    const part = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
    const representedUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"), millisecond);
    guess += targetUtc - representedUtc;
  }
  return new Date(guess);
};
const getSchoolTimezone = async (schoolId: Types.ObjectId) => {
  const school = await School.findById(schoolId).select("timezone").lean();
  return school?.timezone || "UTC";
};
const ensureAdmin = (actor: SessionActor) => {
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(actor.role)) throw new AppError("You are not authorized to manage academic sessions", 403);
};
const findSession = async (sessionId: string, actor: SessionActor) => {
  const { schoolId } = actorIds(actor);
  const session = await Session.findOne({ _id: oid(sessionId, "session ID"), schoolId, isDeleted: false });
  if (!session) throw new AppError("Academic session not found in this school", 404);
  return session;
};
const ensureNoOverlap = async (schoolId: Types.ObjectId, startDate: Date, endDate: Date, excludeId?: Types.ObjectId) => {
  const overlap = await Session.findOne({
    schoolId, isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    startDate: { $lte: endDate }, endDate: { $gte: startDate },
  }).select("name startDate endDate").lean();
  if (overlap) throw new AppError(`Academic session dates overlap with ${overlap.name}`, 409);
};

export async function createAcademicSession(data: { name: string; code: string; startDate: string; endDate: string; description?: string }, actor: SessionActor) {
  ensureAdmin(actor);
  const { schoolId, userId } = actorIds(actor);
  const timezone = await getSchoolTimezone(schoolId);
  const startDate = parseSchoolDate(data.startDate, timezone, false), endDate = parseSchoolDate(data.endDate, timezone, true);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) throw new AppError("Session end date must be after start date", 400);
  await ensureNoOverlap(schoolId, startDate, endDate);
  const name = data.name.trim(), code = data.code.trim().toUpperCase();
  try {
    return await Session.create({ schoolId, name, code, startDate, endDate, description: data.description?.trim(), isActive: false, isClosed: false, status: startDate.getTime() > Date.now() ? "UPCOMING" : "DRAFT", createdBy: userId, auditHistory: [{ action: "CREATED", performedAt: new Date(), performedBy: userId }] });
  } catch (error: any) {
    if (error?.code === 11000) throw new AppError("A session with this name or code already exists", 409);
    throw error;
  }
}

export async function updateAcademicSession(sessionId: string, data: { name?: string; code?: string; startDate?: string; endDate?: string; description?: string }, actor: SessionActor) {
  ensureAdmin(actor);
  const { schoolId, userId } = actorIds(actor);
  const session = await findSession(sessionId, actor);
  if (session.isClosed) throw new AppError("Closed sessions are irreversible and cannot be edited", 409);
  if (session.isActive) throw new AppError("Active session cannot be edited", 409);
  if (session.activatedAt) throw new AppError("A previously activated session cannot be edited; close it after switching to the replacement session", 409);
  const timezone = await getSchoolTimezone(schoolId);
  const startDate = data.startDate ? parseSchoolDate(data.startDate, timezone, false) : session.startDate;
  const endDate = data.endDate ? parseSchoolDate(data.endDate, timezone, true) : session.endDate;
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) throw new AppError("Session end date must be after start date", 400);
  await ensureNoOverlap(schoolId, startDate, endDate, session._id);
  if (data.name !== undefined) session.name = data.name.trim();
  if (data.code !== undefined) session.code = data.code.trim().toUpperCase();
  session.startDate = startDate; session.endDate = endDate;
  if (data.description !== undefined) session.description = data.description.trim();
  session.status = startDate.getTime() > Date.now() ? "UPCOMING" : "DRAFT";
  session.updatedBy = userId;
  session.auditHistory?.push({ action: "UPDATED", performedAt: new Date(), performedBy: userId, details: "Session details updated" });
  try { await session.save(); } catch (error: any) { if (error?.code === 11000) throw new AppError("Session name or code already exists", 409); throw error; }
  return session;
}

export async function activateAcademicSession(sessionId: string, confirmation: string, actor: SessionActor) {
  ensureAdmin(actor);
  if (confirmation !== "ACTIVATE_SESSION") throw new AppError("Explicit activation confirmation is required", 400);
  const { schoolId, userId } = actorIds(actor);
  const selected = await findSession(sessionId, actor);
  if (selected.isClosed) throw new AppError("A closed academic session cannot be activated", 409);
  if (selected.isActive) throw new AppError("This academic session is already active", 409);
  const now = new Date();
  const school = await School.findById(schoolId).select("timezone").lean();
  const timezone = school?.timezone || "UTC";
  const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const today = dayKey(now), startDay = dayKey(selected.startDate), endDay = dayKey(selected.endDate);
  if (today < startDay || today > endDay) throw new AppError(`Session can only be activated between ${startDay} and ${endDay} in the school's ${timezone} timezone`, 400);
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const currentlyActive = await Session.find({ schoolId, _id: { $ne: selected._id }, isActive: true, isClosed: { $ne: true }, isDeleted: false }).session(mongoSession);
      for (const current of currentlyActive) {
        current.isActive = false;
        current.status = current.startDate > now ? "UPCOMING" : "DRAFT";
        current.updatedBy = userId;
        current.auditHistory?.push({ action: "DEACTIVATED", performedAt: now, performedBy: userId, details: `Replaced by session ${selected.name}` });
        await current.save({ session: mongoSession });
      }
      const updated = await Session.findOneAndUpdate({ _id: selected._id, schoolId, isClosed: { $ne: true }, isDeleted: false }, { $set: { isActive: true, status: "ACTIVE", activatedAt: now, activatedBy: userId, updatedBy: userId }, $push: { auditHistory: { action: "ACTIVATED", performedAt: now, performedBy: userId } } }, { new: true, session: mongoSession });
      if (!updated) throw new AppError("Session could not be activated", 409);
    });
  } catch (error: any) {
    if (error?.code === 11000 || error?.code === 112) throw new AppError("Another activation was completed concurrently. Refresh sessions and retry.", 409);
    throw error;
  } finally { await mongoSession.endSession(); }
  return findSession(sessionId, actor);
}

export async function closeAcademicSession(sessionId: string, confirmation: string, actor: SessionActor) {
  ensureAdmin(actor);
  if (confirmation !== "CLOSE_SESSION") throw new AppError("Explicit close confirmation is required", 400);
  const { schoolId, userId } = actorIds(actor);
  const session = await findSession(sessionId, actor);
  if (session.isClosed) throw new AppError("This session is already closed; closure is irreversible", 409);
  if (session.isActive) throw new AppError("Activate the replacement academic session first; the current active session cannot be closed directly", 409);
  const now = new Date(), mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const result = await Session.updateOne({ _id: session._id, schoolId, isActive: { $ne: true }, isClosed: { $ne: true }, isDeleted: false }, { $set: { isActive: false, isClosed: true, status: "CLOSED", closedAt: now, closedBy: userId, updatedBy: userId }, $push: { auditHistory: { action: "CLOSED", performedAt: now, performedBy: userId, details: "Irreversible academic session closure" } } }, { session: mongoSession });
      if (!result.modifiedCount) throw new AppError("Session was already closed by another request", 409);
    });
  } finally { await mongoSession.endSession(); }
  return findSession(sessionId, actor);
}

export async function getSessionDashboard(actor: SessionActor) {
  const { schoolId } = actorIds(actor);
  const schoolTimezone = await getSchoolTimezone(schoolId);
  const sessions = await Session.find({ schoolId, isDeleted: false }).sort({ startDate: -1 }).lean();
  const active = sessions.find(s => s.isActive && !s.isClosed) || null;
  const upcoming = sessions.find(s => !s.isActive && !s.isClosed && s.startDate > new Date()) || null;
  const [activeStudentIds, classCounts, enrollmentCounts] = await Promise.all([
    active ? Student.find({ schoolId, sessionId: active._id, status: "ACTIVE", isDeleted: { $ne: true }, tcLocked: { $ne: true } }).distinct("_id") : Promise.resolve([] as Types.ObjectId[]),
    Promise.all(sessions.map(async session => ({ id: String(session._id), count: await Class.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }) }))),
    Promise.all(sessions.map(async session => ({ id: String(session._id), count: await StudentEnrollment.countDocuments({ schoolId, sessionId: session._id, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] } }) }))),
  ]);
  const alreadyEnrolledNext = upcoming && activeStudentIds.length
    ? await StudentEnrollment.distinct("studentId", { schoolId, sessionId: upcoming._id, studentId: { $in: activeStudentIds }, status: "ACTIVE" })
    : [];
  const pendingPromotion = upcoming ? activeStudentIds.filter(id => !alreadyEnrolledNext.some(nextId => String(nextId) === String(id))).length : 0;
  return {
    schoolTimezone,
    summary: { totalSessions: sessions.length, activeSession: active, upcomingSession: upcoming, closedSessions: sessions.filter(s => s.isClosed).length, activeSessionStudents: activeStudentIds.length, studentsPendingPromotion: pendingPromotion },
    sessions: sessions.map(session => ({ ...session, classCount: classCounts.find(x => x.id === String(session._id))?.count || 0, studentCount: session.isActive ? activeStudentIds.length : enrollmentCounts.find(x => x.id === String(session._id))?.count || 0 })),
  };
}

export async function getSessionDetails(sessionId: string, actor: SessionActor) {
  const { schoolId } = actorIds(actor);
  const session = await findSession(sessionId, actor);
  await session.populate([
    { path: "activatedBy", select: "name email" },
    { path: "closedBy", select: "name email" },
    { path: "auditHistory.performedBy", select: "name email" },
  ]);
  const [classCount, studentCount, feeStructures, promotionCount, detainedCount] = await Promise.all([
    Class.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }),
    session.isActive
      ? Student.countDocuments({ schoolId, sessionId: session._id, status: "ACTIVE", isDeleted: { $ne: true } })
      : StudentEnrollment.countDocuments({ schoolId, sessionId: session._id, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] } }),
    FeeStructure.find({ schoolId, sessionId: session._id, isDeleted: false }).select("isActive totalAmount").lean(),
    StudentRecord.countDocuments({ schoolId, "details.newSessionId": session._id, recordType: "PROMOTION", isDeleted: false }),
    StudentEnrollment.countDocuments({ schoolId, sessionId: session._id, status: "DETAINED" }),
  ]);
  return { session, schoolTimezone: await getSchoolTimezone(schoolId), metrics: { classCount, studentCount, feeStructureCount: feeStructures.length, activeFeeStructures: feeStructures.filter(f => f.isActive).length, draftFeeStructures: feeStructures.filter(f => !f.isActive).length, feeStructureTotalAmount: feeStructures.reduce((sum, f) => sum + Number(f.totalAmount || 0), 0), promotedStudents: promotionCount, detainedStudents: detainedCount } };
}

export async function getSessionReports(actor: SessionActor, sessionId?: string) {
  const { schoolId } = actorIds(actor);
  const filter: any = { schoolId, isDeleted: false };
  if (sessionId) filter._id = oid(sessionId, "session ID");
  const sessions = await Session.find(filter).sort({ startDate: -1 }).lean();
  return Promise.all(sessions.map(async s => {
    const [classes, activeStudents, completedStudents, detainedStudents, promotedStudents, fees] = await Promise.all([
      Class.countDocuments({ schoolId, sessionId: s._id, isDeleted: false }),
      s.isActive
        ? Student.countDocuments({ schoolId, sessionId: s._id, status: "ACTIVE", isDeleted: { $ne: true } })
        : StudentEnrollment.countDocuments({ schoolId, sessionId: s._id, status: "ACTIVE" }),
      StudentEnrollment.countDocuments({ schoolId, sessionId: s._id, status: "COMPLETED" }),
      StudentEnrollment.countDocuments({ schoolId, sessionId: s._id, status: "DETAINED" }),
      StudentRecord.countDocuments({ schoolId, "details.newSessionId": s._id, recordType: "PROMOTION", isDeleted: false }),
      FeeStructure.find({ schoolId, sessionId: s._id, isDeleted: false }).select("isActive totalAmount").lean(),
    ]);
    return { session: s, classCount: classes, activeStudents, completedStudents, detainedStudents, promotedStudents, feeStructureCount: fees.length, activeFeeStructures: fees.filter(f => f.isActive).length, draftFeeStructures: fees.filter(f => !f.isActive).length, feeStructureTotalAmount: fees.reduce((sum, f) => sum + Number(f.totalAmount || 0), 0) };
  }));
}

export async function prepareSessionClasses(sourceSessionId: string, destinationSessionId: string, actor: SessionActor) {
  ensureAdmin(actor);
  const { schoolId, userId } = actorIds(actor);
  if (sourceSessionId === destinationSessionId) throw new AppError("Source and destination sessions must differ", 400);
  const source = await findSession(sourceSessionId, actor), destination = await findSession(destinationSessionId, actor);
  if (destination.isClosed || destination.isActive) throw new AppError("Destination session must be an inactive, open preparation session", 409);
  const sourceClasses = await Class.find({ schoolId, sessionId: source._id, isDeleted: false }).lean();
  const sourceSections = await Section.find({ schoolId, sessionId: source._id, isDeleted: false }).lean();
  const existingClasses = await Class.find({ schoolId, sessionId: destination._id, isDeleted: false }).select("_id code name").lean();
  type PreparedClassRef = { _id: Types.ObjectId; code: string; name: string };
  const existingClassByCode = new Map<string, PreparedClassRef>();
  for (const existingClass of existingClasses) existingClassByCode.set(existingClass.code, existingClass as PreparedClassRef);
  const existingSections = await Section.find({ schoolId, sessionId: destination._id, isDeleted: false }).select("classId code").lean();
  const mongoSession = await mongoose.startSession();
  let createdClasses = 0, createdSections = 0, skippedClasses = 0;
  try {
    await mongoSession.withTransaction(async () => {
      createdClasses = 0; createdSections = 0; skippedClasses = 0;
      for (const sourceClass of sourceClasses) {
        let targetClass: PreparedClassRef | undefined = existingClassByCode.get(sourceClass.code);
        if (targetClass) skippedClasses++;
        else {
          const [created] = await Class.create([{
            schoolId, sessionId: destination._id, name: sourceClass.name, code: sourceClass.code,
            displayName: sourceClass.displayName, numericLevel: sourceClass.numericLevel,
            description: sourceClass.description, capacity: sourceClass.capacity, stream: sourceClass.stream,
            subjects: sourceClass.subjects || [], isActive: true, isDeleted: false, createdBy: userId,
          }], { session: mongoSession });
          targetClass = created as unknown as PreparedClassRef;
          createdClasses++;
        }
        const children = sourceSections.filter(section => String(section.classId) === String(sourceClass._id));
        const existingSectionCodes = new Set(existingSections.filter(section => String(section.classId) === String(targetClass._id)).map(section => section.code));
        for (const section of children) {
          if (existingSectionCodes.has(section.code)) continue;
          await Section.create([{
            schoolId, sessionId: destination._id, classId: targetClass._id, name: section.name, code: section.code,
            displayName: section.displayName, roomNumber: section.roomNumber, capacity: section.capacity,
            description: section.description, isActive: true, isDeleted: false, createdBy: userId,
          }], { session: mongoSession });
          createdSections++;
        }
      }
      await Session.updateOne({ _id: destination._id, schoolId }, { $push: { auditHistory: { action: "CLASSES_PREPARED", performedAt: new Date(), performedBy: userId, details: `${createdClasses} classes and ${createdSections} sections prepared from ${source.name}` } } }, { session: mongoSession });
    });
  } catch (error: any) {
    if (error?.code === 11000) throw new AppError("Some destination classes or sections already exist. Refresh preparation status and retry.", 409);
    throw error;
  } finally { await mongoSession.endSession(); }
  return { sourceSession: source.name, destinationSession: destination.name, createdClasses, createdSections, skippedClasses, teacherAssignmentsCopied: false, subjectsCopiedWithClass: true };
}

export async function cloneSessionFeeStructures(sourceSessionId: string, destinationSessionId: string, actor: SessionActor) {
  ensureAdmin(actor);
  const { schoolId, userId } = actorIds(actor);
  if (sourceSessionId === destinationSessionId) throw new AppError("Source and destination sessions must differ", 400);
  const source = await findSession(sourceSessionId, actor), destination = await findSession(destinationSessionId, actor);
  if (destination.isClosed || destination.isActive) throw new AppError("Destination session must be inactive and open", 409);
  const sourceStructures = await FeeStructure.find({ schoolId, sessionId: source._id, isDeleted: false }).lean();
  const existing = await FeeStructure.find({ schoolId, sessionId: destination._id, isDeleted: false }).select("code").lean();
  const existingCodes = new Set(existing.map(x => x.code));
  const sourceClasses = await Class.find({ schoolId, sessionId: source._id, isDeleted: false }).select("_id code").lean();
  const destinationClasses = await Class.find({ schoolId, sessionId: destination._id, isDeleted: false }).select("_id code").lean();
  const destinationClassByCode = new Map<string, Types.ObjectId>();
  for (const destinationClass of destinationClasses) destinationClassByCode.set(destinationClass.code, destinationClass._id);
  const sourceClassCode = new Map<string, string>();
  for (const sourceClass of sourceClasses) sourceClassCode.set(String(sourceClass._id), sourceClass.code);
  const cloned: any[] = [];
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      cloned.length = 0;
      for (const structure of sourceStructures) {
        const code = `${structure.code}-COPY`;
        if (existingCodes.has(code)) continue;
        const mappedClassIds = (structure.classIds || []).flatMap(classId => {
          const sourceCode = sourceClassCode.get(String(classId));
          const destinationClassId = sourceCode ? destinationClassByCode.get(sourceCode) : undefined;
          return destinationClassId ? [destinationClassId] : [];
        });
        if ((structure.classIds || []).length && mappedClassIds.length !== structure.classIds.length) {
          throw new AppError(`Prepare all destination classes before cloning class-specific fee structure ${structure.name}`, 409);
        }
        const [copy] = await FeeStructure.create([{
          schoolId, sessionId: destination._id, name: `${structure.name} (Draft)`, code,
          description: structure.description, frequency: structure.frequency,
          classIds: mappedClassIds,
          items: structure.items.map(item => ({ feeHeadId: item.feeHeadId, name: item.name, amount: item.amount, isOptional: item.isOptional })),
          totalAmount: structure.totalAmount, dueDay: structure.dueDay, lateFineType: structure.lateFineType,
          lateFineAmount: structure.lateFineAmount, graceDays: structure.graceDays,
          isActive: true, isDeleted: false, createdBy: userId,
        }], { session: mongoSession });
        cloned.push(copy);
      }
      await Session.updateOne({ _id: destination._id, schoolId }, { $push: { auditHistory: { action: "FEES_CLONED", performedAt: new Date(), performedBy: userId, details: `${cloned.length} fee structures cloned as inactive drafts` } } }, { session: mongoSession });
    });
  } catch (error: any) {
    if (error?.code === 11000) throw new AppError("Fee structure code conflict. Check destination fee structures before retrying.", 409);
    throw error;
  } finally { await mongoSession.endSession(); }
  return { sourceSession: source.name, destinationSession: destination.name, clonedCount: cloned.length, structures: cloned };
}

export async function getPreparationStatus(destinationSessionId: string, actor: SessionActor) {
  const { schoolId } = actorIds(actor), destination = await findSession(destinationSessionId, actor);
  const [classes, sections, feeStructures, activeStudents, detainedStudents] = await Promise.all([
    Class.countDocuments({ schoolId, sessionId: destination._id, isDeleted: false }),
    Section.countDocuments({ schoolId, sessionId: destination._id, isDeleted: false }),
    FeeStructure.find({ schoolId, sessionId: destination._id, isDeleted: false }).select("isActive").lean(),
    StudentEnrollment.countDocuments({ schoolId, sessionId: destination._id, status: "ACTIVE" }),
    StudentEnrollment.countDocuments({ schoolId, sessionId: destination._id, status: "DETAINED" }),
  ]);
  return { session: destination, progress: { classesPrepared: classes > 0, sectionsPrepared: sections > 0, feeStructuresReviewed: feeStructures.length > 0 && feeStructures.every(f => f.isActive), feeStructures: feeStructures.length, activeFeeStructures: feeStructures.filter(f => f.isActive).length, draftFeeStructures: feeStructures.filter(f => !f.isActive).length, studentEnrollmentsPrepared: activeStudents > 0, pendingOrDetainedStudents: detainedStudents, classes, sections, activeStudents, detainedStudents, readyForActivation: classes > 0 && sections > 0 } };
}

export async function sessionPromotionEligible(query: any, actor: SessionActor) {
  return eligibleStudentsForSession(query, actor);
}
export async function executeSessionPromotion(data: any, actor: SessionActor) {
  ensureAdmin(actor);
  return promoteStudents(data, actor);
}


export async function activatePreparedFeeStructure(feeStructureId: string, confirmation: string, actor: SessionActor) {
  ensureAdmin(actor);
  if (confirmation !== "ACTIVATE_FEE_STRUCTURE") throw new AppError("Explicit fee structure activation confirmation is required", 400);
  const { schoolId, userId } = actorIds(actor);
  const structure = await FeeStructure.findOne({ _id: oid(feeStructureId, "fee structure ID"), schoolId, isDeleted: false });
  if (!structure) throw new AppError("Fee structure not found in this school", 404);
  const session = await Session.findOne({ _id: structure.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } });
  if (!session) throw new AppError("Fee structure academic session is closed or unavailable", 409);
  if (structure.isActive) throw new AppError("Fee structure is already active", 409);
  if (structure.classIds.length) {
    const validCount = await Class.countDocuments({ _id: { $in: structure.classIds }, schoolId, sessionId: structure.sessionId, isDeleted: false });
    if (validCount !== structure.classIds.length) throw new AppError("One or more fee structure classes do not belong to the destination session", 400);
  }
  const feeHeadIds = structure.items.map(item => item.feeHeadId);
  const validHeads = await FeeHead.countDocuments({ _id: { $in: feeHeadIds }, schoolId, isDeleted: false, isActive: true });
  if (validHeads !== feeHeadIds.length) throw new AppError("All fee heads in this structure must remain active before activation", 409);
  structure.isActive = true;
  structure.updatedBy = userId;
  await structure.save();
  await Session.updateOne({ _id: session._id, schoolId }, { $push: { auditHistory: { action: "FEE_STRUCTURE_ACTIVATED", performedAt: new Date(), performedBy: userId, details: `Fee structure ${structure.name} activated` } } });
  return structure;
}


export async function getPreviousSessions(actor: SessionActor) {
  const { schoolId } = actorIds(actor);
  const now = new Date();
  const sessions = await Session.find({ schoolId, isDeleted: false, isActive: { $ne: true }, $or: [{ isClosed: true }, { endDate: { $lt: now } }] }).sort({ startDate: -1 }).lean();
  return Promise.all(sessions.map(async session => {
    const [studentCount, classCount] = await Promise.all([
      StudentEnrollment.countDocuments({ schoolId, sessionId: session._id, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] } }),
      Class.countDocuments({ schoolId, sessionId: session._id, isDeleted: false }),
    ]);
    return { ...session, studentCount, classCount };
  }));
}

export async function getSessionHistory(actor: SessionActor, sessionId?: string) {
  const { schoolId } = actorIds(actor);
  const filter: any = { schoolId, isDeleted: false };
  if (sessionId) filter._id = oid(sessionId, "session ID");
  const sessions = await Session.find(filter).select("name code auditHistory").populate("auditHistory.performedBy", "name email").sort({ updatedAt: -1 }).lean();
  return sessions.flatMap(session => (session.auditHistory || []).map(event => ({
    sessionId: session._id, sessionName: session.name, sessionCode: session.code, ...event,
  }))).sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}

export async function getDetainedStudents(actor: SessionActor, sessionId: string) {
  const { schoolId } = actorIds(actor);
  const session = await findSession(sessionId, actor);
  return StudentEnrollment.find({ schoolId, sessionId: session._id, status: "DETAINED" })
    .populate("studentId", "admissionNumber firstName middleName lastName status")
    .populate("classId", "name code")
    .populate("sectionId", "name code")
    .sort({ updatedAt: -1 }).lean();
}

export async function previewSessionPromotion(sourceSessionId: string, destinationSessionId: string, actor: SessionActor, page = 1, limit = 100) {
  const { schoolId } = actorIds(actor);
  if (sourceSessionId === destinationSessionId) throw new AppError("Source and destination sessions must differ", 400);
  const source = await findSession(sourceSessionId, actor);
  const destination = await findSession(destinationSessionId, actor);
  if (destination.isClosed) throw new AppError("Destination session is closed", 409);
  const filter = { schoolId, sessionId: source._id, status: "ACTIVE", tcLocked: { $ne: true }, isDeleted: { $ne: true } };
  const totalActive = await Student.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(totalActive / limit));
  const currentPage = Math.min(page, pages);
  const eligible = await Student.find(filter)
    .select("admissionNumber firstName middleName lastName classId sectionId status tcLocked")
    .populate("classId", "name code").populate("sectionId", "name code")
    .sort({ firstName: 1, admissionNumber: 1 })
    .skip((currentPage - 1) * limit).limit(limit).lean();
  const ids = eligible.map(student => student._id);
  const [existingDestination, detained, detainedHistory] = await Promise.all([
    StudentEnrollment.find({ schoolId, studentId: { $in: ids }, sessionId: destination._id, status: "ACTIVE" }).distinct("studentId"),
    StudentEnrollment.find({ schoolId, studentId: { $in: ids }, sessionId: source._id, status: "DETAINED" }).distinct("studentId"),
    ClassSectionHistory.find({ schoolId, studentId: { $in: ids }, sessionId: source._id, event: "PROMOTED", "next.promotionStatus": "DETAINED" }).distinct("studentId"),
  ]);
  const excluded = new Set([...existingDestination.map(String), ...detained.map(String), ...detainedHistory.map(String)]);
  const eligibleStudents = eligible.filter(student => !excluded.has(String(student._id)));
  return {
    sourceSession: { id: source._id, name: source.name },
    destinationSession: { id: destination._id, name: destination.name },
    eligibleStudents,
    excludedStudents: eligible.filter(student => excluded.has(String(student._id))).map(student => ({ ...student, exclusionReason: "Already enrolled in destination session or detained" })),
    counts: { totalActive, eligibleOnPage: eligibleStudents.length, excludedOnPage: excluded.size },
    pagination: { page: currentPage, limit, total: totalActive, pages },
  };
}
