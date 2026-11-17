
import { Types, FilterQuery, startSession } from "mongoose";

import Student, {
  IStudent,
  StudentStatus,
} from "./students.model";

import { AppError } from "../../utils/AppError";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import { Parent } from "../parents/parents.model";
import Employee from "../employees/employees.model";
import StudentRecord from "./student-records.model";

interface StudentActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface StudentQuery {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  classId?: unknown;
  sectionId?: unknown;
  sessionId?: unknown;
  gender?: unknown;
  [key: string]: unknown;
}

const getActorIds = (actor: StudentActor) => {
  if (
    !Types.ObjectId.isValid(actor.userId) ||
    !Types.ObjectId.isValid(actor.schoolId)
  ) {
    throw new AppError("Invalid user or school ID", 400);
  }

  return {
    userId: new Types.ObjectId(actor.userId),
    schoolId: new Types.ObjectId(actor.schoolId),
  };
};

const validateObjectId = (
  value: unknown,
  fieldName: string
): Types.ObjectId => {
  if (
    typeof value !== "string" ||
    !Types.ObjectId.isValid(value)
  ) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPaginationOptions = (query: StudentQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit) || 10)
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getTeacherStudentScope = async (actor: StudentActor): Promise<FilterQuery<IStudent>> => {
  const employee = await Employee.findOne({
    schoolId: actor.schoolId,
    userId: actor.userId,
    status: "ACTIVE",
    isDeleted: false,
    employeeType: "TEACHING",
  }).select("_id").lean();
  if (!employee) throw new AppError("Teacher employee profile is not linked to this account", 403);

  const [assignedClasses, assignedSections] = await Promise.all([
    Class.find({ schoolId: actor.schoolId, classTeacherId: employee._id, isDeleted: false, isActive: true }).select("_id").lean(),
    Section.find({ schoolId: actor.schoolId, classTeacherId: employee._id, isDeleted: false, isActive: true }).select("_id").lean(),
  ]);
  const classIds = assignedClasses.map((item) => item._id);
  const sectionIds = assignedSections.map((item) => item._id);
  if (!classIds.length && !sectionIds.length) return { _id: { $in: [] } };
  return { $or: [
    ...(classIds.length ? [{ classId: { $in: classIds } }] : []),
    ...(sectionIds.length ? [{ sectionId: { $in: sectionIds } }] : []),
  ] };
};

const validateStudentReferences = async (
  data: Record<string, unknown>,
  schoolId: Types.ObjectId
): Promise<void> => {
  const sessionId = validateObjectId(data.sessionId, "session ID");
  const classId = validateObjectId(data.classId, "class ID");
  const sectionId = validateObjectId(data.sectionId, "section ID");

  const [session, classRecord, section] = await Promise.all([
    Session.findOne({ _id: sessionId, schoolId, isDeleted: false, isClosed: { $ne: true } }).select("_id").lean(),
    Class.findOne({ _id: classId, schoolId, sessionId, isDeleted: false }).select("_id").lean(),
    Section.findOne({ _id: sectionId, schoolId, sessionId, classId, isDeleted: false }).select("_id").lean(),
  ]);
  if (!session) throw new AppError("Academic session does not belong to this school", 400);
  if (!classRecord) throw new AppError("Class does not belong to the selected school and session", 400);
  if (!section) throw new AppError("Section does not belong to the selected class and session", 400);

  if (data.parentId) {
    const parentId = validateObjectId(data.parentId, "parent ID");
    const parent = await Parent.findOne({ _id: parentId, schoolId, isActive: true }).select("_id").lean();
    if (!parent) throw new AppError("Parent does not belong to this school", 400);
  }
};

// CREATE STUDENT
export const createStudentService = async (
  data: Record<string, unknown>,
  actor: StudentActor
) => {
  const { userId, schoolId } = getActorIds(actor);
  await validateStudentReferences(data, schoolId);

  const admissionNumber = String(
    data.admissionNumber || ""
  ).trim().toUpperCase();

  if (!admissionNumber) {
    throw new AppError("Admission number is required", 400);
  }

  const existingStudent = await Student.findOne({
    schoolId,
    admissionNumber,
  });

  if (existingStudent) {
    throw new AppError(
      "Admission number already exists in this school",
      409
    );
  }

  const sessionId = validateObjectId(
    data.sessionId,
    "session ID"
  );

  const classId = validateObjectId(
    data.classId,
    "class ID"
  );

  const sectionId = validateObjectId(
    data.sectionId,
    "section ID"
  );

  const studentData = {
    ...data,
    schoolId,
    sessionId,
    classId,
    sectionId,
    admissionNumber,
    createdBy: userId,
    status: StudentStatus.ACTIVE,
    isActive: true,
  };

  // Never trust schoolId or createdBy supplied by the client.
  delete (studentData as Record<string, unknown>).updatedBy;

  const mongoSession = await startSession();
  try {
    let createdStudent: IStudent | null = null;
    await mongoSession.withTransaction(async () => {
      const [student] = await Student.create([studentData], { session: mongoSession });
      if (student.parentId) {
        await Parent.updateOne(
          { _id: student.parentId, schoolId },
          { $addToSet: { studentIds: student._id } },
          { session: mongoSession }
        );
      }
      await StudentRecord.create([{
        schoolId, sessionId, studentId: student._id, recordType: "STATUS",
        title: "Student registered", details: { previousStatus: null, newStatus: StudentStatus.ACTIVE, reason: "Initial student creation", changedBy: userId, changedAt: new Date() },
        uploadedBy: userId,
      }], { session: mongoSession });
      createdStudent = student;
    });
    if (!createdStudent) throw new AppError("Student creation did not complete", 500);
    return createdStudent;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new AppError("Student admission number or roll number already exists", 409);
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
};

// GET ALL STUDENTS
export const getStudentsService = async (
  actor: StudentActor,
  query: StudentQuery
) => {
  const { schoolId } = getActorIds(actor);
  const { page, limit, skip } = getPaginationOptions(query);

  const filter: FilterQuery<IStudent> = {
    schoolId,
    isDeleted: { $ne: true },
  };
  if (query.sessionId) {
    filter.sessionId = validateObjectId(query.sessionId, "session ID");
  } else {
    const activeSession = await Session.findOne({ schoolId, isActive: true, isDeleted: false }).select("_id").lean();
    filter.sessionId = activeSession?._id || { $in: [] };
  }
  if (actor.role === "TEACHER") {
    Object.assign(filter, await getTeacherStudentScope(actor));
  }

  if (query.status) {
    filter.status = String(query.status) as StudentStatus;
  }

  if (query.classId) {
    filter.classId = validateObjectId(
      query.classId,
      "class ID"
    );
  }

  if (query.sectionId) {
    filter.sectionId = validateObjectId(
      query.sectionId,
      "section ID"
    );
  }

  if (query.sessionId) {
    filter.sessionId = validateObjectId(
      query.sessionId,
      "session ID"
    );
  }

  if (query.gender) {
    filter.gender = String(query.gender) as IStudent["gender"];
  }

  if (query.search) {
    const search = escapeRegex(String(query.search).trim());

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
  }

  const studentListQuery = Student.find(filter).select("-medicalInformation")
    .populate("classId", "name")
    .populate("sectionId", "name")
    .sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN", "RECEPTIONIST"].includes(actor.role)) {
    studentListQuery.populate("parentId", "firstName lastName phone");
  } else {
    studentListQuery.select("-parentId -previousSchoolDetails");
  }
  const [items, total] = await Promise.all([studentListQuery.lean(), Student.countDocuments(filter)]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// GET STUDENT BY ID
export const getStudentByIdService = async (
  id: string,
  actor: StudentActor
) => {
  const { schoolId } = getActorIds(actor);

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid student ID", 400);
  }

  const scope = actor.role === "TEACHER" ? await getTeacherStudentScope(actor) : {};
  const studentQuery = Student.findOne({
    _id: id,
    schoolId,
    isDeleted: { $ne: true },
    ...scope,
  });
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(actor.role)) studentQuery.select("-medicalInformation");
  if (!["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN", "RECEPTIONIST"].includes(actor.role)) studentQuery.select("-parentId -previousSchoolDetails");
  const student = await studentQuery
    .populate("classId", "name")
    .populate("sectionId", "name")
    .populate("sessionId", "name startDate endDate")
    .populate(["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN", "RECEPTIONIST"].includes(actor.role) ? { path: "parentId", select: "firstName lastName phone email" } : { path: "parentId", select: "_id" })
    .lean();

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  return student;
};

// UPDATE STUDENT
export const updateStudentService = async (
  id: string,
  data: Record<string, unknown>,
  actor: StudentActor
) => {
  const { userId, schoolId } = getActorIds(actor);

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid student ID", 400);
  }

  const student = await Student.findOne({
    _id: id,
    schoolId,
    isDeleted: { $ne: true },
  });

  if (!student) {
    throw new AppError("Student not found", 404);
  }
  if ((student as any).tcLocked) throw new AppError("Student record is locked after TC issuance", 409);
  if (data.status !== undefined) throw new AppError("Use the authorized transfer, withdrawal or TC workflow to change student status", 400);

  if (["classId", "sectionId", "sessionId"].some((field) => data[field] !== undefined)) {
    throw new AppError("Use the transfer or promotion workflow to change class, section or academic session", 400);
  }

  const referenceData: Record<string, unknown> = {
    sessionId: student.sessionId.toString(),
    classId: data.classId ?? student.classId.toString(),
    sectionId: data.sectionId ?? student.sectionId.toString(),
    parentId: data.parentId === undefined ? (student.parentId ? student.parentId.toString() : null) : data.parentId,
  };
  await validateStudentReferences(referenceData, schoolId);

  const allowedFields = [
    "firstName",
    "middleName",
    "lastName",
    "dateOfBirth",
    "gender",
    "bloodGroup",
    "email",
    "phone",
    "profileImage",
    "parentId",
    "rollNumber",
    "address",
    "emergencyContact",
    "medicalInformation",
    "admissionDate",
    "previousSchool",
    "status",
  ];

  for (const [key, value] of Object.entries(data)) {
    if (!allowedFields.includes(key)) {
      throw new AppError(
        `Updating ${key} is not allowed`,
        400
      );
    }

    if (
      ["classId", "sectionId", "sessionId", "parentId"].includes(key) &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      (student as any)[key] = validateObjectId(value, key);
    } else {
      (student as any)[key] = value;
    }
  }

  if (data.status !== undefined) {
    student.isActive =
      data.status === StudentStatus.ACTIVE;
  }

  student.updatedBy = userId;

  try {
    const previousParentId = student.parentId?.toString();
    await student.save();
    const nextParentId = student.parentId?.toString();
    if (previousParentId && previousParentId !== nextParentId) {
      await Parent.updateOne(
        { _id: previousParentId, schoolId },
        { $pull: { studentIds: student._id } }
      );
    }
    if (nextParentId && previousParentId !== nextParentId) {
      await Parent.updateOne(
        { _id: nextParentId, schoolId },
        { $addToSet: { studentIds: student._id } }
      );
    }
    return student;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new AppError(
        "Roll number already exists in this section and session",
        409
      );
    }

    throw error;
  }
};

// SOFT DELETE STUDENT
export const deleteStudentService = async (
  id: string,
  actor: StudentActor
) => {
  const { userId, schoolId } = getActorIds(actor);

  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid student ID", 400);
  }

  const student = await Student.findOne({
    _id: id,
    schoolId,
    isDeleted: { $ne: true },
  });

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  if (!student.isActive) {
    throw new AppError("Student is already inactive", 400);
  }

  student.status = StudentStatus.INACTIVE;
  student.isActive = false;
  (student as any).isDeleted = true;
  (student as any).deletedAt = new Date();
  student.updatedBy = userId;

  await student.save();

  return student;
};
