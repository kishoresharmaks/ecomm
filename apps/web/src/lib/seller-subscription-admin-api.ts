import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type {
  SellerProfile,
  SellerSubscriptionPlan,
  SellerSubscriptionPlanAudience,
  SellerSubscriptionStatus,
} from "./seller-api";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type SellerSubscriptionPlanPayload = {
  code?: string;
  name?: string;
  description?: string;
  audience?: SellerSubscriptionPlanAudience;
  pricePaise?: number;
  currency?: string;
  billingCycle?: "MONTHLY" | "YEARLY" | "LIFETIME";
  productLimit?: number;
  featuredProductLimit?: number;
  b2bEnquiryLimit?: number;
  commissionDiscountBps?: number;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type AssignSellerSubscriptionPayload = {
  planId: string;
  status?: SellerSubscriptionStatus;
  currentPeriodEnd?: string;
  note?: string;
};

export function listAdminSellerSubscriptionPlans(auth: IndihubAuthHeaders, query: { search?: string; isActive?: boolean; audience?: SellerSubscriptionPlanAudience; page?: number; limit?: number } = {}) {
  return indihubFetch<PageResult<SellerSubscriptionPlan>>(`/api/admin/seller-subscriptions/plans${queryString(query)}`, undefined, auth);
}

export function createSellerSubscriptionPlan(auth: IndihubAuthHeaders, payload: SellerSubscriptionPlanPayload) {
  return indihubFetch<SellerSubscriptionPlan>(
    "/api/admin/seller-subscriptions/plans",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function updateSellerSubscriptionPlan(auth: IndihubAuthHeaders, planId: string, payload: SellerSubscriptionPlanPayload) {
  return indihubFetch<SellerSubscriptionPlan>(
    `/api/admin/seller-subscriptions/plans/${encodeURIComponent(planId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function setDefaultSellerSubscriptionPlan(auth: IndihubAuthHeaders, planId: string) {
  return indihubFetch<SellerSubscriptionPlan>(
    `/api/admin/seller-subscriptions/plans/${encodeURIComponent(planId)}/default`,
    {
      method: "PATCH"
    },
    auth
  );
}

export function assignSellerSubscription(auth: IndihubAuthHeaders, sellerId: string, payload: AssignSellerSubscriptionPayload) {
  return indihubFetch<SellerProfile>(
    `/api/admin/sellers/${encodeURIComponent(sellerId)}/subscription`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
  );
}

function queryString(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return params.size ? `?${params.toString()}` : "";
}
