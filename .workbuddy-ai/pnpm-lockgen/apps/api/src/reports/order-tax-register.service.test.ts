import { describe, expect, it } from "vitest";
import {
  PaymentStatus,
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentStatus,
  TaxDocumentType,
} from "@indihub/database";
import {
  reconcileOrderTaxAmounts,
  taxDocumentReadiness,
} from "./order-tax-register.service";
import {
  OrderTaxReadinessStatus,
  OrderTaxReconciliationStatus,
} from "./dto/order-tax-register-query.dto";

describe("order tax register accounting rules", () => {
  it("marks proven zero-value cancelled transactions as not required", () => {
    expect(
      taxDocumentReadiness({
        documentStatus: null,
        documentNumber: null,
        documentDate: null,
        sellerTaxRegistrationStatus:
          SellerTaxRegistrationStatus.NOT_REGISTERED,
        sellerGstin: null,
        taxClassification: ProductTaxClassification.NON_GST,
        hsnSacCode: null,
        gstRatePercent: 0,
        notRequired: true,
      }),
    ).toBe(OrderTaxReadinessStatus.NOT_REQUIRED);
  });

  it("keeps issued taxable GST documents incomplete until identity and HSN are present", () => {
    expect(
      taxDocumentReadiness({
        documentStatus: TaxDocumentStatus.ISSUED,
        documentNumber: "TI/26-27/1",
        documentDate: new Date("2026-07-22T00:00:00.000Z"),
        sellerTaxRegistrationStatus:
          SellerTaxRegistrationStatus.GST_REGISTERED,
        sellerGstin: "29ABCDE1234F1Z5",
        taxClassification: ProductTaxClassification.TAXABLE,
        hsnSacCode: null,
        gstRatePercent: 18,
        notRequired: false,
      }),
    ).toBe(OrderTaxReadinessStatus.INCOMPLETE_DOCUMENT);
  });

  it("matches invoice, transaction, and payment within one paise tolerance", () => {
    const result = reconcileOrderTaxAmounts({
      documentStatus: TaxDocumentStatus.ISSUED,
      documentType: TaxDocumentType.TAX_INVOICE,
      invoiceValuePaise: 10_000,
      orderValuePaise: 10_001,
      paidAmountPaise: 9_999,
      paymentStatus: PaymentStatus.PAID,
      paymentComparable: true,
    });
    expect(result.status).toBe(OrderTaxReconciliationStatus.MATCHED);
    expect(result.warnings).toEqual([]);
  });

  it("does not compare an order-wide payment with one seller invoice", () => {
    const result = reconcileOrderTaxAmounts({
      documentStatus: TaxDocumentStatus.ISSUED,
      documentType: TaxDocumentType.TAX_INVOICE,
      invoiceValuePaise: 10_000,
      orderValuePaise: 10_000,
      paidAmountPaise: 25_000,
      paymentStatus: PaymentStatus.PAID,
      paymentComparable: false,
    });
    expect(result.status).toBe(
      OrderTaxReconciliationStatus.NOT_COMPARABLE,
    );
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "PAYMENT_SCOPE_MISMATCH",
    );
  });

  it("reports comparable payment differences as mismatches", () => {
    const result = reconcileOrderTaxAmounts({
      documentStatus: TaxDocumentStatus.ISSUED,
      documentType: TaxDocumentType.TAX_INVOICE,
      invoiceValuePaise: 10_000,
      orderValuePaise: 10_000,
      paidAmountPaise: 9_500,
      paymentStatus: PaymentStatus.PAID,
      paymentComparable: true,
    });
    expect(result.status).toBe(OrderTaxReconciliationStatus.MISMATCH);
    expect(result.paymentInvoiceDifferencePaise).toBe(-500);
  });
});
