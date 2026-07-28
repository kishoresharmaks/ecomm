import { SellerLedgerEntryType } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { SellerLedgerService } from "./seller-ledger.service";

describe("SellerLedgerService", () => {
  it("locks the seller before calculating the running ledger balance", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "seller-1" }]),
      sellerLedgerEntry: {
        findFirst: vi.fn().mockResolvedValue({ balanceAfterPaise: 1_000 }),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "entry-1", ...data })),
      },
    };
    const service = new SellerLedgerService({} as never);

    const entry = await service.createEntry(tx as never, {
      sellerId: "seller-1",
      entryType: SellerLedgerEntryType.MANUAL_ADJUSTMENT,
      description: "Approved correction",
      creditPaise: 500,
    });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    const lockCall = tx.$queryRaw.mock.invocationCallOrder[0] ?? 0;
    const balanceReadCall = tx.sellerLedgerEntry.findFirst.mock.invocationCallOrder[0] ?? 0;
    expect(lockCall).toBeLessThan(balanceReadCall);
    expect(entry.balanceAfterPaise).toBe(1_500);
  });
});
