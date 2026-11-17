import { api } from "./api/client";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";

const dataOf = (response: any) => response?.data?.data;
export const homeworkService = {
  async getAll(params?: Record<string, unknown>) {
    const [userRaw, childId] = await Promise.all([SecureStore.getItemAsync("mirexerp_user"), SecureStore.getItemAsync("mirexerp_selected_child_id")]);
    const role = String(JSON.parse(userRaw || "{}")?.role || "").toUpperCase();
    const child = role === "PARENT" && childId ? { studentId: childId } : {};
    const response = await api.get("/homework", { params: { ...child, ...params } });
    return dataOf(response) || [];
  },
  async getLinkedChildren() {
    const response = await api.get("/parents/me/children");
    return dataOf(response) || [];
  },
  async getNotificationPreferences(role: string) {
    const path = role === "PARENT" ? "/parents/me/notification-preferences" : "/student-portal/me/notification-preferences";
    const response = await api.get(path);
    return dataOf(response);
  },
  async updateNotificationPreferences(role: string, enabled: boolean) {
    const path = role === "PARENT" ? "/parents/me/notification-preferences" : "/student-portal/me/notification-preferences";
    const payload = role === "PARENT" ? { homework: enabled } : { notificationsEnabled: enabled };
    const response = await api.patch(path, payload);
    return dataOf(response);
  },
  async getById(id: string, params?: Record<string, unknown>) {
    const response = await api.get(`/homework/${id}`, { params });
    return dataOf(response);
  },
  async getMySubmissions(params?: Record<string, unknown>) {
    const [userRaw, childId] = await Promise.all([SecureStore.getItemAsync("mirexerp_user"), SecureStore.getItemAsync("mirexerp_selected_child_id")]);
    const role = String(JSON.parse(userRaw || "{}")?.role || "").toUpperCase();
    const child = role === "PARENT" && childId ? { studentId: childId } : {};
    const response = await api.get("/homework/my-submissions", { params: { ...child, ...params } });
    return dataOf(response) || [];
  },
  async getSubmissions(id: string) {
    const response = await api.get(`/homework/${id}/submissions`, { params: { page: 1, limit: 100 } });
    return dataOf(response) || [];
  },
  async getPending(id: string) {
    const response = await api.get(`/homework/${id}/pending`);
    return dataOf(response);
  },
  async getSubmissionHistory(submissionId: string) {
    const response = await api.get(`/homework/submissions/${submissionId}/history`);
    return dataOf(response);
  },
  async evaluate(homeworkId: string, submissionId: string, payload: Record<string, unknown>) {
    const response = await api.patch(`/homework/${homeworkId}/submissions/${submissionId}/evaluate`, payload);
    return dataOf(response);
  },
  async downloadAttachment(url: string, name: string) {
    const token = await SecureStore.getItemAsync("mirexerp_access_token");
    if (!token) throw new Error("Please sign in again to download this attachment.");
    const relative = url.replace(/^\/api\/v1/, "");
    const fullUrl = `${api.defaults.baseURL || ""}${relative}`;
    const destination = `${FileSystem.cacheDirectory || ""}${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const result = await FileSystem.downloadAsync(fullUrl, destination, { headers: { Authorization: `Bearer ${token}` } });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { dialogTitle: name });
    return result.uri;
  },
  async submit(id: string, answer: string, studentId?: string, file?: { uri: string; name: string; mimeType?: string }) {
    const body = new FormData();
    if (answer.trim()) body.append("answer", answer);
    if (studentId) body.append("studentId", studentId);
    if (file) body.append("attachments", { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" } as any);
    const response = await api.post(`/homework/${id}/submit`, body, { headers: { "Content-Type": "multipart/form-data" } });
    return dataOf(response);
  },
  async create(payload: Record<string, unknown>, file?: { uri: string; name: string; mimeType?: string }) {
    const body = new FormData();
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (value === undefined || value === null) return;
      body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    });
    if (file) body.append("attachments", { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" } as any);
    const response = await api.post("/homework", body, { headers: { "Content-Type": "multipart/form-data" } });
    return dataOf(response);
  },
};
