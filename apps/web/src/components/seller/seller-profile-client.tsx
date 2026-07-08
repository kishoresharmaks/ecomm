"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { CreditCard, FileText, Loader2, MapPinned, Upload, Wrench } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { type IndihubAuthHeaders } from "@/lib/api";
import {
  uploadSellerDocument,
  type SellerDocumentType,
  type SellerDocumentUploadResult,
} from "@/lib/seller-document-upload";
import {
  getSellerProfile,
  updateSellerProfile,
  syncSellerCourierPickup,
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
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";
import { EditStoreDetailsModal, EditPayoutModal, EditAddressModal, EditDocumentsModal, ProfileModal } from "./seller-profile-modals";

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
  const sellerAuth = useSellerAuth();
  const [activeModal, setActiveModal] = useState<"STORE_DETAILS" | "PAYOUT" | "ADDRESS" | "SERVICE_AREAS" | "DOCUMENTS" | null>(null);

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
  const serviceAreas = profileData?.serviceAreas ?? [];
  const activeServiceAreas = serviceAreas.filter((area) => area.isActive !== false);
  const hasServiceCapability = sellerHasServiceCapability(profileData);

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
                <span className="block h-12 w-12 overflow-hidden rounded-full border border-[#D8E2EA] bg-[#EAF1F7]">
                  <StorefrontImage
                    src={profileData.profile.logoUrl}
                    alt={`${profileData.storeName} logo`}
                    sizes="48px"
                    fallbackLabel={profileData.storeName?.slice(0, 2).toUpperCase()}
                  />
                </span>
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

        {hasServiceCapability ? (
          <SellerPanel className="flex flex-col">
            <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#1F2933]">Service Coverage</h2>
                <p className="mt-1 text-xs font-semibold text-[#667085]">Areas customers can request your services from.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveModal("SERVICE_AREAS")}>Edit</Button>
            </div>
            <div className="px-6 py-5 text-sm font-medium text-[#1F2933]">
              {activeServiceAreas.length ? (
                <div className="grid gap-3">
                  {activeServiceAreas.slice(0, 4).map((area, index) => (
                    <div key={area.id ?? `${area.label}-${index}`} className="rounded-md border border-[#EAF1F7] bg-[#F8FAFC] p-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                          <Wrench className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-[#1F2933]">{serviceAreaTitle(area)}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                            {serviceAreaMeta(area)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeServiceAreas.length > 4 ? (
                    <p className="text-xs font-bold text-[#667085]">
                      +{activeServiceAreas.length - 4} more service coverage areas configured.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="py-6 text-center text-[#667085]">
                  <Wrench className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No service coverage added yet.</p>
                  <p className="mt-1 text-xs">Add service areas so customers know where this provider operates.</p>
                </div>
              )}
            </div>
          </SellerPanel>
        ) : null}

        {/* Courier Settings Card */}
        <SellerPanel className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1F2933]">Courier Settings</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <CourierPickupSyncButton 
              authHeaders={sellerAuth.authHeaders!} 
              authKey={sellerAuth.authKey!} 
              providerCode="SHIPROCKET"
              syncedLocationName={profileData?.courierSettings?.shiprocketPickupLocationName}
            />
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
          profile={profileData ?? null}
        />
      )}
      {activeModal === "ADDRESS" && (
        <EditAddressModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData ?? null}
        />
      )}
      {activeModal === "SERVICE_AREAS" && (
        <EditServiceAreasModal
          open={true}
          onClose={() => setActiveModal(null)}
          authHeaders={sellerAuth.authHeaders!}
          authKey={sellerAuth.authKey!}
          profile={profileData ?? null}
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

function EditServiceAreasModal({
  open,
  onClose,
  authHeaders,
  authKey,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  profile: SellerProfile | null;
}) {
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<SellerServiceAreaDraft[]>(
    profileServiceAreasToDraft(profile?.serviceAreas, profile?.addresses?.[0]),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Service coverage updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
      setTimeout(() => onClose(), 1500);
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Update failed.");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    mutation.mutate({ serviceAreas: draftServiceAreasToPayload(areas) });
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      title="Edit Service Coverage"
      description="Maintain the locations, pincodes, radius, and GPS hints used for service bookings."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <SellerServiceAreaEditor
            areas={areas}
            disabled={mutation.isPending}
            minimumAreas={0}
            addLabel="Add service area"
            emptyMessage="No service coverage added yet. Add at least one area for service bookings."
            createArea={emptyDraftServiceArea}
            onChange={setAreas}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[#D8E2EA] bg-[#F8FAFC] px-6 py-4">
          <div>{notice && <StatusBadge tone={noticeTone}>{notice}</StatusBadge>}</div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save coverage
            </Button>
          </div>
        </div>
      </form>
    </ProfileModal>
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

function serviceAreaTitle(area: SellerServiceArea) {
  return area.label?.trim() || area.pincode || area.cityCode || area.stateCode || area.countryCode || "Service area";
}

function serviceAreaMeta(area: SellerServiceArea) {
  const location = [area.localAreaCode, area.cityCode, area.stateCode, area.countryCode]
    .filter(Boolean)
    .join(" / ");
  const parts = [
    area.pincode ? `Pincode ${area.pincode}` : null,
    area.radiusKm ? `${area.radiusKm} km radius` : null,
    area.latitude && area.longitude ? `GPS ${area.latitude}, ${area.longitude}` : null,
    location || null,
  ].filter(Boolean);

  return parts.length ? parts.join(" - ") : "Coverage details are saved.";
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

function humanize(value?: string | null) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
}

function CourierPickupSyncButton({
  authHeaders,
  authKey,
  providerCode,
  syncedLocationName,
}: {
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  providerCode: string;
  syncedLocationName?: string | null;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: () => syncSellerCourierPickup(authHeaders, providerCode),
    onSuccess: (res) => {
      setNoticeTone("success");
      setNotice(`Synced pickup location as "${res.pickupLocationName}"`);
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Sync failed. Ensure your address, phone, and email are filled.");
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#EAF1F7] p-4 bg-[#F8FAFC]">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div>
          <p className="font-bold text-[#1F2933]">Shiprocket Pickup Location</p>
          <p className="text-xs text-[#667085] mt-1">
            {syncedLocationName ? (
              <span className="text-[#0F8A5F] font-semibold flex items-center gap-1">
                ✓ Synced: {syncedLocationName}
              </span>
            ) : (
              "Not synced yet"
            )}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setNotice(null); mutation.mutate(); }} 
          disabled={mutation.isPending}
          className="shrink-0"
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {syncedLocationName ? "Resync Address" : "Sync Now"}
        </Button>
      </div>
      {notice && (
        <div className="mt-2 text-xs font-bold px-3 py-2 rounded bg-white border border-[#D8E2EA]">
          <span className={noticeTone === "success" ? "text-[#0F8A5F]" : "text-[#B42318]"}>
            {notice}
          </span>
        </div>
      )}
    </div>
  );
}
