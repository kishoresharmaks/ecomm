"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { adminCookieSessionMarker, indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

export type AdminAuthUser = {
  id: string;
  email: string;
  roles: string[];
};

export type AdminLoginResult =
  | {
      mfaRequired: true;
      mfaTicket: string;
      mfaType: "TOTP" | "NONE";
    }
  | {
      mfaRequired: false;
      expiresAt: string;
      user: AdminAuthUser;
    };

export type AdminMfaStatus = {
  mfaEnabled: boolean;
  mfaType: "TOTP" | "NONE";
  remainingRecoveryCodes: number;
};

export type AdminMfaSetupResult = {
  secret: string;
  otpauthUri: string;
};

export type AdminMfaConfirmResult = {
  mfaEnabled: boolean;
  recoveryCodes: string[];
};

type AdminAuthState = {
  token: string;
  expiresAt: string;
  user: AdminAuthUser | null;
};

export type AdminAuthContextValue = AdminAuthState & {
  isReady: boolean;
  isAuthenticated: boolean;
  authHeaders: IndihubAuthHeaders;
  login: (email: string, password: string) => Promise<AdminLoginResult>;
  verifyMfa: (mfaTicket: string, code: string, isRecoveryCode?: boolean) => Promise<void>;
  setupMfa: () => Promise<AdminMfaSetupResult>;
  confirmMfa: (code: string, secret: string) => Promise<AdminMfaConfirmResult>;
  disableMfa: (password: string, code: string) => Promise<void>;
  regenerateRecoveryCodes: (password: string, code: string) => Promise<{ recoveryCodes: string[] }>;
  getMfaStatus: () => Promise<AdminMfaStatus>;
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
        const response = await indihubFetch<AdminLoginResult>("/api/admin/auth/login", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email, password })
        });
        if (!response.mfaRequired) {
          const nextState = {
            token: adminCookieSessionMarker,
            expiresAt: response.expiresAt,
            user: response.user
          };
          setState(nextState);
        }
        return response;
      },
      verifyMfa: async (mfaTicket, code, isRecoveryCode = false) => {
        const response = await indihubFetch<{ expiresAt: string; user: AdminAuthUser }>("/api/admin/auth/mfa/verify", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ mfaTicket, code, isRecoveryCode })
        });
        const nextState = {
          token: adminCookieSessionMarker,
          expiresAt: response.expiresAt,
          user: response.user
        };
        setState(nextState);
      },
      setupMfa: async () => {
        return indihubFetch<AdminMfaSetupResult>(
          "/api/admin/auth/mfa/setup",
          { method: "POST" },
          { bearerToken: adminCookieSessionMarker },
        );
      },
      confirmMfa: async (code, secret) => {
        return indihubFetch<AdminMfaConfirmResult>(
          "/api/admin/auth/mfa/confirm",
          {
            method: "POST",
            body: JSON.stringify({ code, secret }),
          },
          { bearerToken: adminCookieSessionMarker },
        );
      },
      disableMfa: async (password, code) => {
        await indihubFetch(
          "/api/admin/auth/mfa/disable",
          {
            method: "POST",
            body: JSON.stringify({ password, code }),
          },
          { bearerToken: adminCookieSessionMarker },
        );
      },
      regenerateRecoveryCodes: async (password, code) => {
        return indihubFetch<{ recoveryCodes: string[] }>(
          "/api/admin/auth/mfa/regenerate-recovery-codes",
          {
            method: "POST",
            body: JSON.stringify({ password, code }),
          },
          { bearerToken: adminCookieSessionMarker },
        );
      },
      getMfaStatus: async () => {
        return indihubFetch<AdminMfaStatus>(
          "/api/admin/auth/mfa/status",
          undefined,
          { bearerToken: adminCookieSessionMarker },
        );
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
        if (typeof document !== "undefined") {
          document.cookie = "indihub_seller_impersonation=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "indihub_seller_impersonation=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
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
