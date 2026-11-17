
import mongoose, { FilterQuery, Types } from "mongoose";

import Section, { ISectionDocument } from "./sections.model";
import Class from "../classes/classes.model";
import Session from "../sessions/sessions.model";
import Employee from "../employees/employees.model";
import Student from "../students/students.model";
import ClassSectionHistory from "../class-section/class-section-history.model";
import StudentEnrollment from "../class-section/student-enrollment.model";

import { AppError } from "../../utils/AppError";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateSectionInput,
  UpdateSectionInput,
  SectionListQuery,
  UpdateSectionStatusInput,
  AssignSectionTeacherInput,
} from "./sections.validation";

interface SectionActor {
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

const ensureTeachingEmployee = async (
  employeeId: string | null | undefined,
  schoolId: string
): Promise<void> => {
  if (!employeeId) return;
  const employee = await Employee.findOne({
    _id: employeeId, schoolId, isDeleted: false, status: "ACTIVE", employeeType: "TEACHING",
  }).select("_id").lean();
  if (!employee) throw new AppError("Assigned class teacher must be an active teaching employee of this school", 400);
};

const ensureSession = async (
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

const ensureClass = async (
  classId: string,
  sessionId: string,
  schoolId: string
): Promise<void> => {
  validateObjectId(classId, "class ID");

  const classRecord = await Class.findOne({
    _id: classId,
    schoolId,
    sessionId,
    isDeleted: false,
  }).lean();

  if (!classRecord) {
    throw new AppError(
      "Class not found in the selected academic session",
      404
    );
  }

  if (!classRecord.isActive) {
    throw new AppError(
      "Cannot create a section under an inactive class",
      400
    );
  }
};

const findSectionOrFail = async (
  sectionId: string,
  schoolId: string
): Promise<ISectionDocument> => {
  validateObjectId(sectionId, "section ID");

  const section = await Section.findOne({
    _id: sectionId,
    schoolId,
    isDeleted: false,
  });

  if (!section) {
    throw new AppError("Section not found", 404);
  }

  return section;
};

const checkDuplicateSection = async (
  schoolId: string,
  sessionId: string,
  classId: string,
  name: string,
  code: string,
  excludeId?: string
): Promise<void> => {
  const filter: FilterQuery<ISectionDocument> = {
    schoolId,
    sessionId,
    classId,
    isDeleted: false,
    $or: [
      { name: name.trim() },
      { code: normalizeCode(code) },
    ],
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await Section.findOne(filter).lean();

  if (!existing) return;

  if (existing.code === normalizeCode(code)) {
    throw new AppError(
      "Section code already exists in this class",
      409
    );
  }

  throw new AppError(
    "Section name already exists in this class",
    409
  );
};

export const createSectionService = async (
  data: CreateSectionInput,
  actor: SectionActor
): Promise<ISectionDocument> => {
  await ensureSession(data.sessionId, actor.schoolId);

  await ensureClass(
    data.classId,
    data.sessionId,
    actor.schoolId
  );
  await ensureTeachingEmployee(data.classTeacherId, actor.schoolId);

  const code = normalizeCode(data.code);

  await checkDuplicateSection(
    actor.schoolId,
    data.sessionId,
    data.classId,
    data.name,
    code
  );

  try {
    const section = await Section.create({
      schoolId: actor.schoolId,
      sessionId: data.sessionId,
      classId: data.classId,
      name: data.name.trim(),
      code,
      displayName: data.displayName?.trim(),
      roomNumber: data.roomNumber?.trim(),
      capacity: data.capacity ?? null,
      classTeacherId: data.classTeacherId ?? null,
      description: data.description?.trim(),
      isActive: data.isActive ?? true,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    return section;
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
        "Section name or code already exists in this class",
        409
      );
    }

    throw error;
  }
};

export const getAllSectionsService = async (
  query: SectionListQuery,
  schoolId: string
) => {
  const { page, limit, skip } = getPagination({
    page: query.page,
    limit: query.limit,
  });

  const filter: FilterQuery<ISectionDocument> = {
    schoolId,
    isDeleted: false,
  };

  if (query.sessionId) {
    filter.sessionId = query.sessionId;
  }

  if (query.classId) {
    filter.classId = query.classId;
  }

  if (query.classTeacherId) {
    filter.classTeacherId = query.classTeacherId;
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
      { roomNumber: regex },
    ];
  }

  const sortBy = query.sortBy || "name";
  const sortOrder = query.sortOrder === "desc" ? -1 : 1;

  const [sections, total] = await Promise.all([
    Section.find(filter)
      .populate("classId", "name code displayName numericLevel")
      .populate("classTeacherId", "firstName lastName employeeId fullName")
      .sort({ [sortBy]: sortOrder, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Section.countDocuments(filter),
  ]);
  const selectedSession = query.sessionId ? await Session.findOne({ _id: query.sessionId, schoolId, isDeleted: false }).select("isActive").lean() : null;
  const counts = selectedSession && !selectedSession.isActive
    ? await StudentEnrollment.aggregate([
      { $match: { schoolId: new Types.ObjectId(schoolId), sessionId: new Types.ObjectId(query.sessionId), sectionId: { $in: sections.map((item) => item._id) }, status: { $in: ["ACTIVE", "COMPLETED", "DETAINED"] } } },
      { $group: { _id: "$sectionId", enrolledStudents: { $sum: 1 } } },
    ])
    : await Student.aggregate([
      { $match: { schoolId: new Types.ObjectId(schoolId), ...(query.sessionId ? { sessionId: new Types.ObjectId(query.sessionId) } : {}), sectionId: { $in: sections.map((item) => item._id) }, status: "ACTIVE", isDeleted: { $ne: true } } },
      { $group: { _id: "$sectionId", enrolledStudents: { $sum: 1 } } },
    ]);
  const countMap = new Map(counts.map((item) => [String(item._id), item.enrolledStudents]));
  const enrichedSections = sections.map((section) => {
    const enrolledStudents = countMap.get(String(section._id)) || 0;
    return { ...section, enrolledStudents, availableSeats: section.capacity == null ? null : Math.max(0, section.capacity - enrolledStudents), capacityUtilization: section.capacity ? Math.round((enrolledStudents / section.capacity) * 100) : null, isFull: section.capacity != null && enrolledStudents >= section.capacity };
  });

  return {
    sections: enrichedSections,
    pagination: createPaginationMeta(page, limit, total),
  };
};

export const getSectionByIdService = async (
  sectionId: string,
  schoolId: string
): Promise<ISectionDocument> => {
  validateObjectId(sectionId, "section ID");

  const section = await Section.findOne({
    _id: sectionId,
    schoolId,
    isDeleted: false,
  })
    .populate("classId", "name code displayName numericLevel")
    .populate("classTeacherId", "firstName lastName employeeId");

  if (!section) {
    throw new AppError("Section not found", 404);
  }

  return section;
};

export const updateSectionService = async (
  sectionId: string,
  data: UpdateSectionInput,
  actor: SectionActor
): Promise<ISectionDocument> => {
  const section = await findSectionOrFail(
    sectionId,
    actor.schoolId
  );

  const updatedName = data.name?.trim() ?? section.name;
  const updatedCode = data.code
    ? normalizeCode(data.code)
    : section.code;

  await checkDuplicateSection(
    actor.schoolId,
    section.sessionId.toString(),
    section.classId.toString(),
    updatedName,
    updatedCode,
    sectionId
  );

  if (data.name !== undefined) {
    section.name = updatedName;
  }

  if (data.code !== undefined) {
    section.code = updatedCode;
  }

  if (data.displayName !== undefined) {
    section.displayName = data.displayName?.trim();
  }

  if (data.roomNumber !== undefined) {
    section.roomNumber = data.roomNumber?.trim();
  }

  if (data.capacity !== undefined) {
    section.capacity = data.capacity;
  }

  if (data.classTeacherId !== undefined) {
    await ensureTeachingEmployee(data.classTeacherId, actor.schoolId);
    section.classTeacherId = data.classTeacherId
      ? new Types.ObjectId(data.classTeacherId)
      : null;
  }

  if (data.description !== undefined) {
    section.description = data.description?.trim();
  }

  if (data.isActive !== undefined) {
    section.isActive = data.isActive;
  }

  section.updatedBy = new Types.ObjectId(actor.userId);

  await section.save();
  await ClassSectionHistory.create({
    schoolId: new Types.ObjectId(actor.schoolId), sessionId: section.sessionId,
    classId: section.classId, sectionId: section._id, event: "CLASS_TEACHER_ASSIGNED",
    next: { classTeacherId: section.classTeacherId }, actorId: new Types.ObjectId(actor.userId),
  });

  return section;
};

export const updateSectionStatusService = async (
  sectionId: string,
  data: UpdateSectionStatusInput,
  actor: SectionActor
): Promise<ISectionDocument> => {
  const section = await findSectionOrFail(
    sectionId,
    actor.schoolId
  );

  section.isActive = data.isActive;
  section.updatedBy = new Types.ObjectId(actor.userId);

  await section.save();

  return section;
};

export const assignSectionTeacherService = async (
  sectionId: string,
  data: AssignSectionTeacherInput,
  actor: SectionActor
): Promise<ISectionDocument> => {
  const section = await findSectionOrFail(
    sectionId,
    actor.schoolId
  );

  await ensureTeachingEmployee(data.classTeacherId, actor.schoolId);
  const previousClassTeacherId = section.classTeacherId;
  section.classTeacherId = data.classTeacherId
    ? new Types.ObjectId(data.classTeacherId)
    : null;

  section.updatedBy = new Types.ObjectId(actor.userId);

  await section.save();
  await ClassSectionHistory.create({
    schoolId: new Types.ObjectId(actor.schoolId), sessionId: section.sessionId,
    classId: section.classId, sectionId: section._id, event: "CLASS_TEACHER_ASSIGNED",
    previous: { classTeacherId: previousClassTeacherId || null },
    next: { classTeacherId: section.classTeacherId }, actorId: new Types.ObjectId(actor.userId),
  });

  return section;
};

export const deleteSectionService = async (
  sectionId: string,
  actor: SectionActor
): Promise<{ id: string; deleted: boolean }> => {
  const section = await findSectionOrFail(
    sectionId,
    actor.schoolId
  );

  const activeStudents = await Student.countDocuments({ schoolId: actor.schoolId, sectionId: section._id, status: "ACTIVE", isDeleted: { $ne: true } });
  if (activeStudents > 0) throw new AppError("Section cannot be archived while active students are allocated. Transfer students first.", 409);

  section.isDeleted = true;
  section.deletedAt = new Date();
  section.isActive = false;
  section.updatedBy = new Types.ObjectId(actor.userId);

  await section.save();

  return {
    id: section._id.toString(),
    deleted: true,
  };
};

export const getSectionSummaryService = async (
  schoolId: string,
  sessionId?: string,
  classId?: string
) => {
  const filter: FilterQuery<ISectionDocument> = {
    schoolId,
    isDeleted: false,
  };

  if (sessionId) {
    validateObjectId(sessionId, "session ID");
    filter.sessionId = sessionId;
  }

  if (classId) {
    validateObjectId(classId, "class ID");
    filter.classId = classId;
  }

  const [total, active, inactive] = await Promise.all([
    Section.countDocuments(filter),
    Section.countDocuments({
      ...filter,
      isActive: true,
    }),
    Section.countDocuments({
      ...filter,
      isActive: false,
    }),
  ]);

  return {
    total,
    active,
    inactive,
  };
};
