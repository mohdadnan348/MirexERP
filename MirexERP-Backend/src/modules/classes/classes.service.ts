import mongoose, { FilterQuery, Types } from "mongoose";
import Class, { IClassDocumentModel } from "./classes.model";
import Session from "../sessions/sessions.model";
import Employee from "../employees/employees.model";
import Subject from "../subjects/subjects.model";
import Section from "../sections/sections.model";
import Student from "../students/students.model";
import StudentEnrollment from "../class-section/student-enrollment.model";
import ClassSubjectMapping from "../subjects/class-subject-mapping.model";
import { AppError } from "../../utils/AppError";
import {
  CreateClassInput,
  UpdateClassInput,
  ClassListQuery,
  UpdateClassStatusInput,
  AssignClassSubjectsInput,
} from "./classes.validation";
import { createPaginationMeta } from "../../utils/pagination";

interface ClassActor {
  userId: string;
  schoolId: string;
}

const validateObjectId = (id: string, field = "ID"): void => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const ensureActiveSession = async (
  sessionId: string,
  schoolId: string
): Promise<void> => {
  validateObjectId(sessionId, "session ID");

  const session = await Session.findOne({
    _id: sessionId,
    schoolId,
    isDeleted: false,
    isClosed: { $ne: true },
  }).lean();

  if (!session) {
    throw new AppError("Academic session not found or closed", 404);
  }
};

const findClassOrFail = async (
  classId: string,
  schoolId: string
): Promise<IClassDocumentModel> => {
  validateObjectId(classId, "class ID");

  const classRecord = await Class.findOne({
    _id: classId,
    schoolId,
    isDeleted: false,
  });

  if (!classRecord) {
    throw new AppError("Class not found", 404);
  }

  return classRecord;
};

const normalizeCode = (code: string): string =>
  code.trim().toUpperCase();

const validateClassAssignments = async (
  schoolId: string,
  classTeacherId?: string | null,
  subjectIds?: string[]
): Promise<void> => {
  if (classTeacherId) {
    const teacher = await Employee.findOne({
      _id: classTeacherId, schoolId, isDeleted: false, status: "ACTIVE", employeeType: "TEACHING",
    }).select("_id").lean();
    if (!teacher) throw new AppError("Assigned class teacher must be an active teaching employee of this school", 400);
  }
  if (subjectIds?.length) {
    const uniqueIds = [...new Set(subjectIds)];
    const subjects = await Subject.find({ _id: { $in: uniqueIds }, schoolId, isDeleted: false }).select("_id").lean();
    if (subjects.length !== uniqueIds.length) throw new AppError("One or more assigned subjects do not belong to this school", 400);
  }
};

const checkDuplicateClass = async (
  schoolId: string,
  sessionId: string,
  code: string,
  name: string,
  excludeId?: string
): Promise<void> => {
  const filter: FilterQuery<IClassDocumentModel> = {
    schoolId,
    sessionId,
    isDeleted: false,
    $or: [
      { code: normalizeCode(code) },
      { name: name.trim() },
    ],
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existingClass = await Class.findOne(filter).lean();

  if (existingClass) {
    if (existingClass.code === normalizeCode(code)) {
      throw new AppError(
        "A class with this code already exists in this session",
        409
      );
    }

    throw new AppError(
      "A class with this name already exists in this session",
      409
    );
  }
};

export const createClassService = async (
  data: CreateClassInput,
  actor: ClassActor
): Promise<IClassDocumentModel> => {
  await ensureActiveSession(data.sessionId, actor.schoolId);
  await validateClassAssignments(actor.schoolId, data.classTeacherId, data.subjects);

  const code = normalizeCode(data.code);

  await checkDuplicateClass(
    actor.schoolId,
    data.sessionId,
    code,
    data.name
  );

  try {
    const classRecord = await Class.create({
      schoolId: actor.schoolId,
      sessionId: data.sessionId,
      name: data.name.trim(),
      code,
      displayName: data.displayName?.trim(),
      numericLevel: data.numericLevel,
      description: data.description?.trim(),
      classTeacherId: data.classTeacherId ?? null,
      capacity: data.capacity ?? null,
      stream: data.stream?.trim(),
      subjects: data.subjects ?? [],
      isActive: data.isActive ?? true,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    return classRecord;
  } catch (error) {
    if (
      error instanceof mongoose.Error &&
      error.name === "ValidationError"
    ) {
      throw new AppError(error.message, 400);
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        "Class code or name already exists in this session",
        409
      );
    }

    throw error;
  }
};

export const getAllClassesService = async (
  query: ClassListQuery,
  schoolId: string
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter: FilterQuery<IClassDocumentModel> = {
    schoolId,
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = query.sessionId;
  }

  if (query.classTeacherId) {
    filter.classTeacherId = query.classTeacherId;
  }

  if (typeof query.isActive === "boolean") {
    filter.isActive = query.isActive;
  }

  if (query.stream) {
    filter.stream = query.stream;
  }

  if (query.search) {
    const search = query.search.trim();
    const regex = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    filter.$or = [
      { name: regex },
      { code: regex },
      { displayName: regex },
      { stream: regex },
    ];
  }

  const allowedSortFields = [
    "name",
    "code",
    "numericLevel",
    "createdAt",
  ] as const;

  const sortBy = allowedSortFields.includes(
    query.sortBy as (typeof allowedSortFields)[number]
  )
    ? query.sortBy
    : "numericLevel";

  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const [classes, total] = await Promise.all([
    Class.find(filter)
      .populate("sessionId", "name startDate endDate")
      .populate("classTeacherId", "firstName lastName employeeId fullName")
      .populate("subjects", "name code")
      .sort({ [sortBy]: sortOrder, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Class.countDocuments(filter),
  ]);
  const classIds = classes.map((item) => item._id);
  const selectedSession = query.sessionId ? await Session.findOne({ _id: query.sessionId, schoolId, isDeleted: false }).select("isActive").lean() : null;
  const [sectionCounts, studentCounts] = await Promise.all([
    Section.aggregate([{ $match: { schoolId: new Types.ObjectId(schoolId), classId: { $in: classIds }, isDeleted: false } }, { $group: { _id: "$classId", count: { $sum: 1 } } }]),
    selectedSession && !selectedSession.isActive
      ? StudentEnrollment.aggregate([{ $match: { schoolId: new Types.ObjectId(schoolId), sessionId: new Types.ObjectId(query.sessionId), classId: { $in: classIds }, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] } } }, { $group: { _id: "$classId", count: { $sum: 1 } } }])
      : Student.aggregate([{ $match: { schoolId: new Types.ObjectId(schoolId), ...(query.sessionId ? { sessionId: new Types.ObjectId(query.sessionId) } : {}), classId: { $in: classIds }, status: "ACTIVE", isDeleted: { $ne: true } } }, { $group: { _id: "$classId", count: { $sum: 1 } } }]),
  ]);
  const sectionMap = new Map(sectionCounts.map((x) => [String(x._id), x.count]));
  const studentMap = new Map(studentCounts.map((x) => [String(x._id), x.count]));
  const enrichedClasses = classes.map((item) => ({ ...item, totalSections: sectionMap.get(String(item._id)) || 0, totalStudents: studentMap.get(String(item._id)) || 0 }));

  return {
    classes: enrichedClasses,
    pagination: createPaginationMeta(page, limit, total),
  };
};

export const getClassByIdService = async (
  classId: string,
  schoolId: string
): Promise<IClassDocumentModel> => {
  validateObjectId(classId, "class ID");

  const classRecord = await Class.findOne({
    _id: classId,
    schoolId,
    isDeleted: false,
  })
    .populate("classTeacherId", "firstName lastName employeeId")
    .populate("subjects", "name code");

  if (!classRecord) {
    throw new AppError("Class not found", 404);
  }

  return classRecord;
};

export const updateClassService = async (
  classId: string,
  data: UpdateClassInput,
  actor: ClassActor
): Promise<IClassDocumentModel> => {
  const classRecord = await findClassOrFail(
    classId,
    actor.schoolId
  );

  const updatedName = data.name?.trim() ?? classRecord.name;
  const updatedCode = data.code
    ? normalizeCode(data.code)
    : classRecord.code;

  await checkDuplicateClass(
    actor.schoolId,
    classRecord.sessionId.toString(),
    updatedCode,
    updatedName,
    classId
  );

  if (data.name !== undefined) {
    classRecord.name = updatedName;
  }

  if (data.code !== undefined) {
    classRecord.code = updatedCode;
  }

  if (data.displayName !== undefined) {
    classRecord.displayName = data.displayName?.trim();
  }

  if (data.numericLevel !== undefined) {
    classRecord.numericLevel = data.numericLevel;
  }

  if (data.description !== undefined) {
    classRecord.description = data.description?.trim();
  }

  if (data.classTeacherId !== undefined || data.subjects !== undefined) {
    await validateClassAssignments(actor.schoolId, data.classTeacherId, data.subjects);
  }

  if (data.classTeacherId !== undefined) {
    classRecord.classTeacherId = data.classTeacherId
      ? new Types.ObjectId(data.classTeacherId)
      : undefined;
  }

  if (data.capacity !== undefined) {
    classRecord.capacity = data.capacity ?? undefined;
  }

  if (data.stream !== undefined) {
    classRecord.stream = data.stream?.trim();
  }

  if (data.subjects !== undefined) {
    classRecord.subjects = data.subjects.map(
      (id) => new Types.ObjectId(id)
    );
  }

  if (data.isActive !== undefined) {
    classRecord.isActive = data.isActive;
  }

  classRecord.updatedBy = new Types.ObjectId(actor.userId);

  await classRecord.save();

  return classRecord;
};

export const updateClassStatusService = async (
  classId: string,
  data: UpdateClassStatusInput,
  actor: ClassActor
): Promise<IClassDocumentModel> => {
  const classRecord = await findClassOrFail(
    classId,
    actor.schoolId
  );

  classRecord.isActive = data.isActive;
  classRecord.updatedBy = new Types.ObjectId(actor.userId);

  await classRecord.save();

  return classRecord;
};

export const assignClassSubjectsService = async (
  classId: string,
  data: AssignClassSubjectsInput,
  actor: ClassActor
): Promise<IClassDocumentModel> => {
  const classRecord = await findClassOrFail(
    classId,
    actor.schoolId
  );

  const uniqueSubjectIds = [...new Set(data.subjects)];
  await validateClassAssignments(actor.schoolId, undefined, uniqueSubjectIds);

  const session = await Session.findOne({ _id: classRecord.sessionId, schoolId: actor.schoolId, isDeleted: false, isClosed: false }).lean();
  if (!session) throw new AppError("Cannot change subjects for a closed or unavailable academic session", 409);

  const selectedSubjects = await Subject.find({ _id: { $in: uniqueSubjectIds }, schoolId: actor.schoolId, isDeleted: false, isActive: true }).lean();
  if (selectedSubjects.length !== uniqueSubjectIds.length) throw new AppError("Inactive or unavailable subjects cannot be newly mapped", 400);

  classRecord.subjects = uniqueSubjectIds.map((id) => new Types.ObjectId(id));
  classRecord.updatedBy = new Types.ObjectId(actor.userId);
  await classRecord.save();

  const selectedSet = new Set(uniqueSubjectIds);
  await ClassSubjectMapping.updateMany(
    { schoolId: actor.schoolId, sessionId: classRecord.sessionId, classId: classRecord._id, isActive: true, subjectId: { $nin: classRecord.subjects } },
    { $set: { isActive: false, updatedBy: new Types.ObjectId(actor.userId) } }
  );
  for (const subject of selectedSubjects) {
    const requirement = subject.category === "ELECTIVE" ? "ELECTIVE" : subject.category === "ACTIVITY" ? "ACTIVITY" : "COMPULSORY";
    await ClassSubjectMapping.updateOne(
      { schoolId: actor.schoolId, sessionId: classRecord.sessionId, classId: classRecord._id, subjectId: subject._id },
      { $set: { requirement, isActive: true, updatedBy: new Types.ObjectId(actor.userId) }, $setOnInsert: { createdBy: new Types.ObjectId(actor.userId), effectiveFrom: new Date() } },
      { upsert: true, runValidators: true }
    );
  }

  return classRecord;
};

export const deleteClassService = async (
  classId: string,
  actor: ClassActor
): Promise<{ id: string; deleted: boolean }> => {
  const classRecord = await findClassOrFail(
    classId,
    actor.schoolId
  );

  const [activeStudents, activeSections] = await Promise.all([
    Student.countDocuments({ schoolId: actor.schoolId, classId: classRecord._id, status: "ACTIVE", isDeleted: { $ne: true } }),
    Section.countDocuments({ schoolId: actor.schoolId, classId: classRecord._id, isDeleted: false }),
  ]);
  if (activeStudents > 0 || activeSections > 0) {
    throw new AppError("Class cannot be archived while it has active students or active sections. Reassign/archive dependent records first.", 409);
  }

  classRecord.isDeleted = true;
  classRecord.deletedAt = new Date();
  classRecord.isActive = false;
  classRecord.updatedBy = new Types.ObjectId(actor.userId);

  await classRecord.save();

  return {
    id: classRecord._id.toString(),
    deleted: true,
  };
};

export const getClassSummaryService = async (
  schoolId: string,
  sessionId?: string
) => {
  const filter: FilterQuery<IClassDocumentModel> = {
    schoolId,
    isDeleted: false,
  };

  if (sessionId) {
    validateObjectId(sessionId, "session ID");
    filter.sessionId = sessionId;
  }

  const [total, active, inactive] = await Promise.all([
    Class.countDocuments(filter),
    Class.countDocuments({ ...filter, isActive: true }),
    Class.countDocuments({ ...filter, isActive: false }),
  ]);

  return {
    total,
    active,
    inactive,
  };
};
