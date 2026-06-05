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
  Store,
  Upload,
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
  type SellerBusinessType,
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
}> = [
  {
    type: "ID_PROOF",
    label: "ID proof",
    description: "PAN, Aadhaar, passport, or business-authorized ID proof.",
  },
  {
    type: "SIGNATURE_PROOF",
    label: "Signature proof",
    description: "Signed declaration, signature image, or authorization letter.",
  },
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

type SubmitState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function SellerRegistrationForm() {
  const auth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [documents, setDocuments] = useState<SellerDocumentUploadResult[]>([]);

  const sellerQuery = useQuery({
    queryKey: ["seller-onboarding-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans"],
    queryFn: listSellerSubscriptionPlans,
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

  const currentEmail = auth.userProfile?.email;
  const currentName = useMemo(() => auth.userProfile?.fullName ?? "", [auth.userProfile?.fullName]);
  const currentPhone = normalizeIndianPhone(auth.userProfile?.phone);
  const existingSeller = sellerQuery.data;
  const existingDocuments = existingSeller?.documents ?? [];
  const selectedDocuments = documents;
  const allDocuments = [...existingDocuments, ...selectedDocuments];
  const idVerified = hasChecklistDocumentType(allDocuments, [
    "ID_PROOF",
    "PAN_CARD",
    "GST_CERTIFICATE",
    "BUSINESS_REGISTRATION",
  ]);
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

  useEffect(() => {
    if (!selectedPlanId && defaultPlanId) {
      setSelectedPlanId(defaultPlanId);
    }
  }, [defaultPlanId, selectedPlanId]);

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

    onboardingMutation.mutate({
      sellerType: formValue(form, "sellerType") as SellerOnboardingPayload["sellerType"],
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
                  <StatusBadge
                    tone={sellerQuery.data.status === "APPROVED" ? "success" : "warning"}
                  >
                    {sellerQuery.data.status?.replace(/_/g, " ") ?? "Pending"}
                  </StatusBadge>
                  {sellerQuery.data.subscriptionPlan ? (
                    <StatusBadge tone="info">{sellerQuery.data.subscriptionPlan.name}</StatusBadge>
                  ) : null}
                </div>
              </div>
            </div>
            <Button asChild>
              <Link href="/seller">
                Open seller center <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
        <OnboardingCompletionStatus status={onboardingStatus} />
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
              description="Upload the required proof documents before final review. Admin can approve or reject each document."
            />
          </div>
          <div className="mt-5 grid gap-3">
            {verificationDocuments.map((document) => (
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
              title="Store and pickup details"
              description="Add the display name and pickup address used for seller verification and fulfilment."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Store name" name="storeName" required placeholder="Enter your store name" />
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
              />
            </label>
            <div className="md:col-span-2">
              <PlanPicker
                plans={plans}
                selectedPlanId={selectedPlanId}
                defaultPlanId={defaultPlanId}
                loading={plansQuery.isLoading}
                error={plansQuery.error}
                onChange={setSelectedPlanId}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="Address line 1" name="line1" required placeholder="Building and street" />
            <Field label="Address line 2" name="line2" placeholder="Landmark or floor" />
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
              {onboardingMutation.isPending ? "Submitting..." : "Submit for review"}
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
        <OnboardingCompletionStatus status={onboardingStatus} />
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

function OnboardingCompletionStatus({ status }: { status: OnboardingStatusValue }) {
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
      title: "Store & Pickup Details",
      items: [
        { key: "display", label: "Display Name", complete: status.displayNameReady },
        { key: "pickup", label: "Pickup Address", complete: status.pickupAddressReady },
      ],
    },
    {
      title: "Listing & Stock Availability",
      items: [
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
  onChange,
}: {
  plans: SellerSubscriptionPlan[];
  selectedPlanId: string;
  defaultPlanId: string;
  loading: boolean;
  error: Error | null;
  onChange: (planId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        </span>
        <SectionHeading
          title="Seller subscription plan"
          description="Choose the plan for onboarding. Paid monthly and yearly plans are authorised after admin approval."
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
          No active plans configured. Admin default will be applied during review.
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
                  Products {limitLabel(plan.productLimit)} / Featured{" "}
                  {limitLabel(plan.featuredProductLimit)} / B2B {limitLabel(plan.b2bEnquiryLimit)}
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
            <Link href="/sign-in?redirect_url=/seller/register">
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
  document: { type: SellerDocumentType; label: string; description: string };
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
    <label className="block rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-sm font-black text-[#1F2933]">{document.label}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
            {value ? value.fileName : document.description}
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
