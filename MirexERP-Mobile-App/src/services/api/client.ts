import axios from "axios";
import * as SecureStore from "expo-secure-store";
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" }
});
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("mirexerp_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
