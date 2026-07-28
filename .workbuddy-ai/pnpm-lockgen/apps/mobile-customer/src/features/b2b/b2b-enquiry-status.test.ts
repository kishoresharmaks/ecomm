import { describe, expect, it } from "vitest";
import {
  canCancelEnquiry,
  canConfirmEnquiry,
  canSubmitPO,
} from "./b2b-enquiry-status";

describe("b2b-enquiry-status helpers", () => {
  it("governs cancellation permissions correctly", () => {
    expect(canCancelEnquiry("SUBMITTED")).toBe(true);
    expect(canCancelEnquiry("IN_REVIEW")).toBe(true);
    expect(canCancelEnquiry("RESPONDED")).toBe(true);
    expect(canCancelEnquiry("BUYER_CONFIRMED")).toBe(false);
    expect(canCancelEnquiry("FINALISED")).toBe(false);
  });

  it("governs quotation confirmation permissions correctly", () => {
    expect(canConfirmEnquiry("RESPONDED")).toBe(true);
    expect(canConfirmEnquiry("SUBMITTED")).toBe(false);
    expect(canConfirmEnquiry("BUYER_CONFIRMED")).toBe(false);
  });

  it("governs purchase order submission permissions correctly", () => {
    expect(canSubmitPO("PROFORMA_ISSUED")).toBe(true);
    expect(canSubmitPO("PO_SUBMITTED")).toBe(true);
    expect(canSubmitPO("PO_ACCEPTED")).toBe(false);
    expect(canSubmitPO("FULFILLED")).toBe(false);
  });
});
