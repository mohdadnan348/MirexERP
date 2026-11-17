import { api } from "./api/client";

export const employeesService = {
  async getMyProfile() { return (await api.get("/employees/my-profile")).data.data; },
  async getMyAssignments(employeeId: string) { return (await api.get(`/employees/${employeeId}/assignments`)).data.data; },
  async getMySubjectAssignments() { return (await api.get("/subjects/teacher/my-assignments")).data.data; },
};
