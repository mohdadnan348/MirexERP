import { api } from "./api/client";
import * as SecureStore from "expo-secure-store";
export const timetableService = {
  async getAll(params?: Record<string, unknown>) {
    const selectedChildId = await SecureStore.getItemAsync("mirexerp_selected_child_id");
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const requestParams = { date: localDate, ...(selectedChildId ? { childId: selectedChildId } : {}), ...params };
    const response = await api.get("/timetable/me", { params: requestParams });
    return response.data.data;
  },
};
