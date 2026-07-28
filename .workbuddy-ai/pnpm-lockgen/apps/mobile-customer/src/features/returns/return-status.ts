export const mobileReturnRequestStatuses = [
  "PENDING_REVIEW",
  "AUTO_APPROVED",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_PASSED",
  "QC_FAILED",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
] as const;

const successfulReturnTimeline = [
  "PENDING_REVIEW",
  "AUTO_APPROVED",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_PASSED",
  "RESOLVED",
] as const satisfies MobileReturnRequestStatus[];

const qcFailedReturnTimeline = [
  "PENDING_REVIEW",
  "AUTO_APPROVED",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_FAILED",
] as const satisfies MobileReturnRequestStatus[];

export type MobileReturnRequestStatus = (typeof mobileReturnRequestStatuses)[number];
export type MobileStatusTone = "danger" | "neutral" | "success" | "warning";

export type MobileReturnStatusPresentation = {
  description: string;
  label: string;
  tone: MobileStatusTone;
};

const returnStatusPresentation: Record<MobileReturnRequestStatus, MobileReturnStatusPresentation> = {
  PENDING_REVIEW: {
    description: "We received your return request and are checking eligibility.",
    label: "Under review",
    tone: "warning",
  },
  AUTO_APPROVED: {
    description: "Your request was approved automatically and pickup is being prepared.",
    label: "Approved",
    tone: "success",
  },
  APPROVED: {
    description: "Your return request is approved.",
    label: "Approved",
    tone: "success",
  },
  PICKUP_PENDING: {
    description: "Pickup is being assigned for your return.",
    label: "Pickup pending",
    tone: "warning",
  },
  PICKED_UP: {
    description: "The return item was picked up.",
    label: "Picked up",
    tone: "success",
  },
  IN_TRANSIT: {
    description: "Your return is on the way back for review.",
    label: "In transit",
    tone: "neutral",
  },
  RECEIVED: {
    description: "The return item was received by the seller or warehouse.",
    label: "Received",
    tone: "success",
  },
  QC_PASSED: {
    description: "Quality check passed. Refund or replacement processing can continue.",
    label: "QC passed",
    tone: "success",
  },
  QC_FAILED: {
    description: "Quality check needs review. Support will update the request.",
    label: "QC review",
    tone: "danger",
  },
  RESOLVED: {
    description: "This return request is complete.",
    label: "Resolved",
    tone: "success",
  },
  REJECTED: {
    description: "This return request was not approved.",
    label: "Rejected",
    tone: "danger",
  },
  CANCELLED: {
    description: "This return request was cancelled.",
    label: "Cancelled",
    tone: "danger",
  },
};

export function returnStatusPresentationFor(status?: string | null): MobileReturnStatusPresentation {
  if (isMobileReturnRequestStatus(status)) {
    return returnStatusPresentation[status];
  }

  return {
    description: "Return status updated.",
    label: formatReturnStatus(status ?? "Return update"),
    tone: "neutral",
  };
}

export function returnTimeline(status?: string | null) {
  const timelineStatuses = returnTimelineStatuses(status);
  const currentIndex = isMobileReturnRequestStatus(status)
    ? timelineStatuses.indexOf(status)
    : -1;

  return timelineStatuses.map((entry, index) => ({
    status: entry,
    completed: currentIndex >= index,
    current: currentIndex === index,
    ...returnStatusPresentation[entry],
  }));
}

export function formatReturnStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMobileReturnRequestStatus(value?: string | null): value is MobileReturnRequestStatus {
  return mobileReturnRequestStatuses.includes(value as MobileReturnRequestStatus);
}

function returnTimelineStatuses(status?: string | null): MobileReturnRequestStatus[] {
  if (status === "QC_FAILED") {
    return [...qcFailedReturnTimeline];
  }

  if (status === "REJECTED" || status === "CANCELLED") {
    return ["PENDING_REVIEW", status];
  }

  return [...successfulReturnTimeline];
}
