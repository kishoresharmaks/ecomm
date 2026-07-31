"use client";

import { type ComponentType, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { LocateFixed, Loader2, X } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LocationFields } from "@/components/locations/location-fields";
import {
  updateSellerProfile,
  type SellerBusinessType,
  type SellerProfile,
  type SellerProfilePayload,
  type SellerTaxRegistrationStatus,
  type SellerVerificationDocument,
} from "@/lib/seller-api";
import { userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import type { LocationSource } from "@/lib/maps-api";
import type { SellerDocumentType, SellerDocumentUploadResult } from "@/lib/seller-document-upload";
import { useDelayedClose } from "@/hooks/use-delayed-close";
import {
  SellerField,
  SellerImageUpload,
  SellerInfoHint,
  SellerTextArea,
  formValue,
  optionalFormValue,
} from "./seller-ui";

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  isSaving?: boolean;
}

type VerificationDocumentConfig = {
  type: SellerDocumentType;
  label: string;
  description: string;
  required: boolean;
};

type DocumentUploadFieldComponent = ComponentType<{
  document: VerificationDocumentConfig;
  value?: SellerDocumentUploadResult | undefined;
  storedDocument?: SellerVerificationDocument | undefined;
  authHeaders: IndihubAuthHeaders;
  disabled?: boolean;
  onUploaded: (uploaded: SellerDocumentUploadResult) => void;
}>;

const locationSources: readonly LocationSource[] = ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"];

function coordinateInputValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function gpsErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "GPS permission was denied. Allow location access in the browser and try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "GPS position is unavailable. Try from the shop location or enter Google Maps coordinates.";
  }
  if (error.code === error.TIMEOUT) {
    return "GPS request timed out. Move to an open area and try again.";
  }

  return error.message || "Unable to fetch GPS location.";
}

function optionalNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function optionalLocationSource(value: unknown): LocationSource | null {
  return typeof value === "string" && locationSources.includes(value as LocationSource)
    ? (value as LocationSource)
    : null;
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
  profile: SellerProfile | null | undefined;
  businessTypes: Array<{ value: SellerBusinessType; label: string }>;
}) {
  const queryClient = useQueryClient();
  const scheduleClose = useDelayedClose(onClose, open);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.profile?.logoUrl ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(profile?.profile?.bannerUrl ?? null);
  const [taxRegistrationStatus, setTaxRegistrationStatus] =
    useState<SellerTaxRegistrationStatus>(
      profile?.profile?.taxRegistrationStatus ??
        (profile?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED"),
    );

  useEffect(() => {
    setTaxRegistrationStatus(
      profile?.profile?.taxRegistrationStatus ??
        (profile?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED"),
    );
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Store details updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
      scheduleClose();
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(userFacingApiErrorMessage(error));
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
      taxRegistrationStatus,
      ...(taxRegistrationStatus !== "NOT_REGISTERED"
        ? { gstNumber: optionalFormValue(form, "gstNumber")?.toUpperCase() }
        : {}),
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
            <div className="block">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="seller-profile-business-type"
                  className="block text-xs font-bold uppercase tracking-wide text-[#667085]"
                >
                  Business type
                </label>
                <SellerInfoHint label="business type">
                  Choose the legal constitution shown on the seller&apos;s PAN, registration,
                  contracts, and bank records. This does not determine whether GST is charged.
                </SellerInfoHint>
              </div>
              <select
                id="seller-profile-business-type"
                name="businessType"
                defaultValue={profile?.profile?.businessType ?? ""}
                className="mt-1 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              >
                <option value="">Select business type</option>
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="block">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="seller-profile-gst-registration"
                  className="block text-xs font-bold uppercase tracking-wide text-[#667085]"
                >
                  GST registration
                </label>
                <SellerInfoHint label="GST registration">
                  Regular GST sellers may collect GST on taxable products. Composition sellers
                  need a GSTIN but cannot charge GST separately. Sellers who are not registered
                  must not collect GST.
                </SellerInfoHint>
              </div>
              <select
                id="seller-profile-gst-registration"
                name="taxRegistrationStatus"
                value={taxRegistrationStatus}
                onChange={(event) =>
                  setTaxRegistrationStatus(event.target.value as SellerTaxRegistrationStatus)
                }
                className="mt-1 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              >
                <option value="GST_REGISTERED">Regular GST registered</option>
                <option value="COMPOSITION">Composition scheme</option>
                <option value="NOT_REGISTERED">Not GST registered</option>
              </select>
            </div>
            {taxRegistrationStatus !== "NOT_REGISTERED" ? (
              <SellerField
                label="GST number"
                name="gstNumber"
                required
                defaultValue={profile?.profile?.gstNumber}
                info={
                  <SellerInfoHint label="GST number">
                    Enter the 15-character GSTIN belonging to the selected legal entity or
                    proprietor. It is required for regular and composition registrations.
                  </SellerInfoHint>
                }
              />
            ) : null}
            <SellerField
              label="PAN number"
              name="panNumber"
              defaultValue={profile?.profile?.panNumber}
              info={
                <SellerInfoHint label="PAN number">
                  Enter the PAN belonging to the selected business or proprietor. It is used for
                  identity checks, payouts, and applicable income-tax deductions.
                </SellerInfoHint>
              }
            />
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
  profile: SellerProfile | null | undefined;
}) {
  const queryClient = useQueryClient();
  const scheduleClose = useDelayedClose(onClose, open);
  const payoutProfile = profile?.payoutProfile;
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Payout details updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
      scheduleClose();
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(userFacingApiErrorMessage(error));
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
  profile: SellerProfile | null | undefined;
}) {
  const queryClient = useQueryClient();
  const scheduleClose = useDelayedClose(onClose, open);
  const address = profile?.addresses?.[0];
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const [latitude, setLatitude] = useState(coordinateInputValue(address?.latitude));
  const [longitude, setLongitude] = useState(coordinateInputValue(address?.longitude));
  const [accuracyMeters, setAccuracyMeters] = useState(coordinateInputValue(address?.accuracyMeters));
  const [locationSource, setLocationSource] = useState<LocationSource>(
    optionalLocationSource(address?.locationSource) ?? "MANUAL",
  );
  const [gpsStatus, setGpsStatus] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);

  useEffect(() => {
    setLatitude(coordinateInputValue(address?.latitude));
    setLongitude(coordinateInputValue(address?.longitude));
    setAccuracyMeters(coordinateInputValue(address?.accuracyMeters));
    setLocationSource(optionalLocationSource(address?.locationSource) ?? "MANUAL");
    setGpsStatus(null);
  }, [address?.accuracyMeters, address?.latitude, address?.locationSource, address?.longitude, open]);

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Address updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
      scheduleClose();
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(userFacingApiErrorMessage(error));
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice(null);
    const latitudeValue = optionalNumberValue(latitude);
    const longitudeValue = optionalNumberValue(longitude);
    const latitudeEntered = latitude.trim().length > 0;
    const longitudeEntered = longitude.trim().length > 0;

    if (latitudeEntered !== longitudeEntered) {
      setNoticeTone("danger");
      setNotice("Enter both pickup latitude and pickup longitude.");
      return;
    }

    if ((latitudeEntered && latitudeValue === null) || (longitudeEntered && longitudeValue === null)) {
      setNoticeTone("danger");
      setNotice("Enter valid pickup GPS coordinates.");
      return;
    }
    
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
        latitude: latitudeValue,
        longitude: longitudeValue,
        locationSource,
        accuracyMeters: optionalNumberValue(accuracyMeters),
        locationConfidenceScore: optionalNumberValue(address?.locationConfidenceScore),
      },
    });
  }

  function useCurrentGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus({
        tone: "danger",
        message: "GPS is not available in this browser. Enter coordinates from Google Maps.",
      });
      return;
    }

    setGpsStatus({ tone: "info", message: "Fetching shop GPS location..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setAccuracyMeters(Math.round(position.coords.accuracy).toString());
        setLocationSource("GPS");
        setGpsStatus({
          tone: "success",
          message: `GPS added with ${Math.round(position.coords.accuracy)}m accuracy. Save changes to apply.`,
        });
      },
      (error) => {
        setGpsStatus({ tone: "danger", message: gpsErrorMessage(error) });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
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
            
            <LocationFields
              defaultValue={{
                country: address?.country ?? "India",
                countryCode: address?.countryCode ?? "IN",
                state: address?.state ?? "",
                stateCode: address?.stateCode ?? "",
                city: address?.city ?? "",
                cityCode: address?.cityCode ?? "",
                area: address?.area ?? "",
                localAreaCode: address?.localAreaCode ?? "",
                pincode: address?.pincode ?? "",
              }}
              defaultCountryCode={address?.countryCode ?? "IN"}
              loadCitiesAcrossCountry
              className="grid-cols-1 md:grid-cols-2"
              labelClassName="space-y-2"
              inputClassName="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white disabled:bg-[#EEF3F7] disabled:text-[#667085]"
              disabled={mutation.isPending}
            />

            <div className="grid grid-cols-2 gap-4">
              <SellerField
                label="Pickup latitude"
                name="latitude"
                type="number"
                step="0.0000001"
                value={latitude}
                onChange={(value) => {
                  setLatitude(value);
                  setLocationSource("MANUAL");
                }}
              />
              <SellerField
                label="Pickup longitude"
                name="longitude"
                type="number"
                step="0.0000001"
                value={longitude}
                onChange={(value) => {
                  setLongitude(value);
                  setLocationSource("MANUAL");
                }}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#1F2933]">Shop GPS location</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">
                  Stand at the shop pickup point and allow browser location access.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={useCurrentGps} disabled={mutation.isPending}>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                Use GPS
              </Button>
            </div>
            {gpsStatus ? <StatusBadge tone={gpsStatus.tone === "danger" ? "danger" : "success"}>{gpsStatus.message}</StatusBadge> : null}

            <div className="mt-2 rounded-md bg-[#EAF1F7] p-3 text-sm font-semibold text-[#163B5C]">
               Product listing and order acceptance require the shop pickup latitude and longitude. Use the exact shop location from Google Maps if GPS capture is unavailable.
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
  profile: SellerProfile | null | undefined;
  verificationDocuments: VerificationDocumentConfig[];
  DocumentUploadField: DocumentUploadFieldComponent;
}) {
  const queryClient = useQueryClient();
  const scheduleClose = useDelayedClose(onClose, open);
  const [documents, setDocuments] = useState<SellerDocumentUploadResult[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");

  const mutation = useMutation({
    mutationFn: (payload: SellerProfilePayload) => updateSellerProfile(authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Documents saved successfully.");
      void queryClient.invalidateQueries({ queryKey: ["seller-profile", authKey] });
      scheduleClose();
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(userFacingApiErrorMessage(error));
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
      description="Upload proof documents for quality check."
      isSaving={mutation.isPending}
    >
      <form onSubmit={submit}>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-3">
            {verificationDocuments.map((document) => (
              <DocumentUploadField
                key={document.type}
                document={document}
                value={documents.find((item) => item.documentType === document.type)}
                storedDocument={(profile?.documents ?? []).find(
                  (item) => item.documentType === document.type
                )}
                authHeaders={authHeaders}
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
