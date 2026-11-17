import { api } from "./api/client";
export const parentsService = {
  async getAll(params?: Record<string, unknown>) { return (await api.get("/parents", { params })).data.data; },
  async getMyChildren() { return (await api.get("/parents/me/children")).data.data; },
  async getMyProfile() { return (await api.get("/parents/me/profile")).data.data; },
  async getMyRequests() { return (await api.get("/parents/me/engagement")).data.data; },
  async createRequest(payload: { type: "FEEDBACK" | "COMPLAINT" | "MEETING"; studentId?: string; subject: string; message: string; category?: string; requestedAt?: string; requestedTime?: string }) {
    return (await api.post("/parents/me/engagement", payload)).data.data;
  },
};
