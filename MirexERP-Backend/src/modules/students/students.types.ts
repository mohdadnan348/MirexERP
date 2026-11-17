
import { Types } from "mongoose";

import {
  STUDENT_STATUS,
} from "../../config/constants";

import {
  CreateStudentInput,
  UpdateStudentInput,
  GetStudentsQuery,
} from "./students.validation";

// MongoDB Student ID
export type StudentId = Types.ObjectId | string;

// Student creation DTO
export type CreateStudentDTO = CreateStudentInput;

// Student update DTO
export type UpdateStudentDTO = UpdateStudentInput;

// Student status
export type StudentStatus =
  (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

// Student actor information
export interface StudentAuditInfo {
  userId: string;
  schoolId: string;
}

// Student list filters
export type StudentListFilters = GetStudentsQuery;

// Student pagination information
export interface StudentPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Student list response
export interface StudentListResponse<T> {
  students: T[];
  pagination: StudentPagination;
}

// Student details response
export interface StudentDetailsResponse<T> {
  student: T;
}

// Student create response
export interface CreateStudentResponse<T> {
  student: T;
  message: string;
}

// Student update response
export interface UpdateStudentResponse<T> {
  student: T;
  message: string;
}

// Student delete response
export interface DeleteStudentResponse {
  message: string;
}

// Student status update response
export interface StudentStatusResponse<T> {
  student: T;
  message: string;
}

// Student summary
export interface StudentSummary {
  total: number;
  active: number;
  inactive: number;
  transferred: number;
  graduated: number;
  withdrawn: number;
}

// Student dashboard response
export interface StudentDashboardResponse {
  summary: StudentSummary;
}

// Student academic information
export interface StudentAcademicInfo {
  schoolId: StudentId;
  sessionId: StudentId;
  classId: StudentId;
  sectionId?: StudentId;
  admissionNumber: string;
  rollNumber?: string;
  admissionDate: Date;
}

// Student personal information
export interface StudentPersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  dateOfBirth: Date;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string;
  nationality: string;
  religion?: string;
  category?: string;
}

// Student parent information
export interface StudentParentInfo {
  name: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  alternatePhone?: string;
  email?: string;
  occupation?: string;
  isPrimaryContact: boolean;
}

// Student document information
export interface StudentDocumentInfo {
  documentType: string;
  documentName: string;
  fileUrl: string;
  uploadedAt: Date;
  verified: boolean;
}

// Student search result
export interface StudentSearchResult {
  _id: StudentId;
  admissionNumber: string;
  rollNumber?: string;
  fullName: string;
  classId: StudentId;
  sectionId?: StudentId;
  profileImage?: string;
  status: StudentStatus;
}

// Student date range
export interface StudentDateRange {
  startDate: Date;
  endDate: Date;
}

// Student admission information
export interface StudentAdmissionInfo {
  admissionNumber: string;
  admissionDate: Date;
  sessionId: StudentId;
  classId: StudentId;
  sectionId?: StudentId;
}

// Student count by status
export interface StudentStatusCount {
  status: StudentStatus;
  count: number;
}

// Student count by class
export interface StudentClassCount {
  classId: StudentId;
  className: string;
  count: number;
}
