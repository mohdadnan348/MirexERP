
import { Types } from "mongoose";
import { IClassDocumentModel } from "./classes.model";

// Class identification
export type ClassId = string;

export type ClassStatus = "ACTIVE" | "INACTIVE";

// Class teacher information
export interface ClassTeacherInfo {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  employeeId: string;
}

// Subject information
export interface ClassSubjectInfo {
  _id: Types.ObjectId;
  name: string;
  code: string;
}

// Class creation DTO
export interface CreateClassDTO {
  sessionId: string;
  name: string;
  code: string;
  displayName?: string;
  numericLevel: number;
  description?: string;
  classTeacherId?: string | null;
  capacity?: number | null;
  stream?: string;
  subjects?: string[];
  isActive?: boolean;
}

// Class update DTO
export interface UpdateClassDTO {
  name?: string;
  code?: string;
  displayName?: string | null;
  numericLevel?: number;
  description?: string | null;
  classTeacherId?: string | null;
  capacity?: number | null;
  stream?: string | null;
  subjects?: string[];
  isActive?: boolean;
}

// Class listing filters
export interface ClassListFilters {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  classTeacherId?: string;
  isActive?: boolean;
  stream?: string;
  sortBy?: "name" | "code" | "numericLevel" | "createdAt";
  sortOrder?: "asc" | "desc";
}

// Class status update DTO
export interface UpdateClassStatusDTO {
  isActive: boolean;
}

// Assign subjects DTO
export interface AssignClassSubjectsDTO {
  subjects: string[];
}

// Class audit information
export interface ClassAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Class pagination
export interface ClassPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

// Class list response
export interface ClassListResponse {
  classes: IClassDocumentModel[];
  pagination: ClassPagination;
}

// Class summary
export interface ClassSummary {
  total: number;
  active: number;
  inactive: number;
}

// Class delete response
export interface DeleteClassResponse {
  id: string;
  deleted: boolean;
}

// Class details response
export interface ClassDetailsResponse {
  class: IClassDocumentModel;
}

// Class search result
export interface ClassSearchResult {
  _id: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  numericLevel: number;
  stream?: string;
}

// Class document reference
export interface ClassReference {
  _id: Types.ObjectId;
  name: string;
  code: string;
}

// Class document with populated references
export interface PopulatedClass
  extends Omit<IClassDocumentModel, "classTeacherId" | "subjects"> {
  classTeacherId?: ClassTeacherInfo | null;
  subjects: ClassSubjectInfo[];
}

// Class capacity information
export interface ClassCapacityInfo {
  classId: Types.ObjectId;
  capacity: number | null;
  enrolledStudents: number;
  availableSeats: number | null;
  isFull: boolean;
}
