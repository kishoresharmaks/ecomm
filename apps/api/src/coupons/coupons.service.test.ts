import { describe, expect, it, vi } from "vitest";
import { CouponsService } from "./coupons.service";

describe("CouponsService", () => {
  it("sets the required updated timestamp when creating a usage counter", async () => {
    let sql = "";
    const executeRaw = vi.fn(async (strings: TemplateStringsArray) => {
      sql = strings.join("?");
      return 1;
    });
    const service = new CouponsService({ client: {} } as never);

    await (
      service as unknown as {
        ensureUsageCounterRow(
          client: { $executeRaw: typeof executeRaw },
          couponId: string,
        ): Promise<void>;
      }
    ).ensureUsageCounterRow(
      { $executeRaw: executeRaw },
      "00000000-0000-0000-0000-000000000001",
    );

    expect(sql).toContain('"updated_at"');
    expect(sql).toContain("CURRENT_TIMESTAMP");
  });
});
