import { api } from "./api/client";
export const dashboardService = { async getOverview() { const response = await api.get("/dashboard/overview"); return response.data.data as Record<string, unknown>; } };
