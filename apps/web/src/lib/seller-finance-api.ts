import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { LedgerResult, PageResult, SellerPayout, SellerStatement, StatementDownload } from "./admin-finance-api";

export type SellerPayoutAvailability = {
  requestEnabled: boolean;
  minimumPayoutPaise: number;
  sellerReady: boolean;
  hasPayoutMethod: boolean;
  eligibleSplitCount: number;
  periodFrom?: string | null;
  periodTo?: string | null;
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
  canRequest: boolean;
  blockers: string[];
};

export function listSellerLedger(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<LedgerResult>(`/api/seller/finance/ledger${queryString(query)}`, undefined, auth);
}

export function getSellerPayoutAvailability(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerPayoutAvailability>("/api/seller/finance/payouts/availability", undefined, auth);
}

export function requestSellerPayout(auth: IndihubAuthHeaders, payload: { note?: string }) {
  return indihubFetch<SellerPayout>("/api/seller/finance/payout-requests", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function listSellerPayouts(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<SellerPayout>>(`/api/seller/finance/payouts${queryString(query)}`, undefined, auth);
}

export function getSellerPayout(auth: IndihubAuthHeaders, payoutId: string) {
  return indihubFetch<SellerPayout>(`/api/seller/finance/payouts/${encodeURIComponent(payoutId)}`, undefined, auth);
}

export function listSellerStatements(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<SellerStatement>>(`/api/seller/finance/statements${queryString(query)}`, undefined, auth);
}

export function downloadSellerStatement(auth: IndihubAuthHeaders, statementId: string, format: "csv" | "pdf") {
  return indihubFetch<StatementDownload>(`/api/seller/finance/statements/${encodeURIComponent(statementId)}/download/${format}`, undefined, auth);
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
