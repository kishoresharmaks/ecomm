import { describe, expect, it } from "vitest";
import { createSimpleB2BPdf } from "./b2b-simple-pdf";

describe("createSimpleB2BPdf", () => {
  it("creates a valid single-page PDF and escapes receipt text", () => {
    const pdf = createSimpleB2BPdf([
      "1HandIndia B2B Receipt Voucher",
      "Reference: BANK (UTR) \\ verified",
      "Amount: INR 1180.00",
    ]);
    const content = pdf.toString("utf8");

    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("Reference: BANK \\(UTR\\) \\\\ verified");
    expect(content).toContain("%%EOF");
  });

  it("replaces unsupported characters without producing an invalid stream", () => {
    const pdf = createSimpleB2BPdf(["Receipt", "Buyer: Example\u20b9 Company"]);

    expect(pdf.toString("utf8")).toContain("Buyer: Example? Company");
    expect(pdf.length).toBeGreaterThan(300);
  });
});
