
import type { Types } from "mongoose";

export type HolidayId = string;

export type HolidayType =
  | "NATIONAL"
  | "STATE"
  | "RELIGIOUS"
  | "SCHOOL"
  | "OPTIONAL"
  | "OTHER";

export type HolidayApplicability =
  | "STUDENTS"
  | "EMPLOYEES"
  | "BOTH";

export type HolidayStatus = "ACTIVE" | "INACTIVE";

export interface HolidayAuditInfo {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

export interface CreateHolidayDTO {
  sessionId: string;
  name: string;
  description?: string;
  holidayType: HolidayType;
  applicableTo: HolidayApplicability;
  startDate: Date | string;
  endDate: Date | string;
  isOptional?: boolean;
  isRecurring?: boolean;
  recurringMonth?: number;
  recurringDay?: number;
  isActive?: boolean;
}

export interface UpdateHolidayDTO {
  name?: string;
  description?: string | null;
  holidayType?: HolidayType;
  applicableTo?: HolidayApplicability;
  startDate?: Date | string;
  endDate?: Date | string;
  isOptional?: boolean;
  isRecurring?: boolean;
  recurringMonth?: number | null;
  recurringDay?: number | null;
  isActive?: boolean;
}

export interface HolidayListFilters {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  holidayType?: HolidayType;
  applicableTo?: HolidayApplicability;
  startDate?: Date | string;
  endDate?: Date | string;
  isOptional?: boolean;
  isRecurring?: boolean;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UpdateHolidayStatusDTO {
  isActive: boolean;
}

export interface HolidayCalendarFilters {
  sessionId?: string;
  month?: number;
  year?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  applicableTo?: HolidayApplicability;
}

export interface HolidayPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface HolidayListResponse {
  holidays: unknown[];
  pagination: HolidayPagination;
}

export interface HolidayCalendarItem {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  holidayType: HolidayType;
  applicableTo: HolidayApplicability;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  isOptional: boolean;
  isRecurring: boolean;
  isActive: boolean;
}

export interface HolidayCalendarResponse {
  year: number;
  month?: number;
  holidays: HolidayCalendarItem[];
}

export interface HolidaySummary {
  totalHolidays: number;
  activeHolidays: number;
  inactiveHolidays: number;
  upcomingHolidays: number;
  pastHolidays: number;
  optionalHolidays: number;
  recurringHolidays: number;
  totalHolidayDays: number;
}

export interface HolidayDetailsResponse {
  holiday: HolidayCalendarItem & {
    schoolId: Types.ObjectId;
    sessionId: Types.ObjectId;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface DeleteHolidayResponse {
  success: boolean;
  message: string;
  holidayId: string;
}

export interface HolidayDateRange {
  startDate: Date;
  endDate: Date;
}

export interface HolidaySearchResult {
  id: string;
  name: string;
  holidayType: HolidayType;
  startDate: Date;
  endDate: Date;
}

export interface HolidayDocument {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  name: string;
  description?: string;
  holidayType: HolidayType;
  applicableTo: HolidayApplicability;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  isOptional: boolean;
  isRecurring: boolean;
  recurringMonth?: number;
  recurringDay?: number;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
