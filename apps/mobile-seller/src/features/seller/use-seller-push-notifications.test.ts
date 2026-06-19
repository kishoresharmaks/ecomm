import { describe, expect, it, vi } from "vitest";
import { openSellerNotification } from "./use-seller-push-notifications";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  router: {
    push: pushMock,
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-constants", () => ({
  default: {
    easConfig: { projectId: "test-project-id" },
    expoConfig: { extra: { eas: { projectId: "test-project-id" } }, version: "1.0.0" },
  },
}));

vi.mock("expo-notifications", () => ({
  addNotificationReceivedListener: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  AndroidImportance: { HIGH: "high" },
  getExpoPushTokenAsync: vi.fn(),
  getLastNotificationResponseAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
}));

vi.mock("expo-device", () => ({
  isDevice: true,
  modelId: "device-model",
  osInternalBuildId: "device-build",
}));

describe("seller push notification routing", () => {
  it("opens seller order detail links", () => {
    openSellerNotification({ href: "/orders/ORD-1001" });
    expect(pushMock).toHaveBeenCalledWith("/orders/ORD-1001");
  });

  it("opens B2B enquiry detail fallback links", () => {
    openSellerNotification({ enquiryId: "enq_1" });
    expect(pushMock).toHaveBeenCalledWith("/b2b-enquiries/enq_1");
  });
});
