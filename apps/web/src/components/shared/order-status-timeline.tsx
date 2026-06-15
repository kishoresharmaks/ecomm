"use client";

import {
  CheckCircle2,
  Clock3,
  Package,
  PackageCheck,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, cn, type StatusTone } from "@indihub/ui";

export type OrderStatusTimelineEvent = {
  id: string;
  kind?: string | null;
  statusType?: string | null;
  newStatus?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

type TimelineStepKey =
  | "ORDER_PLACED"
  | "SELLER_ACCEPTED"
  | "PROCESSING"
  | "PACKED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

type TimelineStepState = "done" | "current" | "upcoming" | "cancelled";

type StepDefinition = {
  key: TimelineStepKey;
  title: string;
  description: string;
  icon: LucideIcon;
};

type NormalizedTimelineEvent = Required<Pick<OrderStatusTimelineEvent, "id" | "newStatus">> & {
  kind: string;
  note: string | null;
  createdAt: string | null;
  stepKey: TimelineStepKey;
};

const stepDefinitions: StepDefinition[] = [
  {
    key: "ORDER_PLACED",
    title: "Order placed",
    description: "The customer order was created successfully.",
    icon: ShoppingBag,
  },
  {
    key: "SELLER_ACCEPTED",
    title: "Seller accepted",
    description: "The seller confirmed this package will be fulfilled.",
    icon: Store,
  },
  {
    key: "PROCESSING",
    title: "Processing",
    description: "The seller is preparing the ordered items.",
    icon: Clock3,
  },
  {
    key: "PACKED",
    title: "Packed",
    description: "Items are packed and ready for pickup or handover.",
    icon: Package,
  },
  {
    key: "DISPATCHED",
    title: "Dispatched",
    description: "The package has left the store.",
    icon: Truck,
  },
  {
    key: "IN_TRANSIT",
    title: "In transit",
    description: "The package is moving toward the customer.",
    icon: PackageCheck,
  },
  {
    key: "DELIVERED",
    title: "Delivered",
    description: "The package was delivered to the customer.",
    icon: CheckCircle2,
  },
  {
    key: "CANCELLED",
    title: "Cancelled",
    description: "This order or package was cancelled.",
    icon: XCircle,
  },
];

const stepRank = new Map<TimelineStepKey, number>(
  stepDefinitions.map((step, index) => [step.key, index]),
);

const stateTone: Record<TimelineStepState, StatusTone> = {
  done: "success",
  current: "info",
  upcoming: "neutral",
  cancelled: "danger",
};

const markerClasses: Record<TimelineStepState, string> = {
  done: "border-[#0F8A5F] bg-[#0F8A5F] text-white",
  current: "border-[#ED3500] bg-[#ED3500] text-white",
  upcoming: "border-[#D8E2EA] bg-white text-[#667085]",
  cancelled: "border-[#B42318] bg-[#B42318] text-white",
};

export function OrderStatusTimeline({
  events,
  orderCreatedAt,
  currentOrderStatus,
  currentSellerStatus,
  currentDeliveryStatus,
  formatDateTime = defaultFormatDateTime,
  className,
  emptyText = "No order timeline events yet.",
  compact = false,
  showSources = true,
  showNotes = true,
  showFooter = true,
  showStateBadges = true,
}: {
  events: OrderStatusTimelineEvent[];
  orderCreatedAt?: string | null | undefined;
  currentOrderStatus?: string | null | undefined;
  currentSellerStatus?: string | null | undefined;
  currentDeliveryStatus?: string | null | undefined;
  formatDateTime?: (value?: string | null) => string;
  className?: string;
  emptyText?: string;
  compact?: boolean;
  showSources?: boolean;
  showNotes?: boolean;
  showFooter?: boolean;
  showStateBadges?: boolean;
}) {
  const timeline = buildTimelineRows({
    events,
    orderCreatedAt,
    currentOrderStatus,
    currentSellerStatus,
    currentDeliveryStatus,
  });

  if (!timeline.length) {
    return <p className="text-sm font-semibold text-[#667085]">{emptyText}</p>;
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-[#D8E2EA] bg-white", className)}>
      {timeline.map((row, index) => {
        const Icon = row.step.icon;
        const tone = stateTone[row.state];
        const isLast = index === timeline.length - 1;

        return (
          <div
            key={row.step.key}
            className={cn(
              "grid gap-3 border-b border-[#E5E7EB] last:border-b-0",
              compact
                ? "p-3 sm:grid-cols-[34px_minmax(0,1fr)_auto] sm:items-center"
                : "p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto]",
            )}
          >
            <div className="relative hidden justify-center sm:flex">
              {!isLast ? (
                <span
                  className={cn(
                    compact
                      ? "absolute bottom-[-13px] top-8 w-px"
                      : "absolute bottom-[-13px] top-10 w-px",
                    row.state === "upcoming" ? "bg-[#E5E7EB]" : "bg-[#BFEAD9]",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid place-items-center rounded-full border",
                  compact ? "h-7 w-7" : "h-9 w-9",
                  markerClasses[row.state],
                )}
              >
                <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "grid place-items-center rounded-full border sm:hidden",
                    compact ? "h-7 w-7" : "h-8 w-8",
                    markerClasses[row.state],
                  )}
                >
                  <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
                </span>
                <p className={cn("font-black text-[#1F2933]", compact ? "text-sm" : "")}>
                  {row.step.title}
                </p>
                {showStateBadges ? (
                  <StatusBadge tone={tone}>{stateLabel(row.state)}</StatusBadge>
                ) : null}
                {showSources
                  ? row.sources.map((source) => (
                      <StatusBadge key={source} tone="info" className="bg-[#F8FAFC]">
                        {source}
                      </StatusBadge>
                    ))
                  : null}
              </div>
              {showNotes ? (
                <p className="mt-1 text-sm font-semibold leading-5 text-[#667085]">
                  {row.note ?? row.step.description}
                </p>
              ) : null}
            </div>

            <div className="text-left text-xs font-bold text-[#667085] sm:min-w-36 sm:text-right">
              {row.date
                ? formatDateTime(row.date)
                : row.state === "upcoming"
                  ? "Upcoming"
                  : "In progress"}
            </div>
          </div>
        );
      })}
      {showFooter ? (
        <div className="border-t border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-center text-xs font-semibold text-[#667085]">
          Times are shown in your marketplace timezone.
        </div>
      ) : null}
    </div>
  );
}

function buildTimelineRows({
  events,
  orderCreatedAt,
  currentOrderStatus,
  currentSellerStatus,
  currentDeliveryStatus,
}: {
  events: OrderStatusTimelineEvent[];
  orderCreatedAt?: string | null | undefined;
  currentOrderStatus?: string | null | undefined;
  currentSellerStatus?: string | null | undefined;
  currentDeliveryStatus?: string | null | undefined;
}) {
  const grouped = new Map<TimelineStepKey, NormalizedTimelineEvent[]>();

  for (const event of events) {
    const normalized = normalizeTimelineEvent(event);
    if (!normalized) {
      continue;
    }
    grouped.set(normalized.stepKey, [...(grouped.get(normalized.stepKey) ?? []), normalized]);
  }

  if (orderCreatedAt && !grouped.has("ORDER_PLACED")) {
    grouped.set("ORDER_PLACED", [
      {
        id: "order-created",
        kind: "Order",
        newStatus: "PLACED",
        note: null,
        createdAt: orderCreatedAt,
        stepKey: "ORDER_PLACED",
      },
    ]);
  }

  for (const bucket of grouped.values()) {
    bucket.sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt));
  }

  const cancelled = Boolean(
    grouped.has("CANCELLED") ||
    [currentOrderStatus, currentSellerStatus, currentDeliveryStatus].some(
      (status) => normalizeStatus(status) === "CANCELLED",
    ),
  );
  const currentRank = inferCurrentRank({
    grouped,
    currentOrderStatus,
    currentSellerStatus,
    currentDeliveryStatus,
  });

  const visibleSteps = cancelled
    ? stepDefinitions.filter((step) => {
        if (step.key === "CANCELLED") {
          return true;
        }
        return (stepRank.get(step.key) ?? 0) <= currentRank;
      })
    : stepDefinitions.filter((step) => step.key !== "CANCELLED");

  return visibleSteps.map((step) => {
    const bucket = grouped.get(step.key) ?? [];
    const stepIndex = stepRank.get(step.key) ?? 0;
    let state: TimelineStepState = "upcoming";

    if (cancelled && step.key === "CANCELLED") {
      state = "cancelled";
    } else if (stepIndex < currentRank || (step.key === "DELIVERED" && stepIndex <= currentRank)) {
      state = "done";
    } else if (stepIndex === currentRank) {
      state = "current";
    }
    const visibleBucket = state === "upcoming" ? [] : bucket;
    const firstEvent = visibleBucket[0] ?? null;
    const note = selectTimelineNote(visibleBucket);
    const date = firstEvent?.createdAt ?? null;
    const sources = uniqueSources(visibleBucket);

    return {
      step,
      state,
      note,
      date,
      sources,
    };
  });
}

function normalizeTimelineEvent(event: OrderStatusTimelineEvent): NormalizedTimelineEvent | null {
  const status = normalizeStatus(event.newStatus);
  if (!status) {
    return null;
  }
  const source = normalizeSource(event.statusType ?? event.kind);
  const stepKey = mapEventToStep(source, status);

  if (!stepKey) {
    return null;
  }

  return {
    id: event.id,
    kind: source,
    newStatus: status,
    note: cleanTimelineNote(event.note),
    createdAt: event.createdAt ?? null,
    stepKey,
  };
}

function mapEventToStep(source: string, status: string): TimelineStepKey | null {
  if (status === "CANCELLED") {
    return "CANCELLED";
  }
  if (status === "PLACED") {
    return "ORDER_PLACED";
  }
  if (status === "CONFIRMED" || (source === "SELLER" && status === "ACCEPTED")) {
    return "SELLER_ACCEPTED";
  }
  if (status === "PROCESSING") {
    return "PROCESSING";
  }
  if (status === "PACKED") {
    return "PACKED";
  }
  if (status === "SHIPPED" || status === "DISPATCHED") {
    return "DISPATCHED";
  }
  if (status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY") {
    return "IN_TRANSIT";
  }
  if (status === "DELIVERED") {
    return "DELIVERED";
  }
  return null;
}

function inferCurrentRank({
  grouped,
  currentOrderStatus,
  currentSellerStatus,
  currentDeliveryStatus,
}: {
  grouped: Map<TimelineStepKey, NormalizedTimelineEvent[]>;
  currentOrderStatus?: string | null | undefined;
  currentSellerStatus?: string | null | undefined;
  currentDeliveryStatus?: string | null | undefined;
}) {
  const statusRanks = [
    statusRank("ORDER", currentOrderStatus),
    statusRank("SELLER", currentSellerStatus),
    statusRank("DELIVERY", currentDeliveryStatus),
  ].filter((rank): rank is number => typeof rank === "number");
  const ranks = statusRanks.length
    ? statusRanks
    : Array.from(grouped.keys()).map((key) => stepRank.get(key) ?? 0);

  return Math.max(0, ...ranks.filter((rank) => rank < (stepRank.get("CANCELLED") ?? 999)));
}

function statusRank(source: string, status?: string | null) {
  const stepKey = mapEventToStep(source, normalizeStatus(status));
  return stepKey ? stepRank.get(stepKey) : null;
}

function selectTimelineNote(events: NormalizedTimelineEvent[]) {
  const notes = events
    .map((event) => event.note)
    .filter((note): note is string => Boolean(note && !isLowSignalNote(note)));

  if (!notes.length) {
    return null;
  }

  return notes[notes.length - 1];
}

function uniqueSources(events: NormalizedTimelineEvent[]) {
  return Array.from(new Set(events.map((event) => displaySource(event.kind)))).filter(Boolean);
}

function displaySource(source: string) {
  if (source === "ORDER") {
    return "Order";
  }
  if (source === "SELLER") {
    return "Seller";
  }
  if (source === "DELIVERY") {
    return "Delivery";
  }
  return "";
}

function cleanTimelineNote(note?: string | null) {
  const cleaned = note?.trim();
  return cleaned ? cleaned : null;
}

function isLowSignalNote(note: string) {
  return [
    "Seller fulfillment status updated.",
    "Seller fulfilment status updated.",
    "Delivery status updated.",
    "Delivery details updated.",
  ].includes(note);
}

function normalizeSource(value?: string | null) {
  const source = normalizeStatus(value);
  if (source === "STATUS") {
    return "ORDER";
  }
  return source;
}

function normalizeStatus(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function stateLabel(state: TimelineStepState) {
  if (state === "done") {
    return "Done";
  }
  if (state === "current") {
    return "Current";
  }
  if (state === "cancelled") {
    return "Cancelled";
  }
  return "Upcoming";
}

function defaultFormatDateTime(value?: string | null) {
  if (!value) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
