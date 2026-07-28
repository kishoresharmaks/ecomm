import * as Application from "expo-application";
import { Platform } from "react-native";

export type VersionGateResult =
  | { status: "ok" }
  | { status: "blocked"; currentVersionCode: number; minimumVersionCode: number; updateUrl: string };

export function deliveryVersionGate(): VersionGateResult {
  if (Platform.OS !== "android") return { status: "ok" };

  const minimumVersionCode = Number(process.env.EXPO_PUBLIC_DELIVERY_MIN_ANDROID_VERSION_CODE ?? 0);
  // nativeBuildVersion is the versionCode baked into the APK; expoConfig.android.versionCode
  // stays at its static value when EAS remote versioning auto-increments builds.
  const currentVersionCode = Number(Application.nativeBuildVersion ?? 0);
  if (
    Number.isFinite(minimumVersionCode) &&
    currentVersionCode > 0 &&
    minimumVersionCode > currentVersionCode
  ) {
    return {
      status: "blocked",
      currentVersionCode,
      minimumVersionCode,
      updateUrl: process.env.EXPO_PUBLIC_DELIVERY_UPDATE_URL?.trim() || "https://1handindia.com/delivery/register",
    };
  }

  return { status: "ok" };
}
