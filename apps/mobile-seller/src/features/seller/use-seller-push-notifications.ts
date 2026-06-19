import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MobileAuthHeaders } from "../../lib/api";
import { registerSellerPushToken, revokeSellerPushToken } from "./seller-api";

export type SellerPushPermissionState =
  | "checking"
  | "registered"
  | "permission-denied"
  | "device-unsupported"
  | "expo-go-unsupported"
  | "unavailable";

let latestState: SellerPushPermissionState = "checking";
let latestRefresh: (() => void) | null = null;
const subscribers = new Set<() => void>();

type SellerPushPayload = {
  enquiryId?: unknown;
  href?: unknown;
  orderNumber?: unknown;
};

type RegisteredSellerPushToken = {
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

export function useSellerPushNotifications(auth: { authHeaders: MobileAuthHeaders; enabled: boolean }) {
  const [state, setState] = useState<SellerPushPermissionState>("checking");
  const registeredTokenRef = useRef<RegisteredSellerPushToken | null>(null);

  const revokeRegisteredToken = useCallback(async (record?: RegisteredSellerPushToken | null) => {
    const target = record ?? registeredTokenRef.current;
    if (!target) {
      return;
    }
    if (registeredTokenRef.current?.token === target.token) {
      registeredTokenRef.current = null;
    }
    await revokeSellerPushToken(target.authHeaders, target.token).catch(() => null);
  }, []);

  const register = useCallback(async () => {
    if (!auth.enabled) {
      void revokeRegisteredToken();
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
        await Notifications.setNotificationChannelAsync("seller-alerts", {
          importance: Notifications.AndroidImportance.HIGH,
          name: "Seller alerts",
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
      const payload: { appVersion?: string; deviceId?: string; platform: "android" | "ios"; token: string } = {
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
      await registerSellerPushToken(auth.authHeaders, payload);
      registeredTokenRef.current = { authHeaders: auth.authHeaders, token: pushToken };
      updateState("registered", setState);
    } catch {
      updateState("unavailable", setState);
    }
  }, [auth.authHeaders, auth.enabled, revokeRegisteredToken]);

  useEffect(() => {
    const refresh = () => void register();
    latestRefresh = refresh;
    void register();
    return () => {
      if (latestRefresh === refresh) {
        latestRefresh = null;
      }
    };
  }, [register]);

  useEffect(() => {
    return () => {
      void revokeRegisteredToken();
    };
  }, [revokeRegisteredToken]);

  useEffect(() => {
    if (!canUseNativePush) {
      return undefined;
    }
    const received = Notifications.addNotificationReceivedListener(() => undefined);
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      openSellerNotification(event.notification.request.content.data as SellerPushPayload);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((event) => {
        if (event) {
          openSellerNotification(event.notification.request.content.data as SellerPushPayload);
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

export function useSellerPushNotificationStatus() {
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
    state,
  };
}

function updateState(state: SellerPushPermissionState, setState: (state: SellerPushPermissionState) => void) {
  latestState = state;
  setState(state);
  subscribers.forEach((notify) => notify());
}

export function openSellerNotification(data: SellerPushPayload) {
  const href = typeof data.href === "string" ? data.href : null;
  const orderNumber = typeof data.orderNumber === "string" ? data.orderNumber : null;
  const enquiryId = typeof data.enquiryId === "string" ? data.enquiryId : null;

  if (href?.startsWith("/orders/") || href?.startsWith("/b2b-enquiries/")) {
    router.push(href as never);
    return;
  }
  if (orderNumber) {
    router.push(`/orders/${encodeURIComponent(orderNumber)}` as never);
    return;
  }
  if (enquiryId) {
    router.push(`/b2b-enquiries/${encodeURIComponent(enquiryId)}` as never);
  }
}
