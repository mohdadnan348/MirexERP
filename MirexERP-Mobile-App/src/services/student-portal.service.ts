import { api } from "./api/client";
export const studentPortalService = {
  async dashboard() { return (await api.get("/student-portal/me/dashboard")).data.data; },
  async profile() { return (await api.get("/student-portal/me/profile")).data.data; },
  async attendance(params?: Record<string, unknown>) { return (await api.get("/student-portal/me/attendance", { params })).data.data; },
  async timetable(params?: Record<string, unknown>) { return (await api.get("/student-portal/me/timetable", { params })).data.data; },
  async homework(params?: Record<string, unknown>) { return (await api.get("/student-portal/me/homework", { params })).data.data; },
  async results(params?: Record<string, unknown>) { return (await api.get("/student-portal/me/results", { params })).data.data; },
  async fees(params?: Record<string, unknown>) { return (await api.get("/student-portal/me/fees", { params })).data.data; },
  async materials() { return (await api.get("/student-portal/me/materials")).data.data; },
};
