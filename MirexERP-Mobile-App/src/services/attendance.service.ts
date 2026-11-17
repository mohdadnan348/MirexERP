import { api } from "./api/client";
import * as SecureStore from "expo-secure-store";
const portalContext = async () => {
  const [userRaw, childId] = await Promise.all([SecureStore.getItemAsync("mirexerp_user"), SecureStore.getItemAsync("mirexerp_selected_child_id")]);
  const role = String(JSON.parse(userRaw || "{}")?.role || "").toUpperCase();
  return { role, params: role === "PARENT" && childId ? { studentId: childId } : {} };
};
export const attendanceService = {
  async getAll(params?: Record<string, unknown>) {
    const context = await portalContext();
    const path = ["PARENT","STUDENT"].includes(context.role) ? "/me/attendance" : "/attendance";
    const response = await api.get(path, { params: { ...context.params, ...params } });
    return response.data.data;
  },
  async getSummary(params: Record<string, unknown>) {
    const context = await portalContext();
    if (["PARENT","STUDENT"].includes(context.role)) {
      const rows = await this.getAll(params);
      const records = Array.isArray(rows) ? rows : rows?.records || [];
      const totals = records.reduce((acc: any, item: any) => { const key=String(item.status||"").toUpperCase(); acc[key]=(acc[key]||0)+1; return acc; }, {});
      return { totals, records: records.length };
    }
    const response = await api.get("/attendance/summary", { params });
    return response.data.data;
  },
  async markBulk(payload: Record<string, unknown>) { const response = await api.post("/attendance/bulk", payload); return response.data.data; },
  async requestCorrection(attendanceId: string, payload: { requestedStatus: string; reason: string }) { const response = await api.post(`/attendance/${attendanceId}/corrections`, payload); return response.data.data; },
  async getCorrections(decision?: string) { const response = await api.get("/attendance/corrections", { params: decision ? { decision } : {} }); return response.data.data; },
};
