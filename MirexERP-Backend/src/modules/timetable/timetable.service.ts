
import { Types } from "mongoose";
import Timetable, {
  DayOfWeek,
} from "./timetable.model";
import Session from "../sessions/sessions.model";

import { AppError } from "../../utils/AppError";
import ClassSubjectMapping from "../subjects/class-subject-mapping.model";
import Class from "../classes/classes.model";
import Subject from "../subjects/subjects.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import SubstituteAssignment from "../employees/substitute-assignment.model";
import Employee from "../employees/employees.model";
import TimetableVersion from "./timetable-version.model";
import { validateEntry, validateNoConflicts } from "./timetable-advanced.service";

interface TimetableActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface CreateTimetableInput {
  sessionId: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  roomId?: string;
  periodId?: string;
  combinedGroupId?: string;
  entryType?: "REGULAR" | "ACTIVITY" | "LAB";
  isBreak?: boolean;
  breakName?: string;
}

interface TimetableFilters {
  page?: number;
  limit?: number;
  classId?: string;
  sectionId?: string;
  sessionId?: string;
  dayOfWeek?: string;
  date?: string;
  teacherId?: string;
}

const validateId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const validateTime = (startTime: string, endTime: string) => {
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new AppError(
      "End time must be after start time",
      400
    );
  }
};

const ensureSchoolId = (schoolId: string) => {
  if (!schoolId || !Types.ObjectId.isValid(schoolId)) {
    throw new AppError("Valid school context is required", 400);
  }
};

const ensureTeachingFields = (input: CreateTimetableInput) => {
  if (input.isBreak) return;

  if (!input.subjectId || !input.teacherId) {
    throw new AppError(
      "Subject and teacher are required for a teaching period",
      400
    );
  }

  validateId(input.subjectId, "subject ID");
  validateId(input.teacherId, "teacher ID");
};

const checkTeacherConflict = async (
  schoolId: string,
  input: CreateTimetableInput,
  excludeId?: string
) => {
  if (input.isBreak || !input.teacherId) return;

  const query: Record<string, unknown> = {
    schoolId,
    sessionId: input.sessionId,
    teacherId: input.teacherId,
    dayOfWeek: input.dayOfWeek,
    isBreak: false,
    isActive: true,
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await Timetable.findOne(query);

  if (conflict) {
    throw new AppError(
      "Teacher already has another class during this time",
      409
    );
  }
};

const checkClassTimeConflict = async (
  schoolId: string,
  input: CreateTimetableInput,
  excludeId?: string
) => {
  const query: Record<string, unknown> = {
    schoolId,
    sessionId: input.sessionId,
    classId: input.classId,
    sectionId: input.sectionId,
    dayOfWeek: input.dayOfWeek,
    isActive: true,
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await Timetable.findOne(query);

  if (conflict) {
    throw new AppError(
      "This class already has a period during this time",
      409
    );
  }
};

/**
 * Create timetable
 */
export const createTimetableService = async (
  actor: TimetableActor,
  input: CreateTimetableInput
) => {
  ensureSchoolId(actor.schoolId);

  validateId(input.sessionId, "session ID");
  validateId(input.classId, "class ID");
  validateId(input.sectionId, "section ID");
  const session = await Session.findOne({ _id: input.sessionId, schoolId: actor.schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Academic session is closed or unavailable", 409);

  validateTime(input.startTime, input.endTime);
  ensureTeachingFields(input);
  const publishedVersion = await TimetableVersion.exists({schoolId:actor.schoolId,sessionId:input.sessionId,classId:input.classId,sectionId:input.sectionId,status:"PUBLISHED"});
  if(publishedVersion)throw new AppError("This section already uses versioned timetable publishing. Create and publish a new draft version instead.",409);
  await validateEntry(actor.schoolId, input.sessionId, input, actor.userId);
  await validateNoConflicts(actor.schoolId, input.sessionId, [input]);
  if (!input.isBreak && input.subjectId) {
    const [mapped, legacyClass] = await Promise.all([
      ClassSubjectMapping.exists({ schoolId: actor.schoolId, sessionId: input.sessionId, classId: input.classId, subjectId: input.subjectId, isActive: true, effectiveFrom: { $lte: new Date() } }),
      Class.findOne({ _id: input.classId, schoolId: actor.schoolId, sessionId: input.sessionId, isDeleted: false }).select("subjects").lean(),
    ]);
    if (!mapped && !legacyClass?.subjects.some((item) => item.toString() === input.subjectId)) throw new AppError("Timetable subject must be mapped to the selected class and session", 400);
    const activeSubject = await Subject.exists({ _id: input.subjectId, schoolId: actor.schoolId, isDeleted: false, isActive: true });
    if (!activeSubject) throw new AppError("Inactive or unavailable subjects cannot be added to the timetable", 400);
    const assigned = await SubjectTeacherAssignment.exists({
      schoolId: actor.schoolId, sessionId: input.sessionId, classId: input.classId,
      subjectId: input.subjectId, teacherId: input.teacherId, isActive: true,
      $or: [{ sectionId: input.sectionId }, { sectionId: null }],
    });
    if (!assigned) throw new AppError("Assign this teacher to the class/section subject before adding it to the timetable", 400);
  }

  await Promise.all([
    checkTeacherConflict(actor.schoolId, input),
    checkClassTimeConflict(actor.schoolId, input),
  ]);

  const timetable = await Timetable.create({
    ...input,
    schoolId: actor.schoolId,
    subjectId: input.isBreak ? undefined : input.subjectId,
    teacherId: input.isBreak ? undefined : input.teacherId,
    isBreak: input.isBreak ?? false,
    createdBy: actor.userId,
  });

  return timetable;
};

export const addSubstituteTeachers = async (schoolId: string, items: any[], date?: string) => {
  if (!date || !items.length) return items;
  const day = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(day.getTime())) throw new AppError("Invalid timetable date", 400);
  const dayOfWeek = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][day.getUTCDay()];
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  const substitutions = await SubstituteAssignment.find({
    schoolId, date: { $gte: start, $lte: end }, status: "ACTIVE",
  }).populate("substituteTeacherId", "firstName lastName fullName employeeId").lean();
  return items.map((item) => {
    const match = substitutions.find((sub: any) =>
      sub.classId?.toString() === item.classId?._id?.toString() &&
      (!sub.sectionId || sub.sectionId?.toString() === item.sectionId?._id?.toString()) &&
      sub.period === item.periodNumber &&
      item.dayOfWeek === dayOfWeek &&
      sub.regularTeacherId?.toString() === item.teacherId?._id?.toString() &&
      (!sub.subjectId || sub.subjectId.toString() === item.subjectId?._id?.toString())
    );
    return match ? { ...item, isSubstitute: true, substituteTeacher: match.substituteTeacherId, substituteAssignmentId: match._id } : { ...item, isSubstitute: false };
  });
};

/**
 * Get all timetables
 */
export const getTimetablesService = async (
  schoolId: string,
  filters: TimetableFilters
) => {
  ensureSchoolId(schoolId);

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 10));

  const query: Record<string, unknown> = {
    schoolId,
    isActive: true,
  };

  if (filters.teacherId) { validateId(filters.teacherId, "teacher ID"); query.teacherId = filters.teacherId; }

  if (filters.classId) {
    validateId(filters.classId, "class ID");
    query.classId = filters.classId;
  }

  if (filters.sectionId) {
    validateId(filters.sectionId, "section ID");
    query.sectionId = filters.sectionId;
  }

  if (filters.sessionId) {
    validateId(filters.sessionId, "session ID");
    query.sessionId = filters.sessionId;
  }

  if (filters.dayOfWeek) {
    query.dayOfWeek = filters.dayOfWeek;
  }

  const [items, total] = await Promise.all([
    Timetable.find(query)
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName fullName employeeId")
      .populate("roomId", "name roomNumber roomType")
      .populate("periodId", "name periodNumber startTime endTime type")
      .populate("sessionId", "name")
      .sort({ dayOfWeek: 1, periodNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Timetable.countDocuments(query),
  ]);

  return {
    items: await addSubstituteTeachers(schoolId, items, filters.date),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get timetable by ID
 */
export const getTimetableByIdService = async (
  schoolId: string,
  timetableId: string
) => {
  ensureSchoolId(schoolId);
  validateId(timetableId, "timetable ID");

  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId,
    isActive: true,
  })
    .populate("classId", "name")
    .populate("sectionId", "name")
    .populate("subjectId", "name code")
    .populate("teacherId", "firstName lastName fullName employeeId")
    .populate("roomId", "name roomNumber roomType")
    .populate("periodId", "name periodNumber startTime endTime type")
    .populate("sessionId", "name");

  if (!timetable) {
    throw new AppError("Timetable not found", 404);
  }

  return timetable;
};

/**
 * Update timetable
 */
export const updateTimetableService = async (
  schoolId: string,
  timetableId: string,
  input: Partial<CreateTimetableInput> & {
    updatedBy?: string;
  }
) => {
  ensureSchoolId(schoolId);
  validateId(timetableId, "timetable ID");

  const timetable = await Timetable.findOne({
    _id: timetableId,
    schoolId,
    isActive: true,
  });

  if (!timetable) {
    throw new AppError("Timetable not found", 404);
  }
  if(timetable.versionId||await TimetableVersion.exists({schoolId,sessionId:timetable.sessionId,classId:timetable.classId,sectionId:timetable.sectionId,status:"PUBLISHED"}))throw new AppError("Published timetable entries are immutable. Create a new draft version to make changes.",409);
  const sourceSession = await Session.findOne({ _id: timetable.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!sourceSession) throw new AppError("Timetable records in a closed session cannot be changed", 409);

  const updatedData = {
    sessionId: String(input.sessionId ?? timetable.sessionId),
    classId: String(input.classId ?? timetable.classId),
    sectionId: String(input.sectionId ?? timetable.sectionId),
    subjectId: input.subjectId ?? timetable.subjectId?.toString(),
    teacherId: input.teacherId ?? timetable.teacherId?.toString(),
    dayOfWeek: input.dayOfWeek ?? timetable.dayOfWeek,
    periodNumber: input.periodNumber ?? timetable.periodNumber,
    startTime: input.startTime ?? timetable.startTime,
    endTime: input.endTime ?? timetable.endTime,
    roomNumber: input.roomNumber ?? timetable.roomNumber,
    roomId: input.roomId ?? timetable.roomId?.toString(),
    periodId: input.periodId ?? timetable.periodId?.toString(),
    combinedGroupId: input.combinedGroupId ?? timetable.combinedGroupId,
    entryType: input.entryType ?? timetable.entryType,
    isBreak: input.isBreak ?? timetable.isBreak,
    breakName: input.breakName ?? timetable.breakName,
  } as CreateTimetableInput;

  validateId(updatedData.sessionId, "session ID");
  validateId(updatedData.classId, "class ID");
  validateId(updatedData.sectionId, "section ID");
  const session = await Session.findOne({ _id: updatedData.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Academic session is closed or unavailable", 409);

  validateTime(updatedData.startTime, updatedData.endTime);
  if(updatedData.isBreak){updatedData.subjectId=undefined;updatedData.teacherId=undefined;updatedData.roomId=undefined;updatedData.roomNumber=undefined;}
  ensureTeachingFields(updatedData);
  await validateEntry(schoolId, updatedData.sessionId, updatedData, String(input.updatedBy || timetable.createdBy));
  await validateNoConflicts(schoolId, updatedData.sessionId, [updatedData], undefined, new Types.ObjectId(timetableId));

  await Promise.all([
    checkTeacherConflict(schoolId, updatedData, timetableId),
    checkClassTimeConflict(schoolId, updatedData, timetableId),
  ]);

  const allowedFields = [
    "sessionId",
    "classId",
    "sectionId",
    "subjectId",
    "teacherId",
    "dayOfWeek",
    "periodNumber",
    "startTime",
    "endTime",
    "roomNumber",
    "roomId",
    "periodId",
    "combinedGroupId",
    "entryType",
    "isBreak",
    "breakName",
  ] as const;

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      (timetable as any)[field] = input[field];
    }
  }

  if (updatedData.isBreak) {
    timetable.subjectId = undefined as any;
    timetable.teacherId = undefined as any;
  }

  if (input.updatedBy) {
    timetable.updatedBy = new Types.ObjectId(input.updatedBy);
  }

  await timetable.save();

  return timetable;
};

/**
 * Delete timetable (soft delete)
 */
export const deleteTimetableService = async (
  schoolId: string,
  timetableId: string
) => {
  ensureSchoolId(schoolId);
  validateId(timetableId, "timetable ID");

  const existing = await Timetable.findOne({ _id: timetableId, schoolId, isActive: true }).select("sessionId classId sectionId versionId");
  if (!existing) throw new AppError("Timetable not found", 404);
  if(existing.versionId||await TimetableVersion.exists({schoolId,sessionId:existing.sessionId,classId:existing.classId,sectionId:existing.sectionId,status:"PUBLISHED"}))throw new AppError("Published timetable entries cannot be removed individually. Archive or replace the timetable version.",409);
  const session = await Session.findOne({ _id: existing.sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id");
  if (!session) throw new AppError("Timetable records in a closed session cannot be changed", 409);

  const timetable = await Timetable.findOneAndUpdate(
    {
      _id: timetableId,
      schoolId,
      isActive: true,
    },
    {
      $set: { isActive: false },
    },
    { new: true }
  );

  if (!timetable) {
    throw new AppError("Timetable not found", 404);
  }

  return timetable;
};

/**
 * Get class timetable
 */
export const getClassTimetableService = async (
  schoolId: string,
  classId: string,
  sectionId?: string,
  sessionId?: string,
  date?: string
) => {
  ensureSchoolId(schoolId);
  validateId(classId, "class ID");

  const query: Record<string, unknown> = {
    schoolId,
    classId,
    isActive: true,
  };

  if (sectionId) {
    validateId(sectionId, "section ID");
    query.sectionId = sectionId;
  }

  if (sessionId) {
    validateId(sessionId, "session ID");
    query.sessionId = sessionId;
  }

  const items = await Timetable.find(query)
    .populate("subjectId", "name code")
    .populate("teacherId", "firstName lastName fullName employeeId")
    .populate("sectionId", "name")
    .populate("sessionId", "name")
    .populate("classId", "name code")
    .populate("roomId", "name roomNumber roomType")
    .populate("periodId", "name periodNumber startTime endTime type")
    .sort({ dayOfWeek: 1, periodNumber: 1 })
    .lean();
  return addSubstituteTeachers(schoolId, items, date);
};

/**
 * Get teacher timetable
 */
export const getTeacherTimetableService = async (
  schoolId: string,
  teacherId: string,
  dayOfWeek?: string
) => {
  ensureSchoolId(schoolId);
  validateId(teacherId, "teacher ID");

  const query: Record<string, unknown> = {
    schoolId,
    teacherId,
    isActive: true,
    isBreak: false,
  };

  if (dayOfWeek) {
    query.dayOfWeek = dayOfWeek;
  }

  return Timetable.find(query)
    .populate("classId", "name")
    .populate("sectionId", "name")
    .populate("subjectId", "name code")
    .populate("sessionId", "name")
    .sort({ dayOfWeek: 1, periodNumber: 1 })
    .lean();
};


export const getSubjectTimetableService = async (schoolId:string, subjectId:string, sessionId?:string) => {
  ensureSchoolId(schoolId); validateId(subjectId,"subject ID");
  const query:Record<string,unknown>={schoolId,subjectId,isActive:true,isBreak:false};
  if(sessionId){validateId(sessionId,"session ID");query.sessionId=sessionId;}
  return Timetable.find(query).populate("classId","name code").populate("sectionId","name code").populate("teacherId","firstName lastName fullName employeeId").populate("subjectId","name code").populate("sessionId","name").populate("roomId","name roomNumber").sort({dayOfWeek:1,periodNumber:1}).lean();
};

export const getSubstituteTeacherTimetableEntries = async (schoolId:string,sessionId:string,teacherId:string,date:string) => {
  const selectedDate=new Date(`${date}T12:00:00.000Z`);if(Number.isNaN(selectedDate.getTime()))throw new AppError("Invalid timetable date",400);
  const dayOfWeek=["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][selectedDate.getUTCDay()];
  const start=new Date(selectedDate);start.setHours(0,0,0,0);const end=new Date(selectedDate);end.setHours(23,59,59,999);
  const assignments=await SubstituteAssignment.find({schoolId,sessionId,substituteTeacherId:teacherId,date:{$gte:start,$lte:end},status:"ACTIVE"}).lean();
  const substituteTeacher=await Employee.findOne({_id:teacherId,schoolId,isActive:true,isDeleted:false}).select("firstName lastName fullName employeeId").lean();
  const results=[];
  for(const assignment of assignments){
    if(!assignment.period)continue;
    const entry=await Timetable.findOne({schoolId,sessionId,classId:assignment.classId,sectionId:assignment.sectionId,teacherId:assignment.regularTeacherId,dayOfWeek,periodNumber:assignment.period,isActive:true,isBreak:false})
      .populate("classId","name code").populate("sectionId","name code").populate("subjectId","name code").populate("teacherId","firstName lastName fullName employeeId").populate("roomId","name roomNumber").populate("sessionId","name").lean();
    if(entry)results.push({...entry,isSubstitute:true,originalTeacher:entry.teacherId,substituteTeacher,substituteAssignmentId:assignment._id,teacherId:substituteTeacher});
  }
  return results;
};
