
import { Request, Response } from "express";

import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";
import { getValidatedData } from "../../middleware/validate";

import {
  createEmployeeService,
  getAllEmployeesService,
  getEmployeeByIdService,
  updateEmployeeService,
  updateEmployeeStatusService,
  assignEmployeeUserService,
  deleteEmployeeService,
  getEmployeeSummaryService,
} from "./employees.service";

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

const getActor = (req: Request): EmployeeActor => {
  const user = req.user;

  if (!user?.userId || !user.schoolId) {
    throw new AppError(
      "Authenticated school user is required",
      401
    );
  }

  return {
    userId: user.userId,
    schoolId: user.schoolId,
  };
};

const getEmployeeId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid employee ID is required", 400);
  }

  return id;
};

// Create employee
export const createEmployee = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateEmployeeInput>(
      res,
      "body"
    );

    const employee = await createEmployeeService(
      data,
      actor
    );

    const safeEmployee = employee.toObject() as Record<string, unknown>;
    delete safeEmployee.panNumber;
    delete safeEmployee.salary;
    delete safeEmployee.salaryHistory;
    return sendCreated(
      res,
      "Employee created successfully",
      safeEmployee
    );
  }
);

// Get all employees
export const getAllEmployees = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<EmployeeListQuery>(
      res,
      "query"
    );

    const result = await getAllEmployeesService(
      query,
      actor.schoolId
    );

    return sendPaginatedSuccess(
      res,
      "Employees fetched successfully",
      result.employees,
      result.pagination
    );
  }
);

// Get employee by ID
export const getEmployeeById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const employeeId = getEmployeeId(req);

    const employee = await getEmployeeByIdService(
      employeeId,
      actor.schoolId
    );
    // Salary and PAN are returned only by their dedicated permission-protected APIs.
    employee.salary = undefined as never;
    employee.salaryHistory = undefined as never;
    for (const document of employee.documents || []) {
      if (document.documentNumber) {
        document.documentNumber = `••••${document.documentNumber.slice(-4)}`;
      }
    }

    return sendSuccess(
      res,
      "Employee fetched successfully",
      employee
    );
  }
);

// Update employee
export const updateEmployee = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const employeeId = getEmployeeId(req);

    const data = getValidatedData<UpdateEmployeeInput>(
      res,
      "body"
    );

    const employee = await updateEmployeeService(
      employeeId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Employee updated successfully",
      employee
    );
  }
);

// Update employee status
export const updateEmployeeStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const employeeId = getEmployeeId(req);

    const data = getValidatedData<UpdateEmployeeStatusInput>(
      res,
      "body"
    );

    const employee = await updateEmployeeStatusService(
      employeeId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Employee status updated successfully",
      employee
    );
  }
);

// Assign or remove user account
export const assignEmployeeUser = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const employeeId = getEmployeeId(req);

    const data = getValidatedData<AssignEmployeeUserInput>(
      res,
      "body"
    );

    const employee = await assignEmployeeUserService(
      employeeId,
      data,
      actor
    );

    return sendSuccess(
      res,
      "Employee user account updated successfully",
      employee
    );
  }
);

// Delete employee
export const deleteEmployee = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const employeeId = getEmployeeId(req);

    await deleteEmployeeService(employeeId, actor);

    return sendDeleted(
      res,
      "Employee deleted successfully"
    );
  }
);

// Get employee summary
export const getEmployeeSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const summary = await getEmployeeSummaryService(
      actor.schoolId
    );

    return sendSuccess(
      res,
      "Employee summary fetched successfully",
      summary
    );
  }
);
