
import { Types } from "mongoose";
import { ISchool } from "./schools.model";
import { SchoolStatus } from "../../config/constants";

// School ID types
export type SchoolId = string | Types.ObjectId;

// School creation payload
export interface CreateSchoolDTO {
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: ISchool["address"];
  contact: ISchool["contact"];
  principal?: ISchool["principal"];
  affiliation?: ISchool["affiliation"];
  schoolType?: ISchool["schoolType"];
  establishedYear?: number;
}

// School update payload
export interface UpdateSchoolDTO {
  name?: string;
  code?: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: Partial<ISchool["address"]>;
  contact?: Partial<ISchool["contact"]>;
  principal?: ISchool["principal"];
  affiliation?: ISchool["affiliation"];
  branding?: ISchool["branding"];
  schoolType?: ISchool["schoolType"];
  establishedYear?: number;
  isVerified?: boolean;
}

// School status update payload
export interface UpdateSchoolStatusDTO {
  status: SchoolStatus;
}

// School list filters
export interface SchoolListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: SchoolStatus;
  city?: string;
}

// School pagination response
export interface SchoolPaginationResult {
  schools: ISchool[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// School creator/updater information
export interface SchoolAuditInfo {
  createdBy?: SchoolId | null;
  updatedBy?: SchoolId | null;
}

// School status summary
export interface SchoolStatusSummary {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  suspended: number;
  expired: number;
}

// School deletion response
export interface DeleteSchoolResult {
  schoolId: string;
  deletedAt: Date;
}

// School search result
export interface SchoolSearchResult {
  _id: Types.ObjectId;
  name: string;
  code: string;
  email: string;
  phone: string;
  status: SchoolStatus;
  address: ISchool["address"];
}
