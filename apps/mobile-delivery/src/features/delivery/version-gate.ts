import Constants from "expo-constants";
import { Platform } from "react-native";

export type VersionGateResult =
  | { status: "ok" }
  | { status: "blocked"; currentVersionCode: number; minimumVersionCode: number; updateUrl: string };

export function deliveryVersionGate(): VersionGateResult {
  if (Platform.OS !== "android") return { status: "ok" };

  const minimumVersionCode = Number(process.env.EXPO_PUBLIC_DELIVERY_MIN_ANDROID_VERSION_CODE ?? 0);
  const currentVersionCode = Number(Constants.expoConfig?.android?.versionCode ?? 1);
  if (Number.isFinite(minimumVersionCode) && minimumVersionCode > currentVersionCode) {
    return {
      status: "blocked",
      currentVersionCode,
      minimumVersionCode,
      updateUrl: process.env.EXPO_PUBLIC_DELIVERY_UPDATE_URL?.trim() || "https://1handindia.com/delivery/register",
    };
  }

  return { status: "ok" };
}

