"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, Eye, Mail, MapPin, Navigation, Phone, Plus, Search, Send, Trash2, Wrench } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useConfirmationDialog, type ConfirmationRequest } from "@/components/shared/confirmation-dialog";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { IndihubApiError, userFacingApiErrorMessage } from "@/lib/api";
import { coordinatesFromSnapshot, formatCoordinates, googleMapsDirectionsUrl } from "@/lib/map-navigation";
import {
  uploadSellerDocument,
  validateSellerDocument,
} from "@/lib/seller-document-upload";
import {
  archiveSellerService,
  createSellerService,
  downloadSellerServiceTaxDocument,
  getSellerService,
  getSellerServiceBooking,
  getSellerServiceCalendar,
  listSellerServiceBookings,
  listSellerServiceReviews,
  listSellerServices,
  recordSellerServiceCashCollection,
  replyToSellerServiceReview,
  sellerAcceptServiceBooking,
  sellerCancelServiceBooking,
  sellerMarkServiceInProgress,
  sellerRejectServiceBooking,
  sellerRescheduleServiceBooking,
  sellerSendServiceQuote,
  sellerSubmitServiceCompletion,
  sellerUpdateServiceFieldStatus,
  sellerWithdrawServiceQuote,
  updateSellerService,
  updateSellerServiceCalendar,
  type ServiceAvailabilityRule,
  type ServiceArea,
  type ServiceBlockedWindow,
  type ServiceBooking,
  type ServiceCalendarPayload,
  type ServiceListing,
  type ServiceListingPayload,
  type ServiceReview,
  type ServiceCancellationPolicy,
  type ServicePaymentPurpose,
  type ProductTaxClassification,
  type ServicePricingModel,
  type ServiceTechnician,
  type ServiceVisitMode,
} from "@/lib/service-marketplace-api";
import {
  formatMoney,
  listCategories,
  searchSacMaster,
  type CategorySummary,
  type SacMasterEntry,
} from "@/lib/storefront-api";
import { getSellerProfile, type SellerProfile, type SellerServiceArea } from "@/lib/seller-api";
import {
  SellerServiceAreaEditor,
  createEmptySellerServiceAreaDraft,
  createSellerServiceAreaDraftId,
  type SellerServiceAreaDraft,
} from "./seller-service-area-editor";
import { serviceImagesForSave } from "./seller-service-images";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerImageUpload,
  SellerInfoHint,
  SellerMetric,
  SellerNoticeBadge,
  SellerOnboardingRequired,
  SellerPagination,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formValue,
  formatDateTime,
  isSellerOnboardingRequiredError,
  optionalFormValue,
  rupeesToPaise,
  type SellerNotice,
  useSellerAuth,
} from "./seller-ui";

type SellerServicesClientProps = {
  mode?: "list" | "form" | "edit" | "bookings" | "booking-detail" | "calendar" | "reviews";
  serviceId?: string;
  bookingNumber?: string;
};

type SellerActionNotice = {
  tone: "success" | "danger";
  message: string;
};

function SellerActionToast({ notice, onDismiss }: { notice: SellerActionNotice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border bg-white p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={notice.tone === "success" ? "text-sm font-black text-[#0F8A5F]" : "text-sm font-black text-[#B42318]"}>
            {notice.tone === "success" ? "Action saved" : "Action failed"}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#1F2933]">{notice.message}</p>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-md px-2 py-1 text-xs font-black text-[#667085] hover:bg-[#F8FAFC]">
          Close
        </button>
      </div>
    </div>
  );
}

function sellerServiceActionMessage(action: string) {
  switch (action) {
    case "accept":
      return "Service booking accepted and assigned.";
    case "reschedule":
      return "Service schedule updated.";
    case "reject":
      return "Service booking rejected.";
    case "cancel":
      return "Service booking successfully cancelled.";
    case "start":
      return "Service booking marked in progress.";
    case "field":
      return "Technician field status updated.";
    case "withdrawQuote":
      return "Active quote withdrawn.";
    case "complete":
      return "Completion submitted for customer approval.";
    case "payment":
      return "Cash collection recorded. It will count as paid after customer or admin confirmation.";
    default:
      return "Service action completed.";
  }
}

type ServiceBookingAddressSnapshot = {
  fullName?: string | number | null;
  phone?: string | number | null;
  line1?: string | number | null;
  line2?: string | number | null;
  area?: string | number | null;
  city?: string | number | null;
  state?: string | number | null;
  pincode?: string | number | null;
  country?: string | number | null;
  countryCode?: string | number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type ServiceTechnicianDraft = {
  rowId: string;
  id?: string;
  name: string;
  phone: string;
  email: string;
  skills: string;
  isActive: boolean;
};

type ServiceBlockedWindowDraft = {
  rowId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  isFullDay: boolean;
};

const visitModes: Array<{ value: ServiceVisitMode; label: string }> = [
  { value: "CUSTOMER_LOCATION", label: "Customer location" },
  { value: "PROVIDER_LOCATION", label: "Provider location" },
  { value: "REMOTE", label: "Remote" },
];

const pricingModels: Array<{ value: ServicePricingModel; label: string }> = [
  { value: "FIXED_PRICE", label: "Fixed price" },
  { value: "QUOTE_FIRST", label: "Quote first" },
  { value: "INSPECTION_FEE", label: "Inspection fee" },
];

export function SellerServicesClient({ mode = "list", serviceId, bookingNumber }: SellerServicesClientProps) {
  const sellerAuth = useSellerAuth();

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (mode === "form") {
    return <SellerServiceForm />;
  }

  if (mode === "edit") {
    return serviceId ? <SellerServiceForm serviceId={serviceId} /> : <SellerErrorPanel error={new Error("Service id is required.")} onRetry={() => undefined} />;
  }

  if (mode === "bookings") {
    return <SellerServiceBookings />;
  }

  if (mode === "booking-detail") {
    return bookingNumber ? <SellerServiceBookingDetail bookingNumber={bookingNumber} /> : <SellerErrorPanel error={new Error("Booking number is required.")} onRetry={() => undefined} />;
  }

  if (mode === "calendar") {
    return <SellerServiceCalendar />;
  }

  if (mode === "reviews") {
    return <SellerServiceReviews />;
  }

  return <SellerServiceList />;
}

function SellerServiceList() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const servicesQuery = useQuery({
    queryKey: ["seller-services", sellerAuth.authKey, submittedSearch, page, pageSize],
    queryFn: () => listSellerServices(sellerAuth.authHeaders, { search: submittedSearch, page, limit: pageSize }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const archiveMutation = useMutation({
    mutationFn: archiveSellerService.bind(null, sellerAuth.authHeaders),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-services", sellerAuth.authKey] }),
  });

  if (servicesQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (servicesQuery.error) {
    if (isSellerOnboardingRequiredError(servicesQuery.error)) {
      return <SellerOnboardingRequired message="Create a seller profile before listing services." />;
    }
    return <SellerErrorPanel error={servicesQuery.error as Error} onRetry={() => void servicesQuery.refetch()} />;
  }

  const services = servicesQuery.data?.items ?? [];
  const summary = servicesQuery.data?.summary;

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="Service listings" value={summary?.listingCount ?? servicesQuery.data?.total ?? 0} note="All submitted service listings" />
        <SellerMetric label="Live services" value={summary?.liveCount ?? 0} note="Approved and visible" />
        <SellerMetric label="Pending approval" value={summary?.pendingApprovalCount ?? 0} note="Waiting for admin review" />
      </div>

      <SellerPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
              setPage(1);
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search services, category, or description"
              className="h-11 min-w-0 flex-1 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
            />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>
          <Button asChild>
            <Link href="/seller/services/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add service
            </Link>
          </Button>
        </div>
      </SellerPanel>

      {services.length ? (
        <div className="grid gap-4">
          {services.map((service) => (
            <SellerPanel key={service.id} className="p-0">
              <div className="grid gap-4 p-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[#D9E2EA] bg-[#EAF1F7]">
                  <StorefrontImage src={primaryServiceImage(service)} alt={service.title} sizes="180px" fallbackLabel={service.title} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <SellerStatusPill status={service.status} />
                    <SellerStatusPill status={service.approvalStatus} />
                    <StatusBadge tone="info">{service.pricingModel.replace(/_/g, " ")}</StatusBadge>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-[#123A5A]">{service.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667085]">{service.description}</p>
                  <p className="mt-2 text-sm font-bold text-[#1F2933]">{servicePriceLabel(service)}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/services/${service.slug}`}>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/seller/services/${service.id}/edit`}>
                      <Wrench className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Archive this service?",
                        description: `"${service.title}" will be removed from active service listings while its booking and approval history stays available.`,
                        confirmLabel: "Archive service",
                        onConfirm: () => archiveMutation.mutate(service.id),
                      })
                    }
                    disabled={archiveMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Archive
                  </Button>
                </div>
              </div>
            </SellerPanel>
          ))}
        </div>
      ) : (
        <SellerEmptyState
          title="No services yet"
          message="Create your first service listing with pricing, service areas, visit modes, packages, and approval-ready details."
          action={
            <Button asChild>
              <Link href="/seller/services/new">Add service</Link>
            </Button>
          }
        />
      )}
      {servicesQuery.data && servicesQuery.data.total > 0 ? (
        <SellerPagination
          page={page}
          pageSize={pageSize}
          total={servicesQuery.data.total}
          isLoading={servicesQuery.isFetching}
          itemLabel="services"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}

function SellerServiceForm({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<SellerNotice | null>(null);
  const [pricingModel, setPricingModel] = useState<ServicePricingModel>("FIXED_PRICE");
  const [taxClassification, setTaxClassification] =
    useState<ProductTaxClassification>("TAXABLE");
  const [categoryId, setCategoryId] = useState("");
  const [sacCode, setSacCode] = useState("");
  const [gstRatePercent, setGstRatePercent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [serviceAreas, setServiceAreas] = useState<SellerServiceAreaDraft[]>([emptyDraftServiceArea()]);
  const profileAreasHydratedRef = useRef(false);
  const serviceHydratedRef = useRef<string | null>(null);
  const editing = Boolean(serviceId);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const sellerOperatingCurrency = profileQuery.data?.operatingCurrency || "INR";

  const categoriesQuery = useQuery({
    queryKey: ["seller-service-categories"],
    queryFn: listCategories,
    enabled: sellerAuth.enabled,
    staleTime: 5 * 60 * 1000,
  });

  const serviceQuery = useQuery({
    queryKey: ["seller-service", sellerAuth.authKey, serviceId],
    queryFn: () => getSellerService(sellerAuth.authHeaders, serviceId ?? ""),
    enabled: sellerAuth.enabled && Boolean(serviceId),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ServiceListingPayload) =>
      serviceId ? updateSellerService(sellerAuth.authHeaders, serviceId, payload) : createSellerService(sellerAuth.authHeaders, payload),
    onSuccess: (service) => {
      setNotice({ tone: "success", message: serviceId ? "Service changes submitted for admin approval." : "Service submitted for admin approval." });
      void queryClient.invalidateQueries({ queryKey: ["seller-services", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service", sellerAuth.authKey, service.id] });
      router.push("/seller/services");
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });
  useEffect(() => {
    if (!editing && profileQuery.data && !profileAreasHydratedRef.current) {
      profileAreasHydratedRef.current = true;
      setServiceAreas(serviceAreasFromProfile(profileQuery.data));
    }
  }, [editing, profileQuery.data]);

  useEffect(() => {
    if (!serviceQuery.data || serviceHydratedRef.current === serviceQuery.data.id) {
      return;
    }
    serviceHydratedRef.current = serviceQuery.data.id;
    const service = serviceQuery.data;
    setCategoryId(service.categoryId);
    setPricingModel(service.pricingModel);
    setTaxClassification(service.taxClassification);
    setSacCode(service.sacCode ?? "");
    setGstRatePercent(String(service.gstRatePercent ?? ""));
    setCoverImageUrl(primaryServiceImage(service) || null);
    setServiceAreas(service.areas?.length ? service.areas.map(draftServiceAreaFromListing) : [emptyDraftServiceArea()]);
  }, [serviceQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveMutation.isPending) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = formValue(form, "title");
    const basePricePaise = rupeesToPaise(formValue(form, "basePrice"));
    const inspectionFeePaise = rupeesToPaise(formValue(form, "inspectionFee"));
    const advanceAmountPaise = rupeesToPaise(formValue(form, "advanceAmount"));
    const paymentMode = formValue(form, "paymentMode") as ServiceListingPayload["paymentMode"];
    const gstRate = Number(gstRatePercent);
    const taxRegistrationStatus =
      profileQuery.data?.profile?.taxRegistrationStatus ??
      (profileQuery.data?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED");
    if (pricingModel === "FIXED_PRICE" && basePricePaise <= 0) {
      setNotice({ tone: "danger", message: "Base price must be greater than zero for fixed-price services." });
      return;
    }
    if (paymentMode === "INSPECTION_FEE" && inspectionFeePaise <= 0) {
      setNotice({ tone: "danger", message: "Inspection fee must be greater than zero for this payment mode." });
      return;
    }
    if (paymentMode === "ADVANCE_PAYMENT" && advanceAmountPaise <= 0) {
      setNotice({ tone: "danger", message: "Advance amount must be greater than zero for this payment mode." });
      return;
    }
    if (
      ["TAXABLE", "NIL_RATED"].includes(taxClassification) &&
      !/^\d{6}$/.test(sacCode)
    ) {
      setNotice({ tone: "danger", message: "Enter a valid six-digit SAC code." });
      return;
    }
    if (
      taxClassification === "TAXABLE" &&
      taxRegistrationStatus === "GST_REGISTERED" &&
      (!Number.isFinite(gstRate) || gstRate <= 0 || gstRate > 100)
    ) {
      setNotice({
        tone: "danger",
        message: "Regular GST sellers must enter a GST rate between 0 and 100.",
      });
      return;
    }
    const visitModeValues = visitModes
      .map((mode) => (form.get(`visitMode:${mode.value}`) ? mode.value : null))
      .filter((mode): mode is ServiceVisitMode => Boolean(mode));

    const areas = draftServiceAreasToPayload(serviceAreas);

    const payload: ServiceListingPayload = {
      categoryId,
      title,
      description: formValue(form, "description"),
      pricingModel,
      paymentMode,
      cancellationPolicy: (formValue(form, "cancellationPolicy") || "FLEXIBLE") as ServiceCancellationPolicy,
      taxClassification,
      ...(sacCode ? { sacCode } : {}),
      gstRatePercent:
        taxClassification === "TAXABLE" && taxRegistrationStatus === "GST_REGISTERED"
          ? gstRate
          : 0,
      currency: sellerOperatingCurrency,
      quoteTtlHours: Number(formValue(form, "quoteTtlHours") || 48),
      serviceDurationMinutes: Number(formValue(form, "serviceDurationMinutes") || 60),
      allowedVisitModes: visitModeValues.length ? visitModeValues : ["CUSTOMER_LOCATION"],
      ...(basePricePaise > 0 ? { basePricePaise } : {}),
      ...(inspectionFeePaise > 0 ? { inspectionFeePaise } : {}),
      ...(advanceAmountPaise > 0 ? { advanceAmountPaise } : {}),
      highlights: lines(formValue(form, "highlights")),
      inclusions: lines(formValue(form, "inclusions")),
      requirements: lines(formValue(form, "requirements")),
      images: serviceImagesForSave(serviceQuery.data?.images, coverImageUrl, title),
      packages: packageFromForm(form, serviceQuery.data),
      areas,
    };

    saveMutation.mutate(payload);
  }

  const categories = flattenCategories(categoriesQuery.data ?? []);
  const service = serviceQuery.data;
  const serviceAreaCount = Math.max(serviceAreas.filter((area) => area.isActive).length, 1);
  const sellerTaxRegistrationStatus =
    profileQuery.data?.profile?.taxRegistrationStatus ??
    (profileQuery.data?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED");

  if (categoriesQuery.isLoading || serviceQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (categoriesQuery.error) {
    return <SellerErrorPanel error={categoriesQuery.error as Error} onRetry={() => void categoriesQuery.refetch()} />;
  }

  if (serviceQuery.error) {
    return <SellerErrorPanel error={serviceQuery.error as Error} onRetry={() => void serviceQuery.refetch()} />;
  }

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5">
        <SellerPanel>
          <div className="mb-5 flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
          <h2 className="text-xl font-black text-[#123A5A]">Service details</h2>
          <p className="mt-1 text-sm leading-6 text-[#667085]">{editing ? "Update the listing and send it back to admin review." : "Add a precise title, category, pricing model, and operating terms."}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SellerField label="Service title" name="title" required placeholder="LED TV repair and installation" defaultValue={service?.title ?? ""} />
            <SellerSelect
              label="Category"
              name="categoryId"
              required
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value);
                const defaultSac = findCategory(categoriesQuery.data ?? [], value)?.defaultSacCode;
                if (!sacCode && defaultSac) {
                  setSacCode(defaultSac);
                }
              }}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </SellerSelect>
            <SellerSelect label="Pricing model" name="pricingModel" value={pricingModel} onChange={(value) => setPricingModel(value as ServicePricingModel)} required>
              {pricingModels.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </SellerSelect>
            <SellerSelect label="Payment mode" name="paymentMode" required defaultValue={service?.paymentMode ?? "FULL_PAYMENT"}>
              <option value="FULL_PAYMENT">Full payment</option>
              <option value="ADVANCE_PAYMENT">Advance payment</option>
              <option value="INSPECTION_FEE">Inspection fee</option>
              <option value="PAY_AT_VISIT">Pay at visit</option>
            </SellerSelect>
            <SellerField label={`Base price (${sellerOperatingCurrency})`} name="basePrice" type="number" min={0.01} step="0.01" placeholder="999" defaultValue={paiseToRupeesInput(service?.basePricePaise)} />
            <SellerField label={`Inspection fee (${sellerOperatingCurrency})`} name="inspectionFee" type="number" min={0.01} step="0.01" placeholder="299" defaultValue={paiseToRupeesInput(service?.inspectionFeePaise)} />
            <SellerField label={`Advance amount (${sellerOperatingCurrency})`} name="advanceAmount" type="number" min={0.01} step="0.01" placeholder="500" defaultValue={paiseToRupeesInput(service?.advanceAmountPaise)} />
            <SellerField label="Duration minutes" name="serviceDurationMinutes" type="number" min={1} defaultValue={service?.serviceDurationMinutes ?? 60} />
            <SellerField label="Quote TTL hours" name="quoteTtlHours" type="number" min={1} defaultValue={service?.quoteTtlHours ?? 48} />
            <SellerSelect label="Cancellation policy" name="cancellationPolicy" defaultValue={service?.cancellationPolicy ?? "FLEXIBLE"} required>
              <option value="FLEXIBLE">Flexible</option>
              <option value="MODERATE">Moderate</option>
              <option value="STRICT">Strict</option>
            </SellerSelect>
            <SellerSelect
              label="Service tax classification"
              name="taxClassification"
              value={taxClassification}
              onChange={(value) => {
                const next = value as ProductTaxClassification;
                setTaxClassification(next);
                if (next !== "TAXABLE") setGstRatePercent("");
              }}
              required
            >
              <option value="TAXABLE">Taxable service</option>
              <option value="NIL_RATED">Nil-rated service</option>
              <option value="EXEMPT">Exempt service</option>
              <option value="NON_GST">Non-GST service</option>
            </SellerSelect>
            <SellerField
              label="SAC code"
              name="sacCode"
              placeholder="998719"
              value={sacCode}
              onChange={setSacCode}
              required={taxClassification === "TAXABLE" || taxClassification === "NIL_RATED"}
              hint="Use the six-digit Service Accounting Code applicable to this service."
              info={
                <SellerInfoHint label="SAC code">
                  SAC identifies services in GST invoices and returns. Confirm the correct code with your tax adviser; do not use a product HSN code here.
                </SellerInfoHint>
              }
            />
            <SacSuggestions
              search={sacCode}
              category={findCategory(categoriesQuery.data ?? [], categoryId)}
              onSelect={(entry) => setSacCode(entry.sacCode)}
            />
            <SellerField
              label="GST rate (%)"
              name="gstRatePercent"
              type="number"
              min={0}
              step="0.01"
              value={gstRatePercent}
              onChange={setGstRatePercent}
              readOnly={
                taxClassification !== "TAXABLE" ||
                sellerTaxRegistrationStatus !== "GST_REGISTERED"
              }
              required={
                taxClassification === "TAXABLE" &&
                sellerTaxRegistrationStatus === "GST_REGISTERED"
              }
              hint={
                sellerTaxRegistrationStatus === "GST_REGISTERED"
                  ? "The displayed service price is GST-inclusive."
                  : sellerTaxRegistrationStatus === "COMPOSITION"
                    ? "Composition sellers cannot collect GST; the platform records a zero rate."
                    : "Non-GST sellers cannot collect GST; the platform records a zero rate."
              }
              info={
                <SellerInfoHint label="GST rate">
                  GST is calculated only for regular GST-registered sellers offering a taxable service. Composition and non-registered sellers cannot charge GST.
                </SellerInfoHint>
              }
            />
            <div className="md:col-span-2">
              <SellerTextArea label="Description" name="description" required rows={5} placeholder="Explain what is covered, response time, inspection policy, parts, and customer prerequisites." defaultValue={service?.description ?? ""} />
            </div>
          </div>
        </SellerPanel>

        <SellerPanel>
          <h2 className="text-xl font-black text-[#123A5A]">Service image</h2>
          <div className="mt-4">
            <SellerImageUpload
              label="Service cover image"
              description="Upload a clear service photo shown on service cards, store pages, and service detail."
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              authHeaders={sellerAuth.authHeaders}
              purpose="SELLER_PRODUCT_IMAGE"
              previewLabel="SERVICE"
              aspectClass="aspect-[4/3]"
              disabled={saveMutation.isPending}
            />
          </div>
        </SellerPanel>

        <SellerPanel>
          <h2 className="text-xl font-black text-[#123A5A]">Availability and coverage</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#667085]">Visit modes</p>
              <div className="grid gap-2 md:grid-cols-3">
                {visitModes.map((mode, index) => (
                  <label key={mode.value} className="flex items-center gap-2 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3 text-sm font-bold text-[#1F2933]">
                    <input name={`visitMode:${mode.value}`} type="checkbox" defaultChecked={service ? service.allowedVisitModes.includes(mode.value) : index === 0} />
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="rounded-md border border-[#D9E2EA] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Serviceable areas</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                  Profile defaults are prefilled here. Select the exact country, state, city, and local area from the database, then use GPS for radius-based doorstep jobs.
                </p>
                <SellerServiceAreaEditor
                  areas={serviceAreas}
                  disabled={saveMutation.isPending}
                  minimumAreas={1}
                  addLabel="Add service location"
                  emptyMessage="Add at least one serviceable location for this listing."
                  createArea={emptyDraftServiceArea}
                  onChange={setServiceAreas}
                />
              </div>
            </div>
          </div>
        </SellerPanel>

        <SellerPanel>
          <h2 className="text-xl font-black text-[#123A5A]">Customer-facing content</h2>
          <div className="mt-4 grid gap-4">
            <SellerTextArea label="Highlights" name="highlights" rows={3} placeholder={"Doorstep diagnosis\nSame-day visit when available\nGenuine parts support"} defaultValue={(service?.highlights ?? []).join("\n")} />
            <SellerTextArea label="Inclusions" name="inclusions" rows={3} placeholder={"Diagnosis\nBasic troubleshooting\nRepair estimate"} defaultValue={(service?.inclusions ?? []).join("\n")} />
            <SellerTextArea label="Requirements" name="requirements" rows={3} placeholder={"Customer must provide product model\nPower socket must be available"} defaultValue={(service?.requirements ?? []).join("\n")} />
          </div>
        </SellerPanel>
      </div>

      <aside className="self-start xl:sticky xl:top-8">
        <SellerPanel>
          <h2 className="text-lg font-black text-[#123A5A]">Approval summary</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{editing ? "Edited services become inactive until admin approves the updated listing." : "Services are submitted inactive and become visible after admin approval."}</p>
          <div className="mt-4 grid gap-2 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3 text-sm font-bold text-[#1F2933]">
            <span>Image: {coverImageUrl ? "Uploaded" : "Not uploaded"}</span>
            <span>Coverage areas: {serviceAreaCount}</span>
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Submitting..." : editing ? "Submit changes" : "Submit service"}
          </Button>
          <SellerNoticeBadge notice={notice} className="mt-3" />
        </SellerPanel>
      </aside>
    </form>
  );
}

function SellerServiceBookings() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [actionNotice, setActionNotice] = useState<SellerActionNotice | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const bookingsQuery = useQuery({
    queryKey: ["seller-service-bookings", sellerAuth.authKey, page, pageSize],
    queryFn: () => listSellerServiceBookings(sellerAuth.authHeaders, { page, limit: pageSize }),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", sellerAuth.authKey, "actions"],
    queryFn: () => getSellerServiceCalendar(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ booking, action, form }: { booking: ServiceBooking; action: string; form?: FormData }) => {
      if (action === "accept") {
        const payload: { note?: string; scheduledStartAt?: string; assignedTechnicianId?: string } = {};
        const note = form ? optionalFormValue(form, "note") : undefined;
        const scheduledStartAt = form ? optionalFormValue(form, "scheduledStartAt") : undefined;
        const assignedTechnicianId = form ? optionalFormValue(form, "assignedTechnicianId") : undefined;
        if (note) payload.note = note;
        if (scheduledStartAt) payload.scheduledStartAt = toIsoDateTime(scheduledStartAt);
        if (assignedTechnicianId) payload.assignedTechnicianId = assignedTechnicianId;
        return sellerAcceptServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, {
          ...payload,
        });
      }
      if (action === "reschedule") {
        const scheduledStartAt = formValue(form ?? new FormData(), "scheduledStartAt");
        const payload: { scheduledStartAt: string; assignedTechnicianId?: string; note?: string } = {
          scheduledStartAt: toIsoDateTime(scheduledStartAt),
        };
        const assignedTechnicianId = optionalFormValue(form ?? new FormData(), "assignedTechnicianId");
        const note = optionalFormValue(form ?? new FormData(), "note");
        if (assignedTechnicianId) payload.assignedTechnicianId = assignedTechnicianId;
        if (note) payload.note = note;
        return sellerRescheduleServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, payload);
      }
      if (action === "reject") {
        return sellerRejectServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, formValue(form ?? new FormData(), "reason") || "Rejected by provider.");
      }
      if (action === "cancel") {
        return sellerCancelServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, formValue(form ?? new FormData(), "reason") || "Cancelled by provider.");
      }
      if (action === "start") {
        return sellerMarkServiceInProgress(sellerAuth.authHeaders, booking.bookingNumber);
      }
      if (action === "field") {
        const workingForm = form ?? new FormData();
        const latitude = optionalFormValue(workingForm, "latitude");
        const longitude = optionalFormValue(workingForm, "longitude");
        const note = optionalFormValue(workingForm, "note");
        const fieldProofFiles = workingForm.getAll("fieldProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
        fieldProofFiles.forEach(validateSellerDocument);
        const fieldProofKeys = fieldProofFiles.length
          ? (
              await Promise.all(
                fieldProofFiles.slice(0, 8).map((file) =>
                  uploadSellerDocument(sellerAuth.authHeaders, file, "SERVICE_COMPLETION_PROOF", {
                    serviceBookingNumber: booking.bookingNumber,
                  }),
                ),
              )
            ).map((item) => item.fileUrl)
          : undefined;
        return sellerUpdateServiceFieldStatus(sellerAuth.authHeaders, booking.bookingNumber, {
          status: formValue(workingForm, "status") as "EN_ROUTE" | "ARRIVED" | "CHECKED_IN" | "CHECKED_OUT",
          ...(latitude ? { latitude: Number(latitude) } : {}),
          ...(longitude ? { longitude: Number(longitude) } : {}),
          ...(note ? { note } : {}),
          ...(fieldProofKeys?.length ? { fieldProofKeys } : {}),
        });
      }
      if (action === "withdrawQuote") {
        const note = optionalFormValue(form ?? new FormData(), "note");
        return sellerWithdrawServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, note ? { note } : {});
      }
      if (action === "complete") {
        const workingForm = form ?? new FormData();
        const proofFiles = workingForm.getAll("completionProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
        proofFiles.forEach(validateSellerDocument);
        const completionProofKeys = proofFiles.length
          ? (
              await Promise.all(
                proofFiles.slice(0, 8).map((file) =>
                  uploadSellerDocument(sellerAuth.authHeaders, file, "SERVICE_COMPLETION_PROOF", {
                    serviceBookingNumber: booking.bookingNumber,
                  }),
                ),
              )
            ).map((item) => item.fileUrl)
          : undefined;
        return sellerSubmitServiceCompletion(sellerAuth.authHeaders, booking.bookingNumber, {
          completionNote: formValue(workingForm, "completionNote"),
          ...(completionProofKeys?.length ? { completionProofKeys } : {}),
        });
      }
      if (action === "payment") {
        const paymentPayload: {
          purpose: ServicePaymentPurpose;
          amountPaise: number;
          cashCollectionEventId?: string;
          note?: string;
        } = {
          purpose: formValue(form ?? new FormData(), "purpose") as ServicePaymentPurpose,
          amountPaise: rupeesToPaise(formValue(form ?? new FormData(), "amount")),
        };
        const referenceNumber = optionalFormValue(form ?? new FormData(), "referenceNumber");
        if (referenceNumber) {
          paymentPayload.cashCollectionEventId = normalizedCashEventId(booking.bookingNumber, referenceNumber);
          paymentPayload.note = referenceNumber;
        }
        return recordSellerServiceCashCollection(sellerAuth.authHeaders, booking.bookingNumber, paymentPayload);
      }
      const quotePayload: {
        lineItems: ServiceQuoteLinePayload[];
        note?: string;
        ttlHours?: number;
      } = {
        lineItems: serviceQuoteLinesFromForm(form ?? new FormData()),
      };
      const quoteNote = optionalFormValue(form ?? new FormData(), "note");
      const quoteTtlHours = optionalFormValue(form ?? new FormData(), "ttlHours");
      if (quoteNote) {
        quotePayload.note = quoteNote;
      }
      if (quoteTtlHours) {
        quotePayload.ttlHours = Number(quoteTtlHours);
      }
      return sellerSendServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, quotePayload);
    },
    onSuccess: (_result, variables) => {
      setActionNotice({ tone: "success", message: sellerServiceActionMessage(variables.action) });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
    },
    onError: (error) => {
      setActionNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    },
  });
  if (bookingsQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (bookingsQuery.error) {
    if (bookingsQuery.error instanceof IndihubApiError && bookingsQuery.error.status === 403) {
      return <SellerOnboardingRequired message="Service capability and seller approval are required for service bookings." />;
    }
    return <SellerErrorPanel error={bookingsQuery.error as Error} onRetry={() => void bookingsQuery.refetch()} />;
  }

  const bookings = bookingsQuery.data?.items ?? [];
  const technicians = calendarQuery.data?.technicians?.filter((technician) => technician.isActive !== false) ?? [];
  const summary = bookingsQuery.data?.summary;

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <SellerActionToast notice={actionNotice} onDismiss={() => setActionNotice(null)} />
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="New requests" value={summary?.requestedCount ?? 0} note="Awaiting provider action" />
        <SellerMetric label="Upcoming jobs" value={summary?.upcomingCount ?? 0} note="Accepted or scheduled" />
        <SellerMetric label="Completion review" value={summary?.completionReviewCount ?? 0} note="Awaiting customer/admin confirmation" />
      </div>
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <SellerPanel key={booking.id}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="flex flex-wrap gap-2">
                  <SellerStatusPill status={booking.status} />
                  <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
                  <StatusBadge tone="neutral">{booking.paymentMode.replace(/_/g, " ")}</StatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-black text-[#123A5A]">{booking.bookingNumber}</h2>
                <p className="mt-1 text-sm font-bold text-[#1F2933]">{booking.listing.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{booking.customerIssue}</p>
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/seller/service-bookings/${booking.bookingNumber}`}>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Open detail
                    </Link>
                  </Button>
                </div>
                <CustomerBookingDetails booking={booking} />
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <Info label="Payable" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
                  <Info label="Paid" value={formatMoney(booking.paidAmountPaise, booking.currency)} />
                  <Info label="Scheduled" value={formatDateTime(booking.scheduledStartAt)} />
                </div>
                <ServiceCashSummary booking={booking} compact />
              </div>
              <BookingActionPanel
                booking={booking}
                technicians={technicians}
                pending={actionMutation.isPending}
                requestConfirmation={confirmation.requestConfirmation}
                onSubmit={(booking, action, form) => {
                  const variables: { booking: ServiceBooking; action: string; form?: FormData } = { booking, action };
                  if (form) variables.form = form;
                  actionMutation.mutate(variables);
                }}
              />
            </div>
          </SellerPanel>
        ))}
      </div>
      {!bookings.length ? <SellerEmptyState title="No service bookings" message="Customer requests, quotes, scheduled jobs, and completions will appear here." /> : null}
      {(bookingsQuery.data?.total ?? 0) > 0 ? (
        <SellerPagination
          page={page}
          pageSize={pageSize}
          total={bookingsQuery.data?.total ?? 0}
          isLoading={bookingsQuery.isFetching}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPage(1);
            setPageSize(value);
          }}
          itemLabel="service bookings"
        />
      ) : null}
    </div>
  );
}

function SellerServiceBookingDetail({ bookingNumber }: { bookingNumber?: string }) {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [actionNotice, setActionNotice] = useState<SellerActionNotice | null>(null);
  const bookingQuery = useQuery({
    queryKey: ["seller-service-booking", sellerAuth.authKey, bookingNumber],
    queryFn: () => getSellerServiceBooking(sellerAuth.authHeaders, bookingNumber ?? ""),
    enabled: sellerAuth.enabled && Boolean(bookingNumber),
    retry: false,
  });
  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", sellerAuth.authKey, "detail"],
    queryFn: () => getSellerServiceCalendar(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ booking, action, form }: { booking: ServiceBooking; action: string; form?: FormData }) => {
      if (action === "accept") {
        const payload: { note?: string; scheduledStartAt?: string; assignedTechnicianId?: string } = {};
        const note = form ? optionalFormValue(form, "note") : undefined;
        const scheduledStartAt = form ? optionalFormValue(form, "scheduledStartAt") : undefined;
        const assignedTechnicianId = form ? optionalFormValue(form, "assignedTechnicianId") : undefined;
        if (note) payload.note = note;
        if (scheduledStartAt) payload.scheduledStartAt = toIsoDateTime(scheduledStartAt);
        if (assignedTechnicianId) payload.assignedTechnicianId = assignedTechnicianId;
        return sellerAcceptServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, payload);
      }
      if (action === "reschedule") {
        const payload: { scheduledStartAt: string; assignedTechnicianId?: string; note?: string } = {
          scheduledStartAt: toIsoDateTime(formValue(form ?? new FormData(), "scheduledStartAt")),
        };
        const assignedTechnicianId = optionalFormValue(form ?? new FormData(), "assignedTechnicianId");
        const note = optionalFormValue(form ?? new FormData(), "note");
        if (assignedTechnicianId) payload.assignedTechnicianId = assignedTechnicianId;
        if (note) payload.note = note;
        return sellerRescheduleServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, payload);
      }
      if (action === "reject") {
        return sellerRejectServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, formValue(form ?? new FormData(), "reason") || "Rejected by provider.");
      }
      if (action === "cancel") {
        return sellerCancelServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, formValue(form ?? new FormData(), "reason") || "Cancelled by provider.");
      }
      if (action === "start") {
        return sellerMarkServiceInProgress(sellerAuth.authHeaders, booking.bookingNumber);
      }
      if (action === "field") {
        const workingForm = form ?? new FormData();
        const latitude = optionalFormValue(workingForm, "latitude");
        const longitude = optionalFormValue(workingForm, "longitude");
        const note = optionalFormValue(workingForm, "note");
        const fieldProofFiles = workingForm.getAll("fieldProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
        fieldProofFiles.forEach(validateSellerDocument);
        const fieldProofKeys = fieldProofFiles.length
          ? (
              await Promise.all(
                fieldProofFiles.slice(0, 8).map((file) =>
                  uploadSellerDocument(sellerAuth.authHeaders, file, "SERVICE_COMPLETION_PROOF", {
                    serviceBookingNumber: booking.bookingNumber,
                  }),
                ),
              )
            ).map((item) => item.fileUrl)
          : undefined;
        return sellerUpdateServiceFieldStatus(sellerAuth.authHeaders, booking.bookingNumber, {
          status: formValue(workingForm, "status") as "EN_ROUTE" | "ARRIVED" | "CHECKED_IN" | "CHECKED_OUT",
          ...(latitude ? { latitude: Number(latitude) } : {}),
          ...(longitude ? { longitude: Number(longitude) } : {}),
          ...(note ? { note } : {}),
          ...(fieldProofKeys?.length ? { fieldProofKeys } : {}),
        });
      }
      if (action === "withdrawQuote") {
        const note = optionalFormValue(form ?? new FormData(), "note");
        return sellerWithdrawServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, note ? { note } : {});
      }
      if (action === "complete") {
        const workingForm = form ?? new FormData();
        const proofFiles = workingForm.getAll("completionProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
        proofFiles.forEach(validateSellerDocument);
        const completionProofKeys = proofFiles.length
          ? (
              await Promise.all(
                proofFiles.slice(0, 8).map((file) =>
                  uploadSellerDocument(sellerAuth.authHeaders, file, "SERVICE_COMPLETION_PROOF", {
                    serviceBookingNumber: booking.bookingNumber,
                  }),
                ),
              )
            ).map((item) => item.fileUrl)
          : undefined;
        return sellerSubmitServiceCompletion(sellerAuth.authHeaders, booking.bookingNumber, {
          completionNote: formValue(workingForm, "completionNote"),
          ...(completionProofKeys?.length ? { completionProofKeys } : {}),
        });
      }
      if (action === "payment") {
        const payload: { purpose: ServicePaymentPurpose; amountPaise: number; cashCollectionEventId?: string; note?: string } = {
          purpose: formValue(form ?? new FormData(), "purpose") as ServicePaymentPurpose,
          amountPaise: rupeesToPaise(formValue(form ?? new FormData(), "amount")),
        };
        const referenceNumber = optionalFormValue(form ?? new FormData(), "referenceNumber");
        if (referenceNumber) {
          payload.cashCollectionEventId = normalizedCashEventId(booking.bookingNumber, referenceNumber);
          payload.note = referenceNumber;
        }
        return recordSellerServiceCashCollection(sellerAuth.authHeaders, booking.bookingNumber, payload);
      }
      const quotePayload: { lineItems: ServiceQuoteLinePayload[]; note?: string; ttlHours?: number } = {
        lineItems: serviceQuoteLinesFromForm(form ?? new FormData()),
      };
      const note = optionalFormValue(form ?? new FormData(), "note");
      const ttlHours = optionalFormValue(form ?? new FormData(), "ttlHours");
      if (note) quotePayload.note = note;
      if (ttlHours) quotePayload.ttlHours = Number(ttlHours);
      return sellerSendServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, quotePayload);
    },
    onSuccess: (_result, variables) => {
      setActionNotice({ tone: "success", message: sellerServiceActionMessage(variables.action) });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-booking", sellerAuth.authKey, bookingNumber] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
    },
    onError: (error) => {
      setActionNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    },
  });
  const invoiceMutation = useMutation({
    mutationFn: () =>
      downloadSellerServiceTaxDocument(
        sellerAuth.authHeaders,
        bookingNumber ?? "",
      ),
    onError: (error) => {
      setActionNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    },
  });

  if (bookingQuery.isLoading) return <SellerSkeleton />;
  if (bookingQuery.error) return <SellerErrorPanel error={bookingQuery.error as Error} onRetry={() => void bookingQuery.refetch()} />;

  const booking = bookingQuery.data;
  if (!booking) {
    return <SellerEmptyState title="Booking not found" message="This service booking is not available for this seller account." />;
  }
  const technicians = calendarQuery.data?.technicians?.filter((technician) => technician.isActive !== false) ?? [];

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <SellerActionToast notice={actionNotice} onDismiss={() => setActionNotice(null)} />
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <SellerStatusPill status={booking.status} />
              <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
              <StatusBadge tone="neutral">{booking.paymentMode.replace(/_/g, " ")}</StatusBadge>
            </div>
            <h2 className="mt-3 text-2xl font-black text-[#123A5A]">{booking.bookingNumber}</h2>
            <p className="mt-1 text-sm font-bold text-[#667085]">{booking.listing.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["COMPLETED", "CLOSED_AFTER_INSPECTION"].includes(booking.status) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={invoiceMutation.isPending}
                onClick={() => invoiceMutation.mutate()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {invoiceMutation.isPending ? "Downloading..." : "Download invoice"}
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/seller/service-bookings">Back to bookings</Link>
            </Button>
          </div>
        </div>
      </SellerPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-5">
          <SellerPanel>
            <h3 className="text-lg font-black text-[#123A5A]">Customer request</h3>
            <p className="mt-3 text-sm leading-6 text-[#667085]">{booking.customerIssue}</p>
            <CustomerBookingDetails booking={booking} />
          </SellerPanel>

          <SellerPanel>
            <h3 className="text-lg font-black text-[#123A5A]">Schedule and payment</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Info label="Scheduled" value={formatDateTime(booking.scheduledStartAt)} />
              <Info label="Technician" value={booking.assignedTechnician?.name ?? "Not assigned"} />
              <Info label="Payable" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
              <Info label="Paid" value={formatMoney(booking.paidAmountPaise, booking.currency)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Info label="SAC" value={booking.sacCodeSnapshot ?? "Not applicable"} />
              <Info label="GST rate" value={`${Number(booking.gstRatePercentSnapshot)}%`} />
              <Info label="Taxable value" value={formatMoney(booking.taxableValuePaise, booking.currency)} />
              <Info label="GST total" value={formatMoney(booking.taxTotalPaise, booking.currency)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Info label="En route" value={formatDateTime(booking.technicianEnRouteAt)} />
              <Info label="Arrived" value={formatDateTime(booking.technicianArrivedAt)} />
              <Info label="Check-in" value={formatDateTime(booking.technicianCheckInAt)} />
              <Info label="Check-out" value={formatDateTime(booking.technicianCheckOutAt)} />
              <Info label="Field proof" value={`${booking.technicianFieldProofKeys?.length ?? 0} files`} />
            </div>
            {booking.technicianFieldStatusNote ? <p className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">{booking.technicianFieldStatusNote}</p> : null}
            <ServiceCashSummary booking={booking} />
          </SellerPanel>

          <SellerPanel>
            <h3 className="text-lg font-black text-[#123A5A]">Quotes, payments, and disputes</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <TimelineList title="Quotes" empty="No quotes sent" items={(booking.quotes ?? []).map((quote) => `${quote.quoteNumber} - ${quote.status} - ${formatMoney(quote.totalPaise, quote.currency)}`)} />
              <TimelineList title="Payments" empty="No payment records" items={(booking.payments ?? []).map((payment) => `${payment.purpose} - ${payment.status} - ${formatMoney(payment.amountPaise, payment.currency)}`)} />
              <TimelineList title="Disputes" empty="No disputes" items={(booking.disputes ?? []).map((dispute) => `${dispute.resolution ?? "OPEN"} - ${dispute.reason}`)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Info label="Refunds" value={formatMoney((booking.refundRequests ?? []).filter((refund) => !["FAILED", "CANCELLED"].includes(refund.status)).reduce((sum, refund) => sum + refund.amountPaise, 0), booking.currency)} />
              <Info label="Cancellation fee" value={formatMoney(booking.cancellationFeePaise ?? 0, booking.currency)} />
              <Info label="Cancellation refund" value={formatMoney(booking.cancellationRefundPaise ?? 0, booking.currency)} />
            </div>
          </SellerPanel>
        </div>

        <BookingActionPanel
          booking={booking}
          technicians={technicians}
          pending={actionMutation.isPending}
          requestConfirmation={confirmation.requestConfirmation}
          onSubmit={(booking, action, form) => {
            const variables: { booking: ServiceBooking; action: string; form?: FormData } = { booking, action };
            if (form) variables.form = form;
            actionMutation.mutate(variables);
          }}
        />
      </div>
    </div>
  );
}

function SellerServiceReviews() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const reviewsQuery = useQuery({
    queryKey: ["seller-service-reviews", sellerAuth.authKey, status, rating, debouncedSearch, page, pageSize],
    queryFn: () =>
      listSellerServiceReviews(sellerAuth.authHeaders, {
        page,
        limit: pageSize,
        ...(status !== "ALL" ? { status } : {}),
        ...(rating !== "ALL" ? { rating: Number(rating) } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const replyMutation = useMutation({
    mutationFn: ({ review, form }: { review: ServiceReview; form: FormData }) =>
      replyToSellerServiceReview(sellerAuth.authHeaders, review.id, { body: formValue(form, "body") }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-service-reviews"] }),
  });
  const reviews = reviewsQuery.data?.items ?? [];
  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#123A5A]">Service reviews</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">Reply to customers and track hidden, unreplied, or low-rating service feedback.</p>
          </div>
          <StatusBadge tone="info">{reviewsQuery.data?.total ?? 0} reviews</StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px]">
          <SellerField label="Search" name="search" value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Booking, service, review text" />
          <SellerSelect label="Status" name="status" value={status} onChange={(value) => { setStatus(value); setPage(1); }}>
            <option value="ALL">All</option>
            <option value="VISIBLE">Visible</option>
            <option value="HIDDEN">Hidden</option>
            <option value="REPLIED">Replied</option>
            <option value="UNREPLIED">Unreplied</option>
          </SellerSelect>
          <SellerSelect label="Rating" name="rating" value={rating} onChange={(value) => { setRating(value); setPage(1); }}>
            <option value="ALL">All</option>
            {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} star</option>)}
          </SellerSelect>
        </div>
      </SellerPanel>
      {reviewsQuery.isLoading ? <SellerSkeleton /> : null}
      {reviewsQuery.error ? <SellerErrorPanel error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} /> : null}
      <div className="grid gap-4">
        {reviews.map((review) => (
          <SellerPanel key={review.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={review.isVisible === false ? "warning" : "success"}>{review.isVisible === false ? "Hidden" : "Visible"}</StatusBadge>
                  <span className="text-sm font-black text-[#ED3500]">{review.rating}/5 rating</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[#667085]">{review.listing?.title ?? "Service"} / {review.booking?.bookingNumber ?? "Booking"}</p>
                <p className="mt-2 text-base font-semibold leading-7 text-[#1F2933]">{review.body || "No written review."}</p>
                <p className="mt-2 text-xs font-semibold text-[#667085]">{review.customer?.displayName ?? review.customer?.user?.fullName ?? "Customer"} / {formatDateTime(review.createdAt)}</p>
              </div>
              <div className="min-w-[220px] rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Provider reply</p>
                {review.reply ? <p className="mt-2 text-sm font-semibold leading-6 text-[#1F2933]">{review.reply.body}</p> : <p className="mt-2 text-sm font-semibold text-[#667085]">No reply yet.</p>}
              </div>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (replyMutation.isPending) return; replyMutation.mutate({ review, form: new FormData(event.currentTarget) }); }} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <input name="body" defaultValue={review.reply?.body ?? ""} placeholder="Write a professional reply" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
              <Button type="submit" size="sm" disabled={replyMutation.isPending}>Save reply</Button>
            </form>
          </SellerPanel>
        ))}
        {!reviews.length && !reviewsQuery.isLoading && !reviewsQuery.error ? <SellerEmptyState title="No service reviews" message="Customer service reviews will appear here after completed bookings." /> : null}
      </div>
      {reviewsQuery.data && reviewsQuery.data.total > 0 ? (
        <SellerPagination
          page={page}
          pageSize={pageSize}
          total={reviewsQuery.data.total}
          isLoading={reviewsQuery.isFetching}
          itemLabel="reviews"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerBookingDetails({ booking }: { booking: ServiceBooking }) {
  const snapshot = bookingAddressSnapshot(booking);
  const coordinates = coordinatesFromSnapshot(snapshot);
  const address = formatBookingAddress(snapshot);
  const customerName = customerDisplayName(booking, snapshot);
  const phone = customerPhone(booking, snapshot);
  const email = customerEmail(booking);
  const requestedAt = formatDateTime(booking.createdAt);
  const note = booking.customerNote?.trim();
  const emptyAddressText = booking.visitMode === "CUSTOMER_LOCATION" ? "No address captured" : "Not required for this visit mode";

  return (
    <div className="mt-4 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Customer and visit details</p>
          <p className="mt-1 break-words text-base font-black text-[#123A5A]">{customerName}</p>
        </div>
        {coordinates ? (
          <Button asChild size="sm" variant="outline">
            <a href={googleMapsDirectionsUrl(coordinates)} target="_blank" rel="noreferrer">
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Directions
            </a>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <BookingDetailItem icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Phone" value={phone} />
        <BookingDetailItem icon={<Mail className="h-4 w-4" aria-hidden="true" />} label="Email" value={email} />
        <BookingDetailItem icon={<Clock className="h-4 w-4" aria-hidden="true" />} label="Requested" value={requestedAt} />
        <div className="min-w-0 sm:col-span-2 xl:col-span-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#667085]">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            Address
          </div>
          <p className="mt-1 break-words text-sm font-bold leading-6 text-[#1F2933]">{address || emptyAddressText}</p>
          {coordinates ? <p className="mt-1 break-words text-xs font-semibold text-[#667085]">GPS: {formatCoordinates(coordinates)}</p> : null}
        </div>
        {note ? (
          <div className="min-w-0 sm:col-span-2 xl:col-span-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Customer note</p>
            <p className="mt-1 break-words text-sm font-semibold leading-6 text-[#1F2933]">{note}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BookingDetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#667085]">
        <span className="shrink-0 text-[#123A5A]">{icon}</span>
        {label}
      </div>
      <p className="mt-1 break-words text-sm font-bold text-[#1F2933]">{value}</p>
    </div>
  );
}

function BookingActionPanel({
  booking,
  technicians,
  pending,
  onSubmit,
  requestConfirmation,
}: {
  booking: ServiceBooking;
  technicians?: ServiceTechnician[];
  pending: boolean;
  onSubmit: (booking: ServiceBooking, action: string, form?: FormData) => void;
  requestConfirmation: (request: ConfirmationRequest) => void;
}) {
  const activeTechnicians = technicians ?? [];
  const remainingDuePaise = Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise);
  // Guard here rather than per-form: disabled buttons don't stop implicit
  // (Enter-key) form submission, which would double-fire the mutation.
  const submitAction = (target: ServiceBooking, action: string, form?: FormData) => {
    if (pending) {
      return;
    }
    onSubmit(target, action, form);
  };
  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#123A5A]">Provider actions</p>
      <div className="mt-3 grid gap-3">
        {booking.status === "REQUESTED" ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "accept", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="scheduledStartAt" type="datetime-local" required className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            {activeTechnicians.length ? (
              <select name="assignedTechnicianId" required defaultValue={booking.assignedTechnicianId ?? ""} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                <option value="" disabled>Select technician</option>
                {activeTechnicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name}</option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#8A1F1F]">
                Add an active technician in Service calendar before accepting this booking.
              </p>
            )}
            <input name="note" placeholder="Provider note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" size="sm" disabled={pending || !activeTechnicians.length}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
          </form>
        ) : null}
        {booking.status === "REQUESTED" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              requestConfirmation({
                title: "Reject service booking?",
                description: "This request will be closed for the customer. Confirm only after reviewing the rejection reason.",
                confirmLabel: "Reject request",
                tone: "danger",
                onConfirm: () => submitAction(booking, "reject", form),
              });
            }}
            className="grid gap-2 border-t border-[#D9E2EA] pt-3"
          >
            <input name="reason" placeholder="Rejection reason (min 5 characters)" required minLength={5} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending} className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200">Reject request</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_SENT", "QUOTE_ACCEPTED", "QUOTE_REJECTED"].includes(booking.status) ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              requestConfirmation({
                title: "Cancel service booking?",
                description: "This booking will move to cancelled and may apply the configured cancellation policy.",
                confirmLabel: "Cancel booking",
                tone: "danger",
                onConfirm: () => submitAction(booking, "cancel", form),
              });
            }}
            className="grid gap-2 border-t border-[#D9E2EA] pt-3"
          >
            <input name="reason" placeholder="Cancellation reason (min 5 characters)" required minLength={5} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending} className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200">Cancel booking</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "reschedule", new FormData(event.currentTarget)); }} className="grid gap-2 border-t border-[#D9E2EA] pt-3">
            <input name="scheduledStartAt" type="datetime-local" required defaultValue={toLocalDateTimeInput(booking.scheduledStartAt)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            {activeTechnicians.length ? (
              <select name="assignedTechnicianId" required defaultValue={booking.assignedTechnicianId ?? ""} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                <option value="" disabled>Select technician</option>
                {activeTechnicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name}</option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#8A1F1F]">
                Add an active technician before scheduling, starting, or completing this booking.
              </p>
            )}
            <input name="note" placeholder="Reschedule note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending || !activeTechnicians.length}>Update schedule</Button>
          </form>
        ) : null}
        {["ACCEPTED", "IN_PROGRESS"].includes(booking.status) ? (
          <ServiceQuoteBuilder booking={booking} pending={pending} onSubmit={(form) => submitAction(booking, "quote", form)} />
        ) : null}
        {booking.quotes?.some((quote) => quote.status === "SENT") ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "withdrawQuote", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="note" placeholder="Withdraw quote note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Withdraw active quote</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => submitAction(booking, "start")} disabled={pending}>
            <Clock className="h-4 w-4" /> Mark in progress
          </Button>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED", "IN_PROGRESS"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "field", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md border border-[#D9E2EA] bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Technician field status</p>
            <select name="status" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
              <option value="EN_ROUTE">En route</option>
              <option value="ARRIVED">Arrived</option>
              <option value="CHECKED_IN">Checked in</option>
              <option value="CHECKED_OUT">Checked out</option>
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="latitude" type="number" step="0.0000001" placeholder="Latitude" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
              <input name="longitude" type="number" step="0.0000001" placeholder="Longitude" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            </div>
            <input name="note" placeholder="Status note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="fieldProofFiles" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Update field status</Button>
          </form>
        ) : null}
        {booking.status === "IN_PROGRESS" ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "complete", new FormData(event.currentTarget)); }} className="grid gap-2">
            <textarea name="completionNote" required rows={3} placeholder="Completion note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
            <input name="completionProofFiles" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold" />
            <Button type="submit" size="sm" disabled={pending}>Submit completion</Button>
          </form>
        ) : null}
        {remainingDuePaise > 0 ? (
          <form onSubmit={(event) => { event.preventDefault(); submitAction(booking, "payment", new FormData(event.currentTarget)); }} className="grid gap-2">
            <select name="purpose" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
              <option value="PAY_AT_VISIT">Pay at visit</option>
              <option value="FINAL_QUOTE">Final quote</option>
              <option value="FULL_PAYMENT">Full payment</option>
              <option value="ADVANCE_PAYMENT">Advance payment</option>
              <option value="INSPECTION_FEE">Inspection fee</option>
            </select>
            <input name="amount" type="number" min="0.01" step="0.01" defaultValue={remainingDuePaise > 0 ? (remainingDuePaise / 100).toFixed(2) : undefined} placeholder="Amount received INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="referenceNumber" placeholder="Reference / cash note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <p className="rounded-md bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#667085]">
              Remaining balance: {formatMoney(remainingDuePaise, booking.currency)}. Records cash collected by your service person. Customer/admin confirmation controls booking payment; only platform dues from this cash can be settled or offset.
            </p>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Record cash collected</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

type ServiceQuoteLinePayload = Parameters<typeof sellerSendServiceQuote>[2]["lineItems"][number];

type ServiceQuoteLineDraft = {
  id: string;
  lineType: "SERVICE" | "PRODUCT";
  description: string;
  quantity: string;
  unitRupees: string;
  hsnSacCode: string;
  taxClassification: ProductTaxClassification;
  gstRatePercent: string;
  uqc: string;
};

function ServiceQuoteBuilder({
  booking,
  pending,
  onSubmit,
}: {
  booking: ServiceBooking;
  pending: boolean;
  onSubmit: (form: FormData) => void;
}) {
  const [lines, setLines] = useState<ServiceQuoteLineDraft[]>(() => [
    serviceQuoteLineDraft(booking, "SERVICE"),
  ]);

  const updateLine = (id: string, patch: Partial<ServiceQuoteLineDraft>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  return (
    <form
      className="grid gap-3 rounded-md border border-[#D9E2EA] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set("quoteLines", JSON.stringify(lines));
        onSubmit(form);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Quote lines</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || lines.length >= 50}
          onClick={() => setLines((current) => [...current, serviceQuoteLineDraft(booking, "PRODUCT")])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add line
        </Button>
      </div>
      {lines.map((line, index) => {
        const taxable = line.taxClassification === "TAXABLE";
        const gstRegistered =
          booking.sellerTaxRegistrationStatusSnapshot === "GST_REGISTERED";
        return (
          <div key={line.id} className="grid gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-[#123A5A]">Line {index + 1}</p>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#F5B7B7] bg-white text-[#B42318]"
                  aria-label={`Remove quote line ${index + 1}`}
                  onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <select
              value={line.lineType}
              onChange={(event) => {
                const lineType = event.target.value as ServiceQuoteLineDraft["lineType"];
                updateLine(line.id, {
                  lineType,
                  hsnSacCode: lineType === "SERVICE" ? booking.sacCodeSnapshot ?? "" : "",
                  uqc: lineType === "SERVICE" ? "NOS" : "PCS",
                });
              }}
              className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
              aria-label={`Quote line ${index + 1} type`}
            >
              <option value="SERVICE">Service / SAC</option>
              <option value="PRODUCT">Product or spare part / HSN</option>
            </select>
            <input
              required
              minLength={2}
              maxLength={240}
              value={line.description}
              onChange={(event) => updateLine(line.id, { description: event.target.value })}
              placeholder={line.lineType === "SERVICE" ? "Service or labour description" : "Part or material description"}
              className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                required
                type="number"
                min="1"
                max="999"
                step="1"
                value={line.quantity}
                onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                placeholder="Quantity"
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
              />
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={line.unitRupees}
                onChange={(event) => updateLine(line.id, { unitRupees: event.target.value })}
                placeholder="GST-inclusive unit amount INR"
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={line.hsnSacCode}
                onChange={(event) => updateLine(line.id, { hsnSacCode: event.target.value.replace(/\D/g, "").slice(0, 8) })}
                required={taxable || line.taxClassification === "NIL_RATED"}
                pattern={line.lineType === "SERVICE" ? "\\d{6}" : "\\d{4,8}"}
                placeholder={line.lineType === "SERVICE" ? "6-digit SAC" : "4 to 8 digit HSN"}
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
              />
              <select
                value={line.taxClassification}
                onChange={(event) => {
                  const taxClassification = event.target.value as ProductTaxClassification;
                  updateLine(line.id, {
                    taxClassification,
                    gstRatePercent: taxClassification === "TAXABLE" ? line.gstRatePercent : "0",
                  });
                }}
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
                aria-label={`Quote line ${index + 1} tax classification`}
              >
                <option value="TAXABLE">Taxable</option>
                <option value="NIL_RATED">Nil rated</option>
                <option value="EXEMPT">Exempt</option>
                <option value="NON_GST">Non-GST</option>
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required={taxable && gstRegistered}
                disabled={!taxable || !gstRegistered}
                value={taxable && gstRegistered ? line.gstRatePercent : "0"}
                onChange={(event) => updateLine(line.id, { gstRatePercent: event.target.value })}
                placeholder="GST rate %"
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold disabled:bg-[#EEF2F6]"
              />
              <input
                required
                maxLength={8}
                value={line.uqc}
                onChange={(event) => updateLine(line.id, { uqc: event.target.value.toUpperCase() })}
                placeholder="Unit (NOS / PCS)"
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold"
              />
            </div>
            <p className="text-xs font-semibold leading-5 text-[#667085]">
              Enter the catalogue SAC or HSN used for invoicing. Amounts are GST-inclusive.
            </p>
          </div>
        );
      })}
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="ttlHours" type="number" min="1" max="720" defaultValue={booking.listing.quoteTtlHours ?? 48} placeholder="Quote validity hours" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
        <input name="note" maxLength={1000} placeholder="Quote note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <Send className="h-4 w-4" />
        Send quote
      </Button>
    </form>
  );
}

function serviceQuoteLineDraft(
  booking: ServiceBooking,
  lineType: ServiceQuoteLineDraft["lineType"],
): ServiceQuoteLineDraft {
  return {
    id: `${lineType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lineType,
    description: "",
    quantity: "1",
    unitRupees: "",
    hsnSacCode: lineType === "SERVICE" ? booking.sacCodeSnapshot ?? "" : "",
    taxClassification:
      lineType === "SERVICE"
        ? booking.serviceTaxClassificationSnapshot ?? "TAXABLE"
        : "TAXABLE",
    gstRatePercent:
      booking.sellerTaxRegistrationStatusSnapshot === "GST_REGISTERED"
        ? String(Number(booking.gstRatePercentSnapshot ?? 0))
        : "0",
    uqc: lineType === "SERVICE" ? "NOS" : "PCS",
  };
}

function serviceQuoteLinesFromForm(form: FormData): ServiceQuoteLinePayload[] {
  const raw = formValue(form, "quoteLines");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Add at least one quote line.");
  }

  return parsed.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`Quote line ${index + 1} is invalid.`);
    }
    const line = value as Partial<ServiceQuoteLineDraft>;
    const description = line.description?.trim();
    const quantity = Number(line.quantity);
    const unitPaise = rupeesToPaise(line.unitRupees ?? "");
    if (!description || !Number.isInteger(quantity) || quantity < 1 || unitPaise < 1) {
      throw new Error(`Complete description, quantity, and amount for quote line ${index + 1}.`);
    }

    return {
      lineType: line.lineType === "PRODUCT" ? "PRODUCT" : "SERVICE",
      description,
      quantity,
      unitPaise,
      ...(line.hsnSacCode?.trim() ? { hsnSacCode: line.hsnSacCode.trim() } : {}),
      taxClassification: line.taxClassification ?? "TAXABLE",
      gstRatePercent: Number(line.gstRatePercent ?? 0),
      uqc: line.uqc?.trim().toUpperCase() || (line.lineType === "PRODUCT" ? "PCS" : "NOS"),
    };
  });
}

function SellerServiceCalendar() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<SellerNotice | null>(null);
  const [technicianDrafts, setTechnicianDrafts] = useState<ServiceTechnicianDraft[]>([]);
  const [blockedWindowDrafts, setBlockedWindowDrafts] = useState<ServiceBlockedWindowDraft[]>([]);
  const calendarHydratedForAuthRef = useRef<string | null>(null);
  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", sellerAuth.authKey],
    queryFn: () => getSellerServiceCalendar(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const saveMutation = useMutation({
    mutationFn: (form: FormData) =>
      updateSellerServiceCalendar(
        sellerAuth.authHeaders,
        calendarPayloadFromForm(form, technicianDrafts, blockedWindowDrafts),
      ),
    onSuccess: () => {
      setNotice({ tone: "success", message: "Service calendar saved." });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
    },
    onError: (error) => setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Calendar save failed." }),
  });

  useEffect(() => {
    if (!calendarQuery.data || calendarHydratedForAuthRef.current === sellerAuth.authKey) {
      return;
    }
    calendarHydratedForAuthRef.current = sellerAuth.authKey;
    setTechnicianDrafts(
      calendarQuery.data.technicians.length
        ? calendarQuery.data.technicians.map(technicianDraftFromRecord)
        : [emptyTechnicianDraft()],
    );
    setBlockedWindowDrafts(
      calendarQuery.data.blockedWindows.length
        ? calendarQuery.data.blockedWindows.map(blockedWindowDraftFromRecord)
        : [emptyBlockedWindowDraft()],
    );
  }, [calendarQuery.data, sellerAuth.authKey]);

  const scheduled = useMemo(
    () => (calendarQuery.data?.bookings ?? []).filter((booking) => booking.scheduledStartAt).sort((a, b) => String(a.scheduledStartAt).localeCompare(String(b.scheduledStartAt))),
    [calendarQuery.data?.bookings],
  );
  const unscheduled = useMemo(
    () => (calendarQuery.data?.bookings ?? []).filter((booking) => !booking.scheduledStartAt),
    [calendarQuery.data?.bookings],
  );
  const rules = calendarQuery.data?.availabilityRules ?? defaultCalendarRules();
  const blockedWindows = calendarQuery.data?.blockedWindows ?? [];
  const technicians = calendarQuery.data?.technicians ?? [];
  const activeTechnicianCount = technicianDrafts.filter((technician) => technician.isActive && technician.name.trim()).length;

  if (calendarQuery.isLoading) return <SellerSkeleton />;
  if (calendarQuery.error) return <SellerErrorPanel error={calendarQuery.error as Error} onRetry={() => void calendarQuery.refetch()} />;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SellerMetric label="Scheduled jobs" value={scheduled.length} note="Next 45 days" />
        <SellerMetric label="Unscheduled jobs" value={unscheduled.length} note="Needs date or technician" />
        <SellerMetric label="Technicians" value={activeTechnicianCount || technicians.filter((technician) => technician.isActive !== false).length} note="Active roster" />
        <SellerMetric label="Blocked windows" value={blockedWindowDrafts.filter((window) => window.startsAt && window.endsAt).length || blockedWindows.length} note="Leave or non-working time" />
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (saveMutation.isPending) return; saveMutation.mutate(new FormData(event.currentTarget)); }} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <SellerPanel>
            <h2 className="text-lg font-black text-[#123A5A]">Weekly availability</h2>
            <p className="mt-1 text-sm leading-6 text-[#667085]">Set the real working window for each day. Capacity controls how many active service jobs can overlap inside that day window.</p>
            <div className="mt-4 grid gap-3">
              {weekDays.map((day) => {
                const rule = rules.find((item) => item.dayOfWeek === day.value) ?? defaultRuleForDay(day.value);
                return (
                  <div key={day.value} className="grid gap-3 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3 md:grid-cols-[130px_1fr_1fr_120px] md:items-center">
                    <label className="flex items-center gap-2 text-sm font-black text-[#123A5A]">
                      <input name={`rule:${day.value}:active`} type="checkbox" defaultChecked={rule.isActive !== false} />
                      {day.label}
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Start time</span>
                      <input name={`rule:${day.value}:start`} type="time" defaultValue={minuteToTime(rule.startMinute)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">End time</span>
                      <input name={`rule:${day.value}:end`} type="time" defaultValue={minuteToTime(rule.endMinute)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Capacity</span>
                      <input name={`rule:${day.value}:capacity`} type="number" min={1} max={50} defaultValue={rule.capacity ?? 1} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    </label>
                  </div>
                );
              })}
            </div>
          </SellerPanel>

          <SellerPanel>
            <h2 className="text-lg font-black text-[#123A5A]">Scheduled jobs</h2>
            <p className="mt-1 text-sm leading-6 text-[#667085]">Open a job to reschedule it, assign a technician, record payment, send a quote, or submit completion.</p>
            <div className="mt-4 grid gap-3">
              {scheduled.map((booking) => (
                <Link key={booking.id} href={`/seller/service-bookings/${booking.bookingNumber}`} className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#123A5A]">{formatDateTime(booking.scheduledStartAt)}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-[#667085]">{booking.bookingNumber} - {booking.listing.title}</p>
                    <p className="mt-1 text-xs font-bold text-[#667085]">Technician: {booking.assignedTechnician?.name ?? "Not assigned"}</p>
                  </div>
                  <SellerStatusPill status={booking.status} />
                </Link>
              ))}
              {!scheduled.length ? <SellerEmptyState title="No scheduled jobs" message="Accepted service bookings with visit dates will appear here." /> : null}
            </div>
          </SellerPanel>
        </div>

        <aside className="grid gap-5 self-start xl:sticky xl:top-8">
          <SellerPanel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#123A5A]">Technicians</h2>
                <p className="mt-1 text-sm leading-6 text-[#667085]">Add the people who can be assigned to service visits. Inactive rows stay in history but cannot receive new jobs.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTechnicianDrafts((current) => [...current, emptyTechnicianDraft()])}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {technicianDrafts.map((technician) => (
                <div key={technician.rowId} className="grid gap-2 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#1F2933]">
                      <input
                        type="checkbox"
                        checked={technician.isActive}
                        onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { isActive: event.target.checked })}
                      />
                      Active
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeTechnicianDraft(setTechnicianDrafts, technician.rowId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Technician name</span>
                    <input
                      value={technician.name}
                      onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { name: event.target.value })}
                      placeholder="e.g. Kumar"
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Phone</span>
                    <input
                      value={technician.phone}
                      onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { phone: event.target.value })}
                      placeholder="Customer-visible contact if assigned"
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Email</span>
                    <input
                      value={technician.email}
                      onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { email: event.target.value })}
                      placeholder="technician@example.com"
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Skills</span>
                    <input
                      value={technician.skills}
                      onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { skills: event.target.value })}
                      placeholder="Washing machine, AC, installation"
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                </div>
              ))}
            </div>
          </SellerPanel>

          <SellerPanel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#123A5A]">Blocked time</h2>
                <p className="mt-1 text-sm leading-6 text-[#667085]">Use this for leave days, lunch closures, inventory work, or local blackout periods. Bookings cannot be scheduled across these windows.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBlockedWindowDrafts((current) => [...current, emptyBlockedWindowDraft()])}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {blockedWindowDrafts.map((window) => (
                <div key={window.rowId} className="grid gap-2 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#1F2933]">
                      <input
                        type="checkbox"
                        checked={window.isFullDay}
                        onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { isFullDay: event.target.checked })}
                      />
                      Full day
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeBlockedWindowDraft(setBlockedWindowDrafts, window.rowId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Blocked from</span>
                    <input
                      type="datetime-local"
                      value={window.startsAt}
                      onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { startsAt: event.target.value })}
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Blocked until</span>
                    <input
                      type="datetime-local"
                      value={window.endsAt}
                      onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { endsAt: event.target.value })}
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">Reason</span>
                    <input
                      value={window.reason}
                      onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { reason: event.target.value })}
                      placeholder="Leave, lunch closure, inventory work"
                      className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                    />
                  </label>
                </div>
              ))}
            </div>
          </SellerPanel>

          <SellerPanel>
            <h2 className="text-lg font-black text-[#123A5A]">Unscheduled jobs</h2>
            <div className="mt-4 grid gap-2">
              {unscheduled.slice(0, 6).map((booking) => (
                <Link key={booking.id} href={`/seller/service-bookings/${booking.bookingNumber}`} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-bold text-[#123A5A] transition hover:border-[#ED3500]">
                  {booking.bookingNumber} - {booking.listing.title}
                </Link>
              ))}
              {!unscheduled.length ? <p className="text-sm font-semibold text-[#667085]">No unscheduled active jobs.</p> : null}
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save calendar"}
            </Button>
            <SellerNoticeBadge notice={notice} className="mt-3" />
          </SellerPanel>
        </aside>
      </form>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 font-black text-[#123A5A]">{value}</p>
    </div>
  );
}

function ServiceCashSummary({ booking, compact = false }: { booking: ServiceBooking; compact?: boolean }) {
  const payments = booking.payments ?? [];
  const providerCash = payments.filter((payment) => payment.collectionType === "PROVIDER_CASH");
  const platformPaid = payments
    .filter((payment) => payment.status === "PAID" && payment.settlementTreatment === "PAYOUT_ELIGIBLE")
    .reduce((sum, payment) => sum + payment.amountPaise, 0);
  const cashRecorded = providerCash.reduce((sum, payment) => sum + payment.amountPaise, 0);
  const cashConfirmed = providerCash
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.amountPaise, 0);
  const receivables = booking.sellerReceivables ?? providerCash.flatMap((payment) => payment.sellerReceivables ?? []);
  const receivableOpen = receivables
    .filter((item) => !["SETTLED", "WAIVED", "REVERSED", "OFFSET_APPLIED"].includes(item.status))
    .reduce((sum, item) => sum + serviceReceivableOutstanding(item), 0);

  if (!providerCash.length && !receivables.length && compact) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Platform paid" value={formatMoney(platformPaid, booking.currency)} />
        <Info label="Cash recorded" value={formatMoney(cashRecorded, booking.currency)} />
        <Info label="Cash confirmed" value={formatMoney(cashConfirmed, booking.currency)} />
        <Info label="Platform due" value={formatMoney(receivableOpen, booking.currency)} />
      </div>
      {providerCash.length ? (
        <div className="mt-3 grid gap-2">
          {providerCash.slice(0, compact ? 2 : 6).map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs font-bold text-[#667085]">
              <span>{payment.purpose.replace(/_/g, " ")} / {payment.cashCollectionStatus?.replace(/_/g, " ") ?? "RECORDED"}</span>
              <span className="text-[#123A5A]">{formatMoney(payment.amountPaise, payment.currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function bookingAddressSnapshot(booking: ServiceBooking): ServiceBookingAddressSnapshot | null {
  const snapshot = booking.addressSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as ServiceBookingAddressSnapshot;
}

function snapshotText(snapshot: ServiceBookingAddressSnapshot | null, key: keyof ServiceBookingAddressSnapshot) {
  const value = snapshot?.[key];
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function customerDisplayName(booking: ServiceBooking, snapshot: ServiceBookingAddressSnapshot | null) {
  return snapshotText(snapshot, "fullName") || booking.customer?.displayName?.trim() || booking.customer?.user?.fullName?.trim() || booking.customer?.user?.email?.trim() || "Customer";
}

function customerPhone(booking: ServiceBooking, snapshot: ServiceBookingAddressSnapshot | null) {
  return snapshotText(snapshot, "phone") || booking.customer?.user?.phone?.trim() || "Not shared";
}

function customerEmail(booking: ServiceBooking) {
  return booking.customer?.user?.email?.trim() || "Not shared";
}

function formatBookingAddress(snapshot: ServiceBookingAddressSnapshot | null) {
  const cityLine = [snapshotText(snapshot, "city"), snapshotText(snapshot, "state"), snapshotText(snapshot, "pincode")].filter(Boolean).join(", ");
  const countryLine = snapshotText(snapshot, "country") || snapshotText(snapshot, "countryCode");
  return [snapshotText(snapshot, "line1"), snapshotText(snapshot, "line2"), snapshotText(snapshot, "area"), cityLine, countryLine].filter(Boolean).join(", ");
}

function primaryServiceImage(service: ServiceListing) {
  return service.images?.find((image) => image.isPrimary)?.url ?? service.images?.[0]?.url ?? "";
}

function servicePriceLabel(service: ServiceListing) {
  if (service.pricingModel === "QUOTE_FIRST") return "Quote after provider review";
  if (service.pricingModel === "INSPECTION_FEE") return `Inspection from ${formatMoney(service.inspectionFeePaise ?? 0, service.currency)}`;
  return `Starts at ${formatMoney(service.basePricePaise ?? service.packages?.[0]?.pricePaise ?? 0, service.currency)}`;
}

function serviceAreasFromProfile(profile?: SellerProfile | null): SellerServiceAreaDraft[] {
  const saved = (profile?.serviceAreas ?? []).map((area) => draftServiceAreaFromProfile(area));
  if (saved.length) {
    return saved;
  }

  const address = profile?.addresses[0];
  return address ? [draftServiceAreaFromAddress(address)] : [emptyDraftServiceArea()];
}

function draftServiceAreaFromProfile(area: SellerServiceArea): SellerServiceAreaDraft {
  return {
    id: area.id ?? draftAreaId(),
    label: area.label ?? "",
    countryCode: area.countryCode ?? "IN",
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

function draftServiceAreaFromListing(area: ServiceArea): SellerServiceAreaDraft {
  return {
    id: area.id ?? draftAreaId(),
    label: area.label ?? "",
    countryCode: area.countryCode ?? "IN",
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
    label: "Primary service area",
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

function draftServiceAreasToPayload(areas: SellerServiceAreaDraft[]): ServiceArea[] {
  const cleaned = areas
    .map((area) => {
      const latitude = numberOrUndefined(area.latitude);
      const longitude = numberOrUndefined(area.longitude);
      const radiusKm = numberOrUndefined(area.radiusKm);
      const payload: ServiceArea = {
        label: optionalText(area.label) ?? "Primary service area",
        countryCode: optionalText(area.countryCode) ?? "IN",
        isActive: area.isActive,
      };
      const stateCode = optionalText(area.stateCode);
      const cityCode = optionalText(area.cityCode);
      const localAreaCode = optionalText(area.localAreaCode);
      const pincode = optionalText(area.pincode);
      if (stateCode) payload.stateCode = stateCode;
      if (cityCode) payload.cityCode = cityCode;
      if (localAreaCode) payload.localAreaCode = localAreaCode;
      if (pincode) payload.pincode = pincode;
      if (latitude !== undefined) payload.latitude = latitude;
      if (longitude !== undefined) payload.longitude = longitude;
      if (radiusKm !== undefined) payload.radiusKm = radiusKm;

      return payload;
    })
    .filter((area) => area.isActive);

  return cleaned.length ? cleaned : [{ label: "Primary service area", countryCode: "IN", radiusKm: 10, isActive: true }];
}

function serviceReceivableOutstanding(receivable: {
  amountDueToPlatformPaise: number;
  settledPaise: number;
  waivedPaise: number;
  reversalPaise: number;
  offsetPaise: number;
}) {
  return Math.max(
    0,
    receivable.amountDueToPlatformPaise -
      receivable.settledPaise -
      receivable.waivedPaise -
      receivable.reversalPaise -
      receivable.offsetPaise,
  );
}

function normalizedCashEventId(bookingNumber: string, reference: string) {
  const cleaned = `${bookingNumber}:${reference}`
    .trim()
    .replace(/[^A-Za-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 150);
  return cleaned.length >= 8 ? cleaned : `${bookingNumber}:cash`;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringifyOptional(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function draftAreaId() {
  return createSellerServiceAreaDraftId();
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function numberOrUndefined(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function packageFromForm(form: FormData, service?: ServiceListing) {
  const name = optionalFormValue(form, "packageName");
  const pricePaise = rupeesToPaise(formValue(form, "basePrice"));
  if (!name && service?.packages?.length) return service.packages;
  if (!name || pricePaise <= 0) return service?.packages ?? [];
  return [{ name, pricePaise, sortOrder: 0, isActive: true }];
}

function SacSuggestions({
  search,
  category,
  onSelect,
}: {
  search: string;
  category?: CategorySummary | null;
  onSelect: (entry: SacMasterEntry) => void;
}) {
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const query = useQuery({
    queryKey: ["sac-master", debouncedSearch],
    queryFn: () => searchSacMaster({ search: debouncedSearch, limit: 6 }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
  const suggestions = query.data ?? [];

  if (!suggestions.length) {
    return category?.defaultSacCode ? (
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: `category-${category.id}`,
            sacCode: category.defaultSacCode ?? "",
            description: `${category.name} default SAC`,
          })
        }
        className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-bold text-[#163B5C] transition hover:border-[#ED3500] hover:bg-[#FFF0EC]"
      >
        Use category default: {category.defaultSacCode}
      </button>
    ) : null;
  }

  return (
    <div className="grid gap-2">
      {suggestions.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelect(entry)}
          className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-bold text-[#163B5C] transition hover:border-[#ED3500] hover:bg-[#FFF0EC]"
        >
          <span className="block">{entry.sacCode} - {entry.description}</span>
          {entry.sourceReference ? (
            <span className="mt-0.5 block text-[#667085]">{entry.sourceReference}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function findCategory(
  categories: CategorySummary[],
  categoryId: string,
): CategorySummary | null {
  for (const category of categories) {
    if (category.id === categoryId) {
      return category;
    }
    const child = findCategory(category.children ?? [], categoryId);
    if (child) {
      return child;
    }
  }
  return null;
}

function flattenCategories(categories: Awaited<ReturnType<typeof listCategories>> = [], prefix = ""): Array<{ id: string; label: string }> {
  return categories.flatMap((category) => {
    const label = prefix ? `${prefix} / ${category.name}` : category.name;
    return [{ id: category.id, label }, ...flattenCategories(category.children ?? [], label)];
  });
}

function paiseToRupeesInput(value?: number | null) {
  return value ? String(value / 100) : "";
}

function toIsoDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const weekDays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function defaultRuleForDay(dayOfWeek: number): ServiceAvailabilityRule {
  return {
    dayOfWeek,
    startMinute: 10 * 60,
    endMinute: 18 * 60,
    capacity: 1,
    isActive: dayOfWeek !== 0,
  };
}

function defaultCalendarRules() {
  return weekDays.map((day) => defaultRuleForDay(day.value));
}

function minuteToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinute(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Math.min(1440, Math.max(0, Number(hours) * 60 + Number(minutes)));
}

function calendarPayloadFromForm(
  form: FormData,
  technicianDrafts: ServiceTechnicianDraft[],
  blockedWindowDrafts: ServiceBlockedWindowDraft[],
): ServiceCalendarPayload {
  const availabilityRules = weekDays.map((day) => ({
    dayOfWeek: day.value,
    startMinute: timeToMinute(formValue(form, `rule:${day.value}:start`) || "10:00"),
    endMinute: timeToMinute(formValue(form, `rule:${day.value}:end`) || "18:00"),
    capacity: Number(formValue(form, `rule:${day.value}:capacity`) || 1),
    isActive: Boolean(form.get(`rule:${day.value}:active`)),
  }));

  const technicians: ServiceTechnician[] = technicianDrafts.flatMap((draft) => {
    const name = draft.name.trim();
    if (!name && !draft.id) return [];
    const technician: ServiceTechnician = {
      name: name || "Technician",
      phone: optionalText(draft.phone) ?? null,
      email: optionalText(draft.email) ?? null,
      skills: splitComma(draft.skills),
      isActive: draft.isActive && Boolean(name),
    };
    if (draft.id) technician.id = draft.id;
    return [technician];
  });

  const blockedWindows: ServiceBlockedWindow[] = blockedWindowDrafts.flatMap((draft) => {
    const startsAt = draft.startsAt.trim();
    const endsAt = draft.endsAt.trim();
    if (!startsAt || !endsAt) return [];
    return [{
      startsAt: toIsoDateTime(startsAt),
      endsAt: toIsoDateTime(endsAt),
      reason: optionalText(draft.reason) ?? null,
      isFullDay: draft.isFullDay,
    }];
  });

  return { availabilityRules, technicians, blockedWindows };
}

function technicianDraftFromRecord(technician: ServiceTechnician): ServiceTechnicianDraft {
  const draft: ServiceTechnicianDraft = {
    rowId: technician.id ?? createCalendarDraftId(),
    name: technician.name ?? "",
    phone: technician.phone ?? "",
    email: technician.email ?? "",
    skills: (technician.skills ?? []).join(", "),
    isActive: technician.isActive ?? true,
  };
  if (technician.id) draft.id = technician.id;
  return draft;
}

function emptyTechnicianDraft(): ServiceTechnicianDraft {
  return {
    rowId: createCalendarDraftId(),
    name: "",
    phone: "",
    email: "",
    skills: "",
    isActive: true,
  };
}

function blockedWindowDraftFromRecord(window: ServiceBlockedWindow): ServiceBlockedWindowDraft {
  return {
    rowId: window.id ?? createCalendarDraftId(),
    startsAt: toLocalDateTimeInput(window.startsAt),
    endsAt: toLocalDateTimeInput(window.endsAt),
    reason: window.reason ?? "",
    isFullDay: window.isFullDay ?? false,
  };
}

function emptyBlockedWindowDraft(): ServiceBlockedWindowDraft {
  return {
    rowId: createCalendarDraftId(),
    startsAt: "",
    endsAt: "",
    reason: "",
    isFullDay: false,
  };
}

function updateTechnicianDraft(
  setDrafts: (updater: (current: ServiceTechnicianDraft[]) => ServiceTechnicianDraft[]) => void,
  rowId: string,
  patch: Partial<ServiceTechnicianDraft>,
) {
  setDrafts((current) => current.map((draft) => (draft.rowId === rowId ? { ...draft, ...patch } : draft)));
}

function removeTechnicianDraft(
  setDrafts: (updater: (current: ServiceTechnicianDraft[]) => ServiceTechnicianDraft[]) => void,
  rowId: string,
) {
  setDrafts((current) => {
    const next = current.filter((draft) => draft.rowId !== rowId);
    return next.length ? next : [emptyTechnicianDraft()];
  });
}

function updateBlockedWindowDraft(
  setDrafts: (updater: (current: ServiceBlockedWindowDraft[]) => ServiceBlockedWindowDraft[]) => void,
  rowId: string,
  patch: Partial<ServiceBlockedWindowDraft>,
) {
  setDrafts((current) => current.map((draft) => (draft.rowId === rowId ? { ...draft, ...patch } : draft)));
}

function removeBlockedWindowDraft(
  setDrafts: (updater: (current: ServiceBlockedWindowDraft[]) => ServiceBlockedWindowDraft[]) => void,
  rowId: string,
) {
  setDrafts((current) => {
    const next = current.filter((draft) => draft.rowId !== rowId);
    return next.length ? next : [emptyBlockedWindowDraft()];
  });
}

function createCalendarDraftId() {
  return `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitComma(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function TimelineList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-sm font-black text-[#123A5A]">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <p key={`${item}-${index}`} className="break-words text-sm font-semibold leading-6 text-[#667085]">{item}</p>
        ))}
        {!items.length ? <p className="text-sm font-semibold text-[#667085]">{empty}</p> : null}
      </div>
    </div>
  );
}
