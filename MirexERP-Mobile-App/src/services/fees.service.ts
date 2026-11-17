import { api } from "./api/client";
import * as SecureStore from "expo-secure-store";
export const feesService = {
  async getAll(params?: Record<string, unknown>) {
    const [userRaw, childId] = await Promise.all([SecureStore.getItemAsync("mirexerp_user"), SecureStore.getItemAsync("mirexerp_selected_child_id")]);
    const role = String(JSON.parse(userRaw || "{}")?.role || "").toUpperCase();
    const child = role === "PARENT" && childId ? { studentId: childId } : {};
    const response = await api.get("/me/fees", { params: { ...child, ...params } });
    return response.data.data;
  },
};
