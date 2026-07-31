"use client";

import Link from "next/link";
import { type ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDot,
  CreditCard,
  FileText,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  Wrench,
} from "lucide-react";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { LocationFields } from "@/components/locations/location-fields";
import { MapLocationPicker } from "@/components/maps/map-location-picker";
import { IndihubApiError, userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import {
  uploadSellerDocument,
  type SellerDocumentType,
  type SellerDocumentUploadResult,
} from "@/lib/seller-document-upload";
import {
  getSellerProfile,
  listSellerProducts,
  listSellerSubscriptionPlans,
  onboardSeller,
  updateSellerCapabilities,
  type SellerBusinessType,
  type SellerCapability,
  type SellerOnboardingPayload,
  type SellerTaxRegistrationStatus,
  type SellerSubscriptionPlan,
} from "@/lib/seller-api";
import { listSellerServices } from "@/lib/service-marketplace-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  primaryCapabilityForMode,
  registrationModeFromQuery,
  sellerRegistrationPath,
  type SellerRegistrationMode,
} from "@/components/seller/seller-registration-navigation";
import { SellerInfoHint } from "@/components/seller/seller-ui";

const sellerTypes = [
  { value: "MARKETPLACE_SELLER", label: "Marketplace seller" },
  { value: "HYPERLOCAL_STORE", label: "Hyperlocal store" },
  { value: "WHOLESALE_DISTRIBUTOR", label: "Wholesale distributor" },
] as const;

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

function sellerDocumentIsRequired(
  document: (typeof verificationDocuments)[number],
  taxRegistrationStatus: SellerTaxRegistrationStatus,
) {
  return (
    document.required ||
    (document.type === "GST_CERTIFICATE" &&
      taxRegistrationStatus !== "NOT_REGISTERED")
  );
}

type SubmitState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function SellerRegistrationForm({ 
  initialMode, 
  initialPlanId 
}: { 
  initialMode?: string | null;
  initialPlanId?: string | null;
} = {}) {
  const auth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const requestedMode = registrationModeFromQuery(initialMode);
  const [commerceMode, setCommerceMode] = useState<SellerRegistrationMode>(requestedMode);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [documents, setDocuments] = useState<SellerDocumentUploadResult[]>([]);
  const [selectedTaxRegistrationStatus, setSelectedTaxRegistrationStatus] =
    useState<SellerTaxRegistrationStatus>("NOT_REGISTERED");
  const [consentOpen, setConsentOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const sellerQuery = useQuery({
    queryKey: ["seller-onboarding-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans", commerceMode],
    queryFn: () => listSellerSubscriptionPlans({ audience: primaryCapabilityForMode(commerceMode) }),
  });
  const productsQuery = useQuery({
    queryKey: ["seller-onboarding-products", auth.authKey],
    queryFn: () => listSellerProducts(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled && Boolean(sellerQuery.data) && commerceMode !== "SERVICE",
    retry: false,
  });
  const servicesQuery = useQuery({
    queryKey: ["seller-onboarding-services", auth.authKey],
    queryFn: () => listSellerServices(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled && Boolean(sellerQuery.data) && commerceMode !== "RETAIL",
    retry: false,
  });

  const onboardingMutation = useMutation({
    mutationFn: (payload: SellerOnboardingPayload) => onboardSeller(auth.authHeaders, payload),
    onSuccess: () => {
      setState({ status: "success", message: "Seller onboarding submitted for review." });
      void queryClient.invalidateQueries({ queryKey: ["seller-onboarding-profile", auth.authKey] });
      void queryClient.invalidateQueries({
        queryKey: ["seller-profile", `seller:${auth.authKey}`],
      });
    },
    onError: (error) => {
      setState({
        status: "error",
        message: userFacingApiErrorMessage(error),
      });
    },
  });

  const capabilityMutation = useMutation({
    mutationFn: (payload: { capability: SellerCapability; primaryCapability: SellerCapability }) => {
      const existingCapabilities = sellerCapabilities(sellerQuery.data);
      return updateSellerCapabilities(auth.authHeaders, {
        enabledCapabilities: [...new Set([...existingCapabilities, payload.capability])],
        primaryCapability: payload.primaryCapability,
        reason:
          payload.capability === "RETAIL"
            ? "Adding retail selling after service provider onboarding."
            : "Adding service provider capability after retail seller onboarding.",
      });
    },
    onSuccess: async () => {
      setState({ status: "success", message: "Seller capability updated. New listings still follow normal verification." });
      await queryClient.invalidateQueries({ queryKey: ["seller-onboarding-profile", auth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile", `seller:${auth.authKey}`] });
    },
    onError: (error) => {
      setState({
        status: "error",
        message: userFacingApiErrorMessage(error),
      });
    },
  });

  const currentEmail = auth.userProfile?.email;
  const currentName = useMemo(() => auth.userProfile?.fullName ?? "", [auth.userProfile?.fullName]);
  const currentPhone = normalizeIndianPhone(auth.userProfile?.phone);
  const existingSeller = sellerQuery.data;
  const existingDocuments = existingSeller?.documents ?? [];
  const selectedDocuments = documents;
  const allDocuments = [...existingDocuments, ...selectedDocuments];
  const idVerified = hasChecklistDocumentType(allDocuments, ["ID_PROOF"]);
  const signatureVerified = hasChecklistDocumentType(allDocuments, ["SIGNATURE_PROOF"]);
  const productListingCreated = Boolean(productsQuery.data?.total);
  const serviceListingCreated = Boolean(servicesQuery.data?.total);
  const stockAdded = Boolean(
    productsQuery.data?.items.some((product) =>
      product.variants?.some((variant) => (variant.stockQuantity ?? 0) > 0),
    ),
  );
  const onboardingStatus = {
    emailVerified: Boolean(currentEmail),
    idVerified,
    signatureVerified,
    displayNameReady: Boolean(existingSeller?.storeName?.trim()),
    pickupAddressReady: isPickupAddressReady(existingSeller?.addresses?.[0]),
    productListingCreated,
    serviceListingCreated,
    stockAdded,
  };
  const expectedMissingSeller =
    sellerQuery.error instanceof IndihubApiError && [403, 404].includes(sellerQuery.error.status);
  const plans = plansQuery.data?.items ?? [];
  const validInitialPlanId = useMemo(() => plans.find(p => p.id === initialPlanId)?.id, [plans, initialPlanId]);
  
  const defaultPlanId =
    validInitialPlanId ??
    plansQuery.data?.defaultPlanId ??
    plans.find((plan) => plan.isDefault)?.id ??
    plans[0]?.id ??
    "";
  const primaryCapability = primaryCapabilityForMode(commerceMode);
  const primaryLabel = registrationModeLabel(commerceMode).toLowerCase();

  useEffect(() => {
    if (!selectedPlanId && defaultPlanId) {
      setSelectedPlanId(defaultPlanId);
    }
  }, [defaultPlanId, selectedPlanId]);

  useEffect(() => {
    setSelectedPlanId(defaultPlanId);
  }, [commerceMode, defaultPlanId]);

  useEffect(() => {
    setCommerceMode(requestedMode);
  }, [requestedMode]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "idle" });

    if (onboardingMutation.isPending) {
      return;
    }

    const missingRequiredDocuments = verificationDocuments
      .filter((definition) =>
        sellerDocumentIsRequired(definition, selectedTaxRegistrationStatus),
      )
      .filter((definition) => !documents.some((document) => document.documentType === definition.type));
    if (missingRequiredDocuments.length) {
      setState({
        status: "error",
        message: `Upload the required verification documents before submitting: ${missingRequiredDocuments
          .map((definition) => definition.label)
          .join(", ")}.`,
      });
      return;
    }

    setTermsAccepted(false);
    setPrivacyAccepted(false);
    setConsentOpen(true);
  }

  function submitOnboarding(form: FormData) {
    const line2 = optionalFormValue(form, "line2");
    const area = optionalFormValue(form, "area");
    const businessDescription = optionalFormValue(form, "businessDescription");
    const businessLegalName = optionalFormValue(form, "businessLegalName");
    const businessType = optionalFormValue(form, "businessType") as SellerBusinessType | undefined;
    const taxRegistrationStatus = selectedTaxRegistrationStatus;
    const gstNumber = optionalFormValue(form, "gstNumber")?.toUpperCase();
    const panNumber = optionalFormValue(form, "panNumber")?.toUpperCase();
    const subscriptionPlanId = optionalFormValue(form, "subscriptionPlanId");
    const coordinates = nullableCoordinatePair(form);
    const locationSource = nullableFormValue(form, "locationSource") as SellerOnboardingPayload["address"]["locationSource"];
    const accuracyMeters = nullableNumberValue(form, "accuracyMeters");
    const locationConfidenceScore = nullableNumberValue(form, "locationConfidenceScore");

    const sellerType =
      commerceMode === "SERVICE"
        ? "SERVICE_PROVIDER"
        : (formValue(form, "sellerType") as SellerOnboardingPayload["sellerType"]);
    onboardingMutation.mutate({
      sellerType,
      primaryCapability,
      enabledCapabilities: enabledCapabilitiesForMode(commerceMode),
      storeName: formValue(form, "storeName"),
      ...(businessLegalName ? { businessLegalName } : {}),
      ...(businessType ? { businessType } : {}),
      taxRegistrationStatus,
      ...(taxRegistrationStatus !== "NOT_REGISTERED" && gstNumber ? { gstNumber } : {}),
      ...(panNumber ? { panNumber } : {}),
      contactName: formValue(form, "contactName"),
      contactPhone: formValue(form, "contactPhone"),
      ...(businessDescription ? { businessDescription } : {}),
      ...(subscriptionPlanId ? { subscriptionPlanId } : {}),
      ...(documents.length
        ? {
            documents: documents.map((document) => ({
              documentType: document.documentType,
              fileUrl: document.fileUrl,
            })),
          }
        : {}),
      address: {
        line1: formValue(form, "line1"),
        ...(line2 ? { line2 } : {}),
        ...(area ? { area } : {}),
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
    });
  }

  function confirmPolicyConsent() {
    if (!termsAccepted || !privacyAccepted || !formRef.current || onboardingMutation.isPending) {
      return;
    }

    setConsentOpen(false);
    submitOnboarding(new FormData(formRef.current));
  }

  if (!auth.enabled) {
    return (
      <SellerSignInGate
        status={auth.status}
        error={auth.error}
        onRetry={auth.refresh}
        returnPath={sellerRegistrationPath(initialMode, initialPlanId)}
      />
    );
  }

  if (sellerQuery.isLoading) {
    return <LoadingPanel />;
  }

  if (sellerQuery.data) {
    const enabledCapabilities = sellerCapabilities(sellerQuery.data);
    const canAddRetail = !enabledCapabilities.includes("RETAIL");
    const canAddService = !enabledCapabilities.includes("SERVICE");

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#BFEAD9] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-[#1F2933]">
                  Seller onboarding already submitted
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  {sellerQuery.data.storeName} is connected to this account. You can continue to
                  seller center while approval and catalogue controls are handled from the seller
                  dashboard.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge
                    tone={sellerQuery.data.approvalStatus === "APPROVED" ? "success" : "warning"}
                  >
                    {sellerQuery.data.approvalStatus?.replace(/_/g, " ") ?? "Pending approval"}
                  </StatusBadge>
                  {enabledCapabilities.map((capability) => (
                    <StatusBadge key={capability} tone={capability === "SERVICE" ? "info" : "neutral"}>
                      {capability.toLowerCase()} enabled
                    </StatusBadge>
                  ))}
                  {sellerQuery.data.subscriptionPlan ? (
                    <StatusBadge tone="info">{sellerQuery.data.subscriptionPlan.name}</StatusBadge>
                  ) : null}
                </div>
                {(canAddRetail || canAddService || state.status !== "idle") ? (
                  <div className="mt-4 grid gap-3 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                    {canAddRetail ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-[#1F2933]">Add retail selling</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                            Convert this service provider account into a seller account with product catalogue access.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={capabilityMutation.isPending}
                          onClick={() => capabilityMutation.mutate({ capability: "RETAIL", primaryCapability: "RETAIL" })}
                        >
                          <Store className="h-4 w-4" aria-hidden="true" />
                          Add retail
                        </Button>
                      </div>
                    ) : null}
                    {canAddService ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-[#1F2933]">Add service provider capability</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                            Enable service listings, quote requests, bookings, and service workflow access.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={capabilityMutation.isPending}
                          onClick={() => capabilityMutation.mutate({ capability: "SERVICE", primaryCapability: sellerQuery.data.primaryCapability ?? "RETAIL" })}
                        >
                          <Wrench className="h-4 w-4" aria-hidden="true" />
                          Add services
                        </Button>
                      </div>
                    ) : null}
                    {state.status === "success" ? <StatusBadge tone="success">{state.message}</StatusBadge> : null}
                    {state.status === "error" ? <StatusBadge tone="danger">{state.message}</StatusBadge> : null}
                  </div>
                ) : null}
              </div>
            </div>
            <Button asChild>
              <Link href="/seller">
                Open seller center <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
        <OnboardingCompletionStatus status={onboardingStatus} commerceMode={primarySellerCapability(sellerQuery.data)} />
      </div>
    );
  }

  if (sellerQuery.error && !expectedMissingSeller) {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-5 text-sm font-semibold text-[#8A1F1F]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {userFacingApiErrorMessage(sellerQuery.error)}
          </span>
          <Button type="button" variant="outline" onClick={() => void sellerQuery.refetch()}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="order-2 grid gap-6 xl:order-1">
        <div className="overflow-hidden rounded-xl border border-[#F4C7B8] bg-white shadow-sm">
          <div className="h-1 bg-[#ED3500]" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ED3500]">Application overview</p>
              <h2 className="mt-2 text-xl font-black text-[#123A5A]">Build your verified seller profile</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
                Choose how you sell, upload the required proofs, and add the business details used for review and fulfilment.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#FFF0EC] px-3 py-2 text-xs font-bold text-[#9F2600]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Reviewed before activation
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-[#E1E6EB] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ED3500] text-sm font-black text-white">
              1
            </span>
            <SectionHeading
              title="Choose how you sell"
              description="Your selection personalises the Seller Hub navigation, listings, reports, and operating workflow."
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Seller mode">
            {[
              {
                value: "RETAIL" as const,
                title: "Retail seller",
                description: "Sell products through catalogue, cart, checkout, delivery, and retail payouts.",
                label: "Products and orders",
                icon: Store,
              },
              {
                value: "SERVICE" as const,
                title: "Service provider",
                description: "Offer repair, installation, maintenance, consultation, and local/remote services.",
                label: "Bookings and quotes",
                icon: Wrench,
              },
              {
                value: "BOTH" as const,
                title: "Retail + services",
                description: "Use one business profile for product selling and service bookings together.",
                label: "Combined profile",
                icon: Sparkles,
              },
            ].map((option) => {
              const Icon = option.icon;
              const active = commerceMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCommerceMode(option.value)}
                  role="radio"
                  aria-checked={active}
                  className={`group relative rounded-xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#ED3500] focus-visible:ring-offset-2 ${
                    active
                      ? "border-[#ED3500] bg-[#FFF7F4] shadow-[0_8px_24px_rgba(237,53,0,0.08)]"
                      : "border-[#DCE3E8] bg-[#FCFDFE] hover:border-[#ED3500]/50 hover:bg-white"
                  }`}
                >
                  <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border ${active ? "border-[#ED3500] bg-[#ED3500] text-white" : "border-[#B8C3CC] bg-white text-transparent"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-lg ${active ? "bg-[#ED3500] text-white" : "bg-[#EEF3F6] text-[#123A5A] group-hover:bg-[#FFF0EC] group-hover:text-[#ED3500]"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="pr-5">
                      <span className="block text-sm font-black text-[#1F2933]">{option.title}</span>
                      <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">
                        {option.label}
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-[#667085]">{option.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#CDEBDD] bg-[#F5FCF8] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#DDF7E9] text-[#0F8A5F]">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-black text-[#1F2933]">Account email verified</p>
                <p className="mt-1 break-all text-sm font-semibold text-[#526271]">{currentEmail ?? "Signed-in account"}</p>
              </div>
            </div>
            <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-black text-[#0F8A5F] ring-1 ring-[#B8E5CE] sm:self-center">
              Ready
            </span>
          </div>
          <input name="accountEmail" type="hidden" value={currentEmail ?? "Signed-in account"} />
        </section>

        <section className="rounded-xl border border-[#E1E6EB] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ED3500] text-sm font-black text-white">
              2
            </span>
            <SectionHeading
              title="Upload verification documents"
              description={
                isServiceOnlyMode(commerceMode)
                  ? "Upload only the proofs needed for service-provider review. PAN and tax documents can be added later if required."
                  : "Upload proof documents for final review. PAN is optional unless requested during verification."
              }
            />
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-y border-[#EEF1F4] py-3 text-xs font-bold text-[#667085]">
            <span>PDF, JPG, PNG or WebP</span>
            <span>Required documents are shown first</span>
          </div>
          <div className="mt-4 grid gap-3">
            {verificationDocuments
              .filter((document) => !isServiceOnlyMode(commerceMode) || !["PAN_CARD", "GST_CERTIFICATE", "FSSAI_CERTIFICATE"].includes(document.type))
              .map((document) => ({
                  ...document,
                  required: sellerDocumentIsRequired(
                    document,
                    selectedTaxRegistrationStatus,
                  ),
                }))
              .sort((left, right) => Number(right.required) - Number(left.required))
              .map((displayDocument) => {
                return (
                  <DocumentUploadField
                    key={displayDocument.type}
                    document={displayDocument}
                    value={documents.find((item) => item.documentType === displayDocument.type)}
                    authHeaders={auth.authHeaders}
                    disabled={onboardingMutation.isPending}
                    onUploaded={(uploaded) =>
                      setDocuments((current) => [
                        ...current.filter((item) => item.documentType !== uploaded.documentType),
                        uploaded,
                      ])
                    }
                  />
                );
              })}
          </div>
        </section>

        <section className="rounded-xl border border-[#E1E6EB] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ED3500] text-sm font-black text-white">
              3
            </span>
            <SectionHeading
              title={isServiceOnlyMode(commerceMode) ? "Service profile and coverage" : "Store and pickup details"}
              description={
                isServiceOnlyMode(commerceMode)
                  ? "Add the service display name, contact details, and base coverage address used for review."
                  : commerceMode === "BOTH"
                    ? "Add the business display name and operating address used for retail fulfilment and service coverage review."
                    : "Add the display name and pickup address used for seller verification and fulfilment."
              }
            />
          </div>

          <div className="mt-6 border-t border-[#EEF1F4] pt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Business identity</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Use details that match your registration, tax, and payout records.
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label={isServiceOnlyMode(commerceMode) ? "Service business name" : "Store name"}
              name="storeName"
              required
              placeholder={isServiceOnlyMode(commerceMode) ? "Enter your service business name" : "Enter your store name"}
            />
            {!isServiceOnlyMode(commerceMode) ? (
              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#1F2933]">Seller type</span>
                <select
                  name="sellerType"
                  required
                  className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500]"
                >
                  {sellerTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                <p className="text-sm font-black text-[#1F2933]">Seller type</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Service provider</p>
              </div>
            )}
            {!isServiceOnlyMode(commerceMode) ? (
              <>
                <Field
                  label="Business legal name"
                  name="businessLegalName"
                  placeholder="Registered business or proprietor name"
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="seller-business-type" className="block text-sm font-bold text-[#1F2933]">
                      Business type
                    </label>
                    <SellerInfoHint label="business type">
                      Choose the legal constitution shown on the seller&apos;s PAN, registration,
                      contracts, and bank records. This choice does not decide whether GST is
                      charged.
                    </SellerInfoHint>
                  </div>
                  <select
                    id="seller-business-type"
                    name="businessType"
                    className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500]"
                  >
                    <option value="">Select business type</option>
                    {businessTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="seller-gst-registration" className="block text-sm font-bold text-[#1F2933]">
                      GST registration
                    </label>
                    <SellerInfoHint label="GST registration">
                      Regular GST sellers may collect GST on taxable products. Composition sellers
                      need a GSTIN but cannot charge GST separately. Sellers who are not registered
                      must not collect GST.
                    </SellerInfoHint>
                  </div>
                  <select
                    id="seller-gst-registration"
                    name="taxRegistrationStatus"
                    value={selectedTaxRegistrationStatus}
                    onChange={(event) =>
                      setSelectedTaxRegistrationStatus(
                        event.target.value as SellerTaxRegistrationStatus,
                      )
                    }
                    className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500]"
                  >
                    <option value="GST_REGISTERED">Regular GST registered</option>
                    <option value="COMPOSITION">Composition scheme</option>
                    <option value="NOT_REGISTERED">Not GST registered</option>
                  </select>
                </div>
                {selectedTaxRegistrationStatus !== "NOT_REGISTERED" ? (
                  <Field
                    label="GST number"
                    name="gstNumber"
                    placeholder="33ABCDE1234F1Z5"
                    required
                    info={
                      <SellerInfoHint label="GST number">
                        Enter the 15-character GSTIN belonging to the selected legal entity or
                        proprietor. It is required for regular and composition registrations.
                      </SellerInfoHint>
                    }
                  />
                ) : null}
                <Field
                  label="PAN number"
                  name="panNumber"
                  placeholder="ABCDE1234F"
                  info={
                    <SellerInfoHint label="PAN number">
                      Enter the PAN belonging to the selected business or proprietor. It is used for
                      identity checks, payouts, and applicable income-tax deductions.
                    </SellerInfoHint>
                  }
                />
              </>
            ) : null}
            <Field
              label="Contact name"
              name="contactName"
              required
              defaultValue={currentName}
              placeholder="Primary contact person"
            />
            <Field
              label="Phone"
              name="contactPhone"
              required
              defaultValue={currentPhone}
              placeholder="+91 9876543210"
            />
            <label className="space-y-2 md:col-span-2">
              <span className="block text-sm font-bold text-[#1F2933]">Business description</span>
              <textarea
                name="businessDescription"
                rows={4}
                className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-3 text-sm outline-none focus:border-[#ED3500]"
                placeholder="Describe your store, products, service area, and fulfilment capacity"
                key={commerceMode}
                defaultValue={
                  isServiceOnlyMode(commerceMode)
                    ? "Describe your services, visit modes, coverage area, inspection policy, and operating hours."
                    : commerceMode === "BOTH"
                      ? "Describe your products, service categories, coverage area, fulfilment capacity, and operating hours."
                    : undefined
                }
              />
            </label>
            <div className="md:col-span-2">
              {validInitialPlanId ? (
                <div className="flex flex-col gap-3 rounded-lg border border-[#ED3500]/20 bg-[#FFF0EC] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-[#1F2933]">Selected Plan</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-black text-[#123A5A]">
                        {plans.find((p) => p.id === selectedPlanId)?.name ?? "Loading plan..."}
                      </span>
                      <span className="rounded-full bg-[#123A5A] px-2.5 py-0.5 text-xs font-bold text-white">
                        {plans.find((p) => p.id === selectedPlanId)?.pricePaise === 0
                          ? "Free"
                          : formatMoney(
                              plans.find((p) => p.id === selectedPlanId)?.pricePaise ?? 0,
                              plans.find((p) => p.id === selectedPlanId)?.currency ?? "INR"
                            )}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/seller/choose-plan?mode=${commerceMode.toLowerCase()}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#ED3500] bg-white px-4 text-sm font-bold text-[#ED3500] transition hover:bg-[#ED3500] hover:text-white"
                  >
                    Change plan
                  </Link>
                  <input type="hidden" name="subscriptionPlanId" value={selectedPlanId} />
                </div>
              ) : (
                <PlanPicker
                  plans={plans}
                  selectedPlanId={selectedPlanId}
                  defaultPlanId={defaultPlanId}
                  loading={plansQuery.isLoading}
                  error={plansQuery.error}
                  audience={primaryCapability}
                  mode={commerceMode}
                  onChange={setSelectedPlanId}
                />
              )}
            </div>
          </div>

          <div className="mt-7 border-t border-[#EEF1F4] pt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">
              {isServiceOnlyMode(commerceMode) ? "Service location" : "Pickup and operating address"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Select the exact location used for verification, fulfilment, and service coverage.
            </p>
          </div>
          <div className="mt-4 grid gap-4">
            <Field
              label={isServiceOnlyMode(commerceMode) ? "Service base address" : "Address line 1"}
              name="line1"
              required
              placeholder={isServiceOnlyMode(commerceMode) ? "Office, workshop, or operating base" : "Building and street"}
            />
            <Field label="Address line 2" name="line2" placeholder={isServiceOnlyMode(commerceMode) ? "Coverage landmark or floor" : "Landmark or floor"} />
            <LocationFields
              defaultValue={{ countryCode: "IN" }}
              inputClassName="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500]"
            />
            <MapLocationPicker
              authHeaders={auth.authHeaders}
              disabled={onboardingMutation.isPending}
              radiusPreviewKm={5}
            />

            <div className="mt-3 rounded-xl border border-[#F4C7B8] bg-[#FFF8F5] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black text-[#1F2933]">Review and submit</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                    You will confirm the Terms and Privacy Policy before final submission. Please also review 1HandIndia&apos;s{" "}
                    <Link href="https://1handindia.com/refund-return-policy" target="_blank" rel="noopener noreferrer" className="font-bold text-[#123A5A] transition hover:text-[#ED3500] hover:underline">Return Policy</Link>,{" "}
                    <Link href="https://1handindia.com/shipping-policy" target="_blank" rel="noopener noreferrer" className="font-bold text-[#123A5A] transition hover:text-[#ED3500] hover:underline">Shipping Policy</Link>, and{" "}
                    <Link href="https://1handindia.com/seller-policy" target="_blank" rel="noopener noreferrer" className="font-bold text-[#123A5A] transition hover:text-[#ED3500] hover:underline">Seller Policy</Link>.
                  </p>
                </div>
              </div>

              <Button type="submit" disabled={onboardingMutation.isPending} className="mt-5 w-full sm:w-auto">
                {onboardingMutation.isPending ? "Submitting..." : `Submit ${primaryLabel} profile for review`}
              </Button>

              {state.status === "success" ? (
                <div className="mt-4"><StatusBadge tone="success">{state.message}</StatusBadge></div>
              ) : null}
              {state.status === "error" ? (
                <div className="mt-4"><StatusBadge tone="danger">{state.message}</StatusBadge></div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <aside className="order-1 self-start xl:order-2 xl:sticky xl:top-8">
        <OnboardingCompletionStatus status={onboardingStatus} commerceMode={commerceMode} />
      </aside>
    </form>
    <SellerPolicyConsentDialog
      open={consentOpen}
      termsAccepted={termsAccepted}
      privacyAccepted={privacyAccepted}
      submitting={onboardingMutation.isPending}
      onTermsChange={setTermsAccepted}
      onPrivacyChange={setPrivacyAccepted}
      onClose={() => setConsentOpen(false)}
      onConfirm={confirmPolicyConsent}
    />
    </>
  );
}

function SellerPolicyConsentDialog({
  open,
  termsAccepted,
  privacyAccepted,
  submitting,
  onTermsChange,
  onPrivacyChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  submitting: boolean;
  onTermsChange: (accepted: boolean) => void;
  onPrivacyChange: (accepted: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const consentComplete = termsAccepted && privacyAccepted;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[140]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/55 backdrop-blur-[2px] transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6 sm:py-10">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#F4C7B8] bg-white shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="h-1 bg-[#ED3500]" />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0EC] text-[#ED3500]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Final confirmation</p>
                  <DialogTitle className="mt-1 text-xl font-black text-[#123A5A]">
                    Accept policies to submit
                  </DialogTitle>
                  <Description className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                    Review and accept both policies before sending your 1HandIndia Seller Hub application.
                  </Description>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[#E1E6EB] bg-[#FAFBFC] p-4 text-xs font-semibold leading-5 text-[#667085]">
                Your application includes identity, business, contact, tax, document, and operating-location information used for seller verification and marketplace operations.
              </div>

              <div className="mt-5 grid gap-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E1E6EB] p-4 transition hover:border-[#ED3500]/50 hover:bg-[#FFFCFB]">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => onTermsChange(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#ED3500]"
                  />
                  <span className="text-sm font-semibold leading-6 text-[#526271]">
                    I have read and accept the{" "}
                    <Link
                      href="/terms-and-conditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-black text-[#123A5A] underline decoration-[#ED3500]/40 underline-offset-2 hover:text-[#ED3500]"
                    >
                      Terms and Conditions
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E1E6EB] p-4 transition hover:border-[#ED3500]/50 hover:bg-[#FFFCFB]">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => onPrivacyChange(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#ED3500]"
                  />
                  <span className="text-sm font-semibold leading-6 text-[#526271]">
                    I have read and accept the{" "}
                    <Link
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-black text-[#123A5A] underline decoration-[#ED3500]/40 underline-offset-2 hover:text-[#ED3500]"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Go back
                </Button>
                <Button type="button" disabled={!consentComplete || submitting} onClick={onConfirm}>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {submitting ? "Submitting..." : "Accept and submit"}
                </Button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

type OnboardingStatusValue = {
  emailVerified: boolean;
  idVerified: boolean;
  signatureVerified: boolean;
  displayNameReady: boolean;
  pickupAddressReady: boolean;
  productListingCreated: boolean;
  serviceListingCreated: boolean;
  stockAdded: boolean;
};

type OnboardingStatusItemState = "complete" | "current" | "pending";

function OnboardingCompletionStatus({
  status,
  commerceMode,
}: {
  status: OnboardingStatusValue;
  commerceMode: SellerRegistrationMode;
}) {
  const serviceOnly = isServiceOnlyMode(commerceMode);
  const combined = commerceMode === "BOTH";
  const sections = [
    {
      title: "Account",
      phase: "application" as const,
      items: [
        { key: "email", label: "Email verified", complete: status.emailVerified },
      ],
    },
    {
      title: "Verification documents",
      phase: "application" as const,
      items: [
        { key: "id", label: "ID proof uploaded", complete: status.idVerified },
        { key: "signature", label: "Signature proof uploaded", complete: status.signatureVerified },
      ],
    },
    {
      title: serviceOnly ? "Service profile" : combined ? "Business and operating address" : "Store and pickup details",
      phase: "application" as const,
      items: [
        { key: "display", label: "Display name added", complete: status.displayNameReady },
        {
          key: "pickup",
          label: serviceOnly ? "Service base address added" : combined ? "Operating address added" : "Pickup address added",
          complete: status.pickupAddressReady,
        },
      ],
    },
    {
      title: "After approval",
      phase: "after-approval" as const,
      items:
        serviceOnly
          ? [{ key: "service-listing", label: "Create your first service", complete: status.serviceListingCreated }]
          : combined
            ? [
                { key: "product-listing", label: "Create your first product", complete: status.productListingCreated },
                { key: "service-listing", label: "Create your first service", complete: status.serviceListingCreated },
                { key: "stock", label: "Add product stock", complete: status.stockAdded },
              ]
            : [
                { key: "product-listing", label: "Create your first listing", complete: status.productListingCreated },
                { key: "stock", label: "Add stock", complete: status.stockAdded },
              ],
    },
  ];
  const applicationItems = sections
    .filter((section) => section.phase === "application")
    .flatMap((section) => section.items);
  const completedApplicationItems = applicationItems.filter((item) => item.complete).length;
  const progress = Math.round(
    (completedApplicationItems / applicationItems.length) * 100,
  );
  const firstIncompleteItem = applicationItems.find((item) => !item.complete);

  return (
    <section className="overflow-hidden rounded-xl border border-[#E1E6EB] bg-white shadow-sm">
      <div className="border-b border-[#EEF1F4] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Application progress</p>
            <h2 className="mt-2 text-lg font-black leading-6 text-[#123A5A]">Complete your profile</h2>
          </div>
          <span className="rounded-full bg-[#FFF0EC] px-3 py-1 text-sm font-black text-[#ED3500]">
            {progress}%
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F1F3F5]">
          <div className="h-full rounded-full bg-[#ED3500] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-[#667085]">
          {completedApplicationItems} of {applicationItems.length} application checks complete
        </p>
        {firstIncompleteItem ? (
          <div className="mt-4 rounded-lg bg-[#FFF8F5] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ED3500]">Next required action</p>
            <p className="mt-1 text-sm font-bold text-[#1F2933]">{firstIncompleteItem.label}</p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-[#F0FDF6] p-3 text-sm font-bold text-[#0F8A5F]">
            Application details are ready for review.
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="grid gap-5">
          {sections.map((section) => (
            <div key={section.title} className={section.phase === "after-approval" ? "border-t border-[#EEF1F4] pt-5" : undefined}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#526271]">{section.title}</h3>
                {section.phase === "after-approval" ? (
                  <span className="rounded-full bg-[#F1F3F5] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#667085]">
                    Not required now
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2.5">
                {section.items.map((item) => (
                  <OnboardingCompletionItem
                    key={item.key}
                    label={item.label}
                    state={
                      item.complete
                        ? "complete"
                        : section.phase === "application" && item.key === firstIncompleteItem?.key
                          ? "current"
                          : "pending"
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OnboardingCompletionItem({
  label,
  state,
}: {
  label: string;
  state: OnboardingStatusItemState;
}) {
  const complete = state === "complete";
  const current = state === "current";

  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        className={
          complete
            ? "text-[#32B877]"
            : current
              ? "text-[#ED3500]"
              : "text-[#A7B1BA]"
        }
      >
        {complete ? (
          <CheckCircle2 className="h-4 w-4" aria-label="Completed" />
        ) : current ? (
          <CircleDot className="h-4 w-4" aria-label="Current" />
        ) : (
          <Circle className="h-4 w-4" aria-label="Pending" />
        )}
      </span>
      <span className={complete ? "font-semibold text-[#111827]" : "font-semibold text-[#667085]"}>
        {label}
      </span>
    </div>
  );
}

function PlanPicker({
  plans,
  selectedPlanId,
  defaultPlanId,
  loading,
  error,
  audience,
  mode,
  onChange,
}: {
  plans: SellerSubscriptionPlan[];
  selectedPlanId: string;
  defaultPlanId: string;
  loading: boolean;
  error: Error | null;
  audience: "RETAIL" | "SERVICE";
  mode: SellerRegistrationMode;
  onChange: (planId: string) => void;
}) {
  const combined = mode === "BOTH";
  return (
    <section className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        </span>
        <SectionHeading
          title={combined ? "Combined seller subscription plan" : audience === "SERVICE" ? "Service subscription plan" : "Seller subscription plan"}
          description={
            combined
              ? "Combined onboarding uses the retail/default seller plan now; service capability is enabled on the same verified profile."
              : audience === "SERVICE"
              ? "Choose the service-provider plan for bookings, quotes, featured service slots, and recurring billing readiness."
              : "Choose the plan for onboarding. Paid monthly and yearly plans are authorised after verification."
          }
        />
      </div>

      {loading ? (
        <p className="mt-4 text-sm font-semibold text-[#667085]">Loading seller plans</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">
          {userFacingApiErrorMessage(error)}
        </p>
      ) : null}
      {!loading && plans.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-[#667085]">
          No active {combined ? "combined" : audience === "SERVICE" ? "service" : "seller"} plans configured. Default plan terms will be applied during verification.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        {plans.map((plan) => (
          <label
            key={plan.id}
            className={`block cursor-pointer rounded-lg border p-4 transition ${
              selectedPlanId === plan.id
                ? "border-[#ED3500] bg-white shadow-sm"
                : "border-[#D9E2EA] bg-white/70 hover:border-[#ED3500]"
            }`}
          >
            <input
              type="radio"
              name="subscriptionPlanId"
              value={plan.id}
              checked={selectedPlanId === plan.id}
              onChange={() => onChange(plan.id)}
              className="sr-only"
            />
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-black text-[#1F2933]">{plan.name}</p>
                  {plan.id === defaultPlanId || plan.isDefault ? (
                    <StatusBadge tone="success">Default</StatusBadge>
                  ) : null}
                  <StatusBadge tone="info">{humanize(plan.billingCycle)}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  {plan.description ?? "Seller onboarding plan."}
                </p>
                <p className="mt-2 text-xs font-bold text-[#667085]">
                  {combined
                    ? `Products ${limitLabel(plan.productLimit)} / Featured ${limitLabel(plan.featuredProductLimit)} / Services enabled`
                    : audience === "SERVICE"
                    ? `Featured service slots ${limitLabel(plan.featuredProductLimit)}`
                    : `Products ${limitLabel(plan.productLimit)} / Featured ${limitLabel(plan.featuredProductLimit)} / B2B ${limitLabel(plan.b2bEnquiryLimit)}`}
                </p>
                {plan.pricePaise > 0 && plan.billingCycle !== "LIFETIME" ? (
                  <p className="mt-2 text-xs font-bold text-[#8A5A00]">
                    Recurring Razorpay authorisation starts only after verification.
                  </p>
                ) : null}
              </div>
              <p className="text-lg font-black text-[#163B5C]">
                {formatMoney(plan.pricePaise, plan.currency)}
              </p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

function SellerSignInGate({
  status,
  error,
  onRetry,
  returnPath,
}: {
  status: string;
  error?: string | undefined;
  onRetry: () => void;
  returnPath: string;
}) {
  if (status === "error") {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-5 text-sm font-semibold text-[#8A1F1F]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error ?? "Unable to prepare your account session."}</span>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (status !== "signed-out") {
    return <LoadingPanel />;
  }

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <StatusBadge tone="warning">Sign in required</StatusBadge>
          <h2 className="mt-4 text-2xl font-black text-[#1F2933]">Start seller onboarding</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Use your 1HandIndia account to submit seller details. After sign in, you will return to
            this onboarding page automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/seller/sign-in?redirect_url=${encodeURIComponent(returnPath)}`}>
              <LogIn size={16} /> Sign in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnPath)}`}>Create account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-5 text-sm font-semibold text-[#667085] shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin text-[#163B5C]" aria-hidden="true" />
      Preparing seller onboarding
    </div>
  );
}

function DocumentUploadField({
  document,
  value,
  authHeaders,
  disabled,
  onUploaded,
}: {
  document: { type: SellerDocumentType; label: string; description: string; required: boolean };
  value?: SellerDocumentUploadResult | undefined;
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
        message: userFacingApiErrorMessage(error),
      });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <label
      className={`group block cursor-pointer rounded-xl border p-4 outline-none transition focus-within:ring-2 focus-within:ring-[#ED3500] focus-within:ring-offset-2 ${
        status.type === "error"
          ? "border-[#E7A6A6] bg-[#FFF8F8]"
          : value
            ? "border-[#B8E5CE] bg-[#F3FCF7]"
            : document.required
              ? "border-[#E7D4CD] bg-[#FFFCFB] hover:border-[#ED3500]/50"
              : "border-[#E1E6EB] bg-[#FAFBFC] hover:border-[#BFC9D1]"
      }`}
    >
      <span className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${value ? "bg-[#DDF7E9] text-[#0F8A5F]" : document.required ? "bg-[#FFF0EC] text-[#ED3500]" : "bg-[#EEF3F6] text-[#526271]"}`}>
            {value ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black text-[#1F2933]">{document.label}</span>
            {document.required ? (
              <span className="inline-flex items-center rounded-full bg-[#FFF0EC] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#ED3500]">
                Required
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#7C8995]">
                Optional
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
            {value ? (
              <span className="block truncate font-bold text-[#0F8A5F] [&>span:first-child]:hidden">
                <span>✓</span>
                <span>{value.fileName}</span>
              </span>
            ) : (
              document.description
            )}
          </span>
          </span>
        </span>
        <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#D8E2EA] bg-white px-4 text-xs font-black text-[#123A5A] shadow-sm transition group-hover:border-[#ED3500] group-hover:text-[#ED3500]">
          {status.type === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {status.type === "uploading" ? "Uploading" : value ? "Replace file" : "Choose file"}
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

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  readOnly = false,
  step,
  info,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null | undefined;
  readOnly?: boolean;
  step?: string | undefined;
  info?: ReactNode;
}) {
  const inputId = `seller-registration-${name}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="block text-sm font-bold text-[#1F2933]">
          {label}
        </label>
        {info}
      </div>
      <input
        id={inputId}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        readOnly={readOnly}
        step={step}
        className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500] read-only:bg-[#F8FAFC] read-only:text-[#667085]"
      />
    </div>
  );
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? value : undefined;
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

function sellerCapabilities(seller?: { enabledCapabilities?: SellerCapability[]; primaryCapability?: SellerCapability; sellerType?: string } | null) {
  if (!seller) {
    return [] as SellerCapability[];
  }

  if (seller.enabledCapabilities?.length) {
    return seller.enabledCapabilities;
  }

  if (seller.primaryCapability) {
    return [seller.primaryCapability];
  }

  return [seller.sellerType === "SERVICE_PROVIDER" ? "SERVICE" : "RETAIL"] as SellerCapability[];
}

function primarySellerCapability(seller?: { primaryCapability?: SellerCapability; sellerType?: string } | null) {
  if (seller?.primaryCapability) {
    return seller.primaryCapability;
  }

  return seller?.sellerType === "SERVICE_PROVIDER" ? "SERVICE" : "RETAIL";
}

function enabledCapabilitiesForMode(mode: SellerRegistrationMode): SellerCapability[] {
  return mode === "BOTH" ? ["RETAIL", "SERVICE"] : [mode];
}

function isServiceOnlyMode(mode: SellerRegistrationMode) {
  return mode === "SERVICE";
}

function registrationModeLabel(mode: SellerRegistrationMode) {
  if (mode === "BOTH") {
    return "combined";
  }

  return mode === "SERVICE" ? "service" : "retail";
}

function hasChecklistDocumentType(
  documents: Array<{ documentType: string; status?: string | null }>,
  documentTypes: SellerDocumentType[],
) {
  const expectedTypes = new Set<string>(documentTypes);
  return documents.some(
    (document) =>
      expectedTypes.has(document.documentType) &&
      (document.status === undefined || document.status === "APPROVED"),
  );
}

function isPickupAddressReady(address?: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  return Boolean(
    address?.line1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.pincode?.trim(),
  );
}

function normalizeIndianPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;

  return /^[6-9]\d{9}$/.test(normalized) ? normalized : undefined;
}

function limitLabel(value?: number | null) {
  return value === null || value === undefined ? "Unlimited" : value;
}

function humanize(value?: string | null) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
}
