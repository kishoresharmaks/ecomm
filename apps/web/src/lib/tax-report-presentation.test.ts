import { describe, expect, it } from "vitest";
import type { GstReport } from "./gst-report-api";
import {
  hasApplicableEInvoiceDocuments,
  hasApplicableEWayBillDocuments,
  hasB2BGstinActivity,
  sellerTaxRegime,
} from "./tax-report-presentation";

function reportFixture(): GstReport {
  return {
    currency: "INR",
    summary: {
      documentCount: 1,
      invoiceCount: 1,
      creditNoteCount: 0,
      debitNoteCount: 0,
      taxableValuePaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      cessPaise: 0,
      totalTaxPaise: 1800,
      invoiceValuePaise: 11800,
    },
    documents: [
      {
        id: "document-1",
        documentNumber: "TI/26-27/000001",
        documentType: "TAX_INVOICE",
        issueDate: "2026-07-20T00:00:00.000Z",
        financialYear: "26-27",
        sellerId: "seller-1",
        sellerName: "Test Seller",
        sellerTaxRegistrationStatus: "GST_REGISTERED",
        sellerGstin: "29ABCDE1234F1Z5",
        buyerLegalName: "Test Buyer",
        buyerGstin: "29AAAAA0000A1Z5",
        buyerAddress: {
          line1: "2 Trade Road",
          line2: "",
          area: "",
          city: "Bengaluru",
          state: "Karnataka",
          stateCode: "29",
          postalCode: "560001",
          country: "India",
          countryCode: "IN",
        },
        currency: "INR",
        taxableValuePaise: 10000,
        cgstPaise: 900,
        sgstPaise: 900,
        igstPaise: 0,
        cessPaise: 0,
        totalTaxPaise: 1800,
        invoiceValuePaise: 11800,
        compliance: {
          eInvoiceStatus: "READY",
          eWayBillStatus: "NOT_REQUIRED",
        },
        lines: [],
      },
    ],
    hsnSummary: [],
    sections: [],
    gstr1: {
      B2B: [],
      B2CL: [],
      B2CS: [],
      CDNR: [],
      CDNUR: [],
      EXPORT: [],
      SEZ: [],
      NIL_EXEMPT_NON_GST: [],
    },
    gstr3b: {
      table3_1: {
        outwardTaxable: moneyTotals(),
        zeroRated: moneyTotals(),
        nilExempt: moneyTotals(),
        inwardReverseCharge: moneyTotals(),
        nonGst: moneyTotals(),
      },
      table3_2: { unregistered: [], composition: [], uin: [] },
      sourceNote: "",
    },
    documentSeries: [],
    rateLiability: [],
    stateLiability: [],
    gstinSummary: [
      {
        buyerGstin: "29AAAAA0000A1Z5",
        buyerLegalName: "Test Buyer",
        documentCount: 1,
        ...moneyTotals(),
      },
    ],
    reconciliation: {
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      readyToLock: true,
      books: {
        documentCount: 1,
        invoiceCount: 1,
        creditNoteCount: 0,
        debitNoteCount: 0,
        ...moneyTotals(),
      },
      filing: {
        documentCount: 1,
        invoiceCount: 1,
        creditNoteCount: 0,
        debitNoteCount: 0,
        ...moneyTotals(),
      },
      difference: {
        taxableValuePaise: 0,
        totalTaxPaise: 0,
        invoiceValuePaise: 0,
      },
      issues: [],
    },
    tcs: {
      summary: {
        sellerCount: 0,
        transactionCount: 0,
        grossSuppliesPaise: 0,
        returnsPaise: 0,
        netSuppliesPaise: 0,
        igstPaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        totalTcsPaise: 0,
      },
      statements: [],
    },
    platformCommission: {
      configured: true,
      missingConfiguration: [],
      summary: { documentCount: 0, ...moneyTotals() },
      documents: [],
    },
    providerReadiness: {
      eInvoice: {
        enabled: true,
        provider: "MANUAL",
        credentialsConfigured: true,
        mode: "MANUAL",
      },
      eWayBill: {
        enabled: true,
        provider: "MANUAL",
        thresholdPaise: 5_000_000,
        credentialsConfigured: true,
        mode: "MANUAL",
      },
      platformInvoice: { configured: true, missingConfiguration: [] },
    },
    filingPeriods: [],
    truncated: false,
  };
}

function moneyTotals() {
  return {
    taxableValuePaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    cessPaise: 0,
    totalTaxPaise: 0,
    invoiceValuePaise: 0,
  };
}

describe("tax report presentation", () => {
  it("uses Indian GST only for India and defaults missing legacy country data to India", () => {
    expect(sellerTaxRegime("IN")).toBe("INDIA_GST");
    expect(sellerTaxRegime("sg")).toBe("GENERIC");
    expect(sellerTaxRegime()).toBe("INDIA_GST");
  });

  it("shows conditional compliance exports only when documents are applicable", () => {
    const report = reportFixture();
    expect(hasApplicableEInvoiceDocuments(report)).toBe(true);
    expect(hasApplicableEWayBillDocuments(report)).toBe(false);

    report.documents[0]!.compliance.eWayBillStatus = "READY";
    expect(hasApplicableEWayBillDocuments(report)).toBe(true);
  });

  it("shows the GSTIN summary only when registered-recipient activity exists", () => {
    const report = reportFixture();
    expect(hasB2BGstinActivity(report)).toBe(true);
    report.gstinSummary = [];
    expect(hasB2BGstinActivity(report)).toBe(false);
  });
});
