
import { Types } from "mongoose";
import { ISubjectDocument, SubjectType, SubjectCategory } from "./subjects.model";

// Subject identification
export type SubjectId = string;

export type SubjectStatus = "ACTIVE" | "INACTIVE";

// Subject creation DTO
export interface CreateSubjectDTO {
  name: string;
  code: string;
  displayName?: string;
  subjectType?: SubjectType;
  category?: SubjectCategory;
  remarks?: string;
  icon?: string;
  color?: string;
  description?: string;
  isOptional?: boolean;
  isActive?: boolean;
}

// Subject update DTO
export interface UpdateSubjectDTO {
  name?: string;
  code?: string;
  displayName?: string | null;
  subjectType?: SubjectType;
  category?: SubjectCategory;
  remarks?: string | null;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isOptional?: boolean;
  isActive?: boolean;
}

// Subject listing filters
export interface SubjectListFilters {
  page?: number;
  limit?: number;
  search?: string;
  subjectType?: SubjectType;
  isOptional?: boolean;
  isActive?: boolean;
  category?: SubjectCategory;
  sessionId?: string;
  classId?: string;
  sortBy?: "name" | "code" | "subjectType" | "createdAt";
  sortOrder?: "asc" | "desc";
}

// Subject status update DTO
export interface UpdateSubjectStatusDTO {
  isActive: boolean;
}

// Subject type update DTO
export interface UpdateSubjectTypeDTO {
  subjectType: SubjectType;
}

// Subject audit information
export interface SubjectAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Subject pagination
export interface SubjectPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

// Subject list response
export interface SubjectListResponse {
  subjects: ISubjectDocument[];
  pagination: SubjectPagination;
}

// Subject summary
export interface SubjectSummary {
  total: number;
  active: number;
  inactive: number;
  optional: number;
  compulsory: number;
  byType: Record<string, number>;
  core?: number;
  elective?: number;
  activity?: number;
}

// Subject delete response
export interface DeleteSubjectResponse {
  id: string;
  deleted: boolean;
}

// Subject details response
export interface SubjectDetailsResponse {
  subject: ISubjectDocument;
}

// Subject reference
export interface SubjectReference {
  _id: Types.ObjectId;
  name: string;
  code: string;
  subjectType: SubjectType;
}

// Subject search result
export interface SubjectSearchResult {
  _id: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  subjectType: SubjectType;
  isOptional: boolean;
}

// Subject selection for class assignment
export interface SubjectSelection {
  subjectId: Types.ObjectId;
  isOptional: boolean;
  subjectType: SubjectType;
}

// Subject statistics by type
export interface SubjectTypeStatistics {
  subjectType: SubjectType;
  count: number;
}
