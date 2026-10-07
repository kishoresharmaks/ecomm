import type { StatusTone } from "@indihub/ui";

export function getEffectivePaymentStatus(order: {
  orderStatus?: string | null | undefined;
  paymentStatus?: string | null | undefined;
  payments?: Array<{ status: string }> | null | undefined;
  refundRequests?: Array<{ status: string }> | null | undefined;
}): string {
  const paymentStatus = order.paymentStatus?.toUpperCase() ?? "PENDING";
  if (paymentStatus === "REFUNDED") {
    return "REFUNDED";
  }
  if (order.payments?.some((p) => p.status?.toUpperCase() === "REFUNDED")) {
    return "REFUNDED";
  }
  if (
    order.refundRequests?.some((r) =>
      ["SUCCESS", "APPROVED", "COMPLETED"].includes(r.status?.toUpperCase()),
    )
  ) {
    return "REFUNDED";
  }
  if (
    order.refundRequests?.some((r) =>
      ["PROCESSING", "PENDING", "PENDING_REVIEW"].includes(r.status?.toUpperCase()),
    )
  ) {
    return "REFUND_PENDING";
  }
  if (order.orderStatus?.toUpperCase() === "CANCELLED" && paymentStatus === "PAID") {
    return "REFUNDED";
  }
  return paymentStatus;
}

export function statusTone(value?: string | null): StatusTone {
  const normalized = (value ?? "").toUpperCase();
  if (
    [
      "CONFIRMED",
      "DELIVERED",
      "PAID",
      "VERIFIED",
      "ACTIVE",
      "COMPLETED",
      "SUCCESS",
      "RESPONDED",
      "BUYER_CONFIRMED",
      "ADMIN_APPROVED",
      "FINALISED",
      "CLOSED",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (normalized === "NEGOTIATING") {
    return "info";
  }
  if (
    [
      "PENDING",
      "SUBMITTED",
      "IN_REVIEW",
      "PENDING_APPROVAL",
      "PLACED",
      "PROCESSING",
      "DRAFT",
      "SKIPPED",
      "OPEN",
      "REFUND_PENDING",
    ].includes(normalized)
  ) {
    return "warning";
  }
  if (
    ["REJECTED", "SUSPENDED", "DISABLED", "FAILED", "CANCELLED", "ARCHIVED", "REFUNDED"].includes(normalized)
  ) {
    return "danger";
  }
  return "info";
}
