import { describe, expect, it } from "vitest";
import { getAllowedServiceBookingActions } from "./bookingActions";
import type { MobileBookingStatus } from "../types";

describe("service booking actions", () => {
  it("maps every status to customer actions", () => {
    const expected: Record<MobileBookingStatus, string[]> = {
      requested: ["cancel"],
      accepted: ["cancel"],
      quote_sent: ["accept_quote", "reject_quote", "cancel"],
      quote_accepted: ["cancel"],
      quote_expired: [],
      quote_rejected: [],
      closed_after_inspection: ["submit_review"],
      rejected: [],
      cancelled: [],
      scheduled: ["cancel"],
      in_progress: [],
      completion_submitted: ["confirm_completion", "raise_dispute"],
      completion_disputed: [],
      completed: ["submit_review"],
      cancelled_after_dispute: [],
    };

    for (const [status, actions] of Object.entries(expected)) {
      expect(getAllowedServiceBookingActions(status)).toEqual(actions);
    }
  });

  it("hides review action when review exists", () => {
    expect(getAllowedServiceBookingActions("completed", { hasReview: true })).toEqual([]);
    expect(getAllowedServiceBookingActions("closed_after_inspection", { hasReview: true })).toEqual([]);
  });

  it("returns no actions for unknown status", () => {
    expect(getAllowedServiceBookingActions("future_status")).toEqual([]);
  });
});
