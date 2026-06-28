import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { B2BOrder, B2BPaymentMethod, B2BPaymentProof, B2BProofStatus } from "./business-buyer-api";

export type AdminB2BPaymentProof = B2BPaymentProof & {
  submittedBy?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
  order: B2BOrder;
};

export type AdminB2BPaymentsPage = {
  items: AdminB2BPaymentProof[];
  total: number;
  page: number;
  limit: number;
};

export function listAdminB2BPaymentProofs(
  auth: IndihubAuthHeaders,
  query: {
    status?: B2BProofStatus | "";
    method?: B2BPaymentMethod | "";
    page?: number;
    limit?: number;
  } = {},
) {
  return indihubFetch<AdminB2BPaymentsPage>(
    `/api/admin/b2b-payments${queryString(query)}`,
    undefined,
    auth,
  );
}

export function verifyAdminB2BPaymentProof(
  auth: IndihubAuthHeaders,
  proofId: string,
  payload: { note?: string },
) {
  return indihubFetch<B2BOrder>(
    `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/verify`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function rejectAdminB2BPaymentProof(
  auth: IndihubAuthHeaders,
  proofId: string,
  payload: { rejectionReason: string },
) {
  return indihubFetch<B2BOrder>(
    `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.size ? `?${params.toString()}` : "";
}
