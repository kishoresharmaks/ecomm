import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERVICE_BOOKING_DRAFT_MAX_AGE_MS,
  SERVICE_BOOKING_DRAFT_MAX_ENTRIES,
  clearServiceBookingDraft,
  readServiceBookingDraft,
  saveServiceBookingDraft,
} from "./service-booking-draft-store";
import type { MobileServiceBookingFormValues } from "./types";

describe("service booking draft store", () => {
  afterEach(() => {
    vi.useRealTimers();
    for (let index = 0; index < SERVICE_BOOKING_DRAFT_MAX_ENTRIES + 5; index += 1) {
      clearServiceBookingDraft(`service-${index}`);
    }
    clearServiceBookingDraft("ac-repair");
    clearServiceBookingDraft("tv-repair");
  });

  it("expires stale drafts during later reads", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:00:00.000Z"));

    saveServiceBookingDraft("ac-repair", draft("ac-repair"));
    expect(readServiceBookingDraft("ac-repair")?.serviceSlug).toBe("ac-repair");

    vi.setSystemTime(new Date(Date.now() + SERVICE_BOOKING_DRAFT_MAX_AGE_MS + 1));
    expect(readServiceBookingDraft("ac-repair")).toBeNull();
  });

  it("keeps the draft map bounded by removing oldest entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:00:00.000Z"));

    for (let index = 0; index < SERVICE_BOOKING_DRAFT_MAX_ENTRIES + 1; index += 1) {
      vi.setSystemTime(new Date(Date.now() + 1000));
      saveServiceBookingDraft(`service-${index}`, draft(`service-${index}`));
    }

    expect(readServiceBookingDraft("service-0")).toBeNull();
    expect(readServiceBookingDraft(`service-${SERVICE_BOOKING_DRAFT_MAX_ENTRIES}`)?.serviceSlug).toBe(
      `service-${SERVICE_BOOKING_DRAFT_MAX_ENTRIES}`,
    );
  });
});

function draft(serviceSlug: string): MobileServiceBookingFormValues {
  return {
    serviceSlug,
    selectedPackageId: null,
    visitMode: "customer_location",
    savedAddressId: null,
    addressSnapshot: null,
    preferredDate: null,
    preferredTimeSlot: null,
    customerIssue: "The appliance turns on but does not work correctly.",
    customerNote: null,
  };
}
