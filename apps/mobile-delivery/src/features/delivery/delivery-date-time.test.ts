import { describe, expect, it } from "vitest";
import {
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
});
