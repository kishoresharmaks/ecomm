import type { B2BEnquiryStatus, B2BOrderStatus } from "./b2b-types";
import { colors } from "../../theme";

// ─── Enquiry Status ──────────────────────────────────────────────────────────

export const ENQUIRY_STATUS_LABEL: Record<B2BEnquiryStatus, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  RESPONDED: "Responded",
  NEGOTIATING: "Negotiating",
  BUYER_CONFIRMED: "Confirmed",
  ADMIN_APPROVED: "Approved",
  FINALISED: "Finalised",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const ENQUIRY_STATUS_COLOR: Record<B2BEnquiryStatus, string> = {
  SUBMITTED: colors.warning,
  IN_REVIEW: colors.warning,
  RESPONDED: "#1475FF",
  NEGOTIATING: "#1475FF",
  BUYER_CONFIRMED: colors.primary,
  ADMIN_APPROVED: colors.success,
  FINALISED: colors.success,
  CLOSED: colors.muted,
  CANCELLED: colors.danger,
};

/** Statuses from which the buyer can cancel. */
const CANCELLABLE_STATUSES: B2BEnquiryStatus[] = ["SUBMITTED", "IN_REVIEW", "RESPONDED", "NEGOTIATING"];

/** Returns true when the buyer is permitted to cancel the enquiry. */
export function canCancelEnquiry(status: B2BEnquiryStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** Returns true when the buyer is permitted to confirm the quoted price. */
export function canConfirmEnquiry(status: B2BEnquiryStatus): boolean {
  return status === "RESPONDED" || status === "NEGOTIATING";
}

// ─── Order Status ─────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<B2BOrderStatus, string> = {
  PROFORMA_ISSUED: "Proforma Issued",
  PO_SUBMITTED: "PO Submitted",
  PO_UNDER_REVIEW: "PO Under Review",
  PO_ACCEPTED: "PO Accepted",
  CREDIT_CLEARANCE_PENDING: "Credit Check",
  IN_FULFILMENT: "In Fulfilment",
  PROCUREMENT_IN_PROGRESS: "Procurement",
  PRODUCTION_IN_PROGRESS: "Production",
  STOCK_READY: "Stock Ready",
  PICKING: "Picking",
  PACKING: "Packing",
  QC_PENDING: "QC Pending",
  PACKED_AND_QC_PASSED: "QC Passed",
  TAX_INVOICE_ISSUED: "Invoiced",
  E_WAY_READY: "E-Way Ready",
  E_WAY_NOT_REQUIRED: "No E-Way",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  DELIVERY_ACCEPTED: "Accepted",
  DELIVERY_DISPUTED: "Disputed",
  PAYMENT_OVERDUE: "Payment Overdue",
  ON_HOLD: "On Hold",
  FULFILMENT_REVIEW_REQUIRED: "Review Required",
  CLOSED: "Closed",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLOR: Record<B2BOrderStatus, string> = {
  PROFORMA_ISSUED: colors.warning,
  PO_SUBMITTED: "#1475FF",
  PO_UNDER_REVIEW: "#1475FF",
  PO_ACCEPTED: colors.primary,
  CREDIT_CLEARANCE_PENDING: colors.warning,
  IN_FULFILMENT: colors.primary,
  PROCUREMENT_IN_PROGRESS: colors.primary,
  PRODUCTION_IN_PROGRESS: colors.primary,
  STOCK_READY: colors.success,
  PICKING: colors.primary,
  PACKING: colors.primary,
  QC_PENDING: colors.warning,
  PACKED_AND_QC_PASSED: colors.success,
  TAX_INVOICE_ISSUED: colors.success,
  E_WAY_READY: colors.primary,
  E_WAY_NOT_REQUIRED: colors.muted,
  DISPATCHED: colors.primary,
  IN_TRANSIT: colors.primary,
  DELIVERED: colors.success,
  DELIVERY_ACCEPTED: colors.success,
  DELIVERY_DISPUTED: colors.danger,
  PAYMENT_OVERDUE: colors.danger,
  ON_HOLD: colors.warning,
  FULFILMENT_REVIEW_REQUIRED: colors.warning,
  CLOSED: colors.muted,
  FULFILLED: colors.success,
  CANCELLED: colors.danger,
};

/** Returns true when the buyer can upload or update a PO for this order. */
export function canSubmitPO(status: B2BOrderStatus): boolean {
  return status === "PROFORMA_ISSUED" || status === "PO_SUBMITTED";
}
