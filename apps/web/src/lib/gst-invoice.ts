export const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstInvoiceDetails = {
  buyerGstin: string;
  buyerLegalName: string;
};

export function normalizeGstin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function validateGstInvoiceDetails(
  buyerGstin: string,
  buyerLegalName: string,
): { details?: GstInvoiceDetails; error?: string } {
  const normalizedGstin = normalizeGstin(buyerGstin);
  const normalizedLegalName = buyerLegalName.trim().replace(/\s+/g, " ");

  if (!gstinPattern.test(normalizedGstin)) {
    return { error: "Enter a valid 15-character GSTIN." };
  }

  if (normalizedLegalName.length < 2) {
    return { error: "Enter the registered legal name for the GST invoice." };
  }

  return {
    details: {
      buyerGstin: normalizedGstin,
      buyerLegalName: normalizedLegalName,
    },
  };
}
