
import { Types } from "mongoose";
import {
  IEmployeeDocument,
  EmployeeType,
  EmploymentType,
  EmployeeGender,
} from "./employees.model";

// Employee identification
export type EmployeeId = string;

export type EmployeeStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ON_LEAVE"
  | "RESIGNED"
  | "TERMINATED";

// Salary information
export interface EmployeeSalary {
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  currency: string;
}

// Employee address
export interface EmployeeAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// Emergency contact
export interface EmployeeEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// Employee document
export interface EmployeeDocumentInfo {
  documentType: string;
  documentNumber?: string;
  fileUrl: string;
  uploadedAt: Date;
}

// Employee creation DTO
export interface CreateEmployeeDTO {
  employeeId: string;
  userId?: string | null;
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth?: Date;
  gender: EmployeeGender;
  bloodGroup?: string;
  employeeType: EmployeeType;
  designation: string;
  department?: string;
  employmentType: EmploymentType;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  joiningDate: Date;
  confirmationDate?: Date;
  salary?: EmployeeSalary;
  address?: EmployeeAddress;
  emergencyContact?: EmployeeEmergencyContact;
  documents?: EmployeeDocumentInfo[];
  profileImage?: string;
  status?: EmployeeStatus;
  remarks?: string;
}

// Employee update DTO
export interface UpdateEmployeeDTO {
  userId?: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email?: string | null;
  phone?: string;
  alternatePhone?: string | null;
  dateOfBirth?: Date | null;
  gender?: EmployeeGender;
  bloodGroup?: string | null;
  employeeType?: EmployeeType;
  designation?: string;
  department?: string | null;
  employmentType?: EmploymentType;
  qualification?: string | null;
  specialization?: string | null;
  experienceYears?: number;
  joiningDate?: Date;
  confirmationDate?: Date | null;
  resignationDate?: Date | null;
  salary?: EmployeeSalary;
  address?: EmployeeAddress | null;
  emergencyContact?: EmployeeEmergencyContact | null;
  documents?: EmployeeDocumentInfo[];
  profileImage?: string | null;
  status?: EmployeeStatus;
  remarks?: string | null;
}

// Employee listing filters
export interface EmployeeListFilters {
  page?: number;
  limit?: number;
  search?: string;
  employeeType?: EmployeeType;
  employmentType?: EmploymentType;
  designation?: string;
  department?: string;
  status?: EmployeeStatus;
  gender?: EmployeeGender;
  isActive?: boolean;
  joiningDateFrom?: Date;
  joiningDateTo?: Date;
  sortBy?:
    | "firstName"
    | "employeeId"
    | "joiningDate"
    | "createdAt";
  sortOrder?: "asc" | "desc";
}

// Employee status update DTO
export interface UpdateEmployeeStatusDTO {
  status: EmployeeStatus;
}

// Assign user account DTO
export interface AssignEmployeeUserDTO {
  userId: string | null;
}

// Employee audit information
export interface EmployeeAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Employee pagination
export interface EmployeePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

// Employee list response
export interface EmployeeListResponse {
  employees: IEmployeeDocument[];
  pagination: EmployeePagination;
}

// Employee summary
export interface EmployeeSummary {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  teaching: number;
  nonTeaching: number;
  byDepartment: Array<{
    _id: string | null;
    count: number;
  }>;
  byEmployeeType: Array<{
    _id: EmployeeType;
    count: number;
  }>;
}

// Employee delete response
export interface DeleteEmployeeResponse {
  id: string;
  deleted: boolean;
}

// Employee details response
export interface EmployeeDetailsResponse {
  employee: IEmployeeDocument;
}

// Employee reference
export interface EmployeeReference {
  _id: Types.ObjectId;
  employeeId: string;
  fullName: string;
  designation: string;
}

// Employee search result
export interface EmployeeSearchResult {
  _id: Types.ObjectId;
  employeeId: string;
  fullName: string;
  phone: string;
  email?: string;
  designation: string;
  department?: string;
}

// Employee dashboard statistics
export interface EmployeeDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  teachingStaff: number;
  nonTeachingStaff: number;
  employeesOnLeave: number;
}
