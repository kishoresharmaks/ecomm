import { describe, expect, it } from "vitest";
import { isPayoutConfirmed, sellerLedgerAmount, sellerPayoutStatusLabel } from "./payout-flow";

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

  it("reads credit and debit amounts from the ledger response", () => {
    expect(sellerLedgerAmount({
      id: "credit",
      creditPaise: 1200,
      debitPaise: 0,
      balanceAfterPaise: 1200,
    })).toEqual({ amountPaise: 1200, label: "Credit" });
    expect(sellerLedgerAmount({
      id: "debit",
      creditPaise: 0,
      debitPaise: 300,
      balanceAfterPaise: 900,
    })).toEqual({ amountPaise: 300, label: "Debit" });
  });
});
