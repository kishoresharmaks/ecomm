import type { SellerPayout } from "./seller-api";

export function sellerPayoutStatusLabel(status: SellerPayout["status"]) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "Submitted for approval";
    case "APPROVED":
      return "Approved";
    case "PAID":
      return "Paid";
    case "REJECTED":
      return "Rejected";
    case "HELD":
      return "Held";
    case "CANCELLED":
      return "Cancelled";
    case "DRAFT":
    default:
      return "Draft";
  }
}

export function isPayoutConfirmed(status: SellerPayout["status"]) {
  return status === "APPROVED" || status === "PAID";
}
