import { api } from "@/lib/api/client";

export type SchoolStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "EXPIRED";
export type SchoolType = "PUBLIC" | "PRIVATE" | "GOVERNMENT" | "OTHER";

export interface School {
  _id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: {
    street?: string;
    area?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  contact: {
    phone: string;
    alternatePhone?: string;
    email: string;
    website?: string;
  };
  principal?: { name?: string; email?: string; phone?: string };
  affiliation?: { board?: string; affiliationNumber?: string; recognitionNumber?: string };
  schoolType: SchoolType;
  establishedYear?: number;
  status: SchoolStatus;
  isVerified: boolean;
  createdAt?: string;
}

export interface SchoolListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SchoolStatus | "";
  city?: string;
}

export interface SchoolListResult {
  schools: School[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSchoolPayload {
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: School["address"];
  contact: School["contact"];
  principal?: School["principal"];
  affiliation?: School["affiliation"];
  schoolType: SchoolType;
  establishedYear?: number;
}

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

function normalizeListResponse(response: unknown, requestedPage = 1, requestedLimit = 10): SchoolListResult {
  // Axios response.data contains the backend's API envelope.
  const axiosBody = (response as { data?: unknown })?.data ?? response;
  const body = axiosBody as ApiEnvelope<unknown> & Record<string, unknown>;

  // sendPaginatedSuccess commonly returns data as an array and pagination beside it.
  const rawData = body?.data ?? body;
  const dataObject = rawData as Record<string, unknown> | School[] | null;
  const schools = Array.isArray(rawData)
    ? rawData as School[]
    : Array.isArray((dataObject as Record<string, unknown>)?.schools)
      ? (dataObject as Record<string, unknown>).schools as School[]
      : Array.isArray((dataObject as Record<string, unknown>)?.items)
        ? (dataObject as Record<string, unknown>).items as School[]
        : [];

  const pagination = body?.pagination ?? body?.meta ??
    (!Array.isArray(dataObject) ? (dataObject as Record<string, unknown>)?.pagination as ApiEnvelope<unknown>["pagination"] : undefined);

  return {
    schools,
    total: pagination?.total ?? schools.length,
    page: pagination?.page ?? requestedPage,
    limit: pagination?.limit ?? requestedLimit,
    totalPages: Math.max(1, pagination?.totalPages ?? Math.ceil((pagination?.total ?? schools.length) / requestedLimit)),
  };
}

export const schoolsApi = {
  async list(params: SchoolListParams = {}): Promise<SchoolListResult> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const response = await api.get("/schools", {
      params: {
        page,
        limit,
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.city?.trim() ? { city: params.city.trim() } : {}),
      },
    });
    return normalizeListResponse(response, page, limit);
  },

  async getById(id: string): Promise<School> {
    const response = await api.get(`/schools/${id}`);
    const body = (response as { data?: unknown })?.data ?? response;
    const envelope = body as ApiEnvelope<School>;
    return (envelope?.data ?? body) as School;
  },

  async create(payload: CreateSchoolPayload): Promise<School> {
    const response = await api.post("/schools", payload);
    const body = (response as { data?: unknown })?.data ?? response;
    const envelope = body as ApiEnvelope<School>;
    return (envelope?.data ?? body) as School;
  },

  async update(id: string, payload: Partial<CreateSchoolPayload>): Promise<School> {
    const response = await api.patch(`/schools/${id}`, payload);
    const body = (response as { data?: unknown })?.data ?? response;
    const envelope = body as ApiEnvelope<School>;
    return (envelope?.data ?? body) as School;
  },

  async updateStatus(id: string, status: SchoolStatus): Promise<School> {
    const response = await api.patch(`/schools/${id}/status`, { status });
    const body = (response as { data?: unknown })?.data ?? response;
    const envelope = body as ApiEnvelope<School>;
    return (envelope?.data ?? body) as School;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/schools/${id}`);
  },
};

export function getSchoolsApiError(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };

  if (err.response?.status === 401) return "Your session has expired. Please log in again.";
  if (err.response?.status === 403) return "You do not have permission to manage schools. Sign in as Super Admin.";
  if (err.response?.status === 404) return "Schools API route was not found. Check the backend API mount path.";
  if (err.response?.status === 409) return err.response.data?.message || "A school with this code, slug or email already exists.";
  if (err.response?.status === 429) return "Too many requests. Please wait a moment before trying again.";
  return err.response?.data?.message || err.message || "Unable to connect to the Schools API.";
}
