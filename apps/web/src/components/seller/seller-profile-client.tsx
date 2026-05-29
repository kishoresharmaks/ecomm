"use client";

import { type ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CreditCard, ExternalLink, FileText, Loader2, Store, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { LocationFields } from "@/components/locations/location-fields";
import { type IndihubAuthHeaders } from "@/lib/api";
import {
  uploadSellerDocument,
  type SellerDocumentType,
  type SellerDocumentUploadResult,
} from "@/lib/seller-document-upload";
import {
  getSellerProfile,
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
}> = [
  {
    type: "GST_CERTIFICATE",
    label: "GST certificate",
    description: "Optional for GST-registered sellers.",
  },
  { type: "PAN_CARD", label: "PAN card", description: "Business or proprietor PAN proof." },
  {
    type: "ADDRESS_PROOF",
    label: "Address proof",
    description: "Shop, office, or pickup address proof.",
  },
  {
    type: "BANK_PROOF",
    label: "Bank proof",
    description: "Cancelled cheque or bank proof for payouts.",
  },
];

export function SellerProfileClient() {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<string | null>(null);
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
      setNotice("Seller profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", sellerAuth.authKey] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Seller profile update failed."),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setLogoUrl(profileQuery.data.profile?.logoUrl ?? null);
      setBannerUrl(profileQuery.data.profile?.bannerUrl ?? null);
      setDocuments(
        (profileQuery.data.documents ?? []).map((document) => ({
          documentType: document.documentType,
          fileUrl: document.fileUrl,
          fileName: document.fileUrl.split("/").at(-1) ?? document.documentType,
        })),
      );
    }
  }, [profileQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      payoutProfile: {
        accountHolderName: optionalFormValue(form, "payoutAccountHolderName"),
        bankName: optionalFormValue(form, "payoutBankName"),
        accountNumber: optionalFormValue(form, "payoutAccountNumber"),
        ifscCode: optionalFormValue(form, "payoutIfscCode"),
        upiId: optionalFormValue(form, "payoutUpiId"),
      },
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
      },
      documents: documents.map((document) => ({
        documentType: document.documentType,
        fileUrl: document.fileUrl,
      })),
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
              <StatusBadge tone={mutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
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
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
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
              defaultValue={payoutProfile?.accountHolderName ?? profile?.profile?.contactName}
            />
            <SellerField label="UPI ID" name="payoutUpiId" defaultValue={payoutProfile?.upiId} />
            <SellerField
              label="Bank name"
              name="payoutBankName"
              defaultValue={payoutProfile?.bankName}
            />
            <SellerField
              label="Account number"
              name="payoutAccountNumber"
              defaultValue={payoutProfile?.accountNumber}
            />
            <SellerField
              label="IFSC code"
              name="payoutIfscCode"
              defaultValue={payoutProfile?.ifscCode}
            />
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
              defaultValue={address}
              disabled={mutation.isPending}
              inputClassName="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
            <Button type="submit" disabled={mutation.isPending}>
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
  document: { type: SellerDocumentType; label: string; description: string };
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

  return (
    <label className="block rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-sm font-black text-[#1F2933]">{document.label}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
            {value
              ? value.fileName
              : storedDocument?.status
                ? `${humanize(storedDocument.status)} / ${storedDocument.fileUrl.split("/").at(-1)}`
                : document.description}
          </span>
        </span>
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-xs font-black text-[#163B5C]">
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

function humanize(value?: string | null) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
}
