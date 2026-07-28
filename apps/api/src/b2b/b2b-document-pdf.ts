import { renderProfessionalPdf } from "../documents/professional-pdf";

type B2BParty = {
  name: string;
  gstin?: string | null;
  registration?: string | null;
  address?: string | null;
};

export type B2BProformaPdfInput = {
  proformaNumber: string;
  orderNumber: string;
  issuedAt: string;
  expiresAt: string;
  paymentDueAt: string;
  buyer: B2BParty;
  seller: B2BParty;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  transportMode: string;
  transportStatus: string;
  transportCharge: string;
  transportPartner?: string | null;
  transportEta?: string | null;
  buyerPayable: string;
};

export type B2BReceiptVoucherPdfInput = {
  voucherNumber: string;
  orderNumber: string;
  issuedAt: string;
  buyerName: string;
  sellerName: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  amount: string;
};

export function renderB2BProformaPdf(input: B2BProformaPdfInput) {
  return renderProfessionalPdf({
    title: "Proforma Invoice",
    documentNumber: input.proformaNumber,
    status: "Proforma",
    subtitle: "Quotation document for payment and purchase-order processing. This is not a tax invoice.",
    issuedBy: input.seller.name,
    issuerCaption: "Seller-issued proforma invoice powered by 1HandIndia",
    poweredByPlatform: true,
    metadata: [
      { label: "Proforma number", value: input.proformaNumber },
      { label: "B2B order number", value: input.orderNumber },
      { label: "Issue date", value: input.issuedAt },
      { label: "Valid until", value: input.expiresAt },
      { label: "Payment due", value: input.paymentDueAt },
      { label: "Document status", value: "Proforma - not a tax invoice" },
    ],
    parties: [
      {
        label: "Seller / Supplier",
        name: input.seller.name,
        lines: [
          `GST registration: ${input.seller.registration ?? "Not provided"}`,
          `GSTIN: ${input.seller.gstin ?? "Not provided"}`,
          input.seller.address ?? "Address not recorded",
        ],
      },
      {
        label: "Buyer",
        name: input.buyer.name,
        lines: [
          `GSTIN: ${input.buyer.gstin ?? "Not provided"}`,
          input.buyer.address ?? "Address not recorded",
        ],
      },
    ],
    sections: [
      {
        type: "table",
        title: "Commercial details",
        columns: [
          { key: "description", label: "Description", width: 230 },
          { key: "quantity", label: "Quantity", width: 70, align: "right" },
          { key: "unitPrice", label: "Unit price", width: 105, align: "right" },
          { key: "subtotal", label: "Subtotal", width: 105, align: "right" },
        ],
        rows: [{
          description: input.itemDescription,
          quantity: String(input.quantity),
          unitPrice: input.unitPrice,
          subtotal: input.subtotal,
        }],
      },
      {
        type: "fields",
        title: "Delivery and transport",
        fields: [
          { label: "Transport mode", value: input.transportMode },
          { label: "Transport status", value: input.transportStatus },
          { label: "Transport partner", value: input.transportPartner ?? "Not assigned" },
          { label: "Estimated delivery", value: input.transportEta ?? "Not provided" },
        ],
      },
      {
        type: "totals",
        emphasizedLabel: "Buyer payable",
        rows: [
          { label: "Goods subtotal", value: input.subtotal },
          { label: "Transport charge", value: input.transportCharge },
          { label: "Buyer payable", value: input.buyerPayable },
        ],
      },
    ],
    footerLines: [
      "Payment instructions and approved bank-transfer details are available in the authenticated B2B order workspace.",
      "Tax treatment and the final statutory document are determined when the order reaches the applicable invoicing stage.",
    ],
    fileTitle: `Proforma invoice ${input.proformaNumber}`,
  });
}

export function renderB2BReceiptVoucherPdf(input: B2BReceiptVoucherPdfInput) {
  return renderProfessionalPdf({
    title: "B2B Receipt Voucher",
    documentNumber: input.voucherNumber,
    status: input.paymentStatus,
    subtitle: "Payment acknowledgement for the referenced B2B sales order.",
    issuedBy: "1HandIndia B2B Payments",
    issuerCaption: "Marketplace payment allocation record",
    metadata: [
      { label: "Voucher number", value: input.voucherNumber },
      { label: "B2B order number", value: input.orderNumber },
      { label: "Issued at", value: input.issuedAt },
      { label: "Payment status", value: input.paymentStatus },
    ],
    parties: [
      { label: "Payment received from", name: input.buyerName },
      { label: "Payment allocated to", name: input.sellerName },
    ],
    sections: [
      {
        type: "fields",
        title: "Payment details",
        fields: [
          { label: "Payment method", value: input.paymentMethod },
          { label: "Payment reference", value: input.paymentReference },
        ],
      },
      {
        type: "totals",
        emphasizedLabel: "Amount received",
        rows: [{ label: "Amount received", value: input.amount }],
      },
    ],
    footerLines: [
      "This receipt records payment received and allocated by 1HandIndia against the referenced B2B order.",
      "This receipt is not a substitute for the seller-issued tax invoice, bill of supply, or commercial invoice.",
    ],
    fileTitle: `B2B receipt voucher ${input.voucherNumber}`,
  });
}
