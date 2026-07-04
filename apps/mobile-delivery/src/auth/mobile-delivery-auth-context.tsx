import { useAuth, useUser } from "@clerk/clerk-expo";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MobileApiError, postNoContent, type MobileAuthHeaders } from "../lib/api";

export type MobileDeliveryAuthStatus = "loading" | "signed-out" | "syncing" | "ready" | "error";

type MobileDeliveryAuthContextValue = {
  authHeaders: MobileAuthHeaders;
  authKey: string;
  enabled: boolean;
  status: MobileDeliveryAuthStatus;
  error?: string;
  userProfile: {
    email?: string;
    phone?: string;
    fullName?: string;
  };
  refresh: () => void;
};

const MobileDeliveryAuthContext = createContext<MobileDeliveryAuthContextValue | null>(null);

export function MobileDeliveryAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ status: MobileDeliveryAuthStatus; error?: string }>({ status: "loading" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const getTokenRef = useRef(getToken);
  const signOutRef = useRef(signOut);

  useEffect(() => {
    getTokenRef.current = getToken;
    signOutRef.current = signOut;
  }, [getToken, signOut]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateSyncState = useCallback((next: { status: MobileDeliveryAuthStatus; error?: string }) => {
    if (!mountedRef.current) return;
    setSyncState((current) => (current.status === next.status && current.error === next.error ? current : next));
  }, []);

  const readBearerToken = useCallback(
    async (options?: { skipCache?: boolean }) => {
      if (!isLoaded || !isSignedIn || !userId) return null;
      const token = await getTokenRef.current({ skipCache: Boolean(options?.skipCache) });
      if (token && mountedRef.current) setBearerToken((current) => (current === token ? current : token));
      return token;
    },
    [isLoaded, isSignedIn, userId],
  );

  const handleUnauthorized = useCallback(
    (_error: MobileApiError) => {
      if (!mountedRef.current) return;
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

      if (!cancelled) setBearerToken(token);
    }

    void loadToken().catch((error) => {
      if (!cancelled) {
        setBearerToken(null);
        updateSyncState({ status: "error", error: mobileDeliveryAuthErrorMessage(error) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, refreshIndex, updateSyncState, userId]);

  useEffect(() => {
    let cancelled = false;

    async function syncCurrentUser() {
      if (!bearerToken || !isSignedIn || !userId) return;
      if (!isUserLoaded) {
        updateSyncState({ status: "syncing" });
        return;
      }
      if (!userProfile.email) {
        updateSyncState({ status: "error", error: "Your delivery partner account needs an email address." });
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

    void syncCurrentUser().catch((error) => {
      if (!cancelled) updateSyncState({ status: "error", error: mobileDeliveryAuthErrorMessage(error) });
    });

    return () => {
      cancelled = true;
    };
  }, [bearerToken, handleUnauthorized, isSignedIn, isUserLoaded, readBearerToken, refreshIndex, updateSyncState, userId, userProfile.email, userProfile.fullName, userProfile.phone]);

  const refresh = useCallback(() => setRefreshIndex((current) => current + 1), []);
  const value = useMemo<MobileDeliveryAuthContextValue>(
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

  return <MobileDeliveryAuthContext.Provider value={value}>{children}</MobileDeliveryAuthContext.Provider>;
}

export function useMobileDeliveryAuth() {
  const context = useContext(MobileDeliveryAuthContext);
  if (!context) throw new Error("useMobileDeliveryAuth must be used inside MobileDeliveryAuthProvider.");
  return context;
}

export function mobileDeliveryAuthErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) return error.message;
  if (error && typeof error === "object" && "errors" in error) {
    const clerkErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const firstMessage = clerkErrors?.[0]?.longMessage ?? clerkErrors?.[0]?.message;
    if (firstMessage) return firstMessage;
  }
  return error instanceof Error && error.message ? error.message : "Authentication failed. Please try again.";
}

function currentUserPayload(user: ReturnType<typeof useUser>["user"]) {
  const email = user?.primaryEmailAddress?.emailAddress;
  const phone = user?.primaryPhoneNumber?.phoneNumber;
  const fullName = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(fullName ? { fullName } : {}),
  };
}

