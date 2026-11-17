
import { Types } from "mongoose";

import {
  LeaveType,
  LeaveStatus,
  LeaveApplicantType,
} from "./leaves.model";

// Common identifiers.
export type LeaveId = string;
export type SchoolId = string;
export type SessionId = string;
export type StudentId = string;
export type EmployeeId = string;

// Leave applicant information.
export interface LeaveApplicantInfo {
  applicantType: LeaveApplicantType;
  studentId?: Types.ObjectId | null;
  employeeId?: Types.ObjectId | null;
  applicantName?: string;
  applicantCode?: string;
  designation?: string;
}

// Leave date information.
export interface LeaveDateRange {
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

// Leave approval information.
export interface LeaveApprovalInfo {
  status: LeaveStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewRemarks?: string;
  rejectionReason?: string;
}

// Leave cancellation information.
export interface LeaveCancellationInfo {
  cancelledAt?: Date | null;
  cancellationReason?: string;
}

// Leave audit information.
export interface LeaveAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Create leave DTO.
export interface CreateLeaveDTO {
  sessionId: string;
  applicantType: LeaveApplicantType;
  studentId?: string;
  employeeId?: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  supportingDocument?: string | null;
}

// Update leave DTO.
export interface UpdateLeaveDTO {
  leaveType?: LeaveType;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  supportingDocument?: string | null;
}

// Leave listing filters.
export interface LeaveListFilters {
  page: number;
  limit: number;
  applicantType?: LeaveApplicantType;
  studentId?: string;
  employeeId?: string;
  sessionId?: string;
  leaveType?: LeaveType;
  status?: LeaveStatus;
  startDate?: Date;
  endDate?: Date;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

// Leave pagination.
export interface LeavePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Leave list response.
export interface LeaveListResponse<T = unknown> {
  leaves: T[];
  pagination: LeavePagination;
}

// Review leave DTO.
export interface ReviewLeaveDTO {
  reviewRemarks?: string;
}

// Approve leave DTO.
export interface ApproveLeaveDTO {
  reviewRemarks?: string;
}

// Reject leave DTO.
export interface RejectLeaveDTO {
  rejectionReason: string;
}

// Cancel leave DTO.
export interface CancelLeaveDTO {
  cancellationReason?: string;
}

// Update leave status DTO.
export interface UpdateLeaveStatusDTO {
  status: LeaveStatus;
  reviewRemarks?: string;
  rejectionReason?: string;
}

// Leave summary filters.
export interface LeaveSummaryFilters {
  schoolId: string;
  sessionId?: string;
  applicantType?: LeaveApplicantType;
  studentId?: string;
  employeeId?: string;
  leaveType?: LeaveType;
  startDate?: Date;
  endDate?: Date;
}

// Leave status summary.
export interface LeaveStatusSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELLED: number;
}

// Leave summary response.
export interface LeaveSummary {
  totalApplications: number;
  summary: LeaveStatusSummary;
  totalApprovedLeaveDays: number;
}

// Leave report row.
export interface LeaveReportRow {
  applicantId: Types.ObjectId;
  applicantName: string;
  applicantType: LeaveApplicantType;
  totalApplications: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  pendingLeaves: number;
  cancelledLeaves: number;
  totalApprovedDays: number;
}

// Leave dashboard statistics.
export interface LeaveDashboardStats {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  cancelledApplications: number;
  employeesOnLeaveToday: number;
  studentsOnLeaveToday: number;
}

// Leave delete response.
export interface DeleteLeaveResponse {
  id: Types.ObjectId;
  deleted: boolean;
}

// Leave details response.
export interface LeaveDetailsResponse<T = unknown> {
  leave: T;
  applicant: LeaveApplicantInfo;
  dateRange: LeaveDateRange;
  approval: LeaveApprovalInfo;
}

// Leave search result.
export interface LeaveSearchResult {
  id: Types.ObjectId;
  applicantType: LeaveApplicantType;
  applicantName: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: LeaveStatus;
}

// Leave calendar entry.
export interface LeaveCalendarEntry {
  id: Types.ObjectId;
  applicantId: Types.ObjectId;
  applicantName: string;
  applicantType: LeaveApplicantType;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  status: LeaveStatus;
}

// Leave balance information.
export interface LeaveBalance {
  employeeId: Types.ObjectId;
  leaveType: LeaveType;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

// Leave balance summary.
export interface LeaveBalanceSummary {
  employeeId: Types.ObjectId;
  employeeName: string;
  balances: LeaveBalance[];
  totalAllocatedDays: number;
  totalUsedDays: number;
  totalRemainingDays: number;
}
