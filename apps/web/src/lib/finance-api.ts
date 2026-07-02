import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { PageResult } from "./admin-finance-api";

export type FinanceMetric = {
  count: number;
  amountPaise: number;
};

export type FinanceDashboard = {
  metrics: {
    codPending: FinanceMetric;
    codCollected: FinanceMetric;
    bankTransferPending: FinanceMetric;
    manualPending: FinanceMetric;
    onlinePaid: FinanceMetric;
    settlementDue: FinanceMetric;
    payoutPending: FinanceMetric;
    payoutPaid: FinanceMetric;
    serviceReceivableOpen: FinanceMetric;
    serviceReceivableDisputed: FinanceMetric;
    serviceReceivableSettled: FinanceMetric;
  };
  recentPayments: FinancePaymentCollection[];
};

export type FinancePaymentCollection = {
  id: string;
  provider: "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
  method?: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";
  amountPaise: number;
  currency: string;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  customerReference?: string | null;
  bankTransferDetails?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    deliveryStatus: string;
    totalPaise: number;
    currency: string;
    createdAt: string;
    customer: {
      email?: string | null;
      phone?: string | null;
      fullName?: string | null;
    };
    sellers: Array<{
      id: string;
      storeName: string;
      sellerSubtotalPaise: number;
      settlementStatus: string;
    }>;
    deliveryDetail?: {
      status: string;
      codCollectionStatus: "NOT_COLLECTED" | "COLLECTED" | "VERIFIED" | "REJECTED";
      codCollectedAmountPaise?: number | null;
      codCollectedAt?: string | null;
      codCollectionNote?: string | null;
      codVerifiedAt?: string | null;
      codVerificationNote?: string | null;
      codCollectedBy?: { id: string; email?: string | null; fullName?: string | null } | null;
      codVerifiedBy?: { id: string; email?: string | null; fullName?: string | null } | null;
    } | null;
  };
  events: Array<{
    id: string;
    eventType: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    createdAt: string;
  }>;
};

export type FinanceReportGroup = {
  label: string;
  count: number;
  amountPaise: number;
};

export type FinancePaymentReports = {
  byProvider: FinanceReportGroup[];
  byPaymentStatus: FinanceReportGroup[];
  codByCollectionStatus: FinanceReportGroup[];
  bySettlementStatus: FinanceReportGroup[];
  byServiceSettlementStatus: FinanceReportGroup[];
  byPayoutStatus: FinanceReportGroup[];
  serviceReceivablesByStatus: FinanceReportGroup[];
  serviceReceivablesByTaxStatus: FinanceReportGroup[];
  serviceReceivablesByOffsetPolicy: FinanceReportGroup[];
};

export type FinancePaymentQuery = Record<string, string | number | undefined>;

export type CourierCodRemittance = {
  id: string;
  providerCode: string;
  awbNumber?: string | null;
  expectedAmountPaise: number;
  collectedAmountPaise?: number | null;
  remittedAmountPaise?: number | null;
  remittanceDate?: string | null;
  remittanceReference?: string | null;
  reportReference?: string | null;
  status: "PENDING" | "COURIER_COLLECTED" | "REMITTED" | "VERIFIED" | "DISPUTED" | "REJECTED";
  notes?: string | null;
  verifiedAt?: string | null;
  verificationNote?: string | null;
  order: {
    id: string;
    orderNumber: string;
    paymentStatus: string;
    deliveryStatus: string;
    totalPaise: number;
    currency: string;
  };
  orderShipment: {
    id: string;
    shipmentNumber: string;
    seller?: { id: string; storeName: string } | null;
  };
};

export function getFinanceDashboard(auth: IndihubAuthHeaders) {
  return indihubFetch<FinanceDashboard>("/api/admin/finance/dashboard", undefined, auth);
}

export function listFinancePaymentCollections(auth: IndihubAuthHeaders, query: FinancePaymentQuery = {}) {
  return indihubFetch<PageResult<FinancePaymentCollection>>(`/api/admin/finance/payment-collections${queryString(query)}`, undefined, auth);
}

export function verifyFinanceOfflinePayment(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: { decision: "VERIFY" | "REJECT"; transactionReference?: string; note?: string }
) {
  return indihubFetch(
    `/api/admin/finance/payment-collections/${encodeURIComponent(orderNumber)}/offline-verification`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth
  );
}

export function verifyFinanceCodCollection(auth: IndihubAuthHeaders, orderNumber: string, payload: { decision: "VERIFY" | "REJECT"; note?: string }) {
  return indihubFetch(
    `/api/admin/finance/order-payments/${encodeURIComponent(orderNumber)}/cod-verification`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth
  );
}

export function listCourierCodRemittances(auth: IndihubAuthHeaders, query: FinancePaymentQuery = {}) {
  return indihubFetch<PageResult<CourierCodRemittance>>(
    `/api/admin/finance/courier-cod-remittances${queryString(query)}`,
    undefined,
    auth
  );
}

export function upsertCourierCodRemittance(
  auth: IndihubAuthHeaders,
  payload: {
    shipmentNumber?: string | undefined;
    awbNumber?: string | undefined;
    remittedAmountPaise: number;
    remittanceReference?: string | undefined;
    reportReference?: string | undefined;
    notes?: string | undefined;
  }
) {
  return indihubFetch(
    "/api/admin/finance/courier-cod-remittances",
    { method: "POST", body: JSON.stringify(payload) },
    auth
  );
}

export function verifyCourierCodRemittance(
  auth: IndihubAuthHeaders,
  remittanceId: string,
  payload: { decision: "VERIFY" | "DISPUTE" | "REJECT"; note?: string }
) {
  return indihubFetch(
    `/api/admin/finance/courier-cod-remittances/${encodeURIComponent(remittanceId)}/verify`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth
  );
}

export function getFinancePaymentReports(auth: IndihubAuthHeaders, query: FinancePaymentQuery = {}) {
  return indihubFetch<FinancePaymentReports>(`/api/admin/finance/payment-reports${queryString(query)}`, undefined, auth);
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
