import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MobileAuthHeaders } from "../../lib/api";
import { captureMobileError } from "../../lib/mobile-telemetry";
import { registerDeliveryPushToken, revokeDeliveryPushToken } from "./delivery-push-api";

export type DeliveryPushPermissionState =
  | "checking"
  | "registered"
  | "permission-denied"
  | "device-unsupported"
  | "expo-go-unsupported"
  | "unavailable";

let latestState: DeliveryPushPermissionState = "checking";
let latestRefresh: (() => void) | null = null;
let latestRevoke: (() => Promise<void>) | null = null;
const subscribers = new Set<() => void>();

type DeliveryPushPayload = {
  kind?: unknown;
  orderNumber?: unknown;
  requestNumber?: unknown;
};

type RegisteredDeliveryPushToken = {
  authHeaders: MobileAuthHeaders;
  token: string;
};

const canUseNativePush = Constants.appOwnership !== "expo";

if (canUseNativePush) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function useDeliveryPushNotifications(auth: {
  authHeaders: MobileAuthHeaders;
  authKey: string;
  enabled: boolean;
}) {
  const [state, setState] = useState<DeliveryPushPermissionState>("checking");
  const registeredTokenRef = useRef<RegisteredDeliveryPushToken | null>(null);
  // Clerk rotates the bearer token roughly every minute, which gives
  // auth.authHeaders a new identity on each rotation. Registration must key
  // off authKey (the signed-in user), not the headers object, or every
  // rotation re-runs the whole permission + register round trip.
  const authHeadersRef = useRef(auth.authHeaders);

  useEffect(() => {
    authHeadersRef.current = auth.authHeaders;
  }, [auth.authHeaders]);

  const revokeRegisteredToken = useCallback(async (record?: RegisteredDeliveryPushToken | null) => {
    const target = record ?? registeredTokenRef.current;
    if (!target) return;
    const revoked = await revokeDeliveryPushToken(target.authHeaders, target.token)
      .then(() => true)
      .catch(() => false);
    // Keep the record when the revoke request fails so a later attempt can
    // retry it instead of leaving the token registered forever.
    if (revoked && registeredTokenRef.current?.token === target.token) {
      registeredTokenRef.current = null;
    }
  }, []);

  const register = useCallback(async () => {
    if (!auth.enabled) {
      updateState("checking", setState);
      return;
    }
    if (!canUseNativePush) {
      updateState("expo-go-unsupported", setState);
      return;
    }
    if (!Device.isDevice) {
      updateState("device-unsupported", setState);
      return;
    }

    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("delivery-alerts", {
          importance: Notifications.AndroidImportance.HIGH,
          name: "Delivery alerts",
        });
      }

      const existingPermission = await Notifications.getPermissionsAsync();
      const finalPermission =
        existingPermission.status === "granted"
          ? existingPermission
          : await Notifications.requestPermissionsAsync();

      if (finalPermission.status !== "granted") {
        await revokeRegisteredToken();
        updateState("permission-denied", setState);
        return;
      }

      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      const pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      const payload: {
        appVersion?: string;
        deviceId?: string;
        platform: "android" | "ios";
        token: string;
      } = {
        platform: Platform.OS === "ios" ? "ios" : "android",
        token: pushToken,
      };
      if (Constants.expoConfig?.version) {
        payload.appVersion = Constants.expoConfig.version;
      }
      const deviceId = Device.osInternalBuildId ?? Device.modelId;
      if (deviceId) {
        payload.deviceId = deviceId;
      }

      const previousToken = registeredTokenRef.current;
      if (previousToken && previousToken.token !== pushToken) {
        await revokeRegisteredToken(previousToken);
      }

      const authHeaders = authHeadersRef.current;
      await registerDeliveryPushToken(authHeaders, payload);
      // Store headers without onUnauthorized: a 401 during a best-effort
      // revoke must not re-trigger the forced sign-out flow (which itself
      // revokes) and recurse.
      registeredTokenRef.current = {
        authHeaders: {
          ...(authHeaders.bearerToken !== undefined ? { bearerToken: authHeaders.bearerToken } : {}),
          ...(authHeaders.getBearerToken ? { getBearerToken: authHeaders.getBearerToken } : {}),
        },
        token: pushToken,
      };
      updateState("registered", setState);
    } catch (error) {
      captureMobileError(error, "delivery-push-registration");
      updateState("unavailable", setState);
    }
  }, [auth.authKey, auth.enabled, revokeRegisteredToken]);

  useEffect(() => {
    const refresh = () => void register();
    const revoke = () => revokeRegisteredToken();
    latestRefresh = refresh;
    latestRevoke = revoke;
    void register();
    return () => {
      if (latestRefresh === refresh) {
        latestRefresh = null;
      }
      if (latestRevoke === revoke) {
        latestRevoke = null;
      }
    };
  }, [register, revokeRegisteredToken]);

  useEffect(() => {
    if (!canUseNativePush) {
      return undefined;
    }
    const received = Notifications.addNotificationReceivedListener(() => undefined);
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      openDeliveryNotification(event.notification.request.content.data as DeliveryPushPayload);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((event) => {
        if (event) {
          openDeliveryNotification(event.notification.request.content.data as DeliveryPushPayload);
        }
      })
      .catch(() => null);

    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  return { refresh: register, state };
}

export function useDeliveryPushNotificationStatus() {
  const [state, setState] = useState(latestState);

  useEffect(() => {
    const notify = () => setState(latestState);
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return {
    refresh: () => latestRefresh?.(),
    revoke: () => latestRevoke?.(),
    state,
  };
}

/**
 * Best-effort revoke of the currently registered push token, callable from
 * outside React (e.g. sign-out paths). Resolves even when no registration
 * exists or the revoke request fails.
 */
export function revokeCurrentDeliveryPushToken(): Promise<void> {
  return latestRevoke?.().catch(() => undefined) ?? Promise.resolve();
}

function updateState(state: DeliveryPushPermissionState, setState: (state: DeliveryPushPermissionState) => void) {
  latestState = state;
  setState(state);
  subscribers.forEach((notify) => notify());
}

export function openDeliveryNotification(data: DeliveryPushPayload) {
  const kind = typeof data.kind === "string" ? data.kind : null;
  const orderNumber = typeof data.orderNumber === "string" ? data.orderNumber : null;
  const requestNumber = typeof data.requestNumber === "string" ? data.requestNumber : null;

  if (kind === "order" && orderNumber) {
    router.push(`/orders/${encodeURIComponent(orderNumber)}` as never);
    return;
  }
  if (kind === "return" && requestNumber) {
    router.push(`/returns/${encodeURIComponent(requestNumber)}` as never);
    return;
  }
  if (kind === "wallet") {
    router.push("/(tabs)/wallet" as never);
    return;
  }
  // Unknown or malformed payloads land on the dashboard rather than crashing.
  router.push("/(tabs)" as never);
}
