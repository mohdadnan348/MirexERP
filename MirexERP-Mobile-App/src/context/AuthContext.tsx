import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@/types/auth";
import { authService } from "@/services/auth.service";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_KEY = "mirexerp_access_token";
const REFRESH_KEY = "mirexerp_refresh_token";
const USER_KEY = "mirexerp_user";

// Web uses AsyncStorage; Android/iOS use encrypted SecureStore.
const storage = {
  getItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key),

  setItem: (key: string, value: string) =>
    Platform.OS === "web"
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value),

  removeItem: (key: string) =>
    Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = async (result: {
    accessToken: string;
    refreshToken?: string;
    user: User;
  }) => {
    const tasks: Promise<void>[] = [
      storage.setItem(ACCESS_KEY, result.accessToken),
      storage.setItem(USER_KEY, JSON.stringify(result.user)),
    ];

    if (result.refreshToken) {
      tasks.push(storage.setItem(REFRESH_KEY, result.refreshToken));
    }

    await Promise.all(tasks);
  };

  const clearSession = async () => {
    await Promise.all([
      storage.removeItem(ACCESS_KEY),
      storage.removeItem(REFRESH_KEY),
      storage.removeItem(USER_KEY),
    ]);
  };

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const [savedUser, access, refresh] = await Promise.all([
          storage.getItem(USER_KEY),
          storage.getItem(ACCESS_KEY),
          storage.getItem(REFRESH_KEY),
        ]);

        if (!savedUser) return;

        if (access) {
          if (active) setUser(JSON.parse(savedUser) as User);
          return;
        }

        if (refresh) {
          const result = await authService.refresh(refresh);
          await persist(result);
          if (active) setUser(result.user);
        } else {
          await clearSession();
        }
      } catch {
        await clearSession();
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await persist(result);
    setUser(result.user);
  };

  const logout = async () => {
    const refresh = await storage.getItem(REFRESH_KEY);

    try {
      await authService.logout(refresh ?? undefined);
    } finally {
      await clearSession();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
