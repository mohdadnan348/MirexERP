import { api } from "./api/client";

export const subjectsService = {
  getMyTeacherAssignments: async () => {
    const response = await api.get("/subjects/teacher/my-assignments");
    return response.data?.data ?? response.data;
  },
  getMySyllabus: async () => {
    const response = await api.get("/subjects/teacher/my-syllabus");
    return response.data?.data ?? response.data;
  },
  getClassSubjectMappings: async (sessionId: string, classId: string) => {
    const response = await api.get("/subjects/class-mappings", { params: { sessionId, classId } });
    return response.data?.data ?? response.data;
  },
  getAvailableElectives: async (sessionId: string, classId: string) => {
    const response = await api.get("/subjects/electives/available", { params: { sessionId, classId } });
    return response.data?.data ?? response.data;
  },
};
