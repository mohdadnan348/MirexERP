
/**
 * MirexERP
 * Application-wide constants
 *
 * Keep shared roles, statuses and configuration values here.
 */

// ==========================================
// APPLICATION CONSTANTS
// ==========================================

export const APP_CONSTANTS = {
  NAME: "MirexERP",
  API_VERSION: "v1",
  DEFAULT_PORT: 5000,
  DEFAULT_API_PREFIX: "/api/v1",
} as const;

// ==========================================
// USER ROLES
// ==========================================

export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",

  SCHOOL_ADMIN: "SCHOOL_ADMIN",
  PRINCIPAL: "PRINCIPAL",
  ACCOUNTANT: "ACCOUNTANT",
  RECEPTIONIST: "RECEPTIONIST",
  LIBRARIAN: "LIBRARIAN",
  TRANSPORT_MANAGER: "TRANSPORT_MANAGER",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",

  PARENT: "PARENT",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;

export type UserRole =
  (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Platform-level roles

export const PLATFORM_ROLES = [
  USER_ROLES.SUPER_ADMIN,
] as const;

// School web-panel roles

export const SCHOOL_ROLES = [
  USER_ROLES.SCHOOL_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ACCOUNTANT,
  USER_ROLES.RECEPTIONIST,
  USER_ROLES.LIBRARIAN,
  USER_ROLES.TRANSPORT_MANAGER,
  USER_ROLES.INVENTORY_MANAGER,
] as const;

// Mobile application roles

export const MOBILE_ROLES = [
  USER_ROLES.PARENT,
  USER_ROLES.TEACHER,
  USER_ROLES.STUDENT,
] as const;

// ==========================================
// ACCOUNT STATUS
// ==========================================

export const ACCOUNT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING",
  BLOCKED: "BLOCKED",
} as const;

// ==========================================
// SCHOOL STATUS
// ==========================================

export const SCHOOL_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
} as const;

// ==========================================
// STUDENT STATUS
// ==========================================

export const STUDENT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  TRANSFERRED: "TRANSFERRED",
  GRADUATED: "GRADUATED",
  WITHDRAWN: "WITHDRAWN",
  SUSPENDED: "SUSPENDED",
} as const;

// ==========================================
// EMPLOYEE STATUS
// ==========================================

export const EMPLOYEE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ON_LEAVE: "ON_LEAVE",
  RESIGNED: "RESIGNED",
  TERMINATED: "TERMINATED",
} as const;

// ==========================================
// ADMISSION STATUS
// ==========================================

export const ADMISSION_STATUS = {
  ENQUIRY: "ENQUIRY",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  WAITLISTED: "WAITLISTED",
  WITHDRAWN: "WITHDRAWN",
  REGISTERED: "REGISTERED",
  APPLIED: "APPLIED",
  UNDER_REVIEW: "UNDER_REVIEW",
  DOCUMENTS_PENDING: "DOCUMENTS_PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  CONVERTED: "CONVERTED",
} as const;

// ==========================================
// ATTENDANCE STATUS
// ==========================================

export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
  HALF_DAY: "HALF_DAY",
  LEAVE: "LEAVE",
  HOLIDAY: "HOLIDAY",
} as const;

// ==========================================
// LEAVE STATUS
// ==========================================

export const LEAVE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

// ==========================================
// FEE STATUS
// ==========================================

export const FEE_STATUS = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;

// ==========================================
// PAYMENT STATUS
// ==========================================

export const PAYMENT_STATUS = {
  INITIATED: "INITIATED",
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;

// ==========================================
// PAYMENT METHODS
// ==========================================

export const PAYMENT_METHODS = {
  CASH: "CASH",
  UPI: "UPI",
  CARD: "CARD",
  NET_BANKING: "NET_BANKING",
  CHEQUE: "CHEQUE",
  BANK_TRANSFER: "BANK_TRANSFER",
  RAZORPAY: "RAZORPAY",
} as const;

// ==========================================
// EXAMINATION STATUS
// ==========================================

export const EXAM_STATUS = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  PUBLISHED: "PUBLISHED",
  CANCELLED: "CANCELLED",
} as const;

// ==========================================
// HOMEWORK STATUS
// ==========================================

export const HOMEWORK_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;

export const HOMEWORK_SUBMISSION_STATUS = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  LATE: "LATE",
  REVIEWED: "REVIEWED",
  RESUBMISSION_REQUIRED: "RESUBMISSION_REQUIRED",
} as const;

// ==========================================
// SUBSCRIPTION STATUS
// ==========================================

export const SUBSCRIPTION_STATUS = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  SUSPENDED: "SUSPENDED",
} as const;

// ==========================================
// NOTIFICATION STATUS
// ==========================================

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
} as const;

// ==========================================
// COMMON RECORD STATUS
// ==========================================

export const RECORD_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

// ==========================================
// GENDER
// ==========================================

export const GENDER = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;

// ==========================================
// DOCUMENT TYPES
// ==========================================

export const DOCUMENT_TYPES = {
  PROFILE_PHOTO: "PROFILE_PHOTO",
  STUDENT_PHOTO: "STUDENT_PHOTO",
  ID_PROOF: "ID_PROOF",
  ADDRESS_PROOF: "ADDRESS_PROOF",
  BIRTH_CERTIFICATE: "BIRTH_CERTIFICATE",
  TRANSFER_CERTIFICATE: "TRANSFER_CERTIFICATE",
  MARKSHEET: "MARKSHEET",
  OTHER: "OTHER",
} as const;

// ==========================================
// PAGINATION
// ==========================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// ==========================================
// FILE UPLOAD
// ==========================================

export const FILE_UPLOAD = {
  DEFAULT_MAX_SIZE: 10 * 1024 * 1024,

  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
} as const;

// ==========================================
// TOKEN TYPES
// ==========================================

export const TOKEN_TYPES = {
  ACCESS: "ACCESS",
  REFRESH: "REFRESH",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
} as const;

// ==========================================
// SORT ORDER
// ==========================================

export const SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

// ==========================================
// COMMON TYPE EXPORTS
// ==========================================

export type AccountStatus =
  (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export type SchoolStatus =
  (typeof SCHOOL_STATUS)[keyof typeof SCHOOL_STATUS];

export type StudentStatus =
  (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

export type EmployeeStatus =
  (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS];

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export type FeeStatus =
  (typeof FEE_STATUS)[keyof typeof FEE_STATUS];
