import { api } from "@/lib/api/client";

export interface CreateSchoolAdminPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  schoolId: string;
}

export const schoolAdminApi = {
  async create(payload: CreateSchoolAdminPayload) {
    const response = await api.post("/auth/create-school-admin", payload);
    return response.data;
  },
};
