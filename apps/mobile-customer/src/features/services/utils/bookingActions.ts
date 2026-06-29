import type { MobileBookingStatus, MobileServiceAction } from "../types";

export function getAllowedServiceBookingActions(
  status: MobileBookingStatus | string,
  options: { hasReview?: boolean } = {},
): MobileServiceAction[] {
  switch (status) {
    case "requested":
    case "accepted":
    case "scheduled":
    case "quote_accepted":
      return ["cancel"];
    case "quote_sent":
      return ["accept_quote", "reject_quote", "cancel"];
    case "completion_submitted":
      return ["confirm_completion", "raise_dispute"];
    case "completed":
    case "closed_after_inspection":
      return options.hasReview ? [] : ["submit_review"];
    default:
      return [];
  }
}

export function isActiveServiceBookingStatus(status: MobileBookingStatus) {
  return new Set<MobileBookingStatus>([
    "requested",
    "accepted",
    "scheduled",
    "quote_sent",
    "quote_accepted",
    "in_progress",
    "completion_submitted",
    "completion_disputed",
  ]).has(status);
}

export function isCompletedServiceBookingStatus(status: MobileBookingStatus) {
  return status === "completed" || status === "closed_after_inspection";
}

export function isClosedServiceBookingStatus(status: MobileBookingStatus) {
  return new Set<MobileBookingStatus>(["cancelled", "cancelled_after_dispute", "rejected", "quote_rejected", "quote_expired"]).has(status);
}

export function serviceBookingStatusTone(status: MobileBookingStatus): "neutral" | "success" | "warning" | "danger" {
  if (isCompletedServiceBookingStatus(status)) {
    return "success";
  }
  if (isClosedServiceBookingStatus(status)) {
    return "danger";
  }
  if (status === "completion_submitted" || status === "completion_disputed" || status === "quote_sent") {
    return "warning";
  }
  return "neutral";
}
