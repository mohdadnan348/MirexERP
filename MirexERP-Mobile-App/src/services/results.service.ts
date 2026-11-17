import { api } from "./api/client";
import * as SecureStore from "expo-secure-store";
const childParams = async () => {
  const [userRaw, childId] = await Promise.all([SecureStore.getItemAsync("mirexerp_user"), SecureStore.getItemAsync("mirexerp_selected_child_id")]);
  const role = String(JSON.parse(userRaw || "{}")?.role || "").toUpperCase();
  return role === "PARENT" && childId ? { studentId: childId } : {};
};
export const resultsService = {
  async getAll(params?: Record<string, unknown>) {
    const response = await api.get("/me/results", { params: { ...(await childParams()), ...params } });
    return response.data.data;
  },
  async getSchedule(params?: Record<string, unknown>) {
    const response = await api.get("/me/exams", { params: { ...(await childParams()), ...params } });
    return response.data.data;
  },
};
