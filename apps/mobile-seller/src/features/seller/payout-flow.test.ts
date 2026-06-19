import { describe, expect, it } from "vitest";
import { isPayoutConfirmed, sellerPayoutStatusLabel } from "./payout-flow";

describe("seller mobile payout flow", () => {
  it("does not call a submitted payout confirmed until approval or paid status", () => {
    expect(isPayoutConfirmed("PENDING_APPROVAL")).toBe(false);
    expect(isPayoutConfirmed("APPROVED")).toBe(true);
    expect(isPayoutConfirmed("PAID")).toBe(true);
  });

  it("uses seller-friendly lifecycle labels", () => {
    expect(sellerPayoutStatusLabel("PENDING_APPROVAL")).toBe("Submitted for approval");
    expect(sellerPayoutStatusLabel("PAID")).toBe("Paid");
  });
});
