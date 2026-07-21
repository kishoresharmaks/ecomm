import {
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";
import { describe, expect, it } from "vitest";
import {
  renderTaxDocumentPdf,
  taxDocumentDownloadFileName,
} from "./tax-document-pdf";

describe("tax document PDF renderer", () => {
  it("renders a customer-readable commercial invoice PDF with a safe filename", () => {
    const pdf = renderTaxDocumentPdf({
      documentNumber: "CI/26-27/000001",
      documentType: TaxDocumentType.COMMERCIAL_INVOICE,
      issueDate: new Date("2026-07-20T10:00:00.000Z"),
      supplyDate: new Date("2026-07-20T10:00:00.000Z"),
      orderNumber: "ORD-1001",
      sellerLegalName: "Local Store",
      sellerTaxRegistrationStatus: SellerTaxRegistrationStatus.NOT_REGISTERED,
      sellerGstin: null,
      sellerAddressSnapshot: { line1: "1 Market Road", city: "Salem" },
      buyerLegalName: "Customer",
      buyerGstin: null,
      buyerAddressSnapshot: { line1: "2 Trade Road", city: "Salem" },
      placeOfSupplyStateCode: "33",
      supplyType: TaxSupplyType.INTRA_STATE,
      reverseCharge: false,
      currency: "INR",
      taxableValuePaise: 10000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      cessPaise: 0,
      totalTaxPaise: 0,
      invoiceValuePaise: 10000,
      lines: [
        {
          description: "Handmade basket",
          sku: "BASKET-1",
          hsnSacCode: "4602",
          taxClassification: ProductTaxClassification.TAXABLE,
          quantity: 1,
          uqc: "NOS",
          taxableValuePaise: 10000,
          gstRatePercent: 0,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          cessPaise: 0,
          lineValuePaise: 10000,
        },
      ],
    });

    expect(pdf.subarray(0, 8).toString("ascii")).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("Commercial Invoice");
    expect(pdf.toString("latin1")).toContain("Handmade basket");
    expect(taxDocumentDownloadFileName({
      documentNumber: "CI/26-27/000001",
      documentType: TaxDocumentType.COMMERCIAL_INVOICE,
    })).toBe("CI-26-27-000001.pdf");
  });
});
