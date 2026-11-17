import { api } from "./api/client";
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;
export async function getAnnouncements(params?: Record<string, unknown>) {
  const response = await api.get("/communication", { params: { status: "PUBLISHED", ...params } });
  const data = unwrap(response);
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}
export async function getNotificationPreferences() { return unwrap(await api.get("/communication/preferences/me")); }
export async function updateNotificationPreferences(values: Record<string, boolean>) { return unwrap(await api.patch("/communication/preferences/me", values)); }
