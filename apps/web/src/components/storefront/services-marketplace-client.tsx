"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, Clock, MapPin, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { listCustomerAddresses } from "@/lib/account-api";
import {
  createCustomerServiceBooking,
  getPublicService,
  listPublicServices,
  type ServiceBookingPayload,
  type ServiceListing,
  type ServiceVisitMode,
} from "@/lib/service-marketplace-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  buildCustomerServiceBookingPayload,
  hasManualServiceLocationInput,
  isManualServiceLocationReadyForQuery,
  serviceLocationQueryFromAddress,
  serviceLocationQueryFromManualAddress,
  type ManualServiceAddressInput,
} from "./service-booking-payload";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontEmptyState, StorefrontErrorPanel, StorefrontNotice, StorefrontSkeleton } from "./storefront-ui";

type ServicesMarketplaceClientProps = {
  mode?: "list" | "detail";
  slug?: string;
};

export function ServicesMarketplaceClient({ mode = "list", slug }: ServicesMarketplaceClientProps) {
  if (mode === "detail" && slug) {
    return <ServiceDetail slug={slug} />;
  }

  return <ServicesDirectory />;
}

function ServicesDirectory() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const servicesQuery = useQuery({
    queryKey: ["public-services", submittedSearch],
    queryFn: () => listPublicServices({ search: submittedSearch, limit: 36 }),
  });

  const services = servicesQuery.data?.items ?? [];

  return (
    <StorefrontFrame>
      <main className="min-h-screen bg-[#FFFCFB]">
        <section className="border-b border-[#F0E4DE] bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6 lg:py-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FFD7CB] bg-[#FFF0EC] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#B72A00]">
                <Wrench className="h-4 w-4" aria-hidden="true" />
                Services
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-normal text-[#123A5A] md:text-5xl">
                Book trusted local and remote services
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085] md:text-base">
                Find approved service providers for repair, installation, maintenance, consultation, and quote-first work.
              </p>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <p className="text-sm font-black text-[#123A5A]">How service booking works</p>
              <div className="mt-3 grid gap-3 text-sm font-semibold text-[#667085]">
                <span className="flex gap-2"><Search className="mt-0.5 h-4 w-4 text-[#ED3500]" /> Choose a service and check location availability.</span>
                <span className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-[#ED3500]" /> Request a visit, quote, inspection, or pay-at-visit booking.</span>
                <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ED3500]" /> Confirm completion before payout becomes eligible.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(search.trim());
            }}
            className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm sm:flex-row"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search TV repair, phone repair, AC service, consultation..."
              className="h-11 min-w-0 flex-1 rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            />
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>

          {servicesQuery.isLoading ? <StorefrontSkeleton className="mt-6 h-80" /> : null}
          {servicesQuery.error ? <StorefrontErrorPanel error={servicesQuery.error} onRetry={() => void servicesQuery.refetch()} retryLabel="Retry services" /> : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <ServiceCard key={service.id} service={service} priority={index === 0} />
            ))}
          </div>

          {!servicesQuery.isLoading && !services.length ? (
            <StorefrontEmptyState title="No services found" message="Try a different service name or browse again later as more approved providers come online." />
          ) : null}
        </section>
      </main>
    </StorefrontFrame>
  );
}

export function ServiceCard({ service, priority = false }: { service: ServiceListing; priority?: boolean }) {
  return (
    <Link href={`/services/${service.slug}`} className="group overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(22,59,92,0.12)]">
      <span className="relative block aspect-[4/3] bg-[#F8FAFC]">
        <StorefrontImage src={primaryServiceImage(service)} alt={service.title} priority={priority} sizes="(min-width: 1024px) 33vw, 100vw" fallbackLabel={service.title} />
      </span>
      <span className="block p-4">
        <span className="flex flex-wrap gap-2">
          <StatusBadge tone="info">{service.pricingModel.replace(/_/g, " ")}</StatusBadge>
          {service.serviceability?.serviceable ? <StatusBadge tone="success">Serviceable</StatusBadge> : null}
        </span>
        <span className="mt-3 block text-lg font-black leading-6 text-[#123A5A] group-hover:text-[#ED3500]">{service.title}</span>
        <span className="mt-1 line-clamp-2 block text-sm leading-6 text-[#667085]">{service.description}</span>
        <span className="mt-3 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-black text-[#1F2933]">{servicePriceLabel(service)}</span>
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-[#667085]">
              <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
              {ratingLabel(service)}
            </span>
          </span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
            <Wrench className="h-5 w-5" />
          </span>
        </span>
      </span>
    </Link>
  );
}

function ServiceDetail({ slug }: { slug: string }) {
  const customerAuth = useCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedVisitMode, setSelectedVisitMode] = useState<ServiceVisitMode>("CUSTOMER_LOCATION");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [manualAddress, setManualAddress] = useState<ManualServiceAddressInput>({
    city: "",
    state: "",
    pincode: "",
    countryCode: "IN",
  });
  const addressesQuery = useQuery({
    queryKey: ["account-addresses", customerAuth.authKey, "service-booking"],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const addresses = addressesQuery.data ?? [];
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;
  const selectedAddressLocationQuery = useMemo(() => serviceLocationQueryFromAddress(selectedAddress), [selectedAddress]);
  const manualLocationQuery = useMemo(
    () => serviceLocationQueryFromManualAddress(manualAddress),
    [manualAddress.countryCode, manualAddress.pincode],
  );
  const debouncedManualLocationQuery = useDebouncedValue(manualLocationQuery, 450);
  const selectedLocationQuery =
    selectedVisitMode === "CUSTOMER_LOCATION"
      ? selectedAddress
        ? selectedAddressLocationQuery
        : debouncedManualLocationQuery
      : {};
  const hasSelectedLocationForServiceability = Object.keys(selectedLocationQuery).length > 0;
  const manualLocationHasInput = hasManualServiceLocationInput(manualAddress);
  const manualLocationReadyForCheck = isManualServiceLocationReadyForQuery(manualAddress);
  const serviceQuery = useQuery({
    queryKey: ["public-service", slug, selectedLocationQuery],
    queryFn: () => getPublicService(slug, selectedLocationQuery),
    placeholderData: (previousData) => previousData,
  });

  const bookingMutation = useMutation({
    mutationFn: (payload: ServiceBookingPayload) => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before booking a service.");
      }
      return createCustomerServiceBooking(customerAuth.authHeaders, payload);
    },
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ["customer-service-bookings", customerAuth.authKey] });
      router.push(`/account/service-bookings/${encodeURIComponent(booking.bookingNumber)}`);
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to book this service right now."),
  });

  const service = serviceQuery.data;
  const activeVisitMode = resolveVisitMode(service, selectedVisitMode);
  const needsCustomerAddress = activeVisitMode === "CUSTOMER_LOCATION";
  const selectedServiceAddress = needsCustomerAddress ? selectedAddress : null;
  const showManualAddress = needsCustomerAddress && !selectedServiceAddress;
  const currentLocationReadyForServiceability = needsCustomerAddress && (Boolean(selectedServiceAddress) || manualLocationReadyForCheck);
  const isCheckingServiceability =
    needsCustomerAddress &&
    currentLocationReadyForServiceability &&
    serviceQuery.isFetching &&
    !serviceQuery.isLoading;

  useEffect(() => {
    if (!service?.allowedVisitModes.length) {
      return;
    }
    if (!service.allowedVisitModes.includes(selectedVisitMode)) {
      setSelectedVisitMode(resolveVisitMode(service, selectedVisitMode));
    }
  }, [selectedVisitMode, service?.allowedVisitModes]);

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const visitMode = resolveVisitMode(service, selectedVisitMode);
    const scheduledStartAt = optionalFormValue(form, "scheduledStartAt");
    const customerNote = optionalFormValue(form, "customerNote");
    const payload = buildCustomerServiceBookingPayload({
      serviceSlug: slug,
      visitMode,
      customerIssue: formValue(form, "customerIssue"),
      selectedPackageId,
      selectedAddress: selectedServiceAddress,
      manualAddress,
      ...(scheduledStartAt ? { scheduledStartAt } : {}),
      ...(customerNote ? { customerNote } : {}),
    });
    setNotice(null);
    bookingMutation.mutate(payload);
  }

  return (
    <StorefrontFrame>
      <main className="min-h-screen bg-[#FFFCFB]">
        <section className="mx-auto max-w-7xl px-5 py-6 lg:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/services">
              <ArrowLeft className="h-4 w-4" />
              Back to services
            </Link>
          </Button>
        </section>

        {serviceQuery.isLoading && !service ? (
          <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
            <StorefrontSkeleton className="h-[520px]" />
          </section>
        ) : null}

        {serviceQuery.error ? (
          <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
            <StorefrontErrorPanel error={serviceQuery.error} onRetry={() => void serviceQuery.refetch()} retryLabel="Retry service" />
          </section>
        ) : null}

        {service ? (
          <>
            <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-6">
              <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
                <div className="relative aspect-[16/9] bg-[#F8FAFC]">
                  <StorefrontImage src={primaryServiceImage(service)} alt={service.title} priority sizes="(min-width: 1024px) 65vw, 100vw" fallbackLabel={service.title} />
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="info">{service.pricingModel.replace(/_/g, " ")}</StatusBadge>
                    <StatusBadge tone="neutral">{service.paymentMode.replace(/_/g, " ")}</StatusBadge>
                    <StatusBadge tone="success">{service.cancellationPolicy.toLowerCase()} cancellation</StatusBadge>
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-normal text-[#123A5A] md:text-4xl">{service.title}</h1>
                  <p className="mt-3 text-base leading-7 text-[#667085]">{service.description}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniStat icon={Wrench} label="Price" value={servicePriceLabel(service)} />
                    <MiniStat icon={Clock} label="Duration" value={service.serviceDurationMinutes ? `${service.serviceDurationMinutes} mins` : "Provider confirms"} />
                    <MiniStat icon={Star} label="Rating" value={ratingLabel(service)} />
                  </div>
                </div>
              </div>

              <aside className="self-start rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm lg:sticky lg:top-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
                    <BadgeCheck className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#123A5A]">{service.seller.storeName}</p>
                    <p className="text-xs font-bold text-[#667085]">Approved service provider</p>
                  </div>
                </div>

                <form onSubmit={submitBooking} className="mt-5 grid gap-4">
                  {!customerAuth.enabled ? <CustomerAuthNotice /> : null}
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Visit mode</span>
                    <select value={activeVisitMode} onChange={(event) => setSelectedVisitMode(event.target.value as ServiceVisitMode)} className="h-11 w-full rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold">
                      {service.allowedVisitModes.map((mode) => (
                        <option key={mode} value={mode}>{mode.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </label>
                  {service.packages.length ? (
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Package</span>
                      <select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)} className="h-11 w-full rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold">
                        <option value="">Provider recommended</option>
                        {service.packages.filter((item) => item.isActive !== false).map((item) => (
                          <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.pricePaise, item.currency ?? service.currency)}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {needsCustomerAddress ? (
                    <>
                      <label className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Saved address</span>
                        <select value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)} className="h-11 w-full rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold">
                          <option value="">Use manual location below</option>
                          {addresses.map((address) => (
                            <option key={address.id} value={address.id}>{address.label ?? address.line1} · {address.city} {address.pincode}</option>
                          ))}
                        </select>
                      </label>
                      {showManualAddress ? <ManualAddressFields value={manualAddress} onChange={(patch) => setManualAddress((current) => ({ ...current, ...patch }))} /> : null}
                    </>
                  ) : (
                    <StorefrontNotice>
                      {activeVisitMode === "REMOTE"
                        ? "This is a remote service. No service address will be sent with the booking."
                        : "You will visit the provider location. The provider will share the address after confirming the booking."}
                    </StorefrontNotice>
                  )}
                  {needsCustomerAddress && isCheckingServiceability ? (
                    <StorefrontNotice>Checking service availability for this pincode...</StorefrontNotice>
                  ) : null}
                  {needsCustomerAddress && currentLocationReadyForServiceability && service.serviceability?.serviceable ? (
                    <StorefrontNotice tone="success">This service is available at the selected location.</StorefrontNotice>
                  ) : null}
                  {needsCustomerAddress && currentLocationReadyForServiceability && service.serviceability && !service.serviceability.serviceable && !isCheckingServiceability ? (
                    <StorefrontNotice tone="warning">{service.serviceability.reason ?? unavailableText}</StorefrontNotice>
                  ) : null}
                  {needsCustomerAddress && showManualAddress && manualLocationHasInput && !manualLocationReadyForCheck ? (
                    <StorefrontNotice>Enter the full 6-digit pincode to check service availability.</StorefrontNotice>
                  ) : null}
                  {needsCustomerAddress && !currentLocationReadyForServiceability && (!showManualAddress || !manualLocationHasInput) ? (
                    <StorefrontNotice tone="warning">Select your service location to check availability.</StorefrontNotice>
                  ) : null}
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Preferred date and time</span>
                    <input name="scheduledStartAt" type="datetime-local" className="h-11 w-full rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Issue details</span>
                    <textarea name="customerIssue" required minLength={10} rows={4} className="w-full rounded-md border border-[#E5E7EB] px-3 py-3 text-sm font-semibold" placeholder="Describe the product/service issue, model, urgency, and access details." />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Note</span>
                    <input name="customerNote" className="h-11 w-full rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold" placeholder="Call before visit, preferred language, etc." />
                  </label>
                  <Button type="submit" disabled={!customerAuth.enabled || bookingMutation.isPending}>
                    {bookingMutation.isPending ? "Booking..." : service.pricingModel === "QUOTE_FIRST" ? "Request quote" : "Book service"}
                  </Button>
                  {notice ? <StorefrontNotice tone={notice.includes("created") ? "success" : "warning"}>{notice}</StorefrontNotice> : null}
                </form>
              </aside>
            </section>

            <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-12 lg:grid-cols-2 lg:px-6">
              <InfoPanel title="What is included" items={service.inclusions ?? service.highlights ?? []} fallback="Provider will confirm exact inclusions before work begins." />
              <InfoPanel title="Customer requirements" items={service.requirements ?? []} fallback="Share accurate issue details and keep the service location accessible." />
            </section>

            <section className="mx-auto max-w-7xl px-5 pb-14 lg:px-6">
              <SectionHeading title="Reviews" description="Customer reviews unlock after completed service bookings." />
              <div className="mt-4 grid gap-3">
                {(service.reviews ?? []).map((review) => (
                  <div key={review.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <p className="font-black text-[#123A5A]">{review.rating}/5 stars</p>
                    {review.body ? <p className="mt-2 text-sm leading-6 text-[#667085]">{review.body}</p> : null}
                    {review.reply ? <p className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-sm font-semibold text-[#1F2933]">Provider reply: {review.reply.body}</p> : null}
                  </div>
                ))}
                {!service.reviews?.length ? <StorefrontEmptyState title="No reviews yet" message="Reviews will appear here after completed service bookings." /> : null}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </StorefrontFrame>
  );
}

function ManualAddressFields({
  value,
  onChange,
}: {
  value: ManualServiceAddressInput;
  onChange: (patch: Partial<ManualServiceAddressInput>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="flex items-center gap-2 text-sm font-black text-[#123A5A]"><MapPin className="h-4 w-4" /> Service location</p>
      <input value={value.city ?? ""} onChange={(event) => onChange({ city: event.target.value })} className="h-10 rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold" placeholder="City" />
      <input value={value.state ?? ""} onChange={(event) => onChange({ state: event.target.value })} className="h-10 rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold" placeholder="State" />
      <input
        value={value.pincode ?? ""}
        onChange={(event) => onChange({ pincode: cleanManualPincodeInput(event.target.value, value.countryCode) })}
        className="h-10 rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold"
        placeholder="Pincode"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
      />
      <input
        value={value.countryCode ?? "IN"}
        onChange={(event) => onChange({ countryCode: event.target.value.trim().toUpperCase() })}
        className="h-10 rounded-md border border-[#E5E7EB] px-3 text-sm font-semibold"
        placeholder="Country code"
      />
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function cleanManualPincodeInput(value: string, countryCode?: string | null) {
  if ((countryCode?.trim().toUpperCase() || "IN") === "IN") {
    return value.replace(/\D/g, "").slice(0, 6);
  }
  return value.trim().toUpperCase().slice(0, 12);
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Wrench; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <Icon className="h-5 w-5 text-[#ED3500]" />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#123A5A]">{value}</p>
    </div>
  );
}

function InfoPanel({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-[#123A5A]">{title}</h2>
      {items.length ? (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm font-semibold text-[#667085]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F8A5F]" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#667085]">{fallback}</p>
      )}
    </div>
  );
}

const unavailableText = "This service is not available for the selected location. Please choose another saved address or contact support for nearby provider options.";

function primaryServiceImage(service: ServiceListing) {
  return service.images?.find((image) => image.isPrimary)?.url ?? service.images?.[0]?.url ?? service.seller.profile?.logoUrl ?? "";
}

function servicePriceLabel(service: ServiceListing) {
  if (service.pricingModel === "QUOTE_FIRST") return "Quote after review";
  if (service.pricingModel === "INSPECTION_FEE") return `Inspection ${formatMoney(service.inspectionFeePaise ?? 0, service.currency)}`;
  return `Starts at ${formatMoney(service.basePricePaise ?? service.packages?.[0]?.pricePaise ?? 0, service.currency)}`;
}

function ratingLabel(service: ServiceListing) {
  const rating = Number(service.serviceRating ?? service.seller.serviceRating ?? 0);
  const count = service.serviceReviewCount ?? service.seller.serviceReviewCount ?? 0;
  return count ? `${rating.toFixed(1)} (${count})` : "New provider";
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? value : undefined;
}

function resolveVisitMode(service: ServiceListing | undefined, selectedVisitMode: ServiceVisitMode): ServiceVisitMode {
  if (!service?.allowedVisitModes.length) {
    return selectedVisitMode;
  }
  if (service.allowedVisitModes.includes(selectedVisitMode)) {
    return selectedVisitMode;
  }
  return service.allowedVisitModes[0] ?? "CUSTOMER_LOCATION";
}
