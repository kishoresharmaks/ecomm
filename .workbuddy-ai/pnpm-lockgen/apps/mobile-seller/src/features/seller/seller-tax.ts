import type {
  SellerDocumentType,
  SellerTaxRegistrationStatus,
  SellerVerificationDocumentPayload,
} from "./seller-api";

export const SELLER_TAX_REGISTRATION_OPTIONS = [
  { label: "GST registered", value: "GST_REGISTERED" },
  { label: "Composition scheme", value: "COMPOSITION" },
  { label: "Not registered for GST", value: "NOT_REGISTERED" },
] satisfies Array<{ label: string; value: SellerTaxRegistrationStatus }>;

export const BASE_ONBOARDING_DOCUMENT_TYPES = [
  "ID_PROOF",
  "SIGNATURE_PROOF",
  "ADDRESS_PROOF",
  "BANK_PROOF",
] satisfies SellerDocumentType[];

export function normalizeGstin(value: string) {
  return value.trim().toUpperCase();
}

export function validateGstin(status: SellerTaxRegistrationStatus, value: string) {
  if (status === "NOT_REGISTERED") {
    return undefined;
  }
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGstin(value))
    ? undefined
    : "Enter a valid 15-character GSTIN.";
}

export function requiredOnboardingDocumentTypes(status: SellerTaxRegistrationStatus) {
  return status === "NOT_REGISTERED"
    ? [...BASE_ONBOARDING_DOCUMENT_TYPES]
    : [...BASE_ONBOARDING_DOCUMENT_TYPES, "GST_CERTIFICATE" as const];
}

export function missingOnboardingDocumentTypes(
  status: SellerTaxRegistrationStatus,
  documents: SellerVerificationDocumentPayload[],
) {
  const uploaded = new Set(documents.map((document) => document.documentType));
  return requiredOnboardingDocumentTypes(status).filter((type) => !uploaded.has(type));
}
