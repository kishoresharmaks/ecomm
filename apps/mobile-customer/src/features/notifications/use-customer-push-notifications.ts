import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MobileAuthHeaders } from "../../lib/api";
import { openCustomerNotification } from "./customer-notification-routing";
import { registerCustomerPushToken, revokeCustomerPushToken } from "./customer-notifications-api";

export type CustomerPushPermissionState =
  | "checking"
  | "registered"
  | "permission-denied"
  | "device-unsupported"
  | "expo-go-unsupported"
  | "unavailable";

let latestState: CustomerPushPermissionState = "checking";
let latestRefresh: (() => void) | null = null;
let latestRevoke: (() => Promise<void>) | null = null;
const subscribers = new Set<() => void>();

type RegisteredCustomerPushToken = {
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

export function useCustomerPushNotifications(auth: { authHeaders: MobileAuthHeaders; enabled: boolean }) {
  const [state, setState] = useState<CustomerPushPermissionState>("checking");
  const registeredTokenRef = useRef<RegisteredCustomerPushToken | null>(null);

  const revokeRegisteredToken = useCallback(async (record?: RegisteredCustomerPushToken | null) => {
    const target = record ?? registeredTokenRef.current;
    if (!target) return;
    if (registeredTokenRef.current?.token === target.token) {
      registeredTokenRef.current = null;
    }
    await revokeCustomerPushToken(target.authHeaders, target.token).catch(() => null);
  }, []);

  const register = useCallback(async () => {
    console.log("[Push Notifications] Starting registration...");
    if (!auth.enabled) {
      console.log("[Push Notifications] Auth not enabled, skipping registration");
      void revokeRegisteredToken();
      updateState("checking", setState);
      return;
    }
    if (!canUseNativePush) {
      console.log("[Push Notifications] Native push not available (Expo Go)");
      updateState("expo-go-unsupported", setState);
      return;
    }
    if (!Device.isDevice) {
      console.log("[Push Notifications] Not a physical device");
      updateState("device-unsupported", setState);
      return;
    }

    try {
      console.log("[Push Notifications] Setting up notification channel...");
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("customer-alerts", {
          importance: Notifications.AndroidImportance.HIGH,
          name: "Customer alerts",
        });
      }

      console.log("[Push Notifications] Checking permissions...");
      const existingPermission = await Notifications.getPermissionsAsync();
      console.log("[Push Notifications] Existing permission status:", existingPermission.status);
      
      const finalPermission =
        existingPermission.status === "granted"
          ? existingPermission
          : await Notifications.requestPermissionsAsync();
      
      console.log("[Push Notifications] Final permission status:", finalPermission.status);

      if (finalPermission.status !== "granted") {
        console.log("[Push Notifications] Permission denied, revoking any existing token");
        await revokeRegisteredToken();
        updateState("permission-denied", setState);
        return;
      }

      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      console.log("[Push Notifications] Getting Expo push token with projectId:", projectId);
      
      const pushToken = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      console.log("[Push Notifications] Got push token:", pushToken.substring(0, 20) + "...");
      
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
      console.log("[Push Notifications] Registering token with backend:", { platform: payload.platform, deviceId: payload.deviceId, appVersion: payload.appVersion });
      
      const previousToken = registeredTokenRef.current;
      if (previousToken && previousToken.token !== pushToken) {
        console.log("[Push Notifications] Revoking previous token");
        await revokeRegisteredToken(previousToken);
      }
      
      const result = await registerCustomerPushToken(auth.authHeaders, payload);
      console.log("[Push Notifications] Backend registration result:", result);
      
      registeredTokenRef.current = { authHeaders: auth.authHeaders, token: pushToken };
      updateState("registered", setState);
      console.log("[Push Notifications] Registration successful");
    } catch (error) {
      console.error("[Push Notifications] Registration failed:", error);
      updateState("unavailable", setState);
    }
  }, [auth.authHeaders, auth.enabled, revokeRegisteredToken]);

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
      openCustomerNotification(event.notification.request.content.data);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((event) => {
        if (event) {
          openCustomerNotification(event.notification.request.content.data);
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

export function useCustomerPushNotificationStatus() {
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

function updateState(state: CustomerPushPermissionState, setState: (state: CustomerPushPermissionState) => void) {
  latestState = state;
  setState(state);
  subscribers.forEach((notify) => notify());
}
