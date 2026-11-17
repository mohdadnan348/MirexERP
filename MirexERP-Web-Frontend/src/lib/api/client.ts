import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("mirexerp_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Super Admin may select a school for tenant-scoped operations.
    // Ordinary school users never control this header; the backend derives
    // their tenant exclusively from the verified access token.
    const user = (() => {
      try { return JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}"); }
      catch { return {}; }
    })();
    const selectedSchoolId = sessionStorage.getItem("mirexerp_selected_school_id");
    if (user?.role === "SUPER_ADMIN" && selectedSchoolId) {
      config.headers["X-School-Id"] = selectedSchoolId;
    } else if (config.headers["X-School-Id"]) {
      delete config.headers["X-School-Id"];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && typeof window !== "undefined") {
      const refreshToken = sessionStorage.getItem("mirexerp_refresh_token");
      if (refreshToken && !String(original.url || "").includes("/auth/refresh-token")) {
        original._retry = true;
        try {
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true }
          );
          const result = response.data?.data;
          if (result?.accessToken) {
            sessionStorage.setItem("mirexerp_access_token", result.accessToken);
            if (result.refreshToken) sessionStorage.setItem("mirexerp_refresh_token", result.refreshToken);
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${result.accessToken}`;
            return api(original);
          }
        } catch {
          sessionStorage.removeItem("mirexerp_access_token");
          sessionStorage.removeItem("mirexerp_refresh_token");
          sessionStorage.removeItem("mirexerp_user");
          window.location.assign("/login");
        }
      } else if (!refreshToken) {
        sessionStorage.removeItem("mirexerp_access_token");
        sessionStorage.removeItem("mirexerp_user");
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
