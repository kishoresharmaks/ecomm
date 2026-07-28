import { describe, expect, it } from "vitest";
import { gstRegisterCsv, gstr1OrientedCsv, hsnSummaryCsv } from "./gst-report-csv";

describe("GST report CSV generation", () => {
  it("escapes document text and renders signed GST register values", () => {
    const output = gstRegisterCsv(reportFixture());

    expect(output).toContain('"Buyer ""Registered"", Limited"');
    expect(output).toContain('"TI/26-27/000001"');
    expect(output).toContain('"Address Line 1"');
    expect(output).toContain('"2 Trade ""Centre"""');
    expect(output).toContain('"400001"');
    expect(output).toContain('"100.00"');
    expect(output.split("\n")).toHaveLength(2);
  });

  it("renders HSN summary quantities and tax totals", () => {
    const output = hsnSummaryCsv(reportFixture());

    expect(output).toContain('"610910"');
    expect(output).toContain('"2"');
    expect(output).toContain('"18"');
    expect(output).toContain('"18.00"');
  });

  it("groups GSTR-1-oriented rows by GST rate", () => {
    const output = gstr1OrientedCsv(reportFixture());

    expect(output).toContain('"B2B"');
    expect(output).toContain('"29ABCDE1234F1Z5"');
    expect(output).toContain('"27ABCDE1234F1Z5"');
    expect(output).toContain('"18"');
    expect(output.split("\n")).toHaveLength(2);
  });
});

function reportFixture() {
  return {
    documents: [
      {
        documentNumber: "TI/26-27/000001",
        documentType: "TAX_INVOICE",
        issueDate: "2026-07-20T00:00:00.000Z",
        orderNumber: "1HI-1",
        sellerName: "Tax Ready Store",
        sellerGstin: "29ABCDE1234F1Z5",
        buyerLegalName: 'Buyer "Registered", Limited',
        buyerGstin: "27ABCDE1234F1Z5",
        buyerAddress: {
          line1: '2 Trade "Centre"',
          line2: "",
          area: "Fort",
          city: "Mumbai",
          state: "Maharashtra",
          stateCode: "27",
          postalCode: "400001",
          country: "India",
          countryCode: "IN",
        },
        placeOfSupplyStateCode: "27",
        supplyType: "INTER_STATE",
        gstrSupplySection: "B2B",
        originalDocumentNumber: null,
        reason: null,
        taxableValuePaise: 10000,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 1800,
        cessPaise: 0,
        totalTaxPaise: 1800,
        invoiceValuePaise: 11800,
        lines: [
          {
            hsnSacCode: "610910",
            description: "Cotton shirt",
            quantity: 2,
            uqc: "NOS",
            gstRatePercent: 18,
            taxableValuePaise: 10000,
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 1800,
            cessPaise: 0,
            totalTaxPaise: 1800,
            lineValuePaise: 11800,
          },
        ],
      },
    ],
    hsnSummary: [
      {
        hsnSacCode: "610910",
        description: "Cotton shirt",
        uqc: "NOS",
        gstRatePercent: 18,
        quantity: 2,
        taxableValuePaise: 10000,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 1800,
        cessPaise: 0,
        totalTaxPaise: 1800,
      },
    ],
  };
}
