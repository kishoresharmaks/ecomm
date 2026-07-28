"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { IndihubAuthHeaders } from "@/lib/api";

export type DevAuthRole = "admin" | "seller" | "customer" | "businessBuyer" | "deliveryPartner";

type DevAuthState = {
  role: DevAuthRole;
  userIds: Record<DevAuthRole, string>;
};

type DevAuthContextValue = DevAuthState & {
  activeUserId: string;
  setRole: (role: DevAuthRole) => void;
  setUserId: (role: DevAuthRole, userId: string) => void;
  authHeaders: IndihubAuthHeaders;
};

const storageKey = "indihub.devAuth.v1";

const defaultState: DevAuthState = {
  role: "admin",
  userIds: {
    admin: process.env.NEXT_PUBLIC_INDIHUB_DEV_ADMIN_USER_ID ?? "",
    seller: process.env.NEXT_PUBLIC_INDIHUB_DEV_SELLER_USER_ID ?? "",
    customer: process.env.NEXT_PUBLIC_INDIHUB_DEV_CUSTOMER_USER_ID ?? "",
    businessBuyer: process.env.NEXT_PUBLIC_INDIHUB_DEV_BUSINESS_BUYER_USER_ID ?? "",
    deliveryPartner: process.env.NEXT_PUBLIC_INDIHUB_DEV_DELIVERY_PARTNER_USER_ID ?? ""
  }
};

const DevAuthContext = createContext<DevAuthContextValue | null>(null);

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DevAuthState>(defaultState);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<DevAuthState>;
      setState({
        role: parsed.role ?? defaultState.role,
        userIds: {
          ...defaultState.userIds,
          ...parsed.userIds
        }
      });
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const value = useMemo<DevAuthContextValue>(() => {
    const activeUserId = state.userIds[state.role].trim();

    return {
      ...state,
      activeUserId,
      authHeaders: activeUserId ? { platformUserId: activeUserId } : {},
      setRole: (role) => setState((current) => ({ ...current, role })),
      setUserId: (role, userId) =>
        setState((current) => ({
          ...current,
          userIds: {
            ...current.userIds,
            [role]: userId
          }
        }))
    };
  }, [state]);

  return <DevAuthContext.Provider value={value}>{children}</DevAuthContext.Provider>;
}

export function useDevAuth() {
  const context = useContext(DevAuthContext);
  if (!context) {
    throw new Error("useDevAuth must be used inside DevAuthProvider.");
  }

  return context;
}
