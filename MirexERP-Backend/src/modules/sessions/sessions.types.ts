
import { Types } from "mongoose";

import { ISession } from "./sessions.model";

// Session ID
export type SessionId = string | Types.ObjectId;

// Create session DTO
export interface CreateSessionDTO {
  name: string;
  code: string;
  startDate: Date | string;
  endDate: Date | string;
  description?: string;
}

// Update session DTO
export interface UpdateSessionDTO {
  name?: string;
  code?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  description?: string;
}

// Session list filters
export interface SessionListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "DRAFT" | "UPCOMING" | "CLOSED";
}

// Session audit information
export interface SessionAuditInfo {
  createdBy?: SessionId | null;
  updatedBy?: SessionId | null;
}

// Session pagination metadata
export interface SessionPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Paginated session response
export interface SessionListResponse {
  sessions: ISession[];
  pagination: SessionPagination;
}

// Session deletion response
export interface DeleteSessionResponse {
  sessionId: string;
  deletedAt: Date;
}

// Active session response
export interface ActiveSessionResponse {
  session: ISession;
}

// Session summary
export interface SessionSummary {
  total: number;
  active: number;
  inactive: number;
  upcoming: number;
  completed: number;
}

// Session search result
export interface SessionSearchResult {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

// Session date range
export interface SessionDateRange {
  startDate: Date;
  endDate: Date;
}

// Session status
export type SessionStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "CLOSED";

// Session model document type
export type SessionDocument = ISession;
