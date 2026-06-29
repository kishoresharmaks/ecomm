"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Eye, Plus, Search, Send, Trash2, Wrench } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { IndihubApiError } from "@/lib/api";
import {
  archiveSellerService,
  createSellerService,
  listSellerServiceBookings,
  listSellerServices,
  recordSellerServicePayment,
  sellerAcceptServiceBooking,
  sellerMarkServiceInProgress,
  sellerRejectServiceBooking,
  sellerSendServiceQuote,
  sellerSubmitServiceCompletion,
  type ServiceArea,
  type ServiceBooking,
  type ServiceListing,
  type ServiceListingPayload,
  type ServiceCancellationPolicy,
  type ServicePaymentPurpose,
  type ServicePricingModel,
  type ServiceVisitMode,
} from "@/lib/service-marketplace-api";
import { listCategories, formatMoney } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
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
  mode?: "list" | "form" | "bookings" | "calendar";
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

export function SellerServicesClient({ mode = "list" }: SellerServicesClientProps) {
  const sellerAuth = useSellerAuth();

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (mode === "form") {
    return <SellerServiceForm />;
  }

  if (mode === "bookings") {
    return <SellerServiceBookings />;
  }

  if (mode === "calendar") {
    return <SellerServiceCalendar />;
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

function SellerServiceForm() {
  const router = useRouter();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState<ServicePricingModel>("FIXED_PRICE");

  const categoriesQuery = useQuery({
    queryKey: ["seller-service-categories"],
    queryFn: listCategories,
    enabled: sellerAuth.enabled,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ServiceListingPayload) => createSellerService(sellerAuth.authHeaders, payload),
    onSuccess: () => {
      setNotice("Service submitted for admin approval.");
      router.push("/seller/services");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Service save failed."),
  });

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

    const stateCode = optionalFormValue(form, "stateCode");
    const cityCode = optionalFormValue(form, "cityCode");
    const localAreaCode = optionalFormValue(form, "localAreaCode");
    const pincode = optionalFormValue(form, "pincode");
    const latitude = numberOrUndefined(formValue(form, "latitude"));
    const longitude = numberOrUndefined(formValue(form, "longitude"));
    const area: ServiceArea = {
      label: optionalFormValue(form, "areaLabel") ?? "Primary service area",
      countryCode: optionalFormValue(form, "countryCode") ?? "IN",
      radiusKm: numberOrUndefined(formValue(form, "radiusKm")) ?? 10,
      isActive: true,
    };
    if (stateCode) area.stateCode = stateCode;
    if (cityCode) area.cityCode = cityCode;
    if (localAreaCode) area.localAreaCode = localAreaCode;
    if (pincode) area.pincode = pincode;
    if (latitude !== undefined) area.latitude = latitude;
    if (longitude !== undefined) area.longitude = longitude;

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
      packages: packageFromForm(form),
      areas: [area],
    };

    saveMutation.mutate(payload);
  }

  const categories = flattenCategories(categoriesQuery.data ?? []);

  if (categoriesQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (categoriesQuery.error) {
    return <SellerErrorPanel error={categoriesQuery.error as Error} onRetry={() => void categoriesQuery.refetch()} />;
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
              <p className="mt-1 text-sm leading-6 text-[#667085]">Add a precise title, category, pricing model, and operating terms.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SellerField label="Service title" name="title" required placeholder="LED TV repair and installation" />
            <SellerSelect label="Category" name="categoryId" required>
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
            <SellerSelect label="Payment mode" name="paymentMode" required>
              <option value="FULL_PAYMENT">Full payment</option>
              <option value="ADVANCE_PAYMENT">Advance payment</option>
              <option value="INSPECTION_FEE">Inspection fee</option>
              <option value="PAY_AT_VISIT">Pay at visit</option>
            </SellerSelect>
            <SellerField label="Base price (INR)" name="basePrice" type="number" min={0} step="0.01" placeholder="999" />
            <SellerField label="Inspection fee (INR)" name="inspectionFee" type="number" min={0} step="0.01" placeholder="299" />
            <SellerField label="Advance amount (INR)" name="advanceAmount" type="number" min={0} step="0.01" placeholder="500" />
            <SellerField label="Duration minutes" name="serviceDurationMinutes" type="number" min={1} defaultValue={60} />
            <SellerField label="Quote TTL hours" name="quoteTtlHours" type="number" min={1} defaultValue={48} />
            <SellerSelect label="Cancellation policy" name="cancellationPolicy" defaultValue="FLEXIBLE" required>
              <option value="FLEXIBLE">Flexible</option>
              <option value="MODERATE">Moderate</option>
              <option value="STRICT">Strict</option>
            </SellerSelect>
            <div className="md:col-span-2">
              <SellerTextArea label="Description" name="description" required rows={5} placeholder="Explain what is covered, response time, inspection policy, parts, and customer prerequisites." />
            </div>
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
                    <input name={`visitMode:${mode.value}`} type="checkbox" defaultChecked={index === 0} />
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>
            <SellerField label="Area label" name="areaLabel" placeholder="Salem doorstep radius" />
            <SellerField label="Country code" name="countryCode" defaultValue="IN" />
            <SellerField label="State code" name="stateCode" placeholder="IN-TN" />
            <SellerField label="City code" name="cityCode" placeholder="IN-TN-SALEM" />
            <SellerField label="Local area code" name="localAreaCode" placeholder="Existing local area code" />
            <SellerField label="Pincode" name="pincode" placeholder="636001" />
            <SellerField label="Latitude" name="latitude" type="number" step="0.000001" placeholder="11.6643" />
            <SellerField label="Longitude" name="longitude" type="number" step="0.000001" placeholder="78.1460" />
            <SellerField label="Radius km" name="radiusKm" type="number" min={1} defaultValue={10} />
          </div>
        </SellerPanel>

        <SellerPanel>
          <h2 className="text-xl font-black text-[#123A5A]">Customer-facing content</h2>
          <div className="mt-4 grid gap-4">
            <SellerTextArea label="Highlights" name="highlights" rows={3} placeholder={"Doorstep diagnosis\nSame-day visit when available\nGenuine parts support"} />
            <SellerTextArea label="Inclusions" name="inclusions" rows={3} placeholder={"Diagnosis\nBasic troubleshooting\nRepair estimate"} />
            <SellerTextArea label="Requirements" name="requirements" rows={3} placeholder={"Customer must provide product model\nPower socket must be available"} />
          </div>
        </SellerPanel>
      </div>

      <aside className="self-start xl:sticky xl:top-8">
        <SellerPanel>
          <h2 className="text-lg font-black text-[#123A5A]">Approval summary</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">Services are submitted inactive and become visible after admin approval.</p>
          <Button type="submit" className="mt-4 w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Submitting..." : "Submit service"}
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

  const actionMutation = useMutation({
    mutationFn: async ({ booking, action, form }: { booking: ServiceBooking; action: string; form?: FormData }) => {
      if (action === "accept") {
        const payload: { note?: string; scheduledStartAt?: string } = {};
        const note = form ? optionalFormValue(form, "note") : undefined;
        const scheduledStartAt = form ? optionalFormValue(form, "scheduledStartAt") : undefined;
        if (note) payload.note = note;
        if (scheduledStartAt) payload.scheduledStartAt = scheduledStartAt;
        return sellerAcceptServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, {
          ...payload,
        });
      }
      if (action === "reject") {
        return sellerRejectServiceBooking(sellerAuth.authHeaders, booking.bookingNumber, formValue(form ?? new FormData(), "reason") || "Rejected by provider.");
      }
      if (action === "start") {
        return sellerMarkServiceInProgress(sellerAuth.authHeaders, booking.bookingNumber);
      }
      if (action === "complete") {
        return sellerSubmitServiceCompletion(sellerAuth.authHeaders, booking.bookingNumber, {
          completionNote: formValue(form ?? new FormData(), "completionNote"),
        });
      }
      if (action === "payment") {
        const paymentPayload: {
          provider: "MANUAL";
          purpose: ServicePaymentPurpose;
          amountPaise: number;
          referenceNumber?: string;
          markPaid: true;
        } = {
          provider: "MANUAL",
          purpose: formValue(form ?? new FormData(), "purpose") as ServicePaymentPurpose,
          amountPaise: rupeesToPaise(formValue(form ?? new FormData(), "amount")),
          markPaid: true,
        };
        const referenceNumber = optionalFormValue(form ?? new FormData(), "referenceNumber");
        if (referenceNumber) {
          paymentPayload.referenceNumber = referenceNumber;
        }
        return recordSellerServicePayment(sellerAuth.authHeaders, booking.bookingNumber, {
          ...paymentPayload,
        });
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", sellerAuth.authKey] }),
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
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <Info label="Payable" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
                  <Info label="Paid" value={formatMoney(booking.paidAmountPaise, booking.currency)} />
                  <Info label="Scheduled" value={formatDateTime(booking.scheduledStartAt)} />
                </div>
              </div>
      <BookingActionPanel booking={booking} pending={actionMutation.isPending} onSubmit={(booking, action, form) => {
        const variables: { booking: ServiceBooking; action: string; form?: FormData } = { booking, action };
        if (form) variables.form = form;
        actionMutation.mutate(variables);
      }} />
            </div>
          </SellerPanel>
        ))}
      </div>
      {!bookings.length ? <SellerEmptyState title="No service bookings" message="Customer requests, quotes, scheduled jobs, and completions will appear here." /> : null}
    </div>
  );
}

function BookingActionPanel({
  booking,
  pending,
  onSubmit,
}: {
  booking: ServiceBooking;
  pending: boolean;
  onSubmit: (booking: ServiceBooking, action: string, form?: FormData) => void;
}) {
  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#123A5A]">Provider actions</p>
      <div className="mt-3 grid gap-3">
        {booking.status === "REQUESTED" ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "accept", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="scheduledStartAt" type="datetime-local" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="note" placeholder="Provider note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" size="sm" disabled={pending}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
          </form>
        ) : null}
        {["ACCEPTED", "IN_PROGRESS"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "quote", new FormData(event.currentTarget)); }} className="grid gap-2">
            <input name="quoteDescription" placeholder="Quote line item" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <input name="quoteAmount" type="number" min="0" step="0.01" placeholder="Quote amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={pending}><Send className="h-4 w-4" /> Send quote</Button>
          </form>
        ) : null}
        {["ACCEPTED", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onSubmit(booking, "start")} disabled={pending}>
            <Clock className="h-4 w-4" /> Mark in progress
          </Button>
        ) : null}
        {["IN_PROGRESS", "SCHEDULED", "QUOTE_ACCEPTED"].includes(booking.status) ? (
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(booking, "complete", new FormData(event.currentTarget)); }} className="grid gap-2">
            <textarea name="completionNote" required rows={3} placeholder="Completion note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
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
            <Button type="submit" variant="outline" size="sm" disabled={pending}>Record payment</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function SellerServiceCalendar() {
  const sellerAuth = useSellerAuth();
  const bookingsQuery = useQuery({
    queryKey: ["seller-service-bookings-calendar", sellerAuth.authKey],
    queryFn: () => listSellerServiceBookings(sellerAuth.authHeaders, { limit: 100 }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const scheduled = useMemo(
    () => (bookingsQuery.data?.items ?? []).filter((booking) => booking.scheduledStartAt).sort((a, b) => String(a.scheduledStartAt).localeCompare(String(b.scheduledStartAt))),
    [bookingsQuery.data?.items],
  );

  if (bookingsQuery.isLoading) return <SellerSkeleton />;
  if (bookingsQuery.error) return <SellerErrorPanel error={bookingsQuery.error as Error} onRetry={() => void bookingsQuery.refetch()} />;

  return (
    <div className="grid gap-4">
      {scheduled.map((booking) => (
        <SellerPanel key={booking.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#123A5A]"><CalendarDays className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-black text-[#123A5A]">{formatDateTime(booking.scheduledStartAt)}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{booking.bookingNumber} · {booking.listing.title}</p>
              </div>
            </div>
            <SellerStatusPill status={booking.status} />
          </div>
        </SellerPanel>
      ))}
      {!scheduled.length ? <SellerEmptyState title="No scheduled jobs" message="Accepted service bookings with visit dates will appear on this calendar view." /> : null}
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

function primaryServiceImage(service: ServiceListing) {
  return service.images?.find((image) => image.isPrimary)?.url ?? service.images?.[0]?.url ?? "";
}

function servicePriceLabel(service: ServiceListing) {
  if (service.pricingModel === "QUOTE_FIRST") return "Quote after provider review";
  if (service.pricingModel === "INSPECTION_FEE") return `Inspection from ${formatMoney(service.inspectionFeePaise ?? 0, service.currency)}`;
  return `Starts at ${formatMoney(service.basePricePaise ?? service.packages?.[0]?.pricePaise ?? 0, service.currency)}`;
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function packageFromForm(form: FormData) {
  const name = optionalFormValue(form, "packageName");
  const pricePaise = rupeesToPaise(formValue(form, "basePrice"));
  if (!name || pricePaise <= 0) return [];
  return [{ name, pricePaise, sortOrder: 0, isActive: true }];
}

function flattenCategories(categories: Awaited<ReturnType<typeof listCategories>> = [], prefix = ""): Array<{ id: string; label: string }> {
  return categories.flatMap((category) => {
    const label = prefix ? `${prefix} / ${category.name}` : category.name;
    return [{ id: category.id, label }, ...flattenCategories(category.children ?? [], label)];
  });
}
