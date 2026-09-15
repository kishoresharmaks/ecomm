import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { LedgerResult, PageResult, SellerLedgerEntry, SellerPayout, SellerStatement, StatementDownload } from "./admin-finance-api";

export type SellerCashReceivableDetail = {
  id: string;
  receivableNumber: string;
  source: string;
  status: string;
  grossCashCollectedPaise: number;
  platformDuePaise: number;
  outstandingPaise: number;
  settledPaise: number;
  waivedPaise: number;
  offsetPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  sellerPlatformFeePaise: number;
  buyerPlatformFeePaise: number;
  currency: string;
  note: string | null;
  createdAt: string;
  payoutOffset: { id: string; payoutNumber: string; status: string } | null;
  order: { id: string; orderNumber: string };
  orderShipment: {
    id: string;
    shipmentNumber: string;
    deliveryMode: string;
    status: string;
    shippingPaise: number;
    codSurchargePaise: number;
  };
  payment: { id: string; provider: string; method: string; amountPaise: number; status: string };
  events: Array<{
    id: string;
    eventType: string;
    oldStatus: string;
    newStatus: string;
    amountDeltaPaise: number;
    oldOutstandingPaise: number;
    newOutstandingPaise: number;
    note: string | null;
    createdAt: string;
    actor: { id: string; email: string; fullName: string };
  }>;
  ledgerEntries: Array<{
    id: string;
    entryType: string;
    description: string;
    debitPaise: number;
    creditPaise: number;
    balanceAfterPaise: number;
    createdAt: string;
  }>;
};

export type SellerPayoutAvailability = {
  requestEnabled: boolean;
  minimumPayoutPaise: number;
  sellerReady: boolean;
  hasPayoutMethod: boolean;
  eligibleSplitCount: number;
  eligibleB2BOrderCount: number;
  eligibleServiceSettlementCount: number;
  serviceReceivableOffsetPaise: number;
  sellerCashReceivableOffsetPaise?: number;
  sellerCashReceivableOutstandingPaise?: number;
  ledgerDebtOffsetPaise: number;
  holdReceivableCount: number;
  pendingPayoutsPaise?: number;
  paidPayoutsPaise?: number;
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
  baseCurrency?: string;
  fxRate?: number;
  canRequest: boolean;
  blockers: string[];
};

export type SellerStatementResult = PageResult<SellerStatement> & {
  summary: {
    statementCount: number;
    totalsByCurrency: Array<{
      currency: string;
      netPayablePaise: number;
    }>;
  };
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
  return indihubFetch<SellerStatementResult>(`/api/seller/finance/statements${queryString(query)}`, undefined, auth);
}

export function downloadSellerStatement(auth: IndihubAuthHeaders, statementId: string, format: "csv" | "pdf") {
  return indihubFetch<StatementDownload>(`/api/seller/finance/statements/${encodeURIComponent(statementId)}/download/${format}`, undefined, auth);
}

export function getSellerCashReceivable(auth: IndihubAuthHeaders, receivableNumber: string) {
  return indihubFetch<SellerCashReceivableDetail>(`/api/seller/finance/cash-receivables/${encodeURIComponent(receivableNumber)}`, undefined, auth);
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== "") {
            params.append(key, String(item));
          }
        }
      } else if (key === "dateFrom" && typeof value === "string" && value.length === 10) {
        const [y, m, d] = value.split("-");
        const date = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
        params.append(key, date.toISOString());
      } else if (key === "dateTo" && typeof value === "string" && value.length === 10) {
        const [y, m, d] = value.split("-");
        const date = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
        params.append(key, date.toISOString());
      } else {
        params.append(key, String(value));
      }
    }
  }

  const str = params.toString();
  return str ? `?${str}` : "";
}
