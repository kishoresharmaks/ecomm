"use client";

import { type FormEvent, useState } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Loader2, X } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSellerProfile, type SellerProfilePayload, type SellerBusinessType } from "@/lib/seller-api";
import type { IndihubAuthHeaders } from "@/lib/api";
import { SellerField, SellerTextArea, SellerImageUpload, formValue, optionalFormValue } from "./seller-ui";

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  isSaving?: boolean;
}

export function ProfileModal({ open, onClose, title, description, children, isSaving }: ProfileModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[140]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/45 transition duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6 sm:p-6 md:p-10">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-2xl rounded-xl border border-[#D8E2EA] bg-white shadow-2xl transition duration-200 data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <div className="flex items-center justify-between border-b border-[#D8E2EA] px-6 py-4">
              <div>
                <DialogTitle className="text-lg font-black tracking-normal text-[#1F2933]">{title}</DialogTitle>
                {description ? (
                  <Description className="mt-1 text-sm font-semibold leading-5 text-[#667085]">
                    {description}
                  </Description>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F2933]"
                onClick={onClose}
                disabled={isSaving}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {children}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

export function EditStoreDetailsModal({
  open,
  onClose,
  authHeaders,
  authKey,
  profile,
  businessTypes,
}: {
  open: boolean;
  onClose: () => void;
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  profile: any;
  businessTypes: Array<{ value: SellerBusinessType; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.profile?.logoUrl ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(profile?.profile?.bannerUrl ?? null);

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Store details updated successfully.");
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
    });
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      title="Edit Store Details"
      description="Update your store name, business information, and contact details."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SellerField label="Store name" name="storeName" required defaultValue={profile?.storeName} />
            <SellerField label="Business legal name" name="businessLegalName" defaultValue={profile?.profile?.businessLegalName} />
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Business type</span>
              <select
                name="businessType"
                defaultValue={profile?.profile?.businessType ?? ""}
                className="mt-1 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              >
                <option value="">Select business type</option>
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
            <SellerField label="GST number" name="gstNumber" defaultValue={profile?.profile?.gstNumber} />
            <SellerField label="PAN number" name="panNumber" defaultValue={profile?.profile?.panNumber} />
            <SellerField label="Contact name" name="contactName" required defaultValue={profile?.profile?.contactName ?? profile?.user?.fullName} />
            <SellerField label="Contact phone" name="contactPhone" required defaultValue={profile?.profile?.contactPhone ?? profile?.user?.phone} />
            <SellerField label="Contact email" name="contactEmail" type="email" required defaultValue={profile?.profile?.contactEmail ?? profile?.user?.email} />
            
            <div className="md:col-span-2">
              <SellerImageUpload
                label="Store logo"
                description="Upload a square logo for store cards, product seller details, and the public store page."
                value={logoUrl}
                onChange={setLogoUrl}
                authHeaders={authHeaders}
                purpose="SELLER_LOGO"
                previewLabel={profile?.storeName?.slice(0, 2).toUpperCase() ?? "1HI"}
                aspectClass="aspect-square"
                disabled={mutation.isPending}
              />
            </div>
            <div className="md:col-span-2">
              <SellerImageUpload
                label="Store banner"
                description="Upload a wide banner for the public store profile."
                value={bannerUrl}
                onChange={setBannerUrl}
                authHeaders={authHeaders}
                purpose="SELLER_BANNER"
                previewLabel={profile?.storeName ?? "1HandIndia"}
                aspectClass="aspect-[5/2]"
                disabled={mutation.isPending}
              />
            </div>
            <div className="md:col-span-2">
              <SellerTextArea label="Business description" name="description" defaultValue={profile?.profile?.description} rows={5} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#D8E2EA] bg-[#F8FAFC] px-6 py-4">
          <div>{notice && <StatusBadge tone={noticeTone}>{notice}</StatusBadge>}</div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </ProfileModal>
  );
}

export function EditPayoutModal({
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
  profile: any;
}) {
  const queryClient = useQueryClient();
  const payoutProfile = profile?.payoutProfile;
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Payout details updated successfully.");
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
    const form = new FormData(event.currentTarget);
    setNotice(null);
    
    const payload = {
      accountHolderName: optionalFormValue(form, "payoutAccountHolderName"),
      bankName: optionalFormValue(form, "payoutBankName"),
      accountNumber: optionalFormValue(form, "payoutAccountNumber"),
      ifscCode: optionalFormValue(form, "payoutIfscCode"),
      upiId: optionalFormValue(form, "payoutUpiId"),
    };

    const hasData = Object.values(payload).some(Boolean);
    mutation.mutate(hasData ? { payoutProfile: payload } : {});
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      title="Edit Payout Details"
      description="Update bank or UPI details for manual payout requests."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SellerField label="Account holder name" name="payoutAccountHolderName" defaultValue={payoutProfile?.accountHolderName ?? profile?.profile?.contactName ?? ""} placeholder="Enter account holder name" />
            <SellerField label="UPI ID" name="payoutUpiId" placeholder={payoutProfile?.maskedUpiId ? `Saved: ${payoutProfile.maskedUpiId}` : "seller@upi"} />
            <SellerField label="Bank name" name="payoutBankName" defaultValue={payoutProfile?.bankName ?? ""} placeholder="Enter bank name" />
            <SellerField label="Account number" name="payoutAccountNumber" placeholder={payoutProfile?.maskedAccountNumber ? `Saved: ${payoutProfile.maskedAccountNumber}` : "Enter account number"} />
            <SellerField label="IFSC code" name="payoutIfscCode" defaultValue={payoutProfile?.ifscCode ?? ""} placeholder="Enter IFSC code" />
            
            {payoutProfile ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-[#667085] md:col-span-2">
                Existing payout details are saved securely. Enter new values only when you want to replace them.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#D8E2EA] bg-[#F8FAFC] px-6 py-4">
          <div>{notice && <StatusBadge tone={noticeTone}>{notice}</StatusBadge>}</div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </ProfileModal>
  );
}

export function EditAddressModal({
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
  profile: any;
}) {
  const queryClient = useQueryClient();
  const address = profile?.addresses?.[0];
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Address updated successfully.");
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
    const form = new FormData(event.currentTarget);
    setNotice(null);
    
    mutation.mutate({
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
        latitude: address?.latitude,
        longitude: address?.longitude,
        locationSource: address?.locationSource,
        accuracyMeters: address?.accuracyMeters,
        locationConfidenceScore: address?.locationConfidenceScore,
      },
    });
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      title="Edit Business Address"
      description="Update your primary store address for operations."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4">
            <SellerField label="Address line 1" name="line1" required defaultValue={address?.line1} />
            <SellerField label="Address line 2" name="line2" defaultValue={address?.line2} />
            
            <div className="grid grid-cols-2 gap-4">
               <SellerField label="City" name="city" required defaultValue={address?.city} />
               <SellerField label="State" name="state" required defaultValue={address?.state} />
               <SellerField label="Pincode" name="pincode" required defaultValue={address?.pincode} />
               <SellerField label="Country" name="country" required defaultValue={address?.country ?? "India"} />
               <input type="hidden" name="countryCode" value={address?.countryCode ?? "IN"} />
               <input type="hidden" name="stateCode" value={address?.stateCode ?? ""} />
               <input type="hidden" name="cityCode" value={address?.cityCode ?? ""} />
               <input type="hidden" name="area" value={address?.area ?? ""} />
               <input type="hidden" name="localAreaCode" value={address?.localAreaCode ?? ""} />
            </div>

            <div className="mt-2 text-sm font-semibold text-[#667085] p-3 bg-[#EAF1F7] text-[#163B5C] rounded-md">
               Note: Full map-based location selection is available on the original layout. For now, use this modal to quickly update text address fields.
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#D8E2EA] bg-[#F8FAFC] px-6 py-4">
          <div>{notice && <StatusBadge tone={noticeTone}>{notice}</StatusBadge>}</div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </ProfileModal>
  );
}

export function EditDocumentsModal({
  open,
  onClose,
  authHeaders,
  authKey,
  profile,
  verificationDocuments,
  DocumentUploadField,
}: {
  open: boolean;
  onClose: () => void;
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  profile: any;
  verificationDocuments: any[];
  DocumentUploadField: any;
}) {
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Documents saved successfully.");
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
    if (documents.length === 0) {
      setNoticeTone("danger");
      setNotice("No new documents to save.");
      return;
    }
    mutation.mutate({
      documents: documents.map((doc) => ({
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
      })),
    });
  }

  return (
    <ProfileModal
      open={open}
      onClose={onClose}
      title="Verification Documents"
      description="Upload proof documents for admin review."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-3">
            {verificationDocuments.map((document: any) => (
              <DocumentUploadField
                key={document.type}
                document={document}
                value={documents.find((item) => item.documentType === document.type)}
                storedDocument={(profile?.documents ?? []).find(
                  (item: any) => item.documentType === document.type
                )}
                authHeaders={authHeaders}
                disabled={mutation.isPending}
                onUploaded={(uploaded: any) =>
                  setDocuments((current) => [
                    ...current.filter((item) => item.documentType !== uploaded.documentType),
                    uploaded,
                  ])
                }
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#D8E2EA] bg-[#F8FAFC] px-6 py-4">
          <div>{notice && <StatusBadge tone={noticeTone}>{notice}</StatusBadge>}</div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || documents.length === 0}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </ProfileModal>
  );
}
