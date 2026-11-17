import { api } from "./api/client";
import { LoginResult } from "@/types/auth";
export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    // The backend derives the account role from the authenticated user record.
    // Sending a client-selected role violates the strict login request schema.
    const response = await api.post("/auth/login", { email, password });
    return response.data.data as LoginResult;
  },
  async refresh(refreshToken: string): Promise<LoginResult> {
    const response = await api.post("/auth/refresh-token", { refreshToken });
    return response.data.data as LoginResult;
  },
  async logout(refreshToken?: string): Promise<void> {
    // The backend logout contract requires the current refresh token.
    if (refreshToken) await api.post("/auth/logout", { refreshToken });
  }
};
