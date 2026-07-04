import { describe, expect, it } from "vitest";
import { CustomersService } from "../customers/customers.service";
import { SellerLedgerService } from "../finance/seller-ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReturnsService } from "./returns.service";

function returnsServiceForHelperTests() {
  const service = new ReturnsService(
    {} as unknown as PrismaService,
    {} as unknown as CustomersService,
    {} as unknown as SellerLedgerService,
  );
  return service as unknown as {
    firstTrimmedString: (...values: Array<string | undefined>) => string | undefined;
    trimmedStringOrUndefined: (value: string | undefined) => string | undefined;
  };
}

describe("ReturnsService proof reference helpers", () => {
  it("normalizes proof references before they are stored", () => {
    const service = returnsServiceForHelperTests();

    expect(service.trimmedStringOrUndefined("  pickup-ref-001  ")).toBe("pickup-ref-001");
    expect(service.firstTrimmedString("   ", "  fallback-ref  ")).toBe("fallback-ref");
  });

  it("treats missing or blank proof references as absent", () => {
    const service = returnsServiceForHelperTests();

    expect(service.trimmedStringOrUndefined(undefined)).toBeUndefined();
    expect(service.trimmedStringOrUndefined("   ")).toBeUndefined();
    expect(service.firstTrimmedString(undefined, " ", "")).toBeUndefined();
  });
});
