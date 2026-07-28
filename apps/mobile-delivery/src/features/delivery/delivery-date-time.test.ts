import { describe, expect, it } from "vitest";
import {
  deliveryEstimateError,
  nextAttemptDateError,
  parseDeliveryEstimate,
  serializeDeliveryEstimate,
  withDeliveryDate,
  withDeliveryTime,
} from "./delivery-date-time";

describe("delivery estimate date-time helpers", () => {
  it("preserves time when the delivery date changes", () => {
    const current = new Date(2026, 6, 18, 16, 30);
    const selectedDate = new Date(2026, 6, 21, 9, 0);
    const updated = withDeliveryDate(current, selectedDate);

    expect(updated.getFullYear()).toBe(2026);
    expect(updated.getMonth()).toBe(6);
    expect(updated.getDate()).toBe(21);
    expect(updated.getHours()).toBe(16);
    expect(updated.getMinutes()).toBe(30);
  });

  it("preserves the date when the delivery time changes", () => {
    const current = new Date(2026, 6, 21, 16, 30);
    const selectedTime = new Date(2026, 6, 17, 19, 45);
    const updated = withDeliveryTime(current, selectedTime);

    expect(updated.getDate()).toBe(21);
    expect(updated.getHours()).toBe(19);
    expect(updated.getMinutes()).toBe(45);
  });

  it("serializes and restores the complete estimate", () => {
    const estimate = new Date(2026, 6, 21, 19, 45);
    const serialized = serializeDeliveryEstimate(estimate);
    const restored = parseDeliveryEstimate(serialized);

    expect(restored?.getTime()).toBe(estimate.getTime());
  });

  it("rejects past estimates and invalid next-attempt dates", () => {
    const now = new Date(2026, 6, 26, 15, 0);

    expect(deliveryEstimateError(new Date(2026, 6, 26, 14, 59), now)).toBe("Estimated delivery must be in the future.");
    expect(nextAttemptDateError("2026-02-30", now)).toBe("Enter a real calendar date.");
    expect(nextAttemptDateError("2026-07-25", now)).toBe("Next attempt date cannot be in the past.");
    expect(nextAttemptDateError("2026-07-26", now)).toBeNull();
  });
});
