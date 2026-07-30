"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { adminCookieSessionMarker, indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

type AdminAuthUser = {
  id: string;
  email: string;
  roles: string[];
};

type AdminLoginResponse = {
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

const emptyState: AdminAuthState = {
  token: "",
  expiresAt: "",
  user: null
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(emptyState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const user = await indihubFetch<AdminAuthUser>("/api/admin/auth/me", undefined, {
          bearerToken: adminCookieSessionMarker,
        });
        if (cancelled) {
          return;
        }

        const nextState = {
          token: adminCookieSessionMarker,
          expiresAt: "",
          user
        };
        setState(nextState);
      } catch {
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
    const isAuthenticated = Boolean(isReady && state.token && state.user);
    const authHeaders = isAuthenticated
      ? { bearerToken: state.token, onUnauthorized: () => setState(emptyState) }
      : {};

    return {
      ...state,
      isReady,
      isAuthenticated,
      authHeaders,
      login: async (email, password) => {
        const response = await indihubFetch<AdminLoginResponse>("/api/admin/auth/login", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email, password })
        });
        const nextState = {
          token: adminCookieSessionMarker,
          expiresAt: response.expiresAt,
          user: response.user
        };
        setState(nextState);
      },
      changePassword: async (currentPassword, newPassword) => {
        await indihubFetch(
          "/api/admin/auth/change-password",
          {
            method: "POST",
            body: JSON.stringify({ currentPassword, newPassword }),
          },
          { bearerToken: adminCookieSessionMarker },
        );
      },
      logout: async () => {
        setState(emptyState);
        if (state.token) {
          try {
            await indihubFetch("/api/admin/auth/logout", { method: "POST" }, { bearerToken: adminCookieSessionMarker });
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
