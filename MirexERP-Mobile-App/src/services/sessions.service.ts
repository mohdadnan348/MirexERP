import { api } from "./api/client";

export const sessionsService = {
  async getActive() {
    const response = await api.get("/sessions/active");
    return response.data.data;
  },
  async getAll(params?: Record<string, unknown>) {
    const response = await api.get("/sessions", { params });
    return response.data.data;
  },
};
