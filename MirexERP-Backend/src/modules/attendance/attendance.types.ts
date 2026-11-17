
import { Types } from "mongoose";

import {
  AttendanceStatus,
  AttendanceType,
} from "./attendance.model";

// Common attendance identifiers.
export type AttendanceId = string;

export type SchoolId = string;

export type SessionId = string;

export type StudentId = string;

export type EmployeeId = string;

// Attendance actor information.
export interface AttendanceAuditInfo {
  markedBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Student attendance information.
export interface StudentAttendanceInfo {
  studentId: Types.ObjectId;
  admissionNumber?: string;
  studentName?: string;
  classId: Types.ObjectId;
  sectionId: Types.ObjectId;
}

// Employee attendance information.
export interface EmployeeAttendanceInfo {
  employeeId: Types.ObjectId;
  employeeCode?: string;
  employeeName?: string;
  designation?: string;
}

// Attendance timing information.
export interface AttendanceTiming {
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  lateByMinutes?: number;
  earlyDepartureMinutes?: number;
}

// Create attendance DTO.
export interface CreateAttendanceDTO {
  sessionId: string;
  attendanceType: AttendanceType;
  studentId?: string;
  employeeId?: string;
  classId?: string;
  sectionId?: string;
  attendanceDate: Date;
  status: AttendanceStatus;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  lateByMinutes?: number;
  earlyDepartureMinutes?: number;
  remarks?: string;
}

// Update attendance DTO.
export interface UpdateAttendanceDTO {
  status?: AttendanceStatus;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  lateByMinutes?: number;
  earlyDepartureMinutes?: number;
  remarks?: string;
}

// Attendance list filters.
export interface AttendanceListFilters {
  page: number;
  limit: number;
  attendanceType?: AttendanceType;
  status?: AttendanceStatus;
  studentId?: string;
  employeeId?: string;
  classId?: string;
  sectionId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

// Bulk attendance record.
export interface BulkAttendanceRecordDTO {
  studentId?: string;
  employeeId?: string;
  status: AttendanceStatus;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  remarks?: string;
}

// Bulk attendance DTO.
export interface BulkAttendanceDTO {
  sessionId: string;
  attendanceType: AttendanceType;
  attendanceDate: Date;
  classId?: string;
  sectionId?: string;
  records: BulkAttendanceRecordDTO[];
}

// Attendance pagination.
export interface AttendancePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Attendance list response.
export interface AttendanceListResponse<T = unknown> {
  attendance: T[];
  pagination: AttendancePagination;
}

// Attendance status summary.
export interface AttendanceStatusSummary {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  HALF_DAY: number;
  LEAVE: number;
  HOLIDAY: number;
}

// Attendance summary response.
export interface AttendanceSummary {
  attendanceType: AttendanceType;
  totalRecords: number;
  totalPeople: number;
  summary: AttendanceStatusSummary;
  presentRecords: number;
  workingRecords: number;
  attendancePercentage: number;
}

// Daily attendance response.
export interface DailyAttendanceResponse<T = unknown> {
  personId: string;
  attendanceType: AttendanceType;
  attendanceDate: Date;
  attendance: T | null;
}

// Attendance report filters.
export interface AttendanceReportFilters {
  schoolId: string;
  sessionId?: string;
  attendanceType: AttendanceType;
  classId?: string;
  sectionId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Attendance report row.
export interface AttendanceReportRow {
  personId: Types.ObjectId;
  personName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  attendancePercentage: number;
}

// Attendance dashboard statistics.
export interface AttendanceDashboardStats {
  totalStudents?: number;
  totalEmployees?: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  halfDayToday: number;
  attendancePercentage: number;
}

// Attendance delete response.
export interface DeleteAttendanceResponse {
  id: Types.ObjectId;
  deleted: boolean;
}

// Attendance search result.
export interface AttendanceSearchResult {
  id: Types.ObjectId;
  attendanceType: AttendanceType;
  personId: Types.ObjectId;
  personName: string;
  attendanceDate: Date;
  status: AttendanceStatus;
}

// Attendance status update DTO.
export interface UpdateAttendanceStatusDTO {
  status: AttendanceStatus;
  remarks?: string;
}

// Attendance record status.
export type AttendanceRecordStatus =
  | "ACTIVE"
  | "DELETED";

// Attendance date range.
export interface AttendanceDateRange {
  startDate: Date;
  endDate: Date;
}

// Attendance statistics grouped by status.
export interface AttendanceStatusCount {
  status: AttendanceStatus;
  count: number;
  percentage: number;
}
