import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type SyncCurrentUserPayload = {
  email?: string;
  phone?: string;
  fullName?: string;
  defaultRole?: "CUSTOMER" | "SELLER" | "BUSINESS_BUYER" | "ADMIN";
};

export type SyncedAuthUser = {
  synced: true;
};

export function syncCurrentUser(auth: IndihubAuthHeaders, payload: SyncCurrentUserPayload) {
  return indihubFetch<SyncedAuthUser>(
    "/api/auth/sync-current-user",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}
