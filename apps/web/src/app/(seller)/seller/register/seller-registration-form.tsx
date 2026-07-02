"use client";

import Link from "next/link";
import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { IndihubApiError, type IndihubAuthHeaders } from "@/lib/api";
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
  type SellerSubscriptionPlan,
} from "@/lib/seller-api";
import { formatMoney } from "@/lib/storefront-api";

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

type SubmitState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SellerRegistrationMode = SellerCapability | "BOTH";

export function SellerRegistrationForm({ initialMode }: { initialMode?: string | null } = {}) {
  const auth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const requestedMode = registrationModeFromQuery(initialMode);
  const [commerceMode, setCommerceMode] = useState<SellerRegistrationMode>(requestedMode);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [documents, setDocuments] = useState<SellerDocumentUploadResult[]>([]);

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
    enabled: auth.enabled && Boolean(sellerQuery.data),
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
        message: error instanceof Error ? error.message : "Seller onboarding failed.",
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
      setState({ status: "success", message: "Seller capability updated. New listings still follow normal admin approval." });
      await queryClient.invalidateQueries({ queryKey: ["seller-onboarding-profile", auth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile", `seller:${auth.authKey}`] });
    },
    onError: (error) => {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Seller capability update failed.",
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
  const listingCreated = Boolean(productsQuery.data?.total);
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
    listingCreated,
    stockAdded,
  };
  const expectedMissingSeller =
    sellerQuery.error instanceof IndihubApiError && [403, 404].includes(sellerQuery.error.status);
  const plans = plansQuery.data?.items ?? [];
  const defaultPlanId =
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

    const form = new FormData(event.currentTarget);
    const line2 = optionalFormValue(form, "line2");
    const area = optionalFormValue(form, "area");
    const businessDescription = optionalFormValue(form, "businessDescription");
    const businessLegalName = optionalFormValue(form, "businessLegalName");
    const businessType = optionalFormValue(form, "businessType") as SellerBusinessType | undefined;
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
      ...(gstNumber ? { gstNumber } : {}),
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

  if (!auth.enabled) {
    return <SellerSignInGate status={auth.status} error={auth.error} onRetry={auth.refresh} />;
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
            {sellerQuery.error instanceof Error
              ? sellerQuery.error.message
              : "Unable to load seller onboarding status."}
          </span>
          <Button type="button" variant="outline" onClick={() => void sellerQuery.refetch()}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5">
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              {registrationModeIcon(commerceMode)}
            </span>
            <SectionHeading
              title="Choose seller mode"
              description="Choose retail, services, or both. The seller center menu and reports will match the capability you register."
            />
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
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
                  className={`rounded-lg border p-4 text-left transition ${
                    active
                      ? "border-[#ED3500] bg-[#FFF6F3] shadow-sm"
                      : "border-[#E5E7EB] bg-white hover:border-[#ED3500]/50"
                  }`}
                  aria-pressed={active}
                >
                  <span className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-md ${active ? "bg-[#ED3500] text-white" : "bg-[#EAF1F7] text-[#123A5A]"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[#1F2933]">{option.title}</span>
                      <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-[#667085]">
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

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="Email verification"
             />
          </div>
          <div className="mt-5 grid gap-4">
            <Field
              label="Account email"
              name="accountEmail"
              type="email"
              defaultValue={currentEmail ?? "Signed-in account"}
              readOnly
            />
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="ID and signature verification"
              description={
                isServiceOnlyMode(commerceMode)
                  ? "Upload only the proofs needed for service-provider review. PAN and tax documents can be added later if required."
                  : "Upload proof documents for final review. PAN is optional unless admin asks for it."
              }
            />
          </div>
          <div className="mt-5 grid gap-3">
            {verificationDocuments
              .filter((document) => !isServiceOnlyMode(commerceMode) || !["PAN_CARD", "GST_CERTIFICATE", "FSSAI_CERTIFICATE"].includes(document.type))
              .map((document) => (
              <DocumentUploadField
                key={document.type}
                document={document}
                value={documents.find((item) => item.documentType === document.type)}
                authHeaders={auth.authHeaders}
                disabled={onboardingMutation.isPending}
                onUploaded={(uploaded) =>
                  setDocuments((current) => [
                    ...current.filter((item) => item.documentType !== uploaded.documentType),
                    uploaded,
                  ])
                }
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <Store className="h-5 w-5" aria-hidden="true" />
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

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                <label className="space-y-2">
                  <span className="block text-sm font-bold text-[#1F2933]">Business type</span>
                  <select
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
                </label>
                <Field label="GST number" name="gstNumber" placeholder="33ABCDE1234F1Z5" />
                <Field label="PAN number" name="panNumber" placeholder="ABCDE1234F" />
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
            </div>
          </div>

          <div className="mt-5 grid gap-4">
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

            <Button type="submit" disabled={onboardingMutation.isPending}>
              {onboardingMutation.isPending ? "Submitting..." : `Submit ${primaryLabel} profile for review`}
            </Button>

            {state.status === "success" ? (
              <StatusBadge tone="success">{state.message}</StatusBadge>
            ) : null}
            {state.status === "error" ? (
              <StatusBadge tone="danger">{state.message}</StatusBadge>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="self-start xl:sticky xl:top-8">
        <OnboardingCompletionStatus status={onboardingStatus} commerceMode={commerceMode} />
      </aside>
    </form>
  );
}

type OnboardingStatusValue = {
  emailVerified: boolean;
  idVerified: boolean;
  signatureVerified: boolean;
  displayNameReady: boolean;
  pickupAddressReady: boolean;
  listingCreated: boolean;
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
      title: "Email Verification",
      items: [
        { key: "email", label: "Email Verification", complete: status.emailVerified },
      ],
    },
    {
      title: "ID & Signature Verification",
      items: [
        { key: "id", label: "ID Verification", complete: status.idVerified },
        { key: "signature", label: "Signature Verification", complete: status.signatureVerified },
      ],
    },
    {
      title: serviceOnly ? "Service Profile & Coverage" : combined ? "Store, Pickup & Coverage" : "Store & Pickup Details",
      items: [
        { key: "display", label: "Display Name", complete: status.displayNameReady },
        {
          key: "pickup",
          label: serviceOnly ? "Service Base Address" : combined ? "Pickup / Service Base Address" : "Pickup Address",
          complete: status.pickupAddressReady,
        },
      ],
    },
    {
      title: serviceOnly ? "Service Listing Readiness" : combined ? "Retail & Service Readiness" : "Listing & Stock Availability",
      items:
        serviceOnly
          ? [{ key: "listing", label: "First Service Listing", complete: status.listingCreated }]
          : [
              { key: "listing", label: "Listing Created", complete: status.listingCreated },
              { key: "stock", label: "Stock Added", complete: status.stockAdded },
            ],
    },
  ];
  const allItems = sections.flatMap((section) => section.items);
  const progress = Math.round(
    (allItems.filter((item) => item.complete).length / allItems.length) * 100,
  );
  const firstIncompleteKey = sections
    .flatMap((section) => section.items)
    .find((item) => !item.complete)?.key;

  return (
    <section className="overflow-hidden rounded-lg border border-[#F59E0B] bg-[#FFF7E8] shadow-sm">
      <div className="p-4">
        <h2 className="text-base font-black leading-5 text-[#1F2933]">
          Your onboarding completion status
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full bg-[#F5A623] px-3 py-1 text-sm font-black text-white">
            {progress}%
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#F5A623] bg-white">
            <div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="border-t border-[#F5A623]/50 bg-white px-4 py-4">
        <div className="grid gap-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-[#1F2933]">{section.title}</h3>
              <div className="mt-3 grid gap-3">
                {section.items.map((item) => (
                  <OnboardingCompletionItem
                    key={item.key}
                    label={item.label}
                    state={
                      item.complete
                        ? "complete"
                        : item.key === firstIncompleteKey
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
    <div className="flex items-center gap-3 text-sm">
      <span
        className={
          complete
            ? "text-[#32B877]"
            : current
              ? "text-[#F5A623]"
              : "text-[#F5A623]"
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
              : "Choose the plan for onboarding. Paid monthly and yearly plans are authorised after admin approval."
          }
        />
      </div>

      {loading ? (
        <p className="mt-4 text-sm font-semibold text-[#667085]">Loading seller plans</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">
          {error.message}
        </p>
      ) : null}
      {!loading && plans.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-[#667085]">
          No active {combined ? "combined" : audience === "SERVICE" ? "service" : "seller"} plans configured. Admin default will be applied during review.
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
                    Recurring Razorpay authorisation starts only after admin approval.
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
}: {
  status: string;
  error?: string | undefined;
  onRetry: () => void;
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
            <Link href="/seller/sign-in?redirect_url=/seller/register">
              <LogIn size={16} /> Sign in
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-up?redirect_url=/seller/register">Create account</Link>
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
        message: error instanceof Error ? error.message : "Document upload failed.",
      });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <label
      className={`block rounded-md border p-3 transition ${
        value
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

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  readOnly = false,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null | undefined;
  readOnly?: boolean;
  step?: string | undefined;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-bold text-[#1F2933]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        readOnly={readOnly}
        step={step}
        className="h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#ED3500] read-only:bg-[#F8FAFC] read-only:text-[#667085]"
      />
    </label>
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

function registrationModeFromQuery(value?: string | null): SellerRegistrationMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "service" || normalized === "services") {
    return "SERVICE";
  }

  if (normalized === "both" || normalized === "combined" || normalized === "retail-service") {
    return "BOTH";
  }

  return "RETAIL";
}

function primaryCapabilityForMode(mode: SellerRegistrationMode): SellerCapability {
  return mode === "SERVICE" ? "SERVICE" : "RETAIL";
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

function registrationModeIcon(mode: SellerRegistrationMode) {
  if (mode === "SERVICE") {
    return <Wrench className="h-5 w-5" aria-hidden="true" />;
  }

  if (mode === "BOTH") {
    return <Sparkles className="h-5 w-5" aria-hidden="true" />;
  }

  return <Store className="h-5 w-5" aria-hidden="true" />;
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
