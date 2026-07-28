"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

type AdminAuthUser = {
  id: string;
  email: string;
  roles: string[];
};

type AdminLoginResponse = {
  token: string;
  expiresAt: string;
  user: AdminAuthUser;
};

type AdminAuthState = {
  token: string;
  expiresAt: string;
  user: AdminAuthUser | null;
};

type AdminAuthContextValue = AdminAuthState & {
  isReady: boolean;
  isAuthenticated: boolean;
  authHeaders: IndihubAuthHeaders;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const storageKey = "indihub.adminAuth.v1";
const emptyState: AdminAuthState = {
  token: "",
  expiresAt: "",
  user: null
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(emptyState);
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as AdminAuthState;
        if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt) <= new Date()) {
          localStorage.removeItem(storageKey);
          return;
        }

        const user = await indihubFetch<AdminAuthUser>("/api/admin/auth/me", undefined, { bearerToken: parsed.token });
        if (cancelled) {
          return;
        }

        const nextState = {
          token: parsed.token,
          expiresAt: parsed.expiresAt,
          user
        };
        localStorage.setItem(storageKey, JSON.stringify(nextState));
        setState(nextState);
      } catch {
        localStorage.removeItem(storageKey);
        if (!cancelled) {
          setState(emptyState);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => {
    const isAuthenticated = Boolean(isReady && state.token && state.user && new Date(state.expiresAt) > new Date());
    const authHeaders = isAuthenticated ? { bearerToken: state.token } : {};

    return {
      ...state,
      isReady,
      isAuthenticated,
      authHeaders,
      login: async (email, password) => {
        const response = await indihubFetch<AdminLoginResponse>("/api/admin/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        const nextState = {
          token: response.token,
          expiresAt: response.expiresAt,
          user: response.user
        };
        localStorage.setItem(storageKey, JSON.stringify(nextState));
        setState(nextState);
      },
      changePassword: async (currentPassword, newPassword) => {
        await indihubFetch(
          "/api/admin/auth/change-password",
          {
            method: "POST",
            body: JSON.stringify({ currentPassword, newPassword }),
          },
          { bearerToken: state.token },
        );
      },
      logout: async () => {
        const token = state.token;
        setState(emptyState);
        localStorage.removeItem(storageKey);

        if (token) {
          try {
            await indihubFetch("/api/admin/auth/logout", { method: "POST" }, { bearerToken: token });
          } catch {
            // The browser session is already cleared; stale server sessions expire automatically.
          }
        }
      }
    };
  }, [isReady, state]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }

  return context;
}
