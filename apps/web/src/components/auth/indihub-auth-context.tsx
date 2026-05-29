"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useDevAuth } from "@/components/dev-auth/dev-auth-context";
import { syncCurrentUser } from "@/lib/auth-api";
import { userFacingApiErrorMessage, userSessionExpiredMessage, type IndihubAuthHeaders } from "@/lib/api";

export type CustomerAuthStatus = "signed-out" | "syncing" | "ready" | "error";

type CustomerAuthContextValue = {
  mode: "clerk" | "local";
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  enabled: boolean;
  status: CustomerAuthStatus;
  error?: string;
  userProfile?: {
    email?: string | undefined;
    phone?: string | undefined;
    fullName?: string | undefined;
  };
  refresh: () => void;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function LocalCustomerAuthProvider({ children }: { children: ReactNode }) {
  const devAuth = useDevAuth();
  const localAuthEnabled = process.env.NEXT_PUBLIC_INDIHUB_ENABLE_LOCAL_AUTH === "true";
  const platformUserId = localAuthEnabled ? devAuth.userIds.customer.trim() : "";
  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      mode: "local",
      authHeaders: platformUserId ? { platformUserId } : {},
      authKey: platformUserId ? `local:${platformUserId}` : "local:anonymous",
      enabled: Boolean(platformUserId),
      status: platformUserId ? "ready" : "signed-out",
      refresh: () => undefined
    }),
    [platformUserId]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function ClerkCustomerAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: CustomerAuthStatus; error?: string }>({ status: "syncing" });
  const [refreshIndex, setRefreshIndex] = useState(0);

  const readBearerToken = useCallback(
    async (options?: { skipCache?: boolean }) => {
      if (!isLoaded || !isSignedIn || !userId) {
        return null;
      }

      const token = await getToken({ skipCache: Boolean(options?.skipCache) });
      if (token) {
        setBearerToken((current) => (current === token ? current : token));
      }
      return token;
    },
    [getToken, isLoaded, isSignedIn, userId]
  );

  const handleUnauthorized = useCallback(() => {
    setBearerToken(null);
    setSyncState({ status: "error", error: userSessionExpiredMessage });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      if (!isLoaded) {
        setBearerToken(null);
        setSyncState({ status: "syncing" });
        return;
      }

      if (!isSignedIn || !userId) {
        setBearerToken(null);
        setSyncState({ status: "signed-out" });
        return;
      }

      setSyncState({ status: "syncing" });
      const token = await getToken({ skipCache: refreshIndex > 0 });
      if (!token) {
        if (!cancelled) {
          setBearerToken(null);
          setSyncState({ status: "error", error: userSessionExpiredMessage });
        }
        return;
      }

      if (!cancelled) {
        setBearerToken(token);
      }
    }

    void loadToken().catch((error) => {
      if (!cancelled) {
        setBearerToken(null);
        setSyncState({ status: "error", error: userFacingApiErrorMessage(error) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, refreshIndex, userId]);

  useEffect(() => {
    let cancelled = false;

    async function syncCustomer() {
      if (!bearerToken || !isSignedIn || !userId) {
        return;
      }

      if (!isUserLoaded) {
        setSyncState({ status: "syncing" });
        return;
      }

      const payload = currentUserPayload(user);
      if (!payload.email) {
        setSyncState({ status: "error", error: "Your account needs an email address before it can be used here." });
        return;
      }

      setSyncState({ status: "syncing" });
      await syncCurrentUser({ bearerToken, getBearerToken: readBearerToken, onUnauthorized: handleUnauthorized }, payload);

      if (!cancelled) {
        setSyncState({ status: "ready" });
      }
    }

    void syncCustomer().catch((error) => {
      if (!cancelled) {
        setSyncState({ status: "error", error: userFacingApiErrorMessage(error) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bearerToken, handleUnauthorized, isSignedIn, isUserLoaded, readBearerToken, refreshIndex, user, userId]);

  const refresh = useCallback(() => setRefreshIndex((current) => current + 1), []);
  const userProfile = useMemo(() => currentUserPayload(user), [user]);
  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      mode: "clerk",
      authHeaders: bearerToken ? { bearerToken, getBearerToken: readBearerToken, onUnauthorized: handleUnauthorized } : {},
      authKey: userId ? `clerk:${userId}` : "clerk:anonymous",
      enabled: syncState.status === "ready" && Boolean(bearerToken),
      status: syncState.status,
      ...(syncState.error ? { error: syncState.error } : {}),
      userProfile: {
        email: userProfile.email,
        phone: userProfile.phone,
        fullName: userProfile.fullName
      },
      refresh
    }),
    [bearerToken, handleUnauthorized, readBearerToken, refresh, syncState.error, syncState.status, userId, userProfile.email, userProfile.fullName, userProfile.phone]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used inside the app providers.");
  }

  return context;
}

function currentUserPayload(user: ReturnType<typeof useUser>["user"]) {
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const phone = normalizeIndianPhone(user?.primaryPhoneNumber?.phoneNumber ?? user?.phoneNumbers[0]?.phoneNumber);
  const fullName = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(fullName ? { fullName } : {}),
    defaultRole: "CUSTOMER" as const
  };
}

function normalizeIndianPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;

  return /^[6-9]\d{9}$/.test(normalized) ? normalized : undefined;
}
