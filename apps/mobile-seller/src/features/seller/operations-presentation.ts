import type {
  SellerOrder,
  SellerServiceListing,
  SellerServiceBooking,
} from "./seller-api";

export type OperationsTone = "info" | "success" | "warning" | "danger";
export type SellerOrderViewFilter =
  | "all"
  | "needs-action"
  | "processing"
  | "dispatched"
  | "delivered"
  | "cancelled";
export type ServiceListingViewFilter =
  | "all"
  | "live"
  | "under-review"
  | "rejected"
  | "inactive";

const serviceCalendarTimeZone = "Asia/Kolkata";

export const SELLER_ORDER_FILTERS: ReadonlyArray<{
  label: string;
  value: SellerOrderViewFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Needs action", value: "needs-action" },
  { label: "Processing", value: "processing" },
  { label: "Dispatched", value: "dispatched" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export const SERVICE_LISTING_FILTERS: ReadonlyArray<{
  label: string;
  value: ServiceListingViewFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Under review", value: "under-review" },
  { label: "Rejected", value: "rejected" },
  { label: "Inactive", value: "inactive" },
];

const successStatuses = new Set([
  "ACTIVE",
  "APPROVED",
  "AUTO_APPROVED",
  "COMPLETED",
  "DELIVERED",
  "PAID",
  "QC_PASSED",
  "QUOTE_ACCEPTED",
  "RESOLVED",
  "VISIBLE",
]);
const warningStatuses = new Set([
  "ACCEPTED",
  "DRAFT",
  "IN_PROGRESS",
  "PACKED",
  "PENDING",
  "PENDING_APPROVAL",
  "PENDING_REVIEW",
  "PROCESSING",
  "QUOTE_SENT",
  "REQUESTED",
  "SCHEDULED",
]);
const dangerStatuses = new Set([
  "ARCHIVED",
  "CANCELLED",
  "CANCELLED_AFTER_DISPUTE",
  "COMPLETION_DISPUTED",
  "FAILED",
  "HIDDEN",
  "QC_FAILED",
  "QUOTE_EXPIRED",
  "QUOTE_REJECTED",
  "REJECTED",
  "WITHDRAWN",
]);

export function operationStatus(value?: string | null) {
  const status = value?.trim().toUpperCase() || "PENDING";
  const tone: OperationsTone = successStatuses.has(status)
    ? "success"
    : warningStatuses.has(status)
      ? "warning"
      : dangerStatuses.has(status)
        ? "danger"
        : "info";
  return { label: humanizeStatus(status), tone };
}

export function humanizeStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function sellerOrderStage(order: SellerOrder) {
  return order.sellerSplits?.[0]?.sellerStatus
    ?? order.deliveryStatus
    ?? order.orderStatus
    ?? order.status
    ?? "PENDING";
}

export function matchesSellerOrderFilter(order: SellerOrder, filter: SellerOrderViewFilter) {
  if (filter === "all") return true;
  const sellerStatus = sellerOrderStage(order).toUpperCase();
  if (filter === "needs-action") return sellerStatus === "PENDING" || sellerStatus === "ACCEPTED";
  if (filter === "processing") return sellerStatus === "PROCESSING" || sellerStatus === "PACKED";
  if (filter === "dispatched") return sellerStatus === "DISPATCHED" || order.deliveryStatus === "IN_TRANSIT";
  if (filter === "delivered") return sellerStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
  return sellerStatus === "CANCELLED" || order.orderStatus === "CANCELLED";
}

export function primaryServiceImage(service: SellerServiceListing) {
  const images = [...(service.images ?? [])].sort(
    (left, right) =>
      (left.sortOrder ?? Number.MAX_SAFE_INTEGER)
      - (right.sortOrder ?? Number.MAX_SAFE_INTEGER),
  );
  return images.find((image) => image.isPrimary && image.url)?.url
    ?? images.find((image) => image.url)?.url
    ?? null;
}

export function serviceListingQuery(filter: ServiceListingViewFilter, searchValue: string) {
  const search = searchValue.trim();
  return {
    ...(search ? { search } : {}),
    ...(filter === "live" ? { status: "ACTIVE", approvalStatus: "APPROVED" } : {}),
    ...(filter === "under-review" ? { approvalStatus: "PENDING_APPROVAL" } : {}),
    ...(filter === "rejected" ? { approvalStatus: "REJECTED" } : {}),
    ...(filter === "inactive" ? { status: "INACTIVE" } : {}),
  };
}

export function serviceBookingTitle(booking: SellerServiceBooking) {
  return booking.listing && "title" in booking.listing
    ? booking.listing.title ?? "Service job"
    : "Service job";
}

export function formatOperationDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatOperationDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function formatServiceCalendarDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        timeZone: serviceCalendarTimeZone,
        year: "numeric",
      });
}

export function dateInputFromIso(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { day, month, year } = serviceCalendarParts(date);
  return `${year}-${month}-${day}`;
}

export function timeInputFromIso(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { hour, minute } = serviceCalendarParts(date);
  return `${hour}:${minute}`;
}

export function localDateTimeToIso(dateValue: string, timeValue: string) {
  const date = dateValue.trim();
  const time = timeValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Enter date as YYYY-MM-DD and time as HH:mm.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const minuteOfDay = timeValueToMinute(time);
  const dateCheck = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  if (
    minuteOfDay === null
    || minuteOfDay >= 24 * 60
    || dateCheck.getUTCFullYear() !== year
    || dateCheck.getUTCMonth() + 1 !== month
    || dateCheck.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid date and time.");
  }
  const parsed = new Date(`${date}T${time}:00+05:30`);
  return parsed.toISOString();
}

export function addDaysToDateInput(value: string, days: number) {
  const [year, month, day] = value.trim().split("-").map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  if (
    !Number.isInteger(days)
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid date.");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function minuteLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeValueToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

function serviceCalendarParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: serviceCalendarTimeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    month: value("month"),
    year: value("year"),
  };
}
