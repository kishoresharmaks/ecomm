/**
 * Mobile B2B Buyer API client.
 *
 * Mirrors web/src/lib/business-buyer-api.ts using mobile conventions from
 * src/lib/api.ts (getJson / postJson / patchJson / deleteNoContent).
 *
 * 5xx retry policy: each function that mutates state retries once after 2 s on
 * a 5xx response before re-throwing. Read-only GET calls do not auto-retry —
 * callers use react-query's retry mechanism for reads.
 */

import {
  apiBaseUrl,
  deleteNoContent,
  getJson,
  MobileApiError,
  patchJson,
  postJson,
  type MobileAuthHeaders,
} from "./api";
import type {
  BusinessBuyerProfile,
  BusinessBuyerProfilePayload,
  BusinessBuyerAddress,
  BusinessBuyerAddressPayload,
  BusinessBuyerEnquiry,
  BusinessBuyerEnquiryPayload,
  BusinessBuyerPurchaseOrderPayload,
  B2BOrder,
  PaginatedB2BEnquiries,
  PaginatedB2BOrders,
  POUploadRequestPayload,
  POUploadRequestResponse,
  PODocumentAccessResponse,
} from "../features/b2b/b2b-types";
import type { MobileProductListResponse } from "../features/storefront/storefront-api";
import type { MobileStore } from "../types/mobile-home";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params.toString()}` : "";
}

/** Retry a mutation once after 2 s on 5xx. Re-throws on second failure. */
async function withServerRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof MobileApiError && error.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fn();
    }
    throw error;
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getB2BProfile(auth: MobileAuthHeaders): Promise<BusinessBuyerProfile> {
  return getJson({ path: "/b2b/profile", auth });
}

export function upsertB2BProfile(
  auth: MobileAuthHeaders,
  payload: BusinessBuyerProfilePayload,
): Promise<BusinessBuyerProfile> {
  return withServerRetry(() =>
    fetch(`${apiBaseUrl()}/b2b/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(auth.bearerToken ? { Authorization: `Bearer ${auth.bearerToken}` } : {}),
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = "Could not save business profile.";
        try {
          const parsed = JSON.parse(text) as { message?: unknown };
          if (typeof parsed.message === "string") message = parsed.message;
          else if (Array.isArray(parsed.message)) message = parsed.message.join(", ");
        } catch {
          // ignore parsing error
        }
        throw new MobileApiError(message, res.status);
      }
      return res.json() as Promise<BusinessBuyerProfile>;
    }),
  );
}

// ─── Addresses ────────────────────────────────────────────────────────────────

export function listB2BAddresses(auth: MobileAuthHeaders): Promise<BusinessBuyerAddress[]> {
  return getJson({ path: "/b2b/addresses", auth });
}

export function createB2BAddress(
  auth: MobileAuthHeaders,
  payload: BusinessBuyerAddressPayload,
): Promise<BusinessBuyerAddress> {
  return withServerRetry(() => postJson({ path: "/b2b/addresses", auth, body: payload }));
}

export function updateB2BAddress(
  auth: MobileAuthHeaders,
  addressId: string,
  payload: Partial<BusinessBuyerAddressPayload>,
): Promise<BusinessBuyerAddress> {
  return withServerRetry(() =>
    patchJson({ path: `/b2b/addresses/${encodeURIComponent(addressId)}`, auth, body: payload }),
  );
}

export function deleteB2BAddress(auth: MobileAuthHeaders, addressId: string): Promise<void> {
  return withServerRetry(() =>
    deleteNoContent({ path: `/b2b/addresses/${encodeURIComponent(addressId)}`, auth }),
  );
}

// ─── Enquiries ────────────────────────────────────────────────────────────────

export function listB2BEnquiries(
  auth: MobileAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {},
): Promise<PaginatedB2BEnquiries> {
  return getJson({ path: `/b2b/enquiries${queryString(query)}`, auth });
}

export function createB2BEnquiry(
  auth: MobileAuthHeaders,
  payload: BusinessBuyerEnquiryPayload,
): Promise<BusinessBuyerEnquiry> {
  return withServerRetry(() => postJson({ path: "/b2b/enquiries", auth, body: payload }));
}

export function getB2BEnquiry(
  auth: MobileAuthHeaders,
  enquiryId: string,
): Promise<BusinessBuyerEnquiry> {
  return getJson({ path: `/b2b/enquiries/${encodeURIComponent(enquiryId)}`, auth });
}

export function cancelB2BEnquiry(
  auth: MobileAuthHeaders,
  enquiryId: string,
): Promise<BusinessBuyerEnquiry> {
  return withServerRetry(() =>
    patchJson({ path: `/b2b/enquiries/${encodeURIComponent(enquiryId)}/cancel`, auth }),
  );
}

export function confirmB2BEnquiry(
  auth: MobileAuthHeaders,
  enquiryId: string,
): Promise<BusinessBuyerEnquiry> {
  return withServerRetry(() =>
    patchJson({ path: `/b2b/enquiries/${encodeURIComponent(enquiryId)}/confirm`, auth }),
  );
}

// ─── B2B Orders ───────────────────────────────────────────────────────────────

export function listB2BOrders(
  auth: MobileAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {},
): Promise<PaginatedB2BOrders> {
  return getJson({ path: `/b2b/orders${queryString(query)}`, auth });
}

export function getB2BOrder(auth: MobileAuthHeaders, orderNumber: string): Promise<B2BOrder> {
  return getJson({ path: `/b2b/orders/${encodeURIComponent(orderNumber)}`, auth });
}

// ─── Purchase Order Upload ─────────────────────────────────────────────────────

export function createPOUploadRequest(
  auth: MobileAuthHeaders,
  orderNumber: string,
  payload: POUploadRequestPayload,
): Promise<POUploadRequestResponse> {
  return withServerRetry(() =>
    postJson({
      path: `/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/upload-request`,
      auth,
      body: payload,
    }),
  );
}

/**
 * Multipart fallback upload. Used when presignedUrl is absent.
 * Returns the assetKey from the server.
 */
export async function uploadPOMultipart(
  auth: MobileAuthHeaders,
  orderNumber: string,
  fileUri: string,
  mimeType: string,
  fileName: string,
): Promise<{ assetKey: string }> {
  const formData = new FormData();
  formData.append("file", { uri: fileUri, type: mimeType, name: fileName } as unknown as Blob);

  const bearerToken = auth.bearerToken;
  const url = `${apiBaseUrl()}/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/upload`;

  const doUpload = async (): Promise<{ assetKey: string }> => {
    const res = await fetch(url, {
      method: "POST",
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = "Upload failed.";
      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        if (typeof parsed.message === "string") message = parsed.message;
      } catch {
        // ignore parsing error
      }
      throw new MobileApiError(message, res.status);
    }
    return res.json() as Promise<{ assetKey: string }>;
  };

  return withServerRetry(doUpload);
}

export function submitPurchaseOrder(
  auth: MobileAuthHeaders,
  orderNumber: string,
  payload: BusinessBuyerPurchaseOrderPayload,
): Promise<B2BOrder> {
  return withServerRetry(() =>
    patchJson({
      path: `/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order`,
      auth,
      body: payload,
    }),
  );
}

// ─── PO Document Access ───────────────────────────────────────────────────────

export function getPODocumentAccess(
  auth: MobileAuthHeaders,
  orderNumber: string,
): Promise<PODocumentAccessResponse> {
  return getJson({
    path: `/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/document-access`,
    auth,
  });
}

// ─── Enquiry Picker Helpers (public endpoints, no auth required) ──────────────

/**
 * Search approved products for the new-enquiry product picker.
 * Uses the public GET /products endpoint — same as the storefront product list.
 */
export function searchB2BProducts(search: string, limit = 20): Promise<MobileProductListResponse> {
  return getJson<MobileProductListResponse>({
    path: "/products",
    searchParams: { search: search.trim(), limit, approvalStatus: "APPROVED" },
  });
}

/**
 * Search approved sellers/stores for the new-enquiry seller picker.
 * Uses the public GET /sellers endpoint — same as the storefront stores list.
 */
export function searchB2BStores(search: string, limit = 20): Promise<MobileStore[]> {
  return getJson<MobileStore[]>({
    path: "/sellers",
    searchParams: { search: search.trim(), limit },
  });
}
