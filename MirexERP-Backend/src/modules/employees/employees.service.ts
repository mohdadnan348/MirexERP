
import mongoose, { FilterQuery, Types } from "mongoose";

import Employee, {
  IEmployeeDocument,
} from "./employees.model";

import User from "../auth/auth.model";

import { AppError } from "../../utils/AppError";
import EmployeeAudit from "./employee-audit.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import {
  getPagination,
  createPaginationMeta,
} from "../../utils/pagination";

import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeListQuery,
  UpdateEmployeeStatusInput,
  AssignEmployeeUserInput,
} from "./employees.validation";

interface EmployeeActor {
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

const findEmployeeOrFail = async (
  employeeId: string,
  schoolId: string
): Promise<IEmployeeDocument> => {
  validateObjectId(employeeId, "employee ID");

  const employee = await Employee.findOne({
    _id: employeeId,
    schoolId,
    isDeleted: false,
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
};

const checkDuplicateEmployee = async (
  schoolId: string,
  employeeId: string,
  email?: string,
  excludeId?: string
): Promise<void> => {
  const conditions: FilterQuery<IEmployeeDocument>[] = [
    { employeeId: employeeId.trim().toUpperCase() },
  ];

  if (email) {
    conditions.push({
      email: email.trim().toLowerCase(),
    });
  }

  const filter: FilterQuery<IEmployeeDocument> = {
    schoolId,
    isDeleted: false,
    $or: conditions,
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existing = await Employee.findOne(filter).lean();

  if (!existing) return;

  if (
    existing.employeeId === employeeId.trim().toUpperCase()
  ) {
    throw new AppError(
      "Employee ID already exists in this school",
      409
    );
  }

  throw new AppError(
    "Employee email already exists in this school",
    409
  );
};

const validateUserAccount = async (
  userId: string,
  schoolId: string,
  employeeType?: string
): Promise<void> => {
  validateObjectId(userId, "user ID");

  const user = await User.findOne({
    _id: userId,
    schoolId,
    isDeleted: false,
    isActive: true,
  }).select("_id role");

  if (!user) {
    throw new AppError(
      "Active user account not found in this school",
      404
    );
  }

  if (employeeType === "TEACHING" && user.role !== "TEACHER") {
    throw new AppError("Teaching employees must be linked to a Teacher login account", 400);
  }

  const linkedEmployee = await Employee.findOne({
    schoolId,
    userId,
    isDeleted: false,
  }).select("_id");

  if (linkedEmployee) {
    throw new AppError(
      "This user account is already linked to another employee",
      409
    );
  }
};

// Create employee
export const createEmployeeService = async (
  data: CreateEmployeeInput,
  actor: EmployeeActor
): Promise<IEmployeeDocument> => {
  // Atomic per-school sequence. Deleted/exited employee codes are never recycled.
  const existingSequenceRows = await Employee.aggregate([
    { $match: { schoolId: new Types.ObjectId(actor.schoolId), employeeId: /^EMP[0-9]+$/i } },
    { $project: { sequence: { $toInt: { $substrCP: ["$employeeId", 3, 100] } } } },
    { $group: { _id: null, maxSequence: { $max: "$sequence" } } },
  ]);
  const existingSequence = Number(existingSequenceRows[0]?.maxSequence || 0);
  const counterResult = await mongoose.connection.collection("counters").findOneAndUpdate(
    { _id: `employee:${actor.schoolId}` },
    [{ $set: { sequence: { $add: [{ $max: [{ $ifNull: ["$sequence", 0] }, existingSequence] }, 1] } } }],
    { upsert: true, returnDocument: "after" }
  );
  const counterDoc: any = counterResult as any;
  const sequence = counterDoc?.sequence ?? counterDoc?.value?.sequence;
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AppError("Unable to allocate employee code. Please retry.", 503);
  }
  const employeeId = `EMP${String(sequence).padStart(3, "0")}`;

  const email = data.email?.trim().toLowerCase();

  await checkDuplicateEmployee(
    actor.schoolId,
    employeeId,
    email
  );

  if (data.userId) {
    await validateUserAccount(
      data.userId,
      actor.schoolId,
      data.employeeType
    );
  }

  try {
    const employee = await Employee.create({
      ...data,
      schoolId: actor.schoolId,
      employeeId,
      email,
      fullName: [
        data.firstName,
        data.middleName,
        data.lastName,
      ]
        .filter(Boolean)
        .join(" "),
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    if (data.salary) {
      employee.salaryHistory = [{
        basic: data.salary.basic,
        hra: data.salary.hra || 0,
        allowances: data.salary.allowances || 0,
        deductions: data.salary.deductions || 0,
        gross: data.salary.basic + (data.salary.hra || 0) + (data.salary.allowances || 0),
        effectiveDate: data.joiningDate,
        paymentFrequency: "MONTHLY",
        changedBy: new Types.ObjectId(actor.userId),
      }] as any;
      await employee.save();
    }
    await EmployeeAudit.create({schoolId:actor.schoolId,employeeId:employee._id,action:"EMPLOYEE_CREATED",changedFields:["profile","employment",...(data.salary?["salary"]:[])],performedBy:new Types.ObjectId(actor.userId)});
    return employee;
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
        "Employee ID, email or user account already exists",
        409
      );
    }

    throw error;
  }
};

// Get all employees
export const getAllEmployeesService = async (
  query: EmployeeListQuery,
  schoolId: string
) => {
  const { page, limit, skip } = getPagination({
    page: query.page,
    limit: query.limit,
  });

  const filter: FilterQuery<IEmployeeDocument> = {
    schoolId,
    isDeleted: false,
  };

  if (query.employeeType) {
    filter.employeeType = query.employeeType;
  }

  if (query.employmentType) {
    filter.employmentType = query.employmentType;
  }

  if (query.designation) {
    filter.designation = new RegExp(
      `^${query.designation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i"
    );
  }

  if (query.department) {
    filter.department = new RegExp(
      `^${query.department.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i"
    );
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (typeof query.isActive === "boolean") {
    filter.isActive = query.isActive;
  }

  if (query.joiningDateFrom || query.joiningDateTo) {
    filter.joiningDate = {};

    if (query.joiningDateFrom) {
      filter.joiningDate.$gte = query.joiningDateFrom;
    }

    if (query.joiningDateTo) {
      const endDate = new Date(query.joiningDateTo);
      endDate.setHours(23, 59, 59, 999);
      filter.joiningDate.$lte = endDate;
    }
  }

  if (query.search) {
    const escapedSearch = query.search.trim().replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(escapedSearch, "i");

    filter.$or = [
      { firstName: regex },
      { middleName: regex },
      { lastName: regex },
      { fullName: regex },
      { employeeId: regex },
      { email: regex },
      { phone: regex },
      { designation: regex },
      { department: regex },
    ];
  }

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .select("-salary -salaryHistory -panNumber -documents")
      .populate("userId", "name email role status")
      .sort({ [sortBy]: sortOrder, employeeId: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Employee.countDocuments(filter),
  ]);
  const employeeIds = employees.map((employee) => employee._id);
  const assignmentCounts = employeeIds.length ? await SubjectTeacherAssignment.aggregate([
    { $match: { schoolId: new Types.ObjectId(schoolId), teacherId: { $in: employeeIds }, isActive: true } },
    { $group: { _id: "$teacherId", assignedClassCount: { $addToSet: "$classId" } } },
    { $project: { assignedClassCount: { $size: "$assignedClassCount" } } },
  ]) : [];
  const countByEmployee = new Map(assignmentCounts.map((item: any) => [String(item._id), item.assignedClassCount]));
  const employeesWithAssignments = employees.map((employee: any) => ({
    ...employee,
    assignedClassCount: countByEmployee.get(String(employee._id)) || 0,
  }));

  return {
    employees: employeesWithAssignments,
    pagination: createPaginationMeta(page, limit, total),
  };
};

// Get employee by ID
export const getEmployeeByIdService = async (
  employeeId: string,
  schoolId: string
): Promise<IEmployeeDocument> => {
  const employee = await Employee.findOne({
    _id: employeeId,
    schoolId,
    isDeleted: false,
  }).populate("userId", "name email role status");

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
};

// Update employee
export const updateEmployeeService = async (
  employeeId: string,
  data: UpdateEmployeeInput,
  actor: EmployeeActor
): Promise<IEmployeeDocument> => {
  const employee = await findEmployeeOrFail(
    employeeId,
    actor.schoolId
  );

  const updatedFirstName =
    data.firstName ?? employee.firstName;

  const updatedMiddleName =
    data.middleName === undefined
      ? employee.middleName
      : data.middleName ?? undefined;

  const updatedLastName =
    data.lastName ?? employee.lastName;

  const updatedEmail =
    data.email === undefined
      ? employee.email
      : data.email?.trim().toLowerCase();

  if (updatedEmail !== undefined) {
    await checkDuplicateEmployee(
      actor.schoolId,
      employee.employeeId,
      updatedEmail,
      employeeId
    );
  }

  if (data.userId) {
    if (employee.exitDetails) throw new AppError("Exited employees cannot be linked to a new login account", 409);
    const currentUserId = employee.userId?.toString();

    if (currentUserId !== data.userId) {
      await validateUserAccount(
        data.userId,
        actor.schoolId,
        data.employeeType ?? employee.employeeType
      );
    }
  }
  if ((data.employeeType ?? employee.employeeType) === "TEACHING" && employee.userId) {
    const linkedUser = await User.findOne({ _id: employee.userId, schoolId: actor.schoolId, isDeleted: false }).select("role");
    if (!linkedUser || linkedUser.role !== "TEACHER") {
      throw new AppError("Teaching employees must be linked to a Teacher login account", 400);
    }
  }

  const updateFields = { ...data };

  delete updateFields.firstName;
  delete updateFields.middleName;
  delete updateFields.lastName;
  delete updateFields.email;

  Object.assign(employee, updateFields);

  employee.firstName = updatedFirstName;
  employee.middleName = updatedMiddleName;
  employee.lastName = updatedLastName;
  employee.email = updatedEmail;

  employee.fullName = [
    updatedFirstName,
    updatedMiddleName,
    updatedLastName,
  ]
    .filter(Boolean)
    .join(" ");

  employee.updatedBy = new Types.ObjectId(actor.userId);

  await employee.save();
  await EmployeeAudit.create({schoolId:actor.schoolId,employeeId:employee._id,action:"EMPLOYEE_UPDATED",changedFields:Object.keys(data),performedBy:new Types.ObjectId(actor.userId)});

  return employee;
};

// Update employee status
export const updateEmployeeStatusService = async (
  employeeId: string,
  data: UpdateEmployeeStatusInput,
  actor: EmployeeActor
): Promise<IEmployeeDocument> => {
  const employee = await findEmployeeOrFail(
    employeeId,
    actor.schoolId
  );

  if (data.status === "RESIGNED" || data.status === "TERMINATED") {
    throw new AppError("Use the controlled employee exit workflow for resignation or termination.", 409);
  }
  if (employee.exitDetails && data.status === "ACTIVE") {
    throw new AppError("Exited employees cannot be reactivated without a separate rehire workflow", 409);
  }
  employee.status = data.status;
  employee.isActive = data.status === "ACTIVE";
  employee.updatedBy = new Types.ObjectId(actor.userId);
  await employee.save();
  await EmployeeAudit.create({schoolId:actor.schoolId,employeeId:employee._id,action:"EMPLOYMENT_STATUS_UPDATED",changedFields:["status","isActive"],performedBy:new Types.ObjectId(actor.userId)});
  if (employee.userId) {
    await User.updateOne(
      { _id: employee.userId, schoolId: actor.schoolId },
      { $set: { isActive: employee.isActive, status: employee.isActive ? "ACTIVE" : "INACTIVE" } }
    );
    if (!employee.isActive) {
      await mongoose.connection.collection("authsessions").updateMany(
        { userId: employee.userId, revokedAt: null },
        { $set: { revokedAt: new Date(), updatedAt: new Date() } }
      );
    }
  }
  return employee;
};

// Assign or remove user account
export const assignEmployeeUserService = async (
  employeeId: string,
  data: AssignEmployeeUserInput,
  actor: EmployeeActor
): Promise<IEmployeeDocument> => {
  const employee = await findEmployeeOrFail(
    employeeId,
    actor.schoolId
  );

  if (data.userId) {
    if (employee.exitDetails) throw new AppError("Exited employees cannot be linked to a login account", 409);
    const currentUserId = employee.userId?.toString();

    if (currentUserId !== data.userId) {
      await validateUserAccount(
        data.userId,
        actor.schoolId,
        employee.employeeType
      );
    }

    employee.userId = new Types.ObjectId(data.userId);
  } else {
    employee.userId = null;
  }

  employee.updatedBy = new Types.ObjectId(actor.userId);

  await employee.save();

  return employee;
};

// Soft delete employee
export const deleteEmployeeService = async (
  employeeId: string,
  actor: EmployeeActor
): Promise<{ id: string; deleted: boolean }> => {
  // Employee records are historical HR records. Use the controlled exit workflow instead.
  await findEmployeeOrFail(employeeId, actor.schoolId);
  throw new AppError(
    "Employee records cannot be deleted. Complete the employee exit workflow to preserve history and revoke access.",
    409
  );
};

// Employee statistics
export const getEmployeeSummaryService = async (
  schoolId: string
) => {
  const filter: FilterQuery<IEmployeeDocument> = {
    schoolId,
    isDeleted: false,
  };

  const [
    total,
    active,
    inactive,
    onLeave,
    teaching,
    nonTeaching,
  ] = await Promise.all([
    Employee.countDocuments(filter),

    Employee.countDocuments({
      ...filter,
      status: "ACTIVE",
    }),

    Employee.countDocuments({
      ...filter,
      status: "INACTIVE",
    }),

    Employee.countDocuments({
      ...filter,
      status: "ON_LEAVE",
    }),

    Employee.countDocuments({
      ...filter,
      employeeType: "TEACHING",
    }),

    Employee.countDocuments({
      ...filter,
      employeeType: "NON_TEACHING",
    }),
  ]);

  const byDepartment = await Employee.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$department",
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  const byEmployeeType = await Employee.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$employeeType",
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    total,
    active,
    inactive,
    onLeave,
    teaching,
    nonTeaching,
    byDepartment,
    byEmployeeType,
  };
};
