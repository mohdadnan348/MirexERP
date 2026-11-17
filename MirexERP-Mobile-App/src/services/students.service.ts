import { api } from "./api/client";
export const studentsService = {
  async getAll(params?: Record<string, unknown>) {
    const response = await api.get("/students", { params });
    return response.data.data;
  },
  async getMyLinkedChildren() {
    const response = await api.get("/students/my-children");
    return response.data.data;
  },
  async getMyTeachingAssignments() {
    const response = await api.get("/class-section/my-assignments");
    return response.data.data;
  },
};
