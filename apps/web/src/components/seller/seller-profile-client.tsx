"use client";

import { type ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CreditCard, ExternalLink, FileText, Loader2, Store, Truck, Upload } from "lucide-react";
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
  type SellerProfilePayload,
  type SellerVerificationDocument,
} from "@/lib/seller-api";
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
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SellerDocumentUploadResult[]>([]);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) =>
      updateSellerProfile(sellerAuth.authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Seller profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", sellerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Seller profile update failed.");
    },
  });

  const pickupSyncMutation = useMutation({
    mutationFn: (providerCode: string) =>
      syncSellerCourierPickup(sellerAuth.authHeaders, providerCode),
    onSuccess: (result) => {
      setNoticeTone("success");
      setNotice(result.statusLabel ?? `Pickup synced: ${result.pickupLocationName}`);
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", sellerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Pickup sync failed.");
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setLogoUrl(profileQuery.data.profile?.logoUrl ?? null);
      setBannerUrl(profileQuery.data.profile?.bannerUrl ?? null);
      setDocuments([]);
    }
  }, [profileQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existingShiprocketSetting = profileQuery.data?.courierProviderSettings?.find(
      (setting) => setting.providerCode === "SHIPROCKET",
    );
    const shiprocketPickupLocation = optionalFormValue(form, "shiprocketPickupLocation");
    const payoutProfile = sellerPayoutProfilePayload(form);
    const coordinates = nullableCoordinatePair(form);
    const locationSource = nullableFormValue(form, "locationSource") as NonNullable<SellerProfilePayload["address"]>["locationSource"];
    const accuracyMeters = nullableNumberValue(form, "accuracyMeters");
    const locationConfidenceScore = nullableNumberValue(form, "locationConfidenceScore");
    setNotice(null);
    mutation.mutate({
      storeName: formValue(form, "storeName"),
      logoUrl,
      bannerUrl,
      description: optionalFormValue(form, "description"),
      businessLegalName: optionalFormValue(form, "businessLegalName"),
      businessType: optionalFormValue(form, "businessType") as SellerBusinessType | undefined,
      gstNumber: optionalFormValue(form, "gstNumber")?.toUpperCase(),
      panNumber: optionalFormValue(form, "panNumber")?.toUpperCase(),
      contactName: formValue(form, "contactName"),
      contactPhone: formValue(form, "contactPhone"),
      contactEmail: formValue(form, "contactEmail"),
      ...(payoutProfile ? { payoutProfile } : {}),
      address: {
        line1: formValue(form, "line1"),
        line2: optionalFormValue(form, "line2"),
        area: optionalFormValue(form, "area"),
        city: formValue(form, "city"),
        state: formValue(form, "state"),
        pincode: formValue(form, "pincode"),
        country: formValue(form, "country"),
        countryCode: formValue(form, "countryCode"),
        stateCode: formValue(form, "stateCode"),
        cityCode: formValue(form, "cityCode"),
        localAreaCode: optionalFormValue(form, "localAreaCode"),
        ...coordinates,
        locationSource,
        accuracyMeters,
        locationConfidenceScore,
      },
      ...(documents.length
        ? {
            documents: documents.map((document) => ({
              documentType: document.documentType,
              fileUrl: document.fileUrl,
            })),
          }
        : {}),
      ...(shiprocketPickupLocation || existingShiprocketSetting
        ? {
            courierSettings: [
              {
                providerCode: "SHIPROCKET",
                pickupLocationName: shiprocketPickupLocation,
                isActive: Boolean(shiprocketPickupLocation),
              },
            ],
          }
        : {}),
    });
  }

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

    return (
      <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
    );
  }

  const profile = profileQuery.data;
  const address = profile?.addresses[0];
  const payoutProfile = profile?.payoutProfile;
  const shiprocketSetting = profile?.courierProviderSettings?.find(
    (setting) => setting.providerCode === "SHIPROCKET",
  );
  const profileBusy = mutation.isPending || pickupSyncMutation.isPending;

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-[#1F2933]">{profile?.storeName}</h2>
                <SellerStatusPill status={profile?.status} />
                <SellerStatusPill status={profile?.approvalStatus} />
              </div>
              <p className="mt-1 text-sm font-semibold text-[#667085]">
                {profile?.user?.email ??
                  profile?.profile?.contactEmail ??
                  "Seller contact not available"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {profile?.status === "APPROVED" &&
            profile.approvalStatus === "APPROVED" &&
            profile.slug ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/stores/${profile.slug}` as Route}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View public store
                </Link>
              </Button>
            ) : null}
            {notice ? (
              <StatusBadge tone={noticeTone}>{notice}</StatusBadge>
            ) : null}
          </div>
        </div>
      </SellerPanel>

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <SellerPanel>
          <SectionHeading
            title="Store profile"
            description="Control how your store appears to buyers across product pages and the public store profile."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SellerField
              label="Store name"
              name="storeName"
              required
              defaultValue={profile?.storeName}
            />
            <SellerField
              label="Business legal name"
              name="businessLegalName"
              defaultValue={profile?.profile?.businessLegalName}
            />
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">
                Business type
              </span>
              <select
                name="businessType"
                defaultValue={profile?.profile?.businessType ?? ""}
                className="mt-1 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              >
                <option value="">Select business type</option>
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <SellerField
              label="GST number"
              name="gstNumber"
              defaultValue={profile?.profile?.gstNumber}
            />
            <SellerField
              label="PAN number"
              name="panNumber"
              defaultValue={profile?.profile?.panNumber}
            />
            <SellerField
              label="Contact name"
              name="contactName"
              required
              defaultValue={profile?.profile?.contactName ?? profile?.user?.fullName}
            />
            <SellerField
              label="Contact phone"
              name="contactPhone"
              required
              defaultValue={profile?.profile?.contactPhone ?? profile?.user?.phone}
            />
            <SellerField
              label="Contact email"
              name="contactEmail"
              type="email"
              required
              defaultValue={profile?.profile?.contactEmail ?? profile?.user?.email}
            />
            <div className="md:col-span-2">
              <SellerImageUpload
                label="Store logo"
                description="Upload a square logo for store cards, product seller details, and the public store page."
                value={logoUrl}
                onChange={setLogoUrl}
                authHeaders={sellerAuth.authHeaders}
                purpose="SELLER_LOGO"
                previewLabel={profile?.storeName?.slice(0, 2).toUpperCase() ?? "1HI"}
                aspectClass="aspect-square"
                disabled={profileBusy}
              />
            </div>
            <div className="md:col-span-2">
              <SellerImageUpload
                label="Store banner"
                description="Upload a wide banner for the public store profile. Use a clean product or storefront image."
                value={bannerUrl}
                onChange={setBannerUrl}
                authHeaders={sellerAuth.authHeaders}
                purpose="SELLER_BANNER"
                previewLabel={profile?.storeName ?? "1HandIndia"}
                aspectClass="aspect-[5/2]"
                disabled={profileBusy}
              />
            </div>
            <div className="md:col-span-2">
              <SellerTextArea
                label="Business description"
                name="description"
                defaultValue={profile?.profile?.description}
                rows={5}
              />
            </div>
          </div>
        </SellerPanel>

        <SellerPanel>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="Verification documents"
              description="Upload proof documents for admin review. Existing uploaded keys stay private."
            />
          </div>
          <div className="mt-5 grid gap-3">
            {verificationDocuments.map((document) => (
              <DocumentUploadField
                key={document.type}
                document={document}
                value={documents.find((item) => item.documentType === document.type)}
                storedDocument={(profile?.documents ?? []).find(
                  (item) => item.documentType === document.type,
                )}
                authHeaders={sellerAuth.authHeaders}
                disabled={profileBusy}
                onUploaded={(uploaded) =>
                  setDocuments((current) => [
                    ...current.filter((item) => item.documentType !== uploaded.documentType),
                    uploaded,
                  ])
                }
              />
            ))}
          </div>
        </SellerPanel>

        <SellerPanel>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="Manual payout details"
              description="Bank or UPI details used by admin when processing seller payout requests."
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SellerField
              label="Account holder name"
              name="payoutAccountHolderName"
              placeholder={payoutProfile?.accountHolderName ?? profile?.profile?.contactName ?? "Enter account holder name"}
            />
            <SellerField
              label="UPI ID"
              name="payoutUpiId"
              placeholder={payoutProfile?.maskedUpiId ? `Saved: ${payoutProfile.maskedUpiId}` : "seller@upi"}
            />
            <SellerField
              label="Bank name"
              name="payoutBankName"
              placeholder={payoutProfile?.bankName ?? "Enter bank name"}
            />
            <SellerField
              label="Account number"
              name="payoutAccountNumber"
              placeholder={payoutProfile?.maskedAccountNumber ? `Saved: ${payoutProfile.maskedAccountNumber}` : "Enter account number"}
            />
            <SellerField
              label="IFSC code"
              name="payoutIfscCode"
              placeholder={payoutProfile?.ifscCode ?? "Enter IFSC code"}
            />
            {payoutProfile ? (
              <p className="text-xs font-semibold leading-5 text-[#667085] md:col-span-2">
                Existing payout details are saved securely. Enter new values only when you want to replace them.
              </p>
            ) : null}
          </div>
        </SellerPanel>

        <SellerPanel>
          <SectionHeading
            title="Store address"
            description="Primary address used for seller operational review and customer trust signals."
          />
          <div className="mt-5 grid gap-4">
            <SellerField
              label="Address line 1"
              name="line1"
              required
              defaultValue={address?.line1}
            />
            <SellerField label="Address line 2" name="line2" defaultValue={address?.line2} />
            <LocationFields
              defaultValue={{
                country: address?.country ?? "India",
                countryCode: address?.countryCode ?? "IN",
                state: address?.state,
                stateCode: address?.stateCode,
                city: address?.city,
                cityCode: address?.cityCode,
                area: address?.area,
                localAreaCode: address?.localAreaCode,
                pincode: address?.pincode,
              }}
              defaultCountryCode="IN"
              loadCitiesAcrossCountry
              disabled={profileBusy}
              inputClassName="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
            <MapLocationPicker
              defaultValue={{
                latitude: address?.latitude,
                longitude: address?.longitude,
                locationSource: address?.locationSource,
                accuracyMeters: address?.accuracyMeters,
                locationConfidenceScore: address?.locationConfidenceScore,
              }}
              authHeaders={sellerAuth.authHeaders}
              disabled={profileBusy}
              radiusPreviewKm={5}
            />
            <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#ED3500]">
                  <Truck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="grid flex-1 gap-3">
                  <SectionHeading
                    title="Courier pickup"
                    description="Seller pickup location name used by live courier booking."
                  />
                  <SellerField
                    label="Shiprocket pickup location"
                    name="shiprocketPickupLocation"
                    defaultValue={shiprocketSetting?.pickupLocationName ?? ""}
                    placeholder="Main Warehouse"
                  />
                  <div className="flex flex-col gap-3 rounded-md border border-[#D8E2EA] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-bold text-[#1F2933]">
                      {shiprocketSetting?.pickupLocationName
                        ? `Saved pickup: ${shiprocketSetting.pickupLocationName}`
                        : "No Shiprocket pickup synced."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => pickupSyncMutation.mutate("SHIPROCKET")}
                      disabled={profileBusy}
                    >
                      {pickupSyncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Truck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {pickupSyncMutation.isPending ? "Syncing..." : "Sync pickup"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={profileBusy}>
              {mutation.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </SellerPanel>
      </form>
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
