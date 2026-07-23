import { describe, expect, it } from "vitest";
import {
  orderTaxRegisterPeriodRange,
  orderTaxRegisterQuery,
  type OrderTaxRegisterFilters,
} from "./order-tax-register-api";

const filters: OrderTaxRegisterFilters = {
  source: "PRODUCT",
  channel: "",
  dateBasis: "DOCUMENT_DATE",
  dateFrom: "2026-07-01",
  dateTo: "2026-07-22",
  sellerId: "",
  warningCodes: ["MISSING_PAYMENT", "INVALID_GSTIN"],
  search: "",
  sortBy: "DATE",
  sortDirection: "DESC",
  page: 1,
  limit: 50,
};

describe("order tax register web helpers", () => {
  it("omits empty filters and serializes structured warning codes", () => {
    const query = new URLSearchParams(orderTaxRegisterQuery(filters));
    expect(query.get("source")).toBe("PRODUCT");
    expect(query.get("channel")).toBeNull();
    expect(query.get("sellerId")).toBeNull();
    expect(query.get("warningCodes")).toBe(
      "MISSING_PAYMENT,INVALID_GSTIN",
    );
  });

  it("builds inclusive seven-day presets", () => {
    expect(
      orderTaxRegisterPeriodRange(
        "LAST_7",
        new Date(2026, 6, 22, 12, 0, 0),
      ),
    ).toEqual({
      dateFrom: "2026-07-16",
      dateTo: "2026-07-22",
    });
  });

  it("uses blank dates for all-time reporting", () => {
    expect(orderTaxRegisterPeriodRange("ALL_TIME")).toEqual({
      dateFrom: "",
      dateTo: "",
    });
  });
});
