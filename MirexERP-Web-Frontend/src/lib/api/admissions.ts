import { api } from "@/lib/api/client";

export type AdmissionStatus =
  | "ENQUIRY" | "DRAFT" | "SUBMITTED" | "APPLIED" | "UNDER_REVIEW" | "DOCUMENTS_PENDING" | "VERIFIED" | "APPROVED" | "WAITLISTED"
  | "REJECTED" | "WITHDRAWN" | "CANCELLED" | "CONVERTED" | "REGISTERED";

export type GuardianPayload = {
  name: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  alternatePhone?: string;
  email?: string;
  occupation?: string;
  isPrimaryContact: boolean;
};

export type AdmissionPayload = {
  sessionId?: string;
  applicationNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  motherTongue?: string;
  email?: string;
  phone?: string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  guardians?: GuardianPayload[];
  appliedClassId?: string;
  appliedSectionId?: string;
  previousSchool?: string;
  previousClass?: string;
  previousBoard?: string;
  previousSchoolTcNumber?: string;
  parentDeclaration?: boolean;
};

export type Admission = {
  _id: string;
  applicationNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  motherTongue?: string;
  email?: string;
  phone?: string;
  address: NonNullable<AdmissionPayload["address"]>;
  guardians: GuardianPayload[];
  sessionId: any;
  appliedClassId: any;
  appliedSectionId?: any;
  previousSchool?: string;
  previousClass?: string;
  previousBoard?: string;
  previousSchoolTcNumber?: string;
  parentDeclaration?: boolean;
  status: AdmissionStatus;
  applicationDate?: string;
  createdAt?: string;
  reviewRemarks?: string;
  rejectionReason?: string;
  convertedStudentId?: any;
  followUps?: { _id?: string; note: string; outcome?: string; followUpDate: string; nextFollowUpDate?: string }[];
  documents?: any[];
  statusHistory?: any[];
};

export type AdmissionSummary = {
  total: number;
  applied: number;
  underReview: number;
  documentsPending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  converted: number;
};
export type AdmissionListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  appliedClassId?: string;
  status?: AdmissionStatus;
  sortBy?: "createdAt" | "fullName" | "applicationDate" | "applicationNumber";
  sortOrder?: "asc" | "desc";
};

function unwrap<T>(response: any): T {
  let value = response?.data ?? response;
  if (value && typeof value === "object" && "data" in value) value = value.data ?? value;
  return value as T;
}
function normalizeList(response: any) {
  const root = response?.data ?? response;
  const data = root?.data ?? root;
  const admissions = Array.isArray(data) ? data : data?.admissions ?? data?.items ?? [];
  const pagination = data?.pagination ?? root?.pagination ?? {
    total: admissions.length, totalPages: 1,
  };
  return { admissions: admissions as Admission[], pagination };
}
export const admissionsApi = {
  async list(params: AdmissionListParams = {}) {
    const response = await api.get("/admissions", { params });
    return normalizeList(response);
  },
  async summary(sessionId?: string) {
    const response = await api.get("/admissions/summary", {
      params: sessionId ? { sessionId } : {},
    });
    return unwrap<AdmissionSummary>(response);
  },
  async getById(id: string) {
    const response = await api.get(`/admissions/${id}`);
    return unwrap<Admission>(response);
  },
  async create(payload: AdmissionPayload) {
    const response = await api.post("/admissions", payload);
    return unwrap<Admission>(response);
  },
  async update(id: string, payload: AdmissionPayload) {
    const response = await api.patch(`/admissions/${id}`, payload);
    return unwrap<Admission>(response);
  },
  async review(id: string, payload: { reviewRemarks?: string; documentsVerified?: boolean }) {
    const response = await api.patch(`/admissions/${id}/review`, payload);
    return unwrap<Admission>(response);
  },
  async approve(id: string, payload: { remarks?: string } = {}) {
    const response = await api.patch(`/admissions/${id}/approve`, payload);
    return unwrap<any>(response);
  },
  async register(id:string,payload:{admissionDate:string;appliedClassId:string;appliedSectionId?:string}) {
    const response=await api.post(`/admissions/${id}/register`,payload);
    return unwrap<any>(response);
  },
  async addFollowUp(id: string, payload: { note: string; outcome?: string; followUpDate?: string; nextFollowUpDate?: string }) {
    const response = await api.post(`/admissions/${id}/follow-ups`, payload);
    return unwrap<Admission>(response);
  },
  async reject(id: string, payload: { rejectionReason: string }) {
    const response = await api.patch(`/admissions/${id}/reject`, payload);
    return unwrap<Admission>(response);
  },
  async cancel(id: string, payload: { reason: string }) {
    const response = await api.patch(`/admissions/${id}/cancel`, payload);
    return unwrap<Admission>(response);
  },
  async remove(id: string) {
    const response = await api.delete(`/admissions/${id}`);
    return unwrap<{ message: string }>(response);
  },
};

export type Enquiry = {_id:string;childName:string;dateOfBirth?:string;classSought?:any;parentName:string;parentPhone:string;source:string;notes?:string;status:string;followUps:any[];createdAt:string};
export const admissionEnquiriesApi = {
 async list(params:any={}) { const r:any=await api.get("/admissions/enquiries",{params}); const root=r?.data??r; const data=root?.data??root; return {items:data?.items??data?.data??data??[],pagination:data?.pagination??root?.pagination}; },
 async create(payload:any) { const r=await api.post("/admissions/enquiries",payload); return unwrap<Enquiry>(r); },
 async update(id:string,payload:any) { const r=await api.patch(`/admissions/enquiries/${id}`,payload); return unwrap<Enquiry>(r); },
 async convert(id:string,payload:any) { const r=await api.post(`/admissions/enquiries/${id}/convert`,payload); return unwrap<Admission>(r); },
 async remove(id:string) { return api.delete(`/admissions/enquiries/${id}`); },
 async addFollowUp(id:string,payload:any) { return api.post(`/admissions/enquiries/${id}/follow-ups`,payload); },
 async updateFollowUp(id:string,followUpId:string,payload:any) { return api.patch(`/admissions/enquiries/${id}/follow-ups/${followUpId}`,payload); },
 async reports(params:any={}) { const r=await api.get("/admissions/reports",{params}); return unwrap<any>(r); },
 async followUps(bucket:string) { const r=await api.get("/admissions/follow-ups",{params:{bucket}}); return unwrap<any[]>(r); },
 async updateEnquiryFollowUp(id:string,followUpId:string,payload:any) { return api.patch(`/admissions/enquiries/${id}/follow-ups/${followUpId}`,payload); },
 async settings() { const r=await api.get("/admissions/settings"); return unwrap<any>(r); },
 async updateSettings(payload:any) { const r=await api.put("/admissions/settings",payload); return unwrap<any>(r); },
 async uploadDocument(id:string,file:File,documentType:string) { const form=new FormData(); form.append("document",file); form.append("documentType",documentType); return api.post(`/admissions/${id}/documents`,form,{headers:{"Content-Type":"multipart/form-data"}}); },
 async documents(id:string) { const r=await api.get(`/admissions/${id}/documents`); return unwrap<any[]>(r); },
};
