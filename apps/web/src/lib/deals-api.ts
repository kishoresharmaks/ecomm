import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { CategorySummary, ProductSummary, SellerSummary } from "./storefront-api";

export type DealStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type DealParticipationStatus = "ACCEPTED" | "DECLINED";
export type DealProductEnrollmentStatus = "ENROLLED" | "REMOVED";

export type DealParticipation = {
  id: string;
  dealId: string;
  sellerId: string;
  status: DealParticipationStatus;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  seller?: SellerSummary & {
    user?: { email?: string | null; fullName?: string | null } | null;
  };
};

export type DealProductEnrollment = {
  id: string;
  dealId: string;
  sellerId: string;
  productId: string;
  status: DealProductEnrollmentStatus;
  enrolledAt?: string | null;
  removedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  seller?: SellerSummary;
  product?: ProductSummary;
};

export type Deal = {
  id: string;
  title: string;
  description?: string | null;
  categoryId: string;
  category?: CategorySummary;
  discountBps: number;
  joinDeadline: string;
  startsAt: string;
  endsAt: string;
  status: DealStatus;
  maxSellers?: number | null;
  maxProducts?: number | null;
  publishedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    participations?: number;
    productEnrollments?: number;
    orderItems?: number;
  };
};

export type AdminDeal = Deal & {
  participations?: DealParticipation[];
  productEnrollments?: DealProductEnrollment[];
};

export type SellerDeal = Deal & {
  sellerParticipation?: DealParticipation | null;
  sellerEligibleProductCount?: number;
  sellerEnrolledProductCount?: number;
  participations?: DealParticipation[];
  productEnrollments?: DealProductEnrollment[];
  eligibleProducts?: ProductSummary[];
};

export type DealPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type DealPayload = {
  title: string;
  description?: string | null;
  categoryId: string;
  discountPercent?: number;
  discountBps?: number;
  joinDeadline: string;
  startsAt: string;
  endsAt: string;
  maxSellers?: number;
  maxProducts?: number;
};

export type DealDashboard = {
  deal: AdminDeal;
  metrics: {
    acceptedSellers: number;
    declinedSellers: number;
    enrolledProducts: number;
    orderCount: number;
    orderItemCount: number;
    revenuePaise: number;
    discountPaise: number;
  };
  recentOrderItems: Array<{
    id: string;
    productNameSnapshot: string;
    quantity: number;
    lineTotalPaise: number;
    dealDiscountPaise?: number | null;
    order?: { orderNumber: string; createdAt?: string } | null;
    seller?: SellerSummary | null;
    product?: ProductSummary | null;
  }>;
};

export function listAdminDeals(auth: IndihubAuthHeaders, query: { status?: DealStatus; page?: number; limit?: number } = {}) {
  return indihubFetch<DealPage<AdminDeal>>(`/api/admin/deals${queryString(query)}`, undefined, auth);
}

export function getAdminDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<AdminDeal>(`/api/admin/deals/${encodeURIComponent(dealId)}`, undefined, auth);
}

export function createAdminDeal(auth: IndihubAuthHeaders, payload: DealPayload) {
  return indihubFetch<AdminDeal>("/api/admin/deals", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function updateAdminDeal(auth: IndihubAuthHeaders, dealId: string, payload: Partial<DealPayload>) {
  return indihubFetch<AdminDeal>(`/api/admin/deals/${encodeURIComponent(dealId)}`, { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function publishAdminDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<AdminDeal>(`/api/admin/deals/${encodeURIComponent(dealId)}/publish`, { method: "POST" }, auth);
}

export function cancelAdminDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<AdminDeal>(`/api/admin/deals/${encodeURIComponent(dealId)}/cancel`, { method: "POST" }, auth);
}

export function getAdminDealDashboard(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<DealDashboard>(`/api/admin/deals/${encodeURIComponent(dealId)}/dashboard`, undefined, auth);
}

export function listSellerDeals(auth: IndihubAuthHeaders) {
  return indihubFetch<{ items: SellerDeal[] }>("/api/seller/deals", undefined, auth);
}

export function getSellerDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<SellerDeal>(`/api/seller/deals/${encodeURIComponent(dealId)}`, undefined, auth);
}

export function acceptSellerDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<DealParticipation>(`/api/seller/deals/${encodeURIComponent(dealId)}/accept`, { method: "POST" }, auth);
}

export function declineSellerDeal(auth: IndihubAuthHeaders, dealId: string) {
  return indihubFetch<DealParticipation>(`/api/seller/deals/${encodeURIComponent(dealId)}/decline`, { method: "POST" }, auth);
}

export function enrollSellerDealProducts(auth: IndihubAuthHeaders, dealId: string, productIds: string[]) {
  return indihubFetch<{ items: DealProductEnrollment[] }>(
    `/api/seller/deals/${encodeURIComponent(dealId)}/products`,
    { method: "POST", body: JSON.stringify({ productIds }) },
    auth,
  );
}

export function removeSellerDealProduct(auth: IndihubAuthHeaders, dealId: string, productId: string) {
  return indihubFetch<DealProductEnrollment>(
    `/api/seller/deals/${encodeURIComponent(dealId)}/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
    auth,
  );
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params.toString()}` : "";
}
