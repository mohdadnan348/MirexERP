
import { FilterQuery, Types } from "mongoose";
import { Parent } from "./parents.model";
import { Student, IStudent } from "../students/students.model";
import Employee from "../employees/employees.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import { AppError } from "../../utils/AppError";
import ParentChildRelationship from "./parent-child-relationship.model";

interface ParentActor {
  userId: string;
  schoolId: string;
  role: string;
}

interface ParentQuery {
  page?: number;
  limit?: number;
  search?: string;
}

const getSchoolId = (actor: ParentActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.schoolId)) {
    throw new AppError("Valid school ID is required", 400);
  }

  return new Types.ObjectId(actor.schoolId);
};

const getUserId = (actor: ParentActor): Types.ObjectId => {
  if (!Types.ObjectId.isValid(actor.userId)) {
    throw new AppError("Valid user ID is required", 400);
  }

  return new Types.ObjectId(actor.userId);
};

const getParentId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid parent ID", 400);
  }

  return new Types.ObjectId(id);
};

const getPagination = (query: ParentQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const validateStudentIds = async (
  studentIds: string[],
  schoolId: Types.ObjectId
) => {
  const uniqueIds = [...new Set(studentIds)];

  if (uniqueIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError("One or more student IDs are invalid", 400);
  }

  if (uniqueIds.length === 0) {
    return [];
  }

  const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

  const students = await Student.find({
    _id: { $in: objectIds },
    schoolId,
  }).select("_id");

  if (students.length !== uniqueIds.length) {
    throw new AppError(
      "One or more students do not belong to this school",
      400
    );
  }

  return objectIds;
};

const getTeacherStudentScope = async (actor: ParentActor): Promise<FilterQuery<IStudent>> => {
  if (actor.role !== "TEACHER") return {};
  const employee = await Employee.findOne({
    schoolId: actor.schoolId, userId: actor.userId, status: "ACTIVE", isDeleted: false, employeeType: "TEACHING",
  }).select("_id").lean();
  if (!employee) throw new AppError("Teacher employee profile is not linked to this account", 403);
  const [classes, sections] = await Promise.all([
    Class.find({ schoolId: actor.schoolId, classTeacherId: employee._id, isDeleted: false, isActive: true }).select("_id").lean(),
    Section.find({ schoolId: actor.schoolId, classTeacherId: employee._id, isDeleted: false, isActive: true }).select("_id").lean(),
  ]);
  const classIds = classes.map((item) => item._id);
  const sectionIds = sections.map((item) => item._id);
  if (!classIds.length && !sectionIds.length) return { _id: { $in: [] } };
  return { $or: [
    ...(classIds.length ? [{ classId: { $in: classIds } }] : []),
    ...(sectionIds.length ? [{ sectionId: { $in: sectionIds } }] : []),
  ] };
};

// CREATE PARENT
export const createParentService = async (
  data: Record<string, any>,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);

  const studentIds = await validateStudentIds(
    Array.isArray(data.studentIds) ? data.studentIds : [],
    schoolId
  );

  const conflictingStudent = studentIds.length ? await Student.findOne({
    _id: { $in: studentIds }, schoolId,
    parentId: { $exists: true, $nin: [null] },
  }).select("_id admissionNumber").lean() : null;
  if (conflictingStudent) {
    throw new AppError("A selected student is already linked to another parent", 409);
  }

  const parent = await Parent.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    alternatePhone: data.alternatePhone,
    relation: data.relation,
    occupation: data.occupation,
    qualification: data.qualification,
    annualIncome: data.annualIncome,
    address: data.address,
    studentIds,
    schoolId,
    isActive: true,
    createdBy: getUserId(actor),
  });

  // Keep the relationship bidirectional: parent.studentIds and student.parentId
  // must represent the same school-scoped relationship.
  if (studentIds.length) {
    await Student.updateMany(
      { _id: { $in: studentIds }, schoolId, $or: [{ parentId: null }, { parentId: { $exists: false } }, { parentId: parent._id }] },
      { $set: { parentId: parent._id, updatedBy: getUserId(actor) } }
    );
  }

  return parent;
};

// GET ALL PARENTS
export const getParentsService = async (
  query: ParentQuery,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);
  const { page, limit, skip } = getPagination(query);

  const filter: Record<string, any> = {
    schoolId,
    isActive: true,
  };

  if (query.search?.trim()) {
    const search = query.search.trim();

    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Parent.find(filter)
      .populate("studentIds", "firstName lastName admissionNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Parent.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// GET PARENT BY ID
export const getParentByIdService = async (
  id: string,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);
  const parentId = getParentId(id);

  const parent = await Parent.findOne({
    _id: parentId,
    schoolId,
    isActive: true,
  }).populate(
    "studentIds",
    "firstName lastName admissionNumber classId sectionId"
  );

  if (!parent) {
    throw new AppError("Parent not found", 404);
  }

  return parent;
};

// UPDATE PARENT
export const updateParentService = async (
  id: string,
  data: Record<string, any>,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);
  const parentId = getParentId(id);

  const parent = await Parent.findOne({
    _id: parentId,
    schoolId,
    isActive: true,
  });

  if (!parent) {
    throw new AppError("Parent not found", 404);
  }

  const allowedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "alternatePhone",
    "relation",
    "occupation",
    "qualification",
    "annualIncome",
    "address",
    "emergencyContact",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      (parent as any)[field] = data[field];
    }
  }

  if (data.studentIds !== undefined) {
    if (!Array.isArray(data.studentIds)) {
      throw new AppError("Student IDs must be an array", 400);
    }

    const nextStudentIds = await validateStudentIds(data.studentIds, schoolId);
    const conflictingStudent = await Student.findOne({
      _id: { $in: nextStudentIds }, schoolId,
      parentId: { $exists: true, $nin: [null, parent._id] },
    }).select("_id admissionNumber").lean();
    if (conflictingStudent) {
      throw new AppError("A selected student is already linked to another parent", 409);
    }

    const previousIds = parent.studentIds.map((id) => id.toString());
    const nextIds = nextStudentIds.map((id) => id.toString());
    const removedIds = previousIds.filter((id) => !nextIds.includes(id));
    if (removedIds.length) {
      await Student.updateMany(
        { _id: { $in: removedIds }, schoolId, parentId: parent._id },
        { $unset: { parentId: 1 }, $set: { updatedBy: getUserId(actor) } }
      );
    }
    if (nextStudentIds.length) {
      await Student.updateMany(
        { _id: { $in: nextStudentIds }, schoolId },
        { $set: { parentId: parent._id, updatedBy: getUserId(actor) } }
      );
    }
    parent.studentIds = nextStudentIds;
  }

  parent.updatedBy = getUserId(actor);

  await parent.save();

  return parent;
};

// DELETE PARENT (SOFT DELETE)
export const deleteParentService = async (
  id: string,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);
  const parentId = getParentId(id);

  const parent = await Parent.findOneAndUpdate(
    {
      _id: parentId,
      schoolId,
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        updatedBy: getUserId(actor),
      },
    },
    { new: true }
  );

  if (!parent) {
    throw new AppError("Parent not found", 404);
  }

  await Student.updateMany(
    { _id: { $in: parent.studentIds }, schoolId, parentId: parent._id },
    { $unset: { parentId: 1 }, $set: { updatedBy: getUserId(actor) } }
  );

  return parent;
};

// GET STUDENTS LINKED TO PARENT
export const getParentStudentsService = async (
  id: string,
  actor: ParentActor
) => {
  const schoolId = getSchoolId(actor);
  const parentId = getParentId(id);

  const parent = await Parent.findOne({
    _id: parentId,
    schoolId,
    isActive: true,
  }).select("_id studentIds");

  if (!parent) {
    throw new AppError("Parent not found", 404);
  }

  const mappings = await ParentChildRelationship.find({ schoolId, parentId: parent._id }).select("studentId status").lean();
  const mappedIds = new Set((mappings as any[]).map((item) => String(item.studentId)));
  const activeIds = (mappings as any[]).filter((item) => item.status === "ACTIVE").map((item) => item.studentId);
  const legacyIds = parent.studentIds.filter((id: any) => !mappedIds.has(String(id)));
  const teacherScope = await getTeacherStudentScope(actor);
  const students = await Student.find({
    _id: { $in: [...activeIds, ...legacyIds] },
    schoolId,
    ...teacherScope,
  })
    .select(
      "firstName lastName admissionNumber rollNumber classId sectionId status"
    )
    .populate("classId", "name")
    .populate("sectionId", "name")
    .sort({ firstName: 1 })
    .lean();

  return {
    items: students,
    total: students.length,
  };
};
