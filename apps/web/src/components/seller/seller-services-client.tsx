"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Eye, Mail, MapPin, Navigation, Phone, Plus, Search, Send, Trash2, Wrench } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { IndihubApiError } from "@/lib/api";
import { coordinatesFromSnapshot, formatCoordinates, googleMapsDirectionsUrl } from "@/lib/map-navigation";
import { uploadSellerDocument } from "@/lib/seller-document-upload";
import {
  archiveSellerService,
  createSellerService,
  getSellerService,
  getSellerServiceBooking,
  getSellerServiceCalendar,
  listSellerServiceBookings,
  listSellerServiceReviews,
  listSellerServices,
  recordSellerServiceCashCollection,
  replyToSellerServiceReview,
  sellerAcceptServiceBooking,
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
  type ServicePricingModel,
  type ServiceTechnician,
  type ServiceVisitMode,
} from "@/lib/service-marketplace-api";
import { listCategories, formatMoney } from "@/lib/storefront-api";
import { getSellerProfile, type SellerProfile, type SellerServiceArea } from "@/lib/seller-api";
import {
  SellerServiceAreaEditor,
  createEmptySellerServiceAreaDraft,
  createSellerServiceAreaDraftId,
  type SellerServiceAreaDraft,
} from "./seller-service-area-editor";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerImageUpload,
  SellerMetric,
  SellerOnboardingRequired,
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
  useSellerAuth,
} from "./seller-ui";

type SellerServicesClientProps = {
  mode?: "list" | "form" | "edit" | "bookings" | "booking-detail" | "calendar" | "reviews";
  serviceId?: string;
  bookingNumber?: string;
};

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
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const servicesQuery = useQuery({
    queryKey: ["seller-services", sellerAuth.authKey, submittedSearch],
    queryFn: () => listSellerServices(sellerAuth.authHeaders, { search: submittedSearch, limit: 30 }),
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
  const active = services.filter((service) => service.status === "ACTIVE").length;
  const pending = services.filter((service) => service.approvalStatus === "PENDING_APPROVAL").length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="Service listings" value={servicesQuery.data?.total ?? 0} note="All submitted service listings" />
        <SellerMetric label="Live services" value={active} note="Approved and visible" />
        <SellerMetric label="Pending approval" value={pending} note="Waiting for admin review" />
      </div>

      <SellerPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
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
                  <Button type="button" variant="outline" size="sm" onClick={() => archiveMutation.mutate(service.id)} disabled={archiveMutation.isPending}>
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
    </div>
  );
}

function SellerServiceForm({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState<ServicePricingModel>("FIXED_PRICE");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [serviceAreas, setServiceAreas] = useState<SellerServiceAreaDraft[]>([emptyDraftServiceArea()]);
  const editing = Boolean(serviceId);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey, "service-defaults"],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

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
      setNotice(serviceId ? "Service changes submitted for admin approval." : "Service submitted for admin approval.");
      void queryClient.invalidateQueries({ queryKey: ["seller-services", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service", sellerAuth.authKey, service.id] });
      router.push("/seller/services");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Service save failed."),
  });
  useEffect(() => {
    if (!editing && profileQuery.data) {
      setServiceAreas(serviceAreasFromProfile(profileQuery.data));
    }
  }, [editing, profileQuery.data]);

  useEffect(() => {
    if (!serviceQuery.data) {
      return;
    }
    const service = serviceQuery.data;
    setPricingModel(service.pricingModel);
    setCoverImageUrl(primaryServiceImage(service) || null);
    setServiceAreas(service.areas?.length ? service.areas.map(draftServiceAreaFromListing) : [emptyDraftServiceArea()]);
  }, [serviceQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = formValue(form, "title");
    const basePricePaise = rupeesToPaise(formValue(form, "basePrice"));
    const inspectionFeePaise = rupeesToPaise(formValue(form, "inspectionFee"));
    const advanceAmountPaise = rupeesToPaise(formValue(form, "advanceAmount"));
    const visitModeValues = visitModes
      .map((mode) => (form.get(`visitMode:${mode.value}`) ? mode.value : null))
      .filter((mode): mode is ServiceVisitMode => Boolean(mode));

    const areas = draftServiceAreasToPayload(serviceAreas);

    const payload: ServiceListingPayload = {
      categoryId: formValue(form, "categoryId"),
      title,
      description: formValue(form, "description"),
      pricingModel,
      paymentMode: formValue(form, "paymentMode") as ServiceListingPayload["paymentMode"],
      cancellationPolicy: (formValue(form, "cancellationPolicy") || "FLEXIBLE") as ServiceCancellationPolicy,
      currency: "INR",
      quoteTtlHours: Number(formValue(form, "quoteTtlHours") || 48),
      serviceDurationMinutes: Number(formValue(form, "serviceDurationMinutes") || 60),
      allowedVisitModes: visitModeValues.length ? visitModeValues : ["CUSTOMER_LOCATION"],
      ...(basePricePaise > 0 ? { basePricePaise } : {}),
      ...(inspectionFeePaise > 0 ? { inspectionFeePaise } : {}),
      ...(advanceAmountPaise > 0 ? { advanceAmountPaise } : {}),
      highlights: lines(formValue(form, "highlights")),
      inclusions: lines(formValue(form, "inclusions")),
      requirements: lines(formValue(form, "requirements")),
      images: coverImageUrl
        ? [
            {
              url: coverImageUrl,
              altText: title,
              sortOrder: 0,
              isPrimary: true,
            },
          ]
        : [],
      packages: packageFromForm(form, serviceQuery.data),
      areas,
    };

    saveMutation.mutate(payload);
  }

  const categories = flattenCategories(categoriesQuery.data ?? []);
  const service = serviceQuery.data;
  const serviceAreaCount = Math.max(serviceAreas.filter((area) => area.isActive).length, 1);

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
            <SellerSelect label="Category" name="categoryId" required defaultValue={service?.categoryId ?? ""}>
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
            <SellerField label="Base price (INR)" name="basePrice" type="number" min={0} step="0.01" placeholder="999" defaultValue={paiseToRupeesInput(service?.basePricePaise)} />
            <SellerField label="Inspection fee (INR)" name="inspectionFee" type="number" min={0} step="0.01" placeholder="299" defaultValue={paiseToRupeesInput(service?.inspectionFeePaise)} />
            <SellerField label="Advance amount (INR)" name="advanceAmount" type="number" min={0} step="0.01" placeholder="500" defaultValue={paiseToRupeesInput(service?.advanceAmountPaise)} />
            <SellerField label="Duration minutes" name="serviceDurationMinutes" type="number" min={1} defaultValue={service?.serviceDurationMinutes ?? 60} />
            <SellerField label="Quote TTL hours" name="quoteTtlHours" type="number" min={1} defaultValue={service?.quoteTtlHours ?? 48} />
            <SellerSelect label="Cancellation policy" name="cancellationPolicy" defaultValue={service?.cancellationPolicy ?? "FLEXIBLE"} required>
              <option value="FLEXIBLE">Flexible</option>
              <option value="MODERATE">Moderate</option>
              <option value="STRICT">Strict</option>
            </SellerSelect>
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
          {notice ? <p className="mt-3 rounded-md bg-[#FFF0EC] p-3 text-sm font-bold text-[#9F2600]">{notice}</p> : null}
        </SellerPanel>
      </aside>
    </form>
  );
}

function SellerServiceBookings() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["seller-service-bookings", sellerAuth.authKey],
    queryFn: () => listSellerServiceBookings(sellerAuth.authHeaders, { limit: 50 }),
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
      if (action === "start") {
        return sellerMarkServiceInProgress(sellerAuth.authHeaders, booking.bookingNumber);
      }
      if (action === "field") {
        const workingForm = form ?? new FormData();
        const latitude = optionalFormValue(workingForm, "latitude");
        const longitude = optionalFormValue(workingForm, "longitude");
        const note = optionalFormValue(workingForm, "note");
        const fieldProofFiles = workingForm.getAll("fieldProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
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
        lineItems: Array<{ description: string; unitPaise: number }>;
        note?: string;
      } = {
        lineItems: [{ description: formValue(form ?? new FormData(), "quoteDescription"), unitPaise: rupeesToPaise(formValue(form ?? new FormData(), "quoteAmount")) }],
      };
      const quoteNote = optionalFormValue(form ?? new FormData(), "note");
      if (quoteNote) {
        quotePayload.note = quoteNote;
      }
      return sellerSendServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, quotePayload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
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
  const requested = bookings.filter((booking) => booking.status === "REQUESTED").length;
  const upcoming = bookings.filter((booking) => ["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status)).length;
  const completion = bookings.filter((booking) => booking.status === "COMPLETION_SUBMITTED").length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="New requests" value={requested} note="Awaiting provider action" />
        <SellerMetric label="Upcoming jobs" value={upcoming} note="Accepted or scheduled" />
        <SellerMetric label="Completion review" value={completion} note="Awaiting customer/admin confirmation" />
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
    </div>
  );
}

function SellerServiceBookingDetail({ bookingNumber }: { bookingNumber?: string }) {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
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
      if (action === "start") {
        return sellerMarkServiceInProgress(sellerAuth.authHeaders, booking.bookingNumber);
      }
      if (action === "field") {
        const workingForm = form ?? new FormData();
        const latitude = optionalFormValue(workingForm, "latitude");
        const longitude = optionalFormValue(workingForm, "longitude");
        const note = optionalFormValue(workingForm, "note");
        const fieldProofFiles = workingForm.getAll("fieldProofFiles").filter((item): item is File => item instanceof File && item.size > 0);
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
        return sellerSubmitServiceCompletion(sellerAuth.authHeaders, booking.bookingNumber, {
          completionNote: formValue(form ?? new FormData(), "completionNote"),
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
      const quotePayload: { lineItems: Array<{ description: string; unitPaise: number }>; note?: string } = {
        lineItems: [{ description: formValue(form ?? new FormData(), "quoteDescription"), unitPaise: rupeesToPaise(formValue(form ?? new FormData(), "quoteAmount")) }],
      };
      const note = optionalFormValue(form ?? new FormData(), "note");
      if (note) quotePayload.note = note;
      return sellerSendServiceQuote(sellerAuth.authHeaders, booking.bookingNumber, quotePayload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-service-booking", sellerAuth.authKey, bookingNumber] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
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
          <Button asChild variant="outline" size="sm">
            <Link href="/seller/service-bookings">Back to bookings</Link>
          </Button>
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
  const reviewsQuery = useQuery({
    queryKey: ["seller-service-reviews", sellerAuth.authKey, status, rating, search],
    queryFn: () =>
      listSellerServiceReviews(sellerAuth.authHeaders, {
        limit: 50,
        ...(status !== "ALL" ? { status } : {}),
        ...(rating !== "ALL" ? { rating: Number(rating) } : {}),
        ...(search ? { search } : {}),
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
          <SellerField label="Search" name="search" value={search} onChange={setSearch} placeholder="Booking, service, review text" />
          <SellerSelect label="Status" name="status" value={status} onChange={setStatus}>
            <option value="ALL">All</option>
            <option value="VISIBLE">Visible</option>
            <option value="HIDDEN">Hidden</option>
            <option value="REPLIED">Replied</option>
            <option value="UNREPLIED">Unreplied</option>
          </SellerSelect>
          <SellerSelect label="Rating" name="rating" value={rating} onChange={setRating}>
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
            <form onSubmit={(event) => { event.preventDefault(); replyMutation.mutate({ review, form: new FormData(event.currentTarget) }); }} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <input name="body" defaultValue={review.reply?.body ?? ""} placeholder="Write a professional reply" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
              <Button type="submit" size="sm" disabled={replyMutation.isPending}>Save reply</Button>
            </form>
          </SellerPanel>
        ))}
        {!reviews.length && !reviewsQuery.isLoading ? <SellerEmptyState title="No service reviews" message="Customer service reviews will appear here after completed bookings." /> : null}
      </div>
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
}: {
  booking: ServiceBooking;
  technicians?: ServiceTechnician[];
  pending: boolean;
  onSubmit: (booking: ServiceBooking, action: string, form?: FormData) => void;
}) {
  const activeTechnicians = technicians ?? [];
  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#123A5A]">Provider actions</p>
      <div className="mt-3 grid gap-3">
        {booking.status === "REQUESTED" ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "accept", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="scheduledStartAt" type="datetime-local" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            {activeTechnicians.length ? (
              <select name="assignedTechnicianId" defaultValue={booking.assignedTechnicianId ?? ""} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                <option value="">Assign later</option>
                {activeTechnicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name}</option>
                ))}
              </select>
            ) : null}
            <input name="note" placeholder="Provider note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" size="sm" disabled={pending}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "reschedule", new FormData(event.currentTarget)); }} className="grid gap-2 border-t border-[#D9E2EA] pt-3">
            <input name="scheduledStartAt" type="datetime-local" required defaultValue={toLocalDateTimeInput(booking.scheduledStartAt)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            {activeTechnicians.length ? (
              <select name="assignedTechnicianId" defaultValue={booking.assignedTechnicianId ?? ""} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                <option value="">No technician assigned</option>
                {activeTechnicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name}</option>
                ))}
              </select>
            ) : null}
            <input name="note" placeholder="Reschedule note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Update schedule</Button>
          </form>
        ) : null}
        {["ACCEPTED", "IN_PROGRESS"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "quote", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="quoteDescription" placeholder="Quote line item" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="quoteAmount" type="number" min="0" step="0.01" placeholder="Quote amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}><Send className="h-4 w-4" /> Send quote</Button>
          </form>
        ) : null}
        {booking.quotes?.some((quote) => quote.status === "SENT") ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "withdrawQuote", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="note" placeholder="Withdraw quote note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Withdraw active quote</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onSubmit(booking, "start")} disabled={pending}>
            <Clock className="h-4 w-4" /> Mark in progress
          </Button>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED", "IN_PROGRESS"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "field", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md border border-[#D9E2EA] bg-white p-3">
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
        {["IN_PROGRESS", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "complete", new FormData(event.currentTarget)); }} className="grid gap-2">
            <textarea name="completionNote" required rows={3} placeholder="Completion note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
            <input name="completionProofFiles" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold" />
            <Button type="submit" size="sm" disabled={pending}>Submit completion</Button>
          </form>
        ) : null}
        {booking.paymentMode === "PAY_AT_VISIT" || booking.paidAmountPaise < booking.totalPayablePaise ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "payment", new FormData(event.currentTarget)); }} className="grid gap-2">
            <select name="purpose" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
              <option value="PAY_AT_VISIT">Pay at visit</option>
              <option value="FINAL_QUOTE">Final quote</option>
              <option value="FULL_PAYMENT">Full payment</option>
              <option value="ADVANCE_PAYMENT">Advance payment</option>
              <option value="INSPECTION_FEE">Inspection fee</option>
            </select>
            <input name="amount" type="number" min="0" step="0.01" placeholder="Amount received INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="referenceNumber" placeholder="Reference / cash note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <p className="rounded-md bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#667085]">
              Records cash collected by your service person. Customer/admin confirmation controls booking payment; only platform dues from this cash can be settled or offset.
            </p>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Record cash collected</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function SellerServiceCalendar() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [technicianDrafts, setTechnicianDrafts] = useState<ServiceTechnicianDraft[]>([]);
  const [blockedWindowDrafts, setBlockedWindowDrafts] = useState<ServiceBlockedWindowDraft[]>([]);
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
      setNotice("Service calendar saved.");
      void queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Calendar save failed."),
  });

  useEffect(() => {
    if (!calendarQuery.data) {
      return;
    }
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
  }, [calendarQuery.data]);

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

      <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(new FormData(event.currentTarget)); }} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <SellerPanel>
            <h2 className="text-lg font-black text-[#123A5A]">Weekly availability</h2>
            <p className="mt-1 text-sm leading-6 text-[#667085]">Set the real working window for each day. Capacity controls how many active service jobs can overlap inside that day window.</p>
            <div className="mt-4 grid gap-3">
              {weekDays.map((day) => {
                const rule = rules.find((item) => item.dayOfWeek === day.value) ?? defaultRuleForDay(day.value);
                return (
                  <div key={day.value} className="grid gap-3 rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3 md:grid-cols-[130px_1fr_1fr_100px] md:items-center">
                    <label className="flex items-center gap-2 text-sm font-black text-[#123A5A]">
                      <input name={`rule:${day.value}:active`} type="checkbox" defaultChecked={rule.isActive !== false} />
                      {day.label}
                    </label>
                    <input name={`rule:${day.value}:start`} type="time" defaultValue={minuteToTime(rule.startMinute)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    <input name={`rule:${day.value}:end`} type="time" defaultValue={minuteToTime(rule.endMinute)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    <input name={`rule:${day.value}:capacity`} type="number" min={1} max={50} defaultValue={rule.capacity ?? 1} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
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
                  <input
                    value={technician.name}
                    onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { name: event.target.value })}
                    placeholder="Technician name"
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
                  <input
                    value={technician.phone}
                    onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { phone: event.target.value })}
                    placeholder="Phone"
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
                  <input
                    value={technician.email}
                    onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { email: event.target.value })}
                    placeholder="Email"
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
                  <input
                    value={technician.skills}
                    onChange={(event) => updateTechnicianDraft(setTechnicianDrafts, technician.rowId, { skills: event.target.value })}
                    placeholder="Skills, comma separated"
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
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
                  <input
                    type="datetime-local"
                    value={window.startsAt}
                    onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { startsAt: event.target.value })}
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
                  <input
                    type="datetime-local"
                    value={window.endsAt}
                    onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { endsAt: event.target.value })}
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
                  <input
                    value={window.reason}
                    onChange={(event) => updateBlockedWindowDraft(setBlockedWindowDrafts, window.rowId, { reason: event.target.value })}
                    placeholder="Reason"
                    className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  />
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
            {notice ? <p className="mt-3 rounded-md bg-[#FFF0EC] p-3 text-sm font-bold text-[#9F2600]">{notice}</p> : null}
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
