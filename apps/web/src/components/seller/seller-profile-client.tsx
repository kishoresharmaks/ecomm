"use client";

import { type ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CreditCard, ExternalLink, FileText, Loader2, MapPinned, Store, Truck, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { LocationFields } from "@/components/locations/location-fields";
import { MapLocationPicker } from "@/components/maps/map-location-picker";
import { type IndihubAuthHeaders } from "@/lib/api";
import {
  uploadSellerDocument,
  type SellerDocumentType,
  type SellerDocumentUploadResult,
} from "@/lib/seller-document-upload";
import {
  getSellerProfile,
  syncSellerCourierPickup,
  updateSellerProfile,
  type SellerBusinessType,
  type SellerProfile,
  type SellerProfilePayload,
  type SellerServiceArea,
  type SellerVerificationDocument,
} from "@/lib/seller-api";
import {
  SellerServiceAreaEditor,
  createEmptySellerServiceAreaDraft,
  createSellerServiceAreaDraftId,
  type SellerServiceAreaDraft,
} from "./seller-service-area-editor";
import {
  SellerAuthNotice,
  SellerErrorPanel,
  SellerField,
  SellerImageUpload,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formValue,
  isSellerOnboardingRequiredError,
  optionalFormValue,
  useSellerAuth,
} from "./seller-ui";
import { EditStoreDetailsModal, EditPayoutModal, EditAddressModal, EditDocumentsModal } from "./seller-profile-modals";

const businessTypes: Array<{ value: SellerBusinessType; label: string }> = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "PRIVATE_LIMITED", label: "Private limited" },
  { value: "PUBLIC_LIMITED", label: "Public limited" },
  { value: "OTHER", label: "Other" },
];

const verificationDocuments: Array<{
  type: SellerDocumentType;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    type: "ID_PROOF",
    label: "ID proof",
    description: "Aadhaar, passport, voter ID, driving licence, or business-authorized ID proof.",
    required: true,
  },
  {
    type: "SIGNATURE_PROOF",
    label: "Signature proof",
    description: "Signed declaration, signature image, or authorization letter.",
    required: true,
  },
  {
    type: "GST_CERTIFICATE",
    label: "GST certificate",
    description: "For GST-registered sellers. Upload your GST registration certificate.",
    required: false,
  },
  {
    type: "FSSAI_CERTIFICATE",
    label: "FSSAI certificate",
    description: "Required for food product sellers. Upload your FSSAI license or registration certificate.",
    required: false,
  },
  { type: "PAN_CARD", label: "PAN card", description: "Business or proprietor PAN proof if available.", required: false },
  {
    type: "ADDRESS_PROOF",
    label: "Address proof",
    description: "Shop, office, or pickup address proof.",
    required: true,
  },
  {
    type: "BANK_PROOF",
    label: "Bank proof",
    description: "Cancelled cheque or bank proof for payouts.",
    required: true,
  },
];

export function SellerProfileClient() {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [activeModal, setActiveModal] = useState<"STORE_DETAILS" | "PAYOUT" | "ADDRESS" | "DOCUMENTS" | null>(null);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (profileQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (profileQuery.error) {
    if (isSellerOnboardingRequiredError(profileQuery.error)) {
      return (
        <SellerOnboardingRequired message="Submit seller onboarding first, then return here to maintain your store profile." />
      );
    }
    return <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  const profileData = profileQuery.data;
  const address = profileData?.addresses?.[0];
  const payoutProfile = profileData?.payoutProfile;

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F2933]">Store Profile</h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Manage your business details, documents, and address.
          </p>
        </div>
        <StatusBadge tone={profileData?.status === "APPROVED" ? "success" : "warning"}>
          {profileData?.status === "APPROVED" ? "Active Store" : "Pending Approval"}
        </StatusBadge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Store Details Card */}
        <SellerPanel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1F2933]">Store Details</h2>
            <Button variant="outline" size="sm" onClick={() => setActiveModal("STORE_DETAILS")}>Edit</Button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 text-sm font-medium text-[#1F2933]">
            <div className="flex items-center gap-4">
              {profileData?.profile?.logoUrl ? (
                <img src={profileData.profile.logoUrl} alt="Logo" className="h-12 w-12 rounded-full object-cover border" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-[#EAF1F7] flex items-center justify-center text-[#163B5C] font-bold">
                  {profileData?.storeName?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-bold">{profileData?.storeName}</p>
                <p className="text-[#667085]">{profileData?.profile?.businessLegalName || "No legal name set"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 mt-2">
              <div>
                <span className="block text-xs text-[#667085]">Contact Name</span>
                <span>{profileData?.profile?.contactName || "Not set"}</span>
              </div>
              <div>
                <span className="block text-xs text-[#667085]">Phone</span>
                <span>{profileData?.profile?.contactPhone || "Not set"}</span>
              </div>
              <div>
                <span className="block text-xs text-[#667085]">Email</span>
                <span>{profileData?.profile?.contactEmail || "Not set"}</span>
              </div>
              <div>
                <span className="block text-xs text-[#667085]">GST/PAN</span>
                <span>{profileData?.profile?.gstNumber || profileData?.profile?.panNumber || "Not set"}</span>
              </div>
            </div>
          </div>
        </SellerPanel>

        {/* Payout Information Card */}
        <SellerPanel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1F2933]">Payout Information</h2>
            <Button variant="outline" size="sm" onClick={() => setActiveModal("PAYOUT")}>Edit</Button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 text-sm font-medium text-[#1F2933]">
            {payoutProfile ? (
              <div className="grid grid-cols-2 gap-y-4">
                <div className="col-span-2">
                  <span className="block text-xs text-[#667085]">Account Holder</span>
                  <span className="text-base">{payoutProfile.accountHolderName || "Not set"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#667085]">Bank Name</span>
                  <span>{payoutProfile.bankName || "Not set"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#667085]">Account Number</span>
                  <span>{payoutProfile.maskedAccountNumber || "Not set"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#667085]">IFSC Code</span>
                  <span>{payoutProfile.ifscCode || "Not set"}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#667085]">UPI ID</span>
                  <span>{payoutProfile.maskedUpiId || "Not set"}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-[#667085]">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No payout details added yet.</p>
              </div>
            )}
          </div>
        </SellerPanel>

        {/* Business Address Card */}
        <SellerPanel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1F2933]">Business Address</h2>
            <Button variant="outline" size="sm" onClick={() => setActiveModal("ADDRESS")}>Edit</Button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 text-sm font-medium text-[#1F2933]">
            {address ? (
              <div>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>{[address.city, address.state, address.pincode].filter(Boolean).join(", ")}</p>
                <p>{address.country || "India"}</p>
              </div>
            ) : (
              <div className="py-6 text-center text-[#667085]">
                <MapPinned className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No business address added yet.</p>
              </div>
            )}
          </div>
        </SellerPanel>

        {/* Verification Documents Card */}
        <SellerPanel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1F2933]">Verification Documents</h2>
            <Button variant="outline" size="sm" onClick={() => setActiveModal("DOCUMENTS")}>Manage</Button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-3 text-sm font-medium text-[#1F2933]">
            <div className="flex items-center justify-between p-3 rounded-md border border-[#EAF1F7] bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#667085]" />
                <div>
                  <p className="font-bold">Documents</p>
                  <p className="text-xs text-[#667085]">{profileData?.documents?.length || 0} uploaded</p>
                </div>
              </div>
              <StatusBadge tone={(profileData?.documents?.length || 0) > 1 ? "success" : "warning"}>
                {(profileData?.documents?.length || 0) > 1 ? "Provided" : "Action Needed"}
              </StatusBadge>
            </div>
            <p className="text-xs text-[#667085] mt-2">
              Upload your ID proof, address proof, and business registrations.
            </p>
          </div>
        </SellerPanel>
      </div>

      {activeModal === "STORE_DETAILS" && (
        <EditStoreDetailsModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData}
          businessTypes={businessTypes}
        />
      )}
      {activeModal === "PAYOUT" && (
        <EditPayoutModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData}
        />
      )}
      {activeModal === "ADDRESS" && (
        <EditAddressModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData}
        />
      )}
      {activeModal === "DOCUMENTS" && (
        <EditDocumentsModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData}
          verificationDocuments={verificationDocuments}
          DocumentUploadField={DocumentUploadField}
        />
      )}
    </div>
  );
}

function DocumentUploadField({
  document,
  value,
  storedDocument,
  authHeaders,
  disabled,
  onUploaded,
}: {
  document: { type: SellerDocumentType; label: string; description: string; required: boolean };
  value?: SellerDocumentUploadResult | undefined;
  storedDocument?: SellerVerificationDocument | undefined;
  authHeaders: IndihubAuthHeaders;
  disabled?: boolean;
  onUploaded: (uploaded: SellerDocumentUploadResult) => void;
}) {
  const [status, setStatus] = useState<{ type: "idle" | "uploading" | "error"; message?: string }>({
    type: "idle",
  });

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatus({ type: "uploading", message: "Uploading document..." });
    try {
      const uploaded = await uploadSellerDocument(authHeaders, file, document.type);
      onUploaded(uploaded);
      setStatus({ type: "idle" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Document upload failed.",
      });
    } finally {
      event.target.value = "";
    }
  }

  const hasStored = Boolean(storedDocument?.status);
  const isUploaded = Boolean(value);

  return (
    <label
      className={`block rounded-md border p-3 transition ${
        isUploaded || hasStored
          ? "border-[#32B877] bg-[#F0FDF6]"
          : document.required
            ? "border-[#F5B7B7] bg-[#FFF8F8]"
            : "border-[#D8E2EA] bg-[#F8FAFC]"
      }`}
    >
      <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black text-[#1F2933]">{document.label}</span>
            {document.required ? (
              <span className="text-sm font-black text-[#ED3500]" aria-label="Required">*</span>
            ) : null}
            {document.required ? (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#FFF0EC] text-[#ED3500]">
                Required
              </span>
            ) : (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#F3F4F6] text-[#9CA3AF]">
                Optional
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
            {value ? (
              <span className="flex items-center gap-1 text-[#0F8A5F]">
                <span>✓</span>
                <span>{value.fileName}</span>
              </span>
            ) : storedDocument?.status ? (
              <span className={storedDocument.status === "APPROVED" ? "text-[#0F8A5F]" : undefined}>
                {humanize(storedDocument.status)} / {storedDocument.fileName ?? "Uploaded document"}
              </span>
            ) : (
              document.description
            )}
          </span>
        </span>
        <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-xs font-black text-[#163B5C]">
          {status.type === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {value ? "Replace" : "Upload"}
        </span>
      </span>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={disabled || status.type === "uploading"}
        onChange={onFileChange}
        className="sr-only"
      />
      {status.type === "error" ? (
        <span className="mt-2 block text-xs font-bold text-[#B42318]">{status.message}</span>
      ) : null}
    </label>
  );
}

function sellerPayoutProfilePayload(form: FormData): SellerProfilePayload["payoutProfile"] | undefined {
  const payload = {
    accountHolderName: optionalFormValue(form, "payoutAccountHolderName"),
    bankName: optionalFormValue(form, "payoutBankName"),
    accountNumber: optionalFormValue(form, "payoutAccountNumber"),
    ifscCode: optionalFormValue(form, "payoutIfscCode"),
    upiId: optionalFormValue(form, "payoutUpiId"),
  };

  return Object.values(payload).some(Boolean) ? payload : undefined;
}

function sellerHasServiceCapability(profile?: SellerProfile | null) {
  return Boolean(
    profile?.primaryCapability === "SERVICE" ||
      profile?.enabledCapabilities?.includes("SERVICE"),
  );
}

function profileServiceAreasToDraft(
  areas: SellerServiceArea[] | undefined,
  address: SellerProfile["addresses"][number] | undefined,
) {
  const savedAreas = (areas ?? []).map((area) => draftServiceAreaFromProfile(area));
  if (savedAreas.length) {
    return savedAreas;
  }

  return address ? [draftServiceAreaFromAddress(address)] : [];
}

function draftServiceAreaFromProfile(area: SellerServiceArea): SellerServiceAreaDraft {
  return {
    id: area.id ?? draftAreaId(),
    label: area.label ?? "",
    countryCode: area.countryCode ?? "",
    stateCode: area.stateCode ?? "",
    cityCode: area.cityCode ?? "",
    localAreaCode: area.localAreaCode ?? "",
    pincode: area.pincode ?? "",
    latitude: stringifyOptional(area.latitude),
    longitude: stringifyOptional(area.longitude),
    radiusKm: stringifyOptional(area.radiusKm),
    isActive: area.isActive ?? true,
  };
}

function draftServiceAreaFromAddress(address: SellerProfile["addresses"][number]): SellerServiceAreaDraft {
  return {
    id: draftAreaId(),
    label: [address.area, address.city].filter(Boolean).join(" / ") || "Primary service area",
    countryCode: address.countryCode ?? "IN",
    stateCode: address.stateCode ?? "",
    cityCode: address.cityCode ?? "",
    localAreaCode: address.localAreaCode ?? "",
    pincode: address.pincode ?? "",
    latitude: stringifyOptional(address.latitude),
    longitude: stringifyOptional(address.longitude),
    radiusKm: "10",
    isActive: true,
  };
}

function emptyDraftServiceArea(): SellerServiceAreaDraft {
  return createEmptySellerServiceAreaDraft({
    label: "",
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    localAreaCode: "",
    pincode: "",
    latitude: "",
    longitude: "",
    radiusKm: "10",
    isActive: true,
  });
}

function draftServiceAreasToPayload(areas: SellerServiceAreaDraft[]): NonNullable<SellerProfilePayload["serviceAreas"]> {
  return areas
    .map((area) => {
      const latitude = optionalNumber(area.latitude);
      const longitude = optionalNumber(area.longitude);
      const radiusKm = optionalNumber(area.radiusKm);
      const payload: NonNullable<SellerProfilePayload["serviceAreas"]>[number] = {
        isActive: area.isActive,
      };
      const label = optionalString(area.label);
      const countryCode = optionalString(area.countryCode);
      const stateCode = optionalString(area.stateCode);
      const cityCode = optionalString(area.cityCode);
      const localAreaCode = optionalString(area.localAreaCode);
      const pincode = optionalString(area.pincode);
      if (label) payload.label = label;
      if (countryCode) payload.countryCode = countryCode;
      if (stateCode) payload.stateCode = stateCode;
      if (cityCode) payload.cityCode = cityCode;
      if (localAreaCode) payload.localAreaCode = localAreaCode;
      if (pincode) payload.pincode = pincode;
      if (latitude !== undefined) payload.latitude = latitude;
      if (longitude !== undefined) payload.longitude = longitude;
      if (radiusKm !== undefined) payload.radiusKm = radiusKm;

      const hasCoverage = Boolean(
        payload.countryCode ||
          payload.stateCode ||
          payload.cityCode ||
          payload.localAreaCode ||
          payload.pincode ||
          payload.latitude !== undefined ||
          payload.longitude !== undefined,
      );

      return hasCoverage ? payload : null;
    })
    .filter((area): area is NonNullable<typeof area> => Boolean(area));
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringifyOptional(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function draftAreaId() {
  return createSellerServiceAreaDraftId();
}

function nullableFormValue(form: FormData, name: string) {
  if (!form.has(name)) {
    return undefined;
  }

  return optionalFormValue(form, name) ?? null;
}

function nullableCoordinatePair(form: FormData) {
  const latitude = nullableNumberValue(form, "latitude");
  const longitude = nullableNumberValue(form, "longitude");

  if (latitude === undefined && longitude === undefined) {
    return {};
  }

  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }

  return { latitude: null, longitude: null };
}

function nullableNumberValue(form: FormData, name: string) {
  if (!form.has(name)) {
    return undefined;
  }

  const value = optionalFormValue(form, name);
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function humanize(value?: string | null) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
}
