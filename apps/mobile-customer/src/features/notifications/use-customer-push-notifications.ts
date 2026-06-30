import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { MobileAuthHeaders } from "../../lib/api";
import { captureMobileException } from "../../lib/mobile-telemetry";
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
        await Notifications.setNotificationChannelAsync("customer-alerts", {
          importance: Notifications.AndroidImportance.HIGH,
          name: "Customer alerts",
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
      
      await registerCustomerPushToken(auth.authHeaders, payload);
      registeredTokenRef.current = { authHeaders: auth.authHeaders, token: pushToken };
      updateState("registered", setState);
    } catch (error) {
      captureMobileException(error, "customer-push-registration", { pushState: latestState });
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
