
import { Types } from "mongoose";
import { ISectionDocument } from "./sections.model";

// Section identification
export type SectionId = string;

export type SectionStatus = "ACTIVE" | "INACTIVE";

// Section creation DTO
export interface CreateSectionDTO {
  sessionId: string;
  classId: string;
  name: string;
  code: string;
  displayName?: string;
  roomNumber?: string;
  capacity?: number | null;
  classTeacherId?: string | null;
  description?: string;
  isActive?: boolean;
}

// Section update DTO
export interface UpdateSectionDTO {
  name?: string;
  code?: string;
  displayName?: string | null;
  roomNumber?: string | null;
  capacity?: number | null;
  classTeacherId?: string | null;
  description?: string | null;
  isActive?: boolean;
}

// Section listing filters
export interface SectionListFilters {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  classId?: string;
  classTeacherId?: string;
  isActive?: boolean;
  sortBy?: "name" | "code" | "createdAt";
  sortOrder?: "asc" | "desc";
}

// Section status update DTO
export interface UpdateSectionStatusDTO {
  isActive: boolean;
}

// Assign section teacher DTO
export interface AssignSectionTeacherDTO {
  classTeacherId: string | null;
}

// Section teacher information
export interface SectionTeacherInfo {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  employeeId: string;
}

// Section class information
export interface SectionClassInfo {
  _id: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  numericLevel?: number;
}

// Section audit information
export interface SectionAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Section pagination
export interface SectionPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

// Section list response
export interface SectionListResponse {
  sections: ISectionDocument[];
  pagination: SectionPagination;
}

// Section summary
export interface SectionSummary {
  total: number;
  active: number;
  inactive: number;
}

// Section delete response
export interface DeleteSectionResponse {
  id: string;
  deleted: boolean;
}

// Section details response
export interface SectionDetailsResponse {
  section: ISectionDocument;
}

// Section search result
export interface SectionSearchResult {
  _id: Types.ObjectId;
  name: string;
  code: string;
  displayName?: string;
  roomNumber?: string;
  classId: Types.ObjectId;
}

// Section reference
export interface SectionReference {
  _id: Types.ObjectId;
  name: string;
  code: string;
}

// Section capacity information
export interface SectionCapacityInfo {
  sectionId: Types.ObjectId;
  capacity: number | null;
  enrolledStudents: number;
  availableSeats: number | null;
  isFull: boolean;
}

// Populated section response
export interface PopulatedSection
  extends Omit<ISectionDocument, "classId" | "classTeacherId"> {
  classId: SectionClassInfo;
  classTeacherId?: SectionTeacherInfo | null;
}
