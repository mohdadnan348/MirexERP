
import mongoose, { FilterQuery, Types } from "mongoose";

import Subject, { ISubjectDocument } from "./subjects.model";
import ClassSubjectMapping from "./class-subject-mapping.model";
import Class from "../classes/classes.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import SubjectSyllabus from "./subject-syllabus.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import { AppError } from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateSubjectInput,
  UpdateSubjectInput,
  SubjectListQuery,
  UpdateSubjectStatusInput,
  UpdateSubjectTypeInput,
} from "./subjects.validation";

interface SubjectActor {
  userId: string;
  schoolId: string;
}

const validateObjectId = (
  id: string,
  field = "ID"
): void => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
};

const normalizeCode = (code: string): string =>
  code.trim().toUpperCase();

const findSubjectOrFail = async (
  subjectId: string,
  schoolId: string
): Promise<ISubjectDocument> => {
  validateObjectId(subjectId, "subject ID");

  const subject = await Subject.findOne({
    _id: subjectId,
    schoolId,
    isDeleted: false,
  });

  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  return subject;
};

const checkDuplicateSubject = async (
  schoolId: string,
  name: string,
  code: string,
  excludeId?: string
): Promise<void> => {
  const filter: FilterQuery<ISubjectDocument> = {
    schoolId,
    isDeleted: false,
    $or: [
      { name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      { code: new RegExp(`^${normalizeCode(code).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    ],
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await Subject.findOne(filter).lean();

  if (!existing) return;

  if (existing.code?.trim().toUpperCase() === normalizeCode(code)) {
    throw new AppError(
      "Subject code already exists in this school",
      409
    );
  }

  throw new AppError(
    "Subject name already exists in this school",
    409
  );
};

// Create subject
export const createSubjectService = async (
  data: CreateSubjectInput,
  actor: SubjectActor
): Promise<ISubjectDocument> => {
  const code = normalizeCode(data.code);

  await checkDuplicateSubject(
    actor.schoolId,
    data.name,
    code
  );

  try {
    const subject = await Subject.create({
      schoolId: actor.schoolId,
      name: data.name.trim(),
      code,
      displayName: data.displayName?.trim(),
      subjectType: data.subjectType,
      category: data.category,
      remarks: data.remarks,
      icon: data.icon,
      color: data.color,
      description: data.description?.trim(),
      isOptional: data.isOptional,
      isActive: data.isActive,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    return subject;
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
        "Subject name or code already exists in this school",
        409
      );
    }

    throw error;
  }
};

// Get all subjects
export const getAllSubjectsService = async (
  query: SubjectListQuery,
  schoolId: string
) => {
  const { page, limit, skip } = getPagination({
    page: query.page,
    limit: query.limit,
  });

  const filter: FilterQuery<ISubjectDocument> = {
    schoolId,
    isDeleted: false,
  };

  if (query.subjectType) filter.subjectType = query.subjectType;
  if (query.category) filter.category = query.category;
  if (query.sessionId || query.classId) {
    const mappingFilter: Record<string, unknown> = { schoolId };
    if (query.sessionId) mappingFilter.sessionId = query.sessionId;
    if (query.classId) mappingFilter.classId = query.classId;
    const [mapped, legacyClasses] = await Promise.all([
      ClassSubjectMapping.find(mappingFilter).distinct("subjectId"),
      Class.find({ schoolId, ...(query.sessionId ? { sessionId: query.sessionId } : {}), ...(query.classId ? { _id: query.classId } : {}), isDeleted: false }).distinct("subjects"),
    ]);
    const subjectIds = [...new Set([...mapped.map((id) => id.toString()), ...legacyClasses.map((id) => id.toString())])];
    filter._id = { $in: subjectIds };
  }

  if (typeof query.isOptional === "boolean") {
    filter.isOptional = query.isOptional;
  }

  if (typeof query.isActive === "boolean") {
    filter.isActive = query.isActive;
  }

  if (query.search) {
    const escapedSearch = query.search.trim().replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(escapedSearch, "i");

    filter.$or = [
      { name: regex },
      { code: regex },
      { displayName: regex },
      { description: regex },
    ];
  }

  const sortBy = query.sortBy || "name";
  const sortOrder = query.sortOrder === "desc" ? -1 : 1;

  const [subjects, total] = await Promise.all([
    Subject.find(filter)
      .sort({ [sortBy]: sortOrder, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Subject.countDocuments(filter),
  ]);

  const subjectIds = subjects.map((item) => item._id);
  const [mappingCounts, teacherCounts, syllabusCounts] = await Promise.all([
    ClassSubjectMapping.aggregate([
      { $match: { schoolId: new Types.ObjectId(schoolId), subjectId: { $in: subjectIds }, isActive: true } },
      { $group: { _id: "$subjectId", classes: { $addToSet: "$classId" } } },
      { $project: { count: { $size: "$classes" } } },
    ]),
    SubjectTeacherAssignment.aggregate([
      { $match: { schoolId: new Types.ObjectId(schoolId), subjectId: { $in: subjectIds }, isActive: true } },
      { $group: { _id: "$subjectId", teachers: { $addToSet: "$teacherId" } } },
      { $project: { count: { $size: "$teachers" } } },
    ]),
    SubjectSyllabus.aggregate([
      { $match: { schoolId: new Types.ObjectId(schoolId), subjectId: { $in: subjectIds }, isDeleted: false } },
      { $group: { _id: "$subjectId", count: { $sum: 1 } } },
    ]),
  ]);
  const toCountMap = (items: Array<{ _id: Types.ObjectId; count: number }>) => new Map(items.map((item) => [item._id.toString(), item.count]));
  const mappingMap = toCountMap(mappingCounts); const teacherMap = toCountMap(teacherCounts); const syllabusMap = toCountMap(syllabusCounts);
  const enrichedSubjects = subjects.map((item) => ({
    ...item,
    mappedClasses: mappingMap.get(item._id.toString()) || 0,
    assignedTeachers: teacherMap.get(item._id.toString()) || 0,
    syllabusStatus: (syllabusMap.get(item._id.toString()) || 0) > 0 ? "AVAILABLE" : "NOT_UPLOADED",
  }));

  return {
    subjects: enrichedSubjects,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// Get subject by ID
export const getSubjectByIdService = async (
  subjectId: string,
  schoolId: string
): Promise<ISubjectDocument> => {
  const subject = await findSubjectOrFail(
    subjectId,
    schoolId
  );

  return subject;
};

// Update subject
export const updateSubjectService = async (
  subjectId: string,
  data: UpdateSubjectInput,
  actor: SubjectActor
): Promise<ISubjectDocument> => {
  const subject = await findSubjectOrFail(
    subjectId,
    actor.schoolId
  );

  const updatedName = data.name?.trim() ?? subject.name;

  const updatedCode = data.code
    ? normalizeCode(data.code)
    : subject.code;

  await checkDuplicateSubject(
    actor.schoolId,
    updatedName,
    updatedCode,
    subjectId
  );

  if (data.name !== undefined) {
    subject.name = updatedName;
  }

  if (data.code !== undefined) {
    subject.code = updatedCode;
  }

  if (data.displayName !== undefined) {
    subject.displayName = data.displayName?.trim();
  }

  if (data.subjectType !== undefined) subject.subjectType = data.subjectType;
  if (data.category !== undefined) subject.category = data.category;
  if (data.remarks !== undefined) subject.remarks = data.remarks ?? undefined;
  if (data.icon !== undefined) subject.icon = data.icon ?? undefined;
  if (data.color !== undefined) subject.color = data.color ?? undefined;

  if (data.description !== undefined) {
    subject.description = data.description?.trim();
  }

  if (data.isOptional !== undefined) {
    subject.isOptional = data.isOptional;
  }

  if (data.isActive !== undefined) {
    subject.isActive = data.isActive;
  }

  subject.updatedBy = new Types.ObjectId(actor.userId);

  await subject.save();

  return subject;
};

// Update subject status
export const updateSubjectStatusService = async (
  subjectId: string,
  data: UpdateSubjectStatusInput,
  actor: SubjectActor
): Promise<ISubjectDocument> => {
  const subject = await findSubjectOrFail(
    subjectId,
    actor.schoolId
  );

  if (!data.isActive) {
    const [activeMappings, activeAssignments] = await Promise.all([
      ClassSubjectMapping.countDocuments({ schoolId: actor.schoolId, subjectId, isActive: true }),
      SubjectTeacherAssignment.countDocuments({ schoolId: actor.schoolId, subjectId, isActive: true }),
    ]);
    if (activeMappings || activeAssignments) {
      throw new AppError(`Subject is still in use by ${activeMappings} class mapping(s) and ${activeAssignments} teacher assignment(s). Remove or reassign these before deactivation.`, 409);
    }
  }
  subject.isActive = data.isActive;
  subject.updatedBy = new Types.ObjectId(actor.userId);

  await subject.save();

  return subject;
};

// Update subject type
export const updateSubjectTypeService = async (
  subjectId: string,
  data: UpdateSubjectTypeInput,
  actor: SubjectActor
): Promise<ISubjectDocument> => {
  const subject = await findSubjectOrFail(
    subjectId,
    actor.schoolId
  );

  subject.subjectType = data.subjectType;
  subject.updatedBy = new Types.ObjectId(actor.userId);

  await subject.save();

  return subject;
};

// Soft delete subject
export const deleteSubjectService = async (
  subjectId: string,
  actor: SubjectActor
): Promise<{ id: string; deleted: boolean }> => {
  const subject = await findSubjectOrFail(
    subjectId,
    actor.schoolId
  );

  const [activeMappings, activeAssignments] = await Promise.all([
    ClassSubjectMapping.countDocuments({ schoolId: actor.schoolId, subjectId, isActive: true }),
    SubjectTeacherAssignment.countDocuments({ schoolId: actor.schoolId, subjectId, isActive: true }),
  ]);
  if (activeMappings || activeAssignments) throw new AppError("Subject is still mapped or assigned. Remove active dependencies before archiving it.", 409);

  subject.isDeleted = true;
  subject.deletedAt = new Date();
  subject.isActive = false;
  subject.updatedBy = new Types.ObjectId(actor.userId);

  await subject.save();

  return {
    id: subject._id.toString(),
    deleted: true,
  };
};

// Subject statistics
export const getSubjectSummaryService = async (
  schoolId: string
) => {
  const filter: FilterQuery<ISubjectDocument> = {
    schoolId,
    isDeleted: false,
  };

  const [
    total,
    active,
    inactive,
    optional,
    compulsory,
  ] = await Promise.all([
    Subject.countDocuments(filter),

    Subject.countDocuments({
      ...filter,
      isActive: true,
    }),

    Subject.countDocuments({
      ...filter,
      isActive: false,
    }),

    Subject.countDocuments({
      ...filter,
      isOptional: true,
    }),

    Subject.countDocuments({
      ...filter,
      isOptional: false,
    }),
  ]);

  const typeCounts = await Subject.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$subjectType",
        count: { $sum: 1 },
      },
    },
  ]);

  const byType: Record<string, number> = {};

  for (const item of typeCounts) {
    byType[item._id] = item.count;
  }

  return {
    total,
    active,
    inactive,
    optional,
    compulsory,
    byType,
  };
};
