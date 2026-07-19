import { postJson, type MobileAuthHeaders } from "../../lib/api";

export function registerDeliveryPushToken(
  auth: MobileAuthHeaders,
  payload: { appVersion?: string; deviceId?: string; platform: "android" | "ios"; token: string },
) {
  return postJson<{ registered: boolean; tokenId: string }>({ path: "/delivery/push-tokens", auth, body: payload });
}

export function revokeDeliveryPushToken(auth: MobileAuthHeaders, token: string) {
  return postJson<{ revoked: boolean }>({ path: "/delivery/push-tokens/revoke", auth, body: { token } });
}
