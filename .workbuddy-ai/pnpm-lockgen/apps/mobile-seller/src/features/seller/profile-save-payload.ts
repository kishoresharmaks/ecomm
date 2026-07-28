import { buildSellerPayoutProfilePayload } from "./profile-payout";
import { optionalSellerProfileText } from "./profile-validation";
import type {
  SellerProfile,
  SellerProfilePayload,
  SellerTaxRegistrationStatus,
  SellerVerificationDocumentPayload,
} from "./seller-api";
import { normalizeGstin } from "./seller-tax";

export type SellerProfileFormFields = {
  storeName: string;
  description: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  businessLegalName: string;
  businessType: string;
  taxRegistrationStatus: SellerTaxRegistrationStatus;
  gstNumber: string;
  panNumber: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
};

export function emptySellerProfileFormFields(): SellerProfileFormFields {
  return {
    storeName: "",
    description: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    businessLegalName: "",
    businessType: "",
    taxRegistrationStatus: "NOT_REGISTERED",
    gstNumber: "",
    panNumber: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    logoUrl: null,
    bannerUrl: null,
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
  };
}

export function sellerProfileToFormFields(profile: SellerProfile): SellerProfileFormFields {
  const payout = profile.payoutProfile;
  const address = profile.addresses?.[0];

  return {
    storeName: profile.storeName ?? "",
    description: profile.profile?.description ?? profile.description ?? "",
    contactName: profile.profile?.contactName ?? "",
    contactPhone: profile.profile?.contactPhone ?? "",
    contactEmail: profile.profile?.contactEmail ?? "",
    businessLegalName: profile.profile?.businessLegalName ?? "",
    businessType: profile.profile?.businessType ?? "",
    taxRegistrationStatus:
      profile.profile?.taxRegistrationStatus ??
      (profile.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED"),
    gstNumber: profile.profile?.gstNumber ?? "",
    panNumber: profile.profile?.panNumber ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    pincode: address?.pincode ?? "",
    logoUrl: profile.profile?.logoUrl ?? profile.logoUrl ?? null,
    bannerUrl: profile.profile?.bannerUrl ?? profile.bannerUrl ?? null,
    accountHolderName: payout?.accountHolderName ?? "",
    bankName: payout?.bankName ?? "",
    accountNumber: "",
    ifscCode: payout?.ifscCode ?? "",
    upiId: "",
  };
}

export function hasSellerProfileUnsavedChanges(
  profile: SellerProfile | undefined,
  fields: SellerProfileFormFields,
  documentCount: number,
) {
  if (!profile) {
    return false;
  }

  const original = sellerProfileToFormFields(profile);

  return (
    fields.storeName !== original.storeName ||
    fields.description !== original.description ||
    fields.contactName !== original.contactName ||
    fields.contactPhone !== original.contactPhone ||
    fields.contactEmail !== original.contactEmail ||
    fields.businessLegalName !== original.businessLegalName ||
    fields.businessType !== original.businessType ||
    fields.taxRegistrationStatus !== original.taxRegistrationStatus ||
    normalizeGstin(fields.gstNumber) !== normalizeGstin(original.gstNumber) ||
    fields.panNumber !== original.panNumber ||
    fields.line1 !== original.line1 ||
    fields.line2 !== original.line2 ||
    fields.city !== original.city ||
    fields.state !== original.state ||
    fields.pincode !== original.pincode ||
    fields.logoUrl !== original.logoUrl ||
    fields.bannerUrl !== original.bannerUrl ||
    fields.accountHolderName !== original.accountHolderName ||
    fields.bankName !== original.bankName ||
    fields.ifscCode !== original.ifscCode ||
    fields.accountNumber.trim() !== "" ||
    fields.upiId.trim() !== "" ||
    documentCount > 0
  );
}

export function buildSellerProfilePatchPayload(
  profile: SellerProfile,
  fields: SellerProfileFormFields,
  documents: SellerVerificationDocumentPayload[],
): SellerProfilePayload {
  const original = sellerProfileToFormFields(profile);
  const payload: SellerProfilePayload = {};

  if (fields.storeName !== original.storeName) {
    payload.storeName = fields.storeName;
  }

  if (fields.description !== original.description) {
    payload.description = fields.description.trim();
  }

  if (fields.contactName !== original.contactName) {
    payload.contactName = fields.contactName;
  }

  if (fields.contactPhone !== original.contactPhone) {
    payload.contactPhone = fields.contactPhone;
  }

  if (fields.contactEmail !== original.contactEmail) {
    payload.contactEmail = fields.contactEmail;
  }

  const businessLegalName = optionalSellerProfileText(fields.businessLegalName);
  if (fields.businessLegalName !== original.businessLegalName && businessLegalName) {
    payload.businessLegalName = businessLegalName;
  }

  const businessType = optionalSellerProfileText(fields.businessType);
  if (fields.businessType !== original.businessType) {
    payload.businessType = businessType ?? null;
  }

  if (fields.taxRegistrationStatus !== original.taxRegistrationStatus) {
    payload.taxRegistrationStatus = fields.taxRegistrationStatus;
  }

  if (fields.taxRegistrationStatus !== "NOT_REGISTERED") {
    const gstNumber = normalizeGstin(fields.gstNumber);
    if (gstNumber !== original.gstNumber) {
      payload.gstNumber = gstNumber;
    }
  }

  const panNumber = optionalSellerProfileText(fields.panNumber);
  if (fields.panNumber !== original.panNumber && panNumber) {
    payload.panNumber = panNumber;
  }

  if (fields.logoUrl !== original.logoUrl) {
    payload.logoUrl = fields.logoUrl;
  }

  if (fields.bannerUrl !== original.bannerUrl) {
    payload.bannerUrl = fields.bannerUrl;
  }

  if (addressChanged(fields, original)) {
    payload.address = {
      line1: fields.line1,
      line2: fields.line2,
      city: fields.city,
      state: fields.state,
      pincode: fields.pincode,
      country: "India",
      countryCode: "IN",
    };
  }

  const payoutProfile = buildChangedPayoutPayload(fields, original);
  if (payoutProfile) {
    payload.payoutProfile = payoutProfile;
  }

  if (documents.length > 0) {
    payload.documents = documents;
  }

  return payload;
}

function addressChanged(fields: SellerProfileFormFields, original: SellerProfileFormFields) {
  return (
    fields.line1 !== original.line1 ||
    fields.line2 !== original.line2 ||
    fields.city !== original.city ||
    fields.state !== original.state ||
    fields.pincode !== original.pincode
  );
}

function buildChangedPayoutPayload(
  fields: SellerProfileFormFields,
  original: SellerProfileFormFields,
): SellerProfilePayload["payoutProfile"] | undefined {
  const visiblePayoutDraft = buildSellerPayoutProfilePayload({
    accountHolderName: fields.accountHolderName !== original.accountHolderName ? fields.accountHolderName : "",
    bankName: fields.bankName !== original.bankName ? fields.bankName : "",
    accountNumber: fields.accountNumber,
    ifscCode: fields.ifscCode !== original.ifscCode ? fields.ifscCode : "",
    upiId: fields.upiId,
  });

  return visiblePayoutDraft;
}
