import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type FinanceSeller = {
  id: string;
  storeName: string;
  slug?: string;
  payoutProfile?: {
    accountHolderName?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    upiId?: string | null;
    isVerified?: boolean;
  } | null;
};

export type FinanceCategory = {
  id: string;
  name: string;
  slug?: string;
};

export type CommissionRule = {
  id: string;
  name: string;
  scope: "GLOBAL" | "CATEGORY" | "SELLER" | "SELLER_CATEGORY";
  sellerId?: string | null;
  categoryId?: string | null;
  commissionType: "PERCENTAGE" | "FIXED" | "MANUAL";
  commissionValueBps?: number | null;
  commissionFixedPaise?: number | null;
  gstRateBps: number;
  tdsRateBps: number;
  tcsRateBps: number;
  platformFeeType: "PERCENTAGE" | "FIXED" | "MANUAL";
  platformFeeValueBps?: number | null;
  platformFeeFixedPaise?: number | null;
  priority: number;
  active: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  seller?: FinanceSeller | null;
  category?: FinanceCategory | null;
  createdAt?: string;
};

export type CommissionRulePayload = {
  name: string;
  scope: CommissionRule["scope"];
  sellerId?: string;
  categoryId?: string;
  commissionType: CommissionRule["commissionType"];
  commissionRatePercent?: number;
  commissionFixedPaise?: number;
  gstRatePercent?: number;
  tdsRatePercent?: number;
  tcsRatePercent?: number;
  platformFeeType?: CommissionRule["platformFeeType"];
  platformFeeRatePercent?: number;
  platformFeeFixedPaise?: number;
  priority?: number;
  active?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type SellerPayout = {
  id: string;
  payoutNumber: string;
  settlementRunId?: string | null;
  sellerId: string;
  periodFrom: string;
  periodTo: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED" | "HELD";
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  adjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
  paymentMode?: string | null;
  transactionReference?: string | null;
  seller?: FinanceSeller | null;
  settlementRun?: SellerSettlementRun | null;
  orderSplits?: SellerOrderSplitFinance[];
  b2bOrders?: Array<{
    id: string;
    orderNumber: string;
    buyerPayableAmountPaise: number;
    sellerPayoutAmountPaise: number;
    settlementStatus: string;
  }>;
  serviceSettlements?: ServiceSettlementFinance[];
  serviceReceivableOffsets?: ServiceReceivableOffsetFinance[];
  statements?: SellerStatement[];
  events?: Array<{ id: string; eventType: string; oldStatus?: string | null; newStatus?: string | null; note?: string | null; createdAt?: string }>;
  _count?: { orderSplits?: number; b2bOrders?: number; serviceSettlements?: number; serviceReceivableOffsets?: number; ledgerEntries?: number; statements?: number };
  createdAt?: string;
};

export type DeliveryPartnerPayout = {
  id: string;
  payoutNumber: string;
  partnerUserId: string;
  amountPaise: number;
  currency: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
  note?: string | null;
  settingsSnapshot?: Record<string, unknown> | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  paymentMode?: string | null;
  transactionReference?: string | null;
  createdAt?: string;
  partner?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    deliveryProfile?: {
      vehicleNumber?: string | null;
      isAvailable?: boolean | null;
    } | null;
  } | null;
  walletEntries?: Array<{
    id: string;
    entryType: string;
    direction: "CREDIT" | "DEBIT";
    amountPaise: number;
    createdAt?: string;
  }>;
};

export type SellerSettlementRun = {
  id: string;
  runNumber: string;
  periodFrom: string;
  periodTo: string;
  status: SellerPayout["status"];
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
  note?: string | null;
  payouts?: SellerPayout[];
  createdAt?: string;
};

export type SellerOrderSplitFinance = {
  id: string;
  sellerSubtotalPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  settlementStatus: string;
  order?: {
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    createdAt?: string;
  };
};

export type ServiceSettlementFinance = {
  id: string;
  grossAmountPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  status: string;
  currency: string;
  booking?: {
    bookingNumber: string;
    status: string;
    paymentMode: string;
    createdAt?: string;
  };
};

export type ServiceReceivableOffsetFinance = {
  id: string;
  receivableNumber: string;
  status: string;
  offsetPolicy: string;
  grossCashCollectedPaise: number;
  amountDueToPlatformPaise: number;
  settledPaise: number;
  waivedPaise: number;
  reversalPaise: number;
  offsetPaise: number;
  currency: string;
  booking?: {
    bookingNumber: string;
    status: string;
  };
};

export type SellerLedgerEntry = {
  id: string;
  sellerId: string;
  entryType: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  balanceAfterPaise: number;
  currency: string;
  createdAt?: string;
  payout?: { id: string; payoutNumber: string; status: string } | null;
  orderSellerSplit?: { id: string; order?: { orderNumber: string } } | null;
};

export type LedgerResult = PageResult<SellerLedgerEntry> & {
  balancePaise: number;
};

export type SellerStatement = {
  id: string;
  statementNumber: string;
  sellerId: string;
  payoutId?: string | null;
  periodFrom: string;
  periodTo: string;
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  adjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
  status: string;
  generatedAt?: string;
  seller?: FinanceSeller | null;
  payout?: { id: string; payoutNumber: string; status: string } | null;
};

export type StatementDownload = {
  fileName: string;
  contentType: string;
  base64: string;
};

export function listCommissionRules(auth: IndihubAuthHeaders, query: Record<string, string | number | boolean | undefined> = {}) {
  return indihubFetch<PageResult<CommissionRule>>(`/api/admin/finance/commission-rules${queryString(query)}`, undefined, auth);
}

export function createCommissionRule(auth: IndihubAuthHeaders, payload: CommissionRulePayload) {
  return indihubFetch<CommissionRule>("/api/admin/finance/commission-rules", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function updateCommissionRule(auth: IndihubAuthHeaders, ruleId: string, payload: CommissionRulePayload) {
  return indihubFetch<CommissionRule>(`/api/admin/finance/commission-rules/${encodeURIComponent(ruleId)}`, { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function setCommissionRuleActive(auth: IndihubAuthHeaders, ruleId: string, active: boolean) {
  return indihubFetch<CommissionRule>(
    `/api/admin/finance/commission-rules/${encodeURIComponent(ruleId)}/active`,
    { method: "PATCH", body: JSON.stringify({ active }) },
    auth
  );
}

export function listSettlements(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<SellerSettlementRun>>(`/api/admin/finance/settlements${queryString(query)}`, undefined, auth);
}

export function createSettlementDraft(auth: IndihubAuthHeaders, payload: { dateFrom: string; dateTo: string; note?: string }) {
  return indihubFetch<SellerSettlementRun>("/api/admin/finance/settlements/draft", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function submitSettlement(auth: IndihubAuthHeaders, runId: string) {
  return indihubFetch<SellerSettlementRun>(`/api/admin/finance/settlements/${encodeURIComponent(runId)}/submit`, { method: "PATCH" }, auth);
}

export function listPayouts(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<SellerPayout>>(`/api/admin/finance/payouts${queryString(query)}`, undefined, auth);
}

export function approvePayout(auth: IndihubAuthHeaders, payoutId: string, note?: string) {
  return indihubFetch<SellerPayout>(`/api/admin/finance/payouts/${encodeURIComponent(payoutId)}/approve`, { method: "PATCH", body: JSON.stringify({ note }) }, auth);
}

export function rejectPayout(auth: IndihubAuthHeaders, payoutId: string, note?: string) {
  return indihubFetch<SellerPayout>(`/api/admin/finance/payouts/${encodeURIComponent(payoutId)}/reject`, { method: "PATCH", body: JSON.stringify({ note }) }, auth);
}

export function markPayoutPaid(auth: IndihubAuthHeaders, payoutId: string, payload: { paymentMode: string; transactionReference: string; paidAt?: string; note?: string }) {
  return indihubFetch<SellerPayout>(`/api/admin/finance/payouts/${encodeURIComponent(payoutId)}/mark-paid`, { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function updateSellerPayoutProfileVerification(auth: IndihubAuthHeaders, sellerId: string, payload: { note?: string; verified: boolean }) {
  return indihubFetch<NonNullable<FinanceSeller["payoutProfile"]>>(
    `/api/admin/finance/sellers/${encodeURIComponent(sellerId)}/payout-profile/verification`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth
  );
}

export function listDeliveryPartnerPayouts(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<DeliveryPartnerPayout>>(`/api/admin/finance/delivery-partner-payouts${queryString(query)}`, undefined, auth);
}

export function approveDeliveryPartnerPayout(auth: IndihubAuthHeaders, payoutId: string, note?: string) {
  return indihubFetch<DeliveryPartnerPayout>(`/api/admin/finance/delivery-partner-payouts/${encodeURIComponent(payoutId)}/approve`, { method: "PATCH", body: JSON.stringify({ note }) }, auth);
}

export function rejectDeliveryPartnerPayout(auth: IndihubAuthHeaders, payoutId: string, note?: string) {
  return indihubFetch<DeliveryPartnerPayout>(`/api/admin/finance/delivery-partner-payouts/${encodeURIComponent(payoutId)}/reject`, { method: "PATCH", body: JSON.stringify({ note }) }, auth);
}

export function markDeliveryPartnerPayoutPaid(auth: IndihubAuthHeaders, payoutId: string, payload: { paymentMode: string; transactionReference: string; paidAt?: string; note?: string }) {
  return indihubFetch<DeliveryPartnerPayout>(`/api/admin/finance/delivery-partner-payouts/${encodeURIComponent(payoutId)}/mark-paid`, { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function listAdminLedger(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<LedgerResult>(`/api/admin/finance/ledger${queryString(query)}`, undefined, auth);
}

export function addManualLedgerAdjustment(auth: IndihubAuthHeaders, payload: { sellerId: string; direction: "CREDIT" | "DEBIT"; amountPaise: number; description: string }) {
  return indihubFetch<SellerLedgerEntry>("/api/admin/finance/ledger/adjustments", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function listStatements(auth: IndihubAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return indihubFetch<PageResult<SellerStatement>>(`/api/admin/finance/statements${queryString(query)}`, undefined, auth);
}

export function generateStatement(auth: IndihubAuthHeaders, payoutId: string) {
  return indihubFetch<SellerStatement>("/api/admin/finance/statements", { method: "POST", body: JSON.stringify({ payoutId }) }, auth);
}

export function downloadAdminStatement(auth: IndihubAuthHeaders, statementId: string, format: "csv" | "pdf") {
  return indihubFetch<StatementDownload>(`/api/admin/finance/statements/${encodeURIComponent(statementId)}/download/${format}`, undefined, auth);
}

export function bpsToPercent(value?: number | null) {
  return value ? value / 100 : 0;
}

export function percentToInput(value?: number | null) {
  return bpsToPercent(value).toString();
}

export function saveDownload(download: StatementDownload) {
  const bytes = Uint8Array.from(atob(download.base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: download.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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
