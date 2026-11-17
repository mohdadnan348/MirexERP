import { api } from "./api/client";
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;
export async function getAcademicCalendar(from?: string, to?: string) {
  return unwrap(await api.get("/events/calendar", { params: { from, to } }));
}
