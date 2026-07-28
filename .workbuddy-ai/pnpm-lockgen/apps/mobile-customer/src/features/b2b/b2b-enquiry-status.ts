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
  PO_ACCEPTED: "PO Accepted",
  IN_FULFILMENT: "In Fulfilment",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLOR: Record<B2BOrderStatus, string> = {
  PROFORMA_ISSUED: colors.warning,
  PO_SUBMITTED: "#1475FF",
  PO_ACCEPTED: colors.primary,
  IN_FULFILMENT: colors.primary,
  FULFILLED: colors.success,
  CANCELLED: colors.danger,
};

/** Returns true when the buyer can upload or update a PO for this order. */
export function canSubmitPO(status: B2BOrderStatus): boolean {
  return status === "PROFORMA_ISSUED" || status === "PO_SUBMITTED";
}
