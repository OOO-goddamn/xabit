"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSWRConfig } from "swr";

import { api } from "@/lib/api";
import { unsubscribePush } from "@/lib/push";
import { clearToken, getToken, setToken } from "@/lib/session";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { mutate } = useSWRConfig();

  const resetCache = useCallback(() => {
    void mutate(() => true, undefined, { revalidate: false });
  }, [mutate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Defer the first update so the effect only synchronizes with an external system.
      await Promise.resolve();
      if (cancelled) {
        return;
      }

      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const current = await api.me();
        if (!cancelled) {
          setUser(current);
        }
      } catch {
        clearToken();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      resetCache();
    }

    window.addEventListener("habit:unauthorized", onUnauthorized);
    return () => window.removeEventListener("habit:unauthorized", onUnauthorized);
  }, [resetCache]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.login({ email, password });
      setToken(response.token);
      resetCache();
      setUser(response.user);
    },
    [resetCache],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const response = await api.register({ email, password, name });
      setToken(response.token);
      resetCache();
      setUser(response.user);
    },
    [resetCache],
  );

  const logout = useCallback(async () => {
    // Drop this device's push subscription while the token is still valid, so
    // reminders do not keep arriving after logout.
    try {
      await unsubscribePush();
    } catch {
      // The local subscription is cleared even if the server is unreachable.
    }
    try {
      await api.logout();
    } catch {
      // The local session is cleared even if the server is unreachable.
    }
    clearToken();
    resetCache();
    setUser(null);
  }, [resetCache]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
