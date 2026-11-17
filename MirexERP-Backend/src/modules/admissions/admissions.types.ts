
import { Types } from "mongoose";

import { ADMISSION_STATUS } from "../../config/constants";

import {
  CreateAdmissionInput,
  UpdateAdmissionInput,
  AdmissionListQuery,
  ReviewAdmissionInput,
  ApproveAdmissionInput,
  RejectAdmissionInput,
  CancelAdmissionInput,
} from "./admissions.validation";

// MongoDB Admission ID
export type AdmissionId = Types.ObjectId | string;

// Admission status
export type AdmissionStatus =
  (typeof ADMISSION_STATUS)[keyof typeof ADMISSION_STATUS];

// Admission creation DTO
export type CreateAdmissionDTO = CreateAdmissionInput;

// Admission update DTO
export type UpdateAdmissionDTO = UpdateAdmissionInput;

// Admission review DTO
export type ReviewAdmissionDTO = ReviewAdmissionInput;

// Admission approval DTO
export type ApproveAdmissionDTO = ApproveAdmissionInput;

// Admission rejection DTO
export type RejectAdmissionDTO = RejectAdmissionInput;

// Admission cancellation DTO
export type CancelAdmissionDTO = CancelAdmissionInput;

// Admission list filters
export type AdmissionListFilters = AdmissionListQuery;

// Audit information
export interface AdmissionAuditInfo {
  userId: string;
  schoolId: string;
}

// Pagination information
export interface AdmissionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Admission list response
export interface AdmissionListResponse<T> {
  admissions: T[];
  pagination: AdmissionPagination;
}

// Admission details response
export interface AdmissionDetailsResponse<T> {
  admission: T;
}

// Admission creation response
export interface CreateAdmissionResponse<T> {
  admission: T;
  message: string;
}

// Admission update response
export interface UpdateAdmissionResponse<T> {
  admission: T;
  message: string;
}

// Admission review response
export interface ReviewAdmissionResponse<T> {
  admission: T;
  message: string;
}

// Admission approval response
export interface ApproveAdmissionResponse<T> {
  admission: T;
  studentId: AdmissionId;
  message: string;
}

// Admission rejection response
export interface RejectAdmissionResponse<T> {
  admission: T;
  message: string;
}

// Admission cancellation response
export interface CancelAdmissionResponse<T> {
  admission: T;
  message: string;
}

// Admission deletion response
export interface DeleteAdmissionResponse {
  message: string;
}

// Admission summary
export interface AdmissionSummary {
  total: number;
  applied: number;
  underReview: number;
  documentsPending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  converted: number;
}

// Admission dashboard response
export interface AdmissionDashboardResponse {
  summary: AdmissionSummary;
}

// Admission guardian information
export interface AdmissionGuardianInfo {
  name: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  alternatePhone?: string;
  email?: string;
  occupation?: string;
  isPrimaryContact: boolean;
}

// Admission document information
export interface AdmissionDocumentInfo {
  documentType: string;
  documentName: string;
  fileUrl: string;
  uploadedAt: Date;
  verified: boolean;
  remarks?: string;
}

// Applicant personal information
export interface ApplicantPersonalInfo {
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
  motherTongue?: string;
}

// Admission academic information
export interface AdmissionAcademicInfo {
  schoolId: AdmissionId;
  sessionId: AdmissionId;
  applicationNumber: string;
  appliedClassId: AdmissionId;
  appliedSectionId?: AdmissionId;
  previousSchool?: string;
  previousClass?: string;
  previousBoard?: string;
}

// Admission review information
export interface AdmissionReviewInfo {
  reviewedBy?: AdmissionId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  rejectionReason?: string;
}

// Admission conversion information
export interface AdmissionConversionInfo {
  convertedStudentId?: AdmissionId;
  convertedAt?: Date;
}

// Admission count by status
export interface AdmissionStatusCount {
  status: AdmissionStatus;
  count: number;
}

// Admission search result
export interface AdmissionSearchResult {
  _id: AdmissionId;
  applicationNumber: string;
  fullName: string;
  phone?: string;
  email?: string;
  appliedClassId: AdmissionId;
  status: AdmissionStatus;
  applicationDate: Date;
}

// Admission date range
export interface AdmissionDateRange {
  startDate: Date;
  endDate: Date;
}
