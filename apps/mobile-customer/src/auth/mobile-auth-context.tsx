import { useAuth, useUser } from "@clerk/clerk-expo";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MobileApiError, postNoContent, type MobileAuthHeaders } from "../lib/api";

export type MobileCustomerAuthStatus = "loading" | "signed-out" | "syncing" | "ready" | "error";

type MobileCustomerAuthContextValue = {
  authHeaders: MobileAuthHeaders;
  authKey: string;
  enabled: boolean;
  status: MobileCustomerAuthStatus;
  error?: string;
  userProfile: {
    email?: string;
    phone?: string;
    fullName?: string;
  };
  refresh: () => void;
};

const MobileCustomerAuthContext = createContext<MobileCustomerAuthContextValue | null>(null);

export function MobileCustomerAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: MobileCustomerAuthStatus; error?: string }>({
    status: "loading",
  });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const getTokenRef = useRef(getToken);
  const signOutRef = useRef(signOut);

  useEffect(() => {
    getTokenRef.current = getToken;
    signOutRef.current = signOut;
  }, [getToken, signOut]);

  const updateSyncState = useCallback((next: { status: MobileCustomerAuthStatus; error?: string }) => {
    if (!mountedRef.current) {
      return;
    }

    setSyncState((current) => {
      if (current.status === next.status && current.error === next.error) {
        return current;
      }

      return next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const readBearerToken = useCallback(
    async (options?: { skipCache?: boolean }) => {
      if (!isLoaded || !isSignedIn || !userId) {
        return null;
      }

      const token = await getTokenRef.current({ skipCache: Boolean(options?.skipCache) });
      if (token && mountedRef.current) {
        setBearerToken((current) => (current === token ? current : token));
      }
      return token;
    },
    [isLoaded, isSignedIn, userId],
  );

  const handleUnauthorized = useCallback(
    (_error: MobileApiError) => {
      if (!mountedRef.current) {
        return;
      }

      setBearerToken(null);
      updateSyncState({ status: "error", error: "Your session has expired. Please sign in again." });
      void signOutRef.current();
    },
    [updateSyncState],
  );

  const userProfile = useMemo(() => currentUserPayload(user), [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      if (!isLoaded) {
        updateSyncState({ status: "loading" });
        return;
      }

      if (!isSignedIn || !userId) {
        setBearerToken(null);
        lastSyncedSignatureRef.current = null;
        updateSyncState({ status: "signed-out" });
        return;
      }

      updateSyncState({ status: "syncing" });
      const token = await getTokenRef.current({ skipCache: refreshIndex > 0 });
      if (!token) {
        if (!cancelled) {
          setBearerToken(null);
          updateSyncState({ status: "error", error: "Your session has expired. Please sign in again." });
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
        updateSyncState({ status: "error", error: mobileAuthErrorMessage(error) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, refreshIndex, updateSyncState, userId]);

  useEffect(() => {
    let cancelled = false;

    async function syncCurrentCustomer() {
      if (!bearerToken || !isSignedIn || !userId) {
        return;
      }

      if (!isUserLoaded) {
        updateSyncState({ status: "syncing" });
        return;
      }

      if (!userProfile.email) {
        updateSyncState({ status: "error", error: "Your account needs an email address before it can be used here." });
        return;
      }

      const syncSignature = JSON.stringify({
        userId,
        refreshIndex,
        email: userProfile.email,
        phone: userProfile.phone ?? "",
        fullName: userProfile.fullName ?? "",
      });
      if (lastSyncedSignatureRef.current === syncSignature) {
        updateSyncState({ status: "ready" });
        return;
      }

      updateSyncState({ status: "syncing" });
      await postNoContent({
        path: "/auth/sync-current-user",
        auth: { bearerToken, getBearerToken: readBearerToken, onUnauthorized: handleUnauthorized },
        body: {
          email: userProfile.email,
          ...(userProfile.phone ? { phone: userProfile.phone } : {}),
          ...(userProfile.fullName ? { fullName: userProfile.fullName } : {}),
          defaultRole: "CUSTOMER",
        },
      });

      if (!cancelled) {
        lastSyncedSignatureRef.current = syncSignature;
        updateSyncState({ status: "ready" });
      }
    }

    void syncCurrentCustomer().catch((error) => {
      if (!cancelled) {
        updateSyncState({ status: "error", error: mobileAuthErrorMessage(error) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bearerToken, handleUnauthorized, isSignedIn, isUserLoaded, readBearerToken, refreshIndex, updateSyncState, userId, userProfile.email, userProfile.fullName, userProfile.phone]);

  const refresh = useCallback(() => setRefreshIndex((current) => current + 1), []);
  const value = useMemo<MobileCustomerAuthContextValue>(
    () => ({
      authHeaders:
        bearerToken && userId
          ? { bearerToken, getBearerToken: readBearerToken, onUnauthorized: handleUnauthorized }
          : {},
      authKey: userId ? `clerk:${userId}` : "clerk:anonymous",
      enabled: syncState.status === "ready" && Boolean(bearerToken),
      status: syncState.status,
      ...(syncState.error ? { error: syncState.error } : {}),
      userProfile,
      refresh,
    }),
    [bearerToken, handleUnauthorized, readBearerToken, refresh, syncState.error, syncState.status, userId, userProfile],
  );

  return <MobileCustomerAuthContext.Provider value={value}>{children}</MobileCustomerAuthContext.Provider>;
}

export function useMobileCustomerAuth() {
  const context = useContext(MobileCustomerAuthContext);
  if (!context) {
    throw new Error("useMobileCustomerAuth must be used inside MobileCustomerAuthProvider.");
  }

  return context;
}

export function mobileAuthErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.message;
  }

  if (error && typeof error === "object" && "errors" in error) {
    const clerkErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const firstMessage = clerkErrors?.[0]?.longMessage ?? clerkErrors?.[0]?.message;
    if (firstMessage) {
      return firstMessage;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function currentUserPayload(user: ReturnType<typeof useUser>["user"]) {
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const phone = normalizeIndianPhone(user?.primaryPhoneNumber?.phoneNumber ?? user?.phoneNumbers[0]?.phoneNumber);
  const fullName = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(fullName ? { fullName } : {}),
  };
}

function normalizeIndianPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;

  return /^[6-9]\d{9}$/.test(normalized) ? normalized : undefined;
}
