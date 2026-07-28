import { describe, expect, it } from "vitest";
import { renderB2BProformaPdf, renderB2BReceiptVoucherPdf } from "./b2b-document-pdf";

describe("B2B professional PDFs", () => {
  it("renders a structured proforma invoice", async () => {
    const pdf = await renderB2BProformaPdf({
      proformaNumber: "PI-1001",
      orderNumber: "B2B-1001",
      issuedAt: "26 Jul 2026",
      expiresAt: "02 Aug 2026",
      paymentDueAt: "02 Aug 2026",
      buyer: { name: "Buyer Company", gstin: "33ABCDE1234F1Z5", address: "Chennai, Tamil Nadu" },
      seller: { name: "Seller Company", gstin: "33PQRSX5678K1Z2", registration: "Regular", address: "Salem, Tamil Nadu" },
      itemDescription: "Wholesale goods",
      quantity: 100,
      unitPrice: "INR 100.00",
      subtotal: "INR 10,000.00",
      transportMode: "Seller arranged transport",
      transportStatus: "Requested",
      transportCharge: "INR 500.00",
      buyerPayable: "INR 10,500.00",
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("Proforma invoice PI-1001");
  });

  it("renders a structured receipt voucher", async () => {
    const pdf = await renderB2BReceiptVoucherPdf({
      voucherNumber: "RV-1001",
      orderNumber: "B2B-1001",
      issuedAt: "26 Jul 2026, 02:00 PM IST",
      buyerName: "Buyer Company",
      sellerName: "Seller Company",
      paymentMethod: "Bank Transfer",
      paymentReference: "UTR-1001",
      paymentStatus: "Verified",
      amount: "INR 10,500.00",
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("B2B receipt voucher RV-1001");
  });
});
