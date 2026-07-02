import { getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";

export type CustomerNotificationType = "DEAL_PUBLISHED" | "ORDER_PLACED" | "ORDER_DELIVERED" | "B2B_ENQUIRY_MESSAGE" | "SERVICE_BOOKING" | "CAMPAIGN";

export type CustomerNotification = {
  id: string;
  type: CustomerNotificationType;
  title: string;
  body: string;
  imageUrl?: string | null;
  href?: string | null;
  sourceType: string;
  sourceId: string;
  metadata?: unknown;
  readAt?: string | null;
  createdAt: string;
};

export type CustomerNotificationPage = {
  items: CustomerNotification[];
  limit: number;
  pageInfo: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

export type CustomerNotificationPreferences = {
  dealAlertsEnabled: boolean;
  marketingCampaignsEnabled: boolean;
};

export type RegisterCustomerPushTokenPayload = {
  appVersion?: string;
  deviceId?: string;
  platform: "android" | "ios";
  token: string;
};

export function registerCustomerPushToken(auth: MobileAuthHeaders, payload: RegisterCustomerPushTokenPayload) {
  return postJson<{ registered: boolean; tokenId: string }>({
    auth,
    body: payload,
    path: "/account/push-tokens",
  });
}

export function revokeCustomerPushToken(auth: MobileAuthHeaders, token: string) {
  return postJson<{ revoked: boolean }>({
    auth,
    body: { token },
    path: "/account/push-tokens/revoke",
  });
}

export function listCustomerNotifications(auth: MobileAuthHeaders, query: { cursor?: string | null; limit?: number } = {}) {
  return getJson<CustomerNotificationPage>({
    auth,
    path: "/account/notifications",
    searchParams: {
      cursor: query.cursor,
      limit: query.limit ?? 20,
    },
  });
}

export function getCustomerNotificationUnreadCount(auth: MobileAuthHeaders) {
  return getJson<{ count: number }>({
    auth,
    path: "/account/notifications/unread-count",
  });
}

export function markCustomerNotificationRead(auth: MobileAuthHeaders, notificationId: string) {
  return patchJson<CustomerNotification>({
    auth,
    path: `/account/notifications/${encodeURIComponent(notificationId)}/read`,
  });
}

export function markAllCustomerNotificationsRead(auth: MobileAuthHeaders) {
  return postJson<{ updated: number }>({
    auth,
    path: "/account/notifications/read-all",
  });
}

export function getCustomerNotificationPreferences(auth: MobileAuthHeaders) {
  return getJson<CustomerNotificationPreferences>({
    auth,
    path: "/account/notification-preferences",
  });
}

export function updateCustomerNotificationPreferences(
  auth: MobileAuthHeaders,
  payload: Partial<CustomerNotificationPreferences>,
) {
  return patchJson<CustomerNotificationPreferences>({
    auth,
    body: payload,
    path: "/account/notification-preferences",
  });
}
