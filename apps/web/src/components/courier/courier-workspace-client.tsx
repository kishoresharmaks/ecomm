"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
  Settings,
  Truck,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  assignCourierLocalDelivery,
  bookCourierPackage,
  fetchCourierPackageLabel,
  getCourierDashboard,
  getCourierDeliveryPartner,
  getCourierPackage,
  listCourierDeliveryPartners,
  listCourierCodRemittances,
  listCourierLocalDelivery,
  listCourierPackages,
  listCourierProviders,
  listCourierRoutingFailures,
  overrideCourierRoutingFailure,
  recordCourierCodRemittance,
  saveCourierProvider,
  updateCourierDeliveryPartnerAvailability,
  updateCourierDeliveryPartnerProfile,
  updateCourierPackageTracking,
  updateCourierProviderActive,
  type CourierCodRemittance,
  type CourierDashboard,
  type CourierDeliveryPartnerPayload,
  type CourierDeliveryPartnerRecord,
  type CourierPackageRecord,
  type CourierProviderPayload,
  type CourierProviderMode,
  type CourierProviderRecord,
  type CourierShipmentRecord,
  type CourierTrackingStatus,
  type DeliveryMode,
  type DeliveryPartnerOption,
} from "@/lib/courier-api";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const trackingStatuses: CourierTrackingStatus[] = [
  "NOT_BOOKED",
  "BOOKING_PENDING",
  "BOOKED",
  "PICKUP_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RTO_INITIATED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED",
  "CANCELLED",
  "FAILED",
];

const deliveryModes: DeliveryMode[] = ["LOCAL_DELIVERY_PARTNER", "THIRD_PARTY_COURIER", "STORE_PICKUP", "MANUAL_TRANSPORT"];

export function CourierDashboardClient() {
  const auth = useAdminAuth();
  const dashboardQuery = useQuery({
    queryKey: ["courier-dashboard", auth.authHeaders],
    queryFn: () => getCourierDashboard(auth.authHeaders),
    enabled: auth.isAuthenticated,
  });
  const packagesQuery = useQuery({
    queryKey: ["courier-dashboard-packages", auth.authHeaders],
    queryFn: () => listCourierPackages(auth.authHeaders, { limit: 8 }),
    enabled: auth.isAuthenticated,
  });
  const failuresQuery = useQuery({
    queryKey: ["courier-dashboard-routing-failures", auth.authHeaders],
    queryFn: () => listCourierRoutingFailures(auth.authHeaders, { limit: 6 }),
    enabled: auth.isAuthenticated,
  });

  if (dashboardQuery.isLoading) {
    return <CourierState message="Loading courier dashboard" />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <CourierState
        message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Unable to load courier dashboard."}
        action={<Button onClick={() => dashboardQuery.refetch()}>Retry</Button>}
        error
      />
    );
  }

  return (
    <div className="space-y-5">
      <CourierMetricGrid dashboard={dashboardQuery.data} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <CourierPackagePanel title="Recent package operations" packages={packagesQuery.data?.items ?? []} loading={packagesQuery.isLoading} />
        <RoutingFailurePanel failures={failuresQuery.data?.items ?? []} loading={failuresQuery.isLoading} />
      </div>
    </div>
  );
}

export function CourierPackagesClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("");
  const [packageStatus, setPackageStatus] = useState("");
  const [trackingStatus, setTrackingStatus] = useState("");
  const [providerCode, setProviderCode] = useState("");
  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(deliveryMode ? { deliveryMode } : {}),
      ...(packageStatus ? { packageStatus } : {}),
      ...(trackingStatus ? { trackingStatus } : {}),
      ...(providerCode.trim() ? { providerCode: providerCode.trim().toUpperCase() } : {}),
      limit: 60,
    }),
    [deliveryMode, packageStatus, providerCode, search, trackingStatus],
  );

  const packagesQuery = useQuery({
    queryKey: ["courier-packages", auth.authHeaders, query],
    queryFn: () => listCourierPackages(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });

  return (
    <div className="space-y-4">
      <CourierPackageFilters
        search={search}
        deliveryMode={deliveryMode}
        packageStatus={packageStatus}
        trackingStatus={trackingStatus}
        providerCode={providerCode}
        onSearchChange={setSearch}
        onDeliveryModeChange={setDeliveryMode}
        onPackageStatusChange={setPackageStatus}
        onTrackingStatusChange={setTrackingStatus}
        onProviderCodeChange={setProviderCode}
        onRefresh={() => packagesQuery.refetch()}
      />
      {packagesQuery.isLoading ? <CourierState message="Loading package operations" /> : null}
      {packagesQuery.isError ? (
        <CourierState
          message={packagesQuery.error instanceof Error ? packagesQuery.error.message : "Unable to load courier packages."}
          error
        />
      ) : null}
      <CourierPackageTable packages={packagesQuery.data?.items ?? []} total={packagesQuery.data?.total ?? 0} />
    </div>
  );
}

export function CourierPackageDetailClient({ packageId }: { packageId: string }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [booking, setBooking] = useState({
    providerCode: "SHIPROCKET",
    awbNumber: "",
    providerOrderId: "",
    labelUrl: "",
    trackingUrl: "",
    note: "",
  });
  const [tracking, setTracking] = useState<{ trackingStatus: CourierTrackingStatus; trackingStatusLabel: string; note: string }>({
    trackingStatus: "BOOKED",
    trackingStatusLabel: "",
    note: "",
  });
  const [labelError, setLabelError] = useState("");

  const packageQuery = useQuery({
    queryKey: ["courier-package", auth.authHeaders, packageId],
    queryFn: () => getCourierPackage(auth.authHeaders, packageId),
    enabled: auth.isAuthenticated && Boolean(packageId),
  });

  const bookingMutation = useMutation({
    mutationFn: () =>
      bookCourierPackage(auth.authHeaders, packageId, {
        providerCode: booking.providerCode.trim().toUpperCase(),
        ...(booking.awbNumber.trim() ? { awbNumber: booking.awbNumber.trim() } : {}),
        ...(booking.providerOrderId.trim() ? { providerOrderId: booking.providerOrderId.trim() } : {}),
        ...(booking.labelUrl.trim() ? { labelUrl: booking.labelUrl.trim() } : {}),
        ...(booking.trackingUrl.trim() ? { trackingUrl: booking.trackingUrl.trim() } : {}),
        ...(booking.note.trim() ? { note: booking.note.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
    },
  });

  const trackingMutation = useMutation({
    mutationFn: () =>
      updateCourierPackageTracking(auth.authHeaders, packageId, {
        trackingStatus: tracking.trackingStatus,
        ...(tracking.trackingStatusLabel.trim() ? { trackingStatusLabel: tracking.trackingStatusLabel.trim() } : {}),
        ...(tracking.note.trim() ? { note: tracking.note.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
    },
  });

  async function downloadLabel(pkg: CourierPackageRecord, disposition: "download" | "print") {
    if (!pkg.labelDownloadUrl) {
      return;
    }
    setLabelError("");
    try {
      const label = await fetchCourierPackageLabel(auth.authHeaders, pkg.labelDownloadUrl);
      const url = URL.createObjectURL(label.blob);
      if (disposition === "print") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = label.fileName;
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : "Unable to download courier label.");
    }
  }

  if (packageQuery.isLoading) {
    return <CourierState message="Loading package detail" />;
  }

  if (packageQuery.isError || !packageQuery.data) {
    return (
      <CourierState
        message={packageQuery.error instanceof Error ? packageQuery.error.message : "Unable to load package detail."}
        action={<Button onClick={() => packageQuery.refetch()}>Retry</Button>}
        error
      />
    );
  }

  const pkg = packageQuery.data;
  const latest = pkg.latestCourierPackage;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-5">
        <article className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-[#153C55]">{pkg.packageNumber}</h2>
                <StatusBadge tone={statusTone(pkg.status)}>{label(pkg.status)}</StatusBadge>
                <StatusBadge tone={modeTone(pkg.deliveryMode)}>{label(pkg.deliveryMode)}</StatusBadge>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#667085]">
                {pkg.order.orderNumber} / {pkg.seller.storeName} / {new Date(pkg.order.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/courier/packages">Back to packages</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCell label="Weight" value={pkg.weightGrams ? `${pkg.weightGrams} g` : "Not set"} />
            <InfoCell label="Dimensions" value={dimensions(pkg)} />
            <InfoCell label="Declared value" value={money(pkg.declaredValuePaise)} />
            <InfoCell label="Shipping charge" value={money(pkg.shippingPaise + pkg.codSurchargePaise)} />
          </div>
        </article>

        <article className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h3 className="text-lg font-black text-[#1F2933]">Courier booking snapshot</h3>
            <p className="mt-1 text-sm font-semibold text-[#667085]">AWB, label, tracking, and provider state for this physical package.</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <InfoCell label="Provider" value={latest?.courierConsignment?.providerCode ?? pkg.courierCode ?? "Not booked"} />
            <InfoCell label="AWB" value={pkg.awbNumber ?? "Not assigned"} />
            <InfoCell label="Courier" value={pkg.courierName ?? pkg.courierCode ?? "Not assigned"} />
            <InfoCell label="Tracking status" value={label(pkg.courierTrackingStatus)} />
            <InfoCell label="Pickup location" value={latest?.courierConsignment?.pickupLocationName ?? "Not synced"} />
            <InfoCell label="Booked at" value={latest?.bookedAt ? new Date(latest.bookedAt).toLocaleString("en-IN") : "Not booked"} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#E5E7EB] px-4 py-3">
            <Button type="button" disabled={!pkg.canDownloadLabel} onClick={() => downloadLabel(pkg, "download")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download label
            </Button>
            <Button type="button" variant="outline" disabled={!pkg.canDownloadLabel} onClick={() => downloadLabel(pkg, "print")}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Print label
            </Button>
            {pkg.trackingUrl ? (
              <Button asChild variant="outline">
                <a href={pkg.trackingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Track
                </a>
              </Button>
            ) : null}
          </div>
          {labelError ? <p className="border-t border-[#F5B7B7] bg-[#FDECEC] px-4 py-3 text-sm font-semibold text-[#9B1C1C]">{labelError}</p> : null}
        </article>

        <PackageAddressPanel pkg={pkg} />
      </section>

      <aside className="space-y-5">
        <CourierFormPanel title="Book courier package" description="Manual AWB/label entry or live adapter booking through the backend.">
          <div className="grid gap-3">
            <TextInput label="Provider code" value={booking.providerCode} onChange={(value) => setBooking((current) => ({ ...current, providerCode: value }))} />
            <TextInput label="AWB number" value={booking.awbNumber} onChange={(value) => setBooking((current) => ({ ...current, awbNumber: value }))} />
            <TextInput label="Provider order id" value={booking.providerOrderId} onChange={(value) => setBooking((current) => ({ ...current, providerOrderId: value }))} />
            <TextInput label="Label URL" value={booking.labelUrl} onChange={(value) => setBooking((current) => ({ ...current, labelUrl: value }))} />
            <TextInput label="Tracking URL" value={booking.trackingUrl} onChange={(value) => setBooking((current) => ({ ...current, trackingUrl: value }))} />
            <TextArea label="Booking note" value={booking.note} onChange={(value) => setBooking((current) => ({ ...current, note: value }))} />
            <Button type="button" disabled={!pkg.canBookCourier || bookingMutation.isPending || booking.providerCode.trim().length < 2} onClick={() => bookingMutation.mutate()}>
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              {bookingMutation.isPending ? "Booking..." : "Book package"}
            </Button>
            {bookingMutation.isError ? <MutationError error={bookingMutation.error} /> : null}
          </div>
        </CourierFormPanel>

        <CourierFormPanel title="Update tracking" description="Courier status updates roll into package and order delivery timelines.">
          <div className="grid gap-3">
            <SelectInput
              label="Tracking status"
              value={tracking.trackingStatus}
              onChange={(value) => setTracking((current) => ({ ...current, trackingStatus: value as CourierTrackingStatus }))}
              options={trackingStatuses.map((status) => ({ value: status, label: label(status) }))}
            />
            <TextInput
              label="Status label"
              value={tracking.trackingStatusLabel}
              onChange={(value) => setTracking((current) => ({ ...current, trackingStatusLabel: value }))}
            />
            <TextArea label="Tracking note" value={tracking.note} onChange={(value) => setTracking((current) => ({ ...current, note: value }))} />
            <Button type="button" disabled={trackingMutation.isPending} onClick={() => trackingMutation.mutate()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {trackingMutation.isPending ? "Updating..." : "Update tracking"}
            </Button>
            {trackingMutation.isError ? <MutationError error={trackingMutation.error} /> : null}
          </div>
        </CourierFormPanel>
      </aside>
    </div>
  );
}

export function CourierRoutingFailuresClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const query = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), limit: 60 }), [search]);
  const failuresQuery = useQuery({
    queryKey: ["courier-routing-failures", auth.authHeaders, query],
    queryFn: () => listCourierRoutingFailures(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} placeholder="Search failed shipment, seller, order, or reason" onRefresh={() => failuresQuery.refetch()} />
      {failuresQuery.isLoading ? <CourierState message="Loading routing failures" /> : null}
      {failuresQuery.isError ? <CourierState message={errorMessage(failuresQuery.error, "Unable to load routing failures.")} error /> : null}
      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-lg font-black text-[#1F2933]">Routing failure queue</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{failuresQuery.data?.total ?? 0} failed shipments need retry or manual override.</p>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {(failuresQuery.data?.items ?? []).map((shipment) => (
            <RoutingFailureRow key={shipment.id} shipment={shipment} />
          ))}
          {!failuresQuery.isLoading && (failuresQuery.data?.items ?? []).length === 0 ? <EmptyRow message="No routing failures found." /> : null}
        </div>
      </section>
    </div>
  );
}

export function CourierLocalDeliveryClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(assignmentStatus ? { assignmentStatus } : {}),
      limit: 60,
    }),
    [assignmentStatus, search],
  );
  const queueQuery = useQuery({
    queryKey: ["courier-local-delivery", auth.authHeaders, query],
    queryFn: () => listCourierLocalDelivery(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search local shipment, seller, order, or partner"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <select
            value={assignmentStatus}
            onChange={(event) => setAssignmentStatus(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All assignment states</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button type="button" variant="outline" onClick={() => queueQuery.refetch()}>
            Refresh
          </Button>
        </div>
      </section>
      {queueQuery.isLoading ? <CourierState message="Loading local delivery board" /> : null}
      {queueQuery.isError ? <CourierState message={errorMessage(queueQuery.error, "Unable to load local delivery board.")} error /> : null}
      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-lg font-black text-[#1F2933]">Local delivery assignment board</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {(queueQuery.data?.items ?? []).length} shipments visible. {queueQuery.data?.partners.length ?? 0} active delivery partners available.
          </p>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {(queueQuery.data?.items ?? []).map((shipment) => (
            <LocalDeliveryRow key={shipment.id} shipment={shipment} partners={queueQuery.data?.partners ?? []} />
          ))}
          {!queueQuery.isLoading && (queueQuery.data?.items ?? []).length === 0 ? <EmptyRow message="No local delivery shipments found." /> : null}
        </div>
      </section>
    </div>
  );
}

export function CourierDeliveryPartnersClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [pincode, setPincode] = useState("");
  const [localAreaCode, setLocalAreaCode] = useState("");
  const [readiness, setReadiness] = useState("");
  const [workload, setWorkload] = useState("");
  const [codRisk, setCodRisk] = useState("");
  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(availability ? { isAvailable: availability === "available" } : {}),
      ...(cityCode.trim() ? { cityCode: cityCode.trim() } : {}),
      ...(pincode.trim() ? { pincode: pincode.trim() } : {}),
      ...(localAreaCode.trim() ? { localAreaCode: localAreaCode.trim() } : {}),
      limit: 100,
    }),
    [availability, cityCode, localAreaCode, pincode, search],
  );
  const partnersQuery = useQuery({
    queryKey: ["courier-delivery-partners", auth.authHeaders, query],
    queryFn: () => listCourierDeliveryPartners(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });
  const filteredPartners = useMemo(() => {
    const partners = partnersQuery.data?.items ?? [];
    return partners.filter((partner) => {
      if (readiness === "ready" && !partner.assignmentReady) return false;
      if (readiness === "missing-profile" && partner.hasProfile) return false;
      if (readiness === "no-coverage" && partner.hasServiceCoverage) return false;
      if (workload === "active" && partner.activeWorkload <= 0) return false;
      if (workload === "idle" && partner.activeWorkload > 0) return false;
      if (codRisk === "risk" && !partner.codLimitExceeded) return false;
      if (codRisk === "clear" && partner.codLimitExceeded) return false;
      return true;
    });
  }, [codRisk, partnersQuery.data?.items, readiness, workload]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_160px_160px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or phone"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <select value={availability} onChange={(event) => setAvailability(event.target.value)} className={selectClassName}>
            <option value="">Any availability</option>
            <option value="available">Available</option>
            <option value="paused">Paused</option>
          </select>
          <input value={cityCode} onChange={(event) => setCityCode(event.target.value)} placeholder="City code" className={inputClassName} />
          <input value={pincode} onChange={(event) => setPincode(event.target.value)} placeholder="Pincode" className={inputClassName} />
          <input value={localAreaCode} onChange={(event) => setLocalAreaCode(event.target.value)} placeholder="Local area code" className={inputClassName} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={readiness} onChange={(event) => setReadiness(event.target.value)} className={selectClassName}>
            <option value="">Any readiness</option>
            <option value="ready">Assignment ready</option>
            <option value="missing-profile">Missing profile</option>
            <option value="no-coverage">No service coverage</option>
          </select>
          <select value={workload} onChange={(event) => setWorkload(event.target.value)} className={selectClassName}>
            <option value="">Any workload</option>
            <option value="active">Has active workload</option>
            <option value="idle">Idle</option>
          </select>
          <select value={codRisk} onChange={(event) => setCodRisk(event.target.value)} className={selectClassName}>
            <option value="">Any COD exposure</option>
            <option value="risk">COD limit exceeded</option>
            <option value="clear">COD clear</option>
          </select>
          <Button type="button" variant="outline" onClick={() => partnersQuery.refetch()}>
            Refresh
          </Button>
        </div>
      </section>

      {partnersQuery.isLoading ? <CourierState message="Loading delivery partners" /> : null}
      {partnersQuery.isError ? <CourierState message={errorMessage(partnersQuery.error, "Unable to load delivery partners.")} error /> : null}

      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Delivery partner operations</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">
              {filteredPartners.length} partners visible. Courier Manager can edit service coverage and availability only.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/courier/local-delivery">Assignment board</Link>
          </Button>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {filteredPartners.map((partner) => (
            <DeliveryPartnerRow key={partner.id} partner={partner} />
          ))}
          {!partnersQuery.isLoading && filteredPartners.length === 0 ? <EmptyRow message="No delivery partners found." /> : null}
        </div>
      </section>
    </div>
  );
}

export function CourierDeliveryPartnerDetailClient({ userId }: { userId: string }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const partnerQuery = useQuery({
    queryKey: ["courier-delivery-partner", auth.authHeaders, userId],
    queryFn: () => getCourierDeliveryPartner(auth.authHeaders, userId),
    enabled: auth.isAuthenticated && Boolean(userId),
  });
  const [form, setForm] = useState(() => emptyPartnerForm());

  useEffect(() => {
    if (partnerQuery.data) {
      setForm(partnerToForm(partnerQuery.data));
    }
  }, [partnerQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateCourierDeliveryPartnerProfile(auth.authHeaders, userId, partnerFormToPayload(form)),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["courier-delivery-partner"] });
      await queryClient.invalidateQueries({ queryKey: ["courier-delivery-partners"] });
    },
  });
  const availabilityMutation = useMutation({
    mutationFn: (isAvailable: boolean) =>
      updateCourierDeliveryPartnerAvailability(auth.authHeaders, userId, isAvailable, isAvailable ? "Resumed from courier workspace." : "Paused from courier workspace."),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["courier-delivery-partner"] });
      await queryClient.invalidateQueries({ queryKey: ["courier-delivery-partners"] });
    },
  });

  if (partnerQuery.isLoading) {
    return <CourierState message="Loading delivery partner profile" />;
  }

  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <CourierState
        message={errorMessage(partnerQuery.error, "Unable to load delivery partner profile.")}
        action={<Button onClick={() => partnerQuery.refetch()}>Retry</Button>}
        error
      />
    );
  }

  const partner = partnerQuery.data;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {partnerStateBadges(partner)}
            </div>
            <h2 className="mt-3 text-2xl font-black text-[#153C55]">{partner.fullName ?? partner.email}</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">{partner.email}</p>
            {partner.readinessReasons.length ? (
              <p className="mt-2 text-sm font-semibold text-[#B42318]">{partner.readinessReasons.join(", ")}</p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-[#0F8A5F]">Ready for local-delivery assignment.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/courier/local-delivery/partners">Back to partners</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={availabilityMutation.isPending}
              onClick={() => availabilityMutation.mutate(!partner.deliveryProfile.isAvailable)}
            >
              {partner.deliveryProfile.isAvailable ? "Pause partner" : "Resume partner"}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCell label="Active workload" value={String(partner.activeWorkload)} />
        <InfoCell label="COD exposure" value={money(partner.pendingCodCashPaise)} />
        <InfoCell label="COD limit" value={money(partner.deliveryProfile.effectiveCodCashLimitPaise)} />
        <InfoCell label="Service radius" value={partner.deliveryProfile.serviceRadiusKm ? `${partner.deliveryProfile.serviceRadiusKm} km` : "Not set"} />
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-[#1F2933]">Operational profile</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Courier Manager can edit delivery profile data only. User account, roles, passwords, and finance verification stay outside this workspace.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextInput label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <TextInput label="Vehicle number" value={form.vehicleNumber} onChange={(value) => setForm((current) => ({ ...current, vehicleNumber: value }))} />
          <SelectInput
            label="Availability"
            value={form.isAvailable ? "true" : "false"}
            onChange={(value) => setForm((current) => ({ ...current, isAvailable: value === "true" }))}
            options={[
              { value: "true", label: "Available" },
              { value: "false", label: "Paused" },
            ]}
          />
          <TextInput label="Priority" value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} />
          <TextInput label="Country code" value={form.serviceCountryCode} onChange={(value) => setForm((current) => ({ ...current, serviceCountryCode: value }))} />
          <TextInput label="State code" value={form.serviceStateCode} onChange={(value) => setForm((current) => ({ ...current, serviceStateCode: value }))} />
          <TextInput label="City code" value={form.serviceCityCode} onChange={(value) => setForm((current) => ({ ...current, serviceCityCode: value }))} />
          <TextInput label="Service pincodes" value={form.servicePincodes} onChange={(value) => setForm((current) => ({ ...current, servicePincodes: value }))} />
          <TextInput label="Service local area codes" value={form.serviceLocalAreaCodes} onChange={(value) => setForm((current) => ({ ...current, serviceLocalAreaCodes: value }))} />
          <TextInput label="Base latitude" value={form.baseLatitude} onChange={(value) => setForm((current) => ({ ...current, baseLatitude: value }))} />
          <TextInput label="Base longitude" value={form.baseLongitude} onChange={(value) => setForm((current) => ({ ...current, baseLongitude: value }))} />
          <TextInput label="Service radius km" value={form.serviceRadiusKm} onChange={(value) => setForm((current) => ({ ...current, serviceRadiusKm: value }))} />
          <TextInput label="COD cash limit paise" value={form.codCashLimitPaise} onChange={(value) => setForm((current) => ({ ...current, codCashLimitPaise: value }))} />
          <div className="lg:col-span-2">
            <TextArea label="Notes" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#667085]">Use comma-separated values for pincodes and local area codes.</p>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saveMutation.isPending ? "Saving..." : "Save profile"}
          </Button>
        </div>
        {saveMutation.isError ? <div className="mt-3"><MutationError error={saveMutation.error} /></div> : null}
        {availabilityMutation.isError ? <div className="mt-3"><MutationError error={availabilityMutation.error} /></div> : null}
      </section>
    </div>
  );
}

export function CourierProvidersClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CourierProviderPayload>({
    providerCode: "SHIPROCKET",
    displayName: "Shiprocket",
    mode: "MANUAL",
    isActive: true,
    serviceableCountryCodes: ["IN"],
    adapterCode: "SHIPROCKET",
    apiBaseUrl: "https://apiv2.shiprocket.in",
    bookingEndpointPath: "/v1/shipments/book",
    trackingEndpointPath: "/v1/shipments/track",
    labelEndpointPath: "/v1/shipments/label",
    cancellationEndpointPath: "/v1/shipments/cancel",
    defaultPackageWeightGrams: 500,
    defaultPackageLengthCm: 20,
    defaultPackageBreadthCm: 15,
    defaultPackageHeightCm: 8,
    notes: "",
  });
  const providersQuery = useQuery({
    queryKey: ["courier-providers", auth.authHeaders],
    queryFn: () => listCourierProviders(auth.authHeaders),
    enabled: auth.isAuthenticated,
  });
  const saveMutation = useMutation({
    mutationFn: () => saveCourierProvider(auth.authHeaders, cleanProviderPayload(form)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["courier-providers"] });
      await queryClient.invalidateQueries({ queryKey: ["courier-dashboard"] });
    },
  });
  const activeMutation = useMutation({
    mutationFn: ({ providerCode, isActive }: { providerCode: string; isActive: boolean }) =>
      updateCourierProviderActive(auth.authHeaders, providerCode, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["courier-providers"] });
      await queryClient.invalidateQueries({ queryKey: ["courier-dashboard"] });
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-lg font-black text-[#1F2933]">Courier providers</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Provider health and credential setup. Secrets are never shown back in the browser.</p>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {(providersQuery.data?.items ?? []).map((provider) => (
            <ProviderRow key={provider.id} provider={provider} busy={activeMutation.isPending} onToggle={(isActive) => activeMutation.mutate({ providerCode: provider.providerCode, isActive })} />
          ))}
          {providersQuery.isLoading ? <EmptyRow message="Loading courier providers." /> : null}
          {!providersQuery.isLoading && (providersQuery.data?.items ?? []).length === 0 ? <EmptyRow message="No courier providers configured yet." /> : null}
        </div>
      </section>

      <CourierFormPanel title="Provider setup" description="Leave secret fields blank to keep the saved secret value.">
        <div className="grid gap-3">
          <TextInput label="Provider code" value={form.providerCode} onChange={(value) => setForm((current) => ({ ...current, providerCode: value }))} />
          <TextInput label="Display name" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
          <SelectInput
            label="Mode"
            value={form.mode ?? "MANUAL"}
            onChange={(value) => setForm((current) => ({ ...current, mode: value as CourierProviderMode }))}
            options={[
              { value: "MANUAL", label: "Manual" },
              { value: "SANDBOX", label: "Sandbox" },
              { value: "LIVE", label: "Live" },
            ]}
          />
          <TextInput label="Country codes" value={(form.serviceableCountryCodes ?? []).join(",")} onChange={(value) => setForm((current) => ({ ...current, serviceableCountryCodes: splitCsv(value) }))} />
          <TextInput label="Adapter code" value={form.adapterCode ?? ""} onChange={(value) => setForm((current) => ({ ...current, adapterCode: value }))} />
          <TextInput label="API base URL" value={form.apiBaseUrl ?? ""} onChange={(value) => setForm((current) => ({ ...current, apiBaseUrl: value }))} />
          <TextInput label="Booking endpoint" value={form.bookingEndpointPath ?? ""} onChange={(value) => setForm((current) => ({ ...current, bookingEndpointPath: value }))} />
          <TextInput label="Tracking endpoint" value={form.trackingEndpointPath ?? ""} onChange={(value) => setForm((current) => ({ ...current, trackingEndpointPath: value }))} />
          <TextInput label="Label endpoint" value={form.labelEndpointPath ?? ""} onChange={(value) => setForm((current) => ({ ...current, labelEndpointPath: value }))} />
          <TextInput label="Cancellation endpoint" value={form.cancellationEndpointPath ?? ""} onChange={(value) => setForm((current) => ({ ...current, cancellationEndpointPath: value }))} />
          <TextInput label="Account / client code" value={form.accountCode ?? ""} onChange={(value) => setForm((current) => ({ ...current, accountCode: value }))} />
          <TextInput label="API username" value={form.username ?? ""} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
          <TextInput label="API key / token" value={form.apiKey ?? ""} onChange={(value) => setForm((current) => ({ ...current, apiKey: value }))} />
          <TextInput label="API secret" value={form.apiSecret ?? ""} onChange={(value) => setForm((current) => ({ ...current, apiSecret: value }))} />
          <TextInput label="Password / auth token" value={form.password ?? ""} onChange={(value) => setForm((current) => ({ ...current, password: value }))} />
          <TextInput label="Webhook secret" value={form.webhookSecret ?? ""} onChange={(value) => setForm((current) => ({ ...current, webhookSecret: value }))} />
          <div className="grid gap-2 sm:grid-cols-4">
            <NumberInput label="Weight g" value={form.defaultPackageWeightGrams ?? 500} onChange={(value) => setForm((current) => ({ ...current, defaultPackageWeightGrams: value }))} />
            <NumberInput label="Length cm" value={form.defaultPackageLengthCm ?? 20} onChange={(value) => setForm((current) => ({ ...current, defaultPackageLengthCm: value }))} />
            <NumberInput label="Breadth cm" value={form.defaultPackageBreadthCm ?? 15} onChange={(value) => setForm((current) => ({ ...current, defaultPackageBreadthCm: value }))} />
            <NumberInput label="Height cm" value={form.defaultPackageHeightCm ?? 8} onChange={(value) => setForm((current) => ({ ...current, defaultPackageHeightCm: value }))} />
          </div>
          <TextArea label="Notes" value={form.notes ?? ""} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} />
          <label className="flex items-center gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-black text-[#1F2933]">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 accent-[#ED3500]"
            />
            Active provider
          </label>
          <Button type="button" disabled={saveMutation.isPending || form.providerCode.trim().length < 2 || form.displayName.trim().length < 2} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saveMutation.isPending ? "Saving..." : "Save provider"}
          </Button>
          {saveMutation.isError ? <MutationError error={saveMutation.error} /> : null}
        </div>
      </CourierFormPanel>
    </div>
  );
}

export function CourierCodRemittancesClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    shipmentNumber: "",
    awbNumber: "",
    remittedAmountPaise: 0,
    remittanceReference: "",
    reportReference: "",
    notes: "",
  });
  const query = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}), limit: 60 }), [search, status]);
  const remittanceQuery = useQuery({
    queryKey: ["courier-cod-remittances", auth.authHeaders, query],
    queryFn: () => listCourierCodRemittances(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });
  const recordMutation = useMutation({
    mutationFn: () =>
      recordCourierCodRemittance(auth.authHeaders, {
        ...(form.shipmentNumber.trim() ? { shipmentNumber: form.shipmentNumber.trim() } : {}),
        ...(form.awbNumber.trim() ? { awbNumber: form.awbNumber.trim() } : {}),
        remittedAmountPaise: Number(form.remittedAmountPaise) || 0,
        ...(form.remittanceReference.trim() ? { remittanceReference: form.remittanceReference.trim() } : {}),
        ...(form.reportReference.trim() ? { reportReference: form.reportReference.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["courier-cod-remittances"] });
      await queryClient.invalidateQueries({ queryKey: ["courier-dashboard"] });
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search shipment, AWB, order, report, or reference"
                className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COURIER_COLLECTED">Courier collected</option>
              <option value="REMITTED">Remitted</option>
              <option value="VERIFIED">Verified</option>
              <option value="DISPUTED">Disputed</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <Button type="button" variant="outline" onClick={() => remittanceQuery.refetch()}>
              Refresh
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h2 className="text-lg font-black text-[#1F2933]">Courier COD handoff</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">
              Courier managers can record or import remittance details. Final payment verification remains with Finance/Admin.
            </p>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {(remittanceQuery.data?.items ?? []).map((remittance) => (
              <CourierRemittanceRow key={remittance.id} remittance={remittance} />
            ))}
            {remittanceQuery.isLoading ? <EmptyRow message="Loading courier remittances." /> : null}
            {!remittanceQuery.isLoading && (remittanceQuery.data?.items ?? []).length === 0 ? <EmptyRow message="No courier COD remittances found." /> : null}
          </div>
        </section>
      </section>

      <CourierFormPanel title="Record COD remittance" description="Enter shipment/AWB plus courier remitted amount. Finance will verify later.">
        <div className="grid gap-3">
          <TextInput label="Shipment number" value={form.shipmentNumber} onChange={(value) => setForm((current) => ({ ...current, shipmentNumber: value }))} />
          <TextInput label="AWB number" value={form.awbNumber} onChange={(value) => setForm((current) => ({ ...current, awbNumber: value }))} />
          <NumberInput label="Remitted amount paise" value={form.remittedAmountPaise} onChange={(value) => setForm((current) => ({ ...current, remittedAmountPaise: value }))} />
          <TextInput label="Remittance reference" value={form.remittanceReference} onChange={(value) => setForm((current) => ({ ...current, remittanceReference: value }))} />
          <TextInput label="Report reference" value={form.reportReference} onChange={(value) => setForm((current) => ({ ...current, reportReference: value }))} />
          <TextArea label="Notes" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} />
          <Button
            type="button"
            disabled={recordMutation.isPending || (!form.shipmentNumber.trim() && !form.awbNumber.trim())}
            onClick={() => recordMutation.mutate()}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {recordMutation.isPending ? "Recording..." : "Record remittance"}
          </Button>
          {recordMutation.isError ? <MutationError error={recordMutation.error} /> : null}
        </div>
      </CourierFormPanel>
    </div>
  );
}

function CourierMetricGrid({ dashboard }: { dashboard: CourierDashboard }) {
  const metrics = dashboard.metrics;
  const cards = [
    { label: "Pending bookings", value: metrics.pendingBookings, icon: PackageCheck, href: "/courier/packages?packageStatus=READY_FOR_BOOKING", tone: "orange" },
    { label: "Booking failures", value: metrics.bookingFailures, icon: AlertTriangle, href: "/courier/packages?trackingStatus=FAILED", tone: "red" },
    { label: "Label ready", value: metrics.labelReady, icon: FileText, href: "/courier/packages", tone: "green" },
    { label: "Pickup scheduled", value: metrics.pickupScheduled, icon: Truck, href: "/courier/packages", tone: "blue" },
    { label: "In transit", value: metrics.inTransit, icon: Truck, href: "/courier/packages", tone: "blue" },
    { label: "Delivered", value: metrics.delivered, icon: CheckCircle2, href: "/courier/packages", tone: "green" },
    { label: "Routing failures", value: metrics.routingFailures, icon: AlertCircle, href: "/courier/routing-failures", tone: "red" },
    { label: "Local pending", value: metrics.localDeliveryPending, icon: MapPinned, href: "/courier/local-delivery", tone: "orange" },
    { label: "Courier COD", value: metrics.courierCodPending, icon: CreditCard, href: "/courier/cod-remittances", tone: "orange" },
    { label: "Active providers", value: metrics.activeProviders, icon: Settings, href: "/courier/providers", tone: "blue" },
  ] as const;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.label} href={card.href} className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className={iconTone(card.tone)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <StatusBadge tone={card.value > 0 ? "warning" : "success"}>{card.value}</StatusBadge>
            </div>
            <p className="mt-4 text-sm font-black text-[#667085]">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-[#153C55]">{card.value}</p>
          </Link>
        );
      })}
    </section>
  );
}

function CourierPackagePanel({ title, packages, loading }: { title: string; packages: CourierPackageRecord[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Package-level labels, AWB, and tracking.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/courier/packages">Open</Link>
        </Button>
      </div>
      <div className="divide-y divide-[#E5E7EB]">
        {packages.map((pkg) => (
          <PackageSummaryRow key={pkg.id} pkg={pkg} />
        ))}
        {loading ? <EmptyRow message="Loading packages." /> : null}
        {!loading && packages.length === 0 ? <EmptyRow message="No package records found." /> : null}
      </div>
    </section>
  );
}

function RoutingFailurePanel({ failures, loading }: { failures: CourierShipmentRecord[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">Routing failures</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Failed shipments awaiting retry or override.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/courier/routing-failures">Open</Link>
        </Button>
      </div>
      <div className="divide-y divide-[#E5E7EB]">
        {failures.map((shipment) => (
          <ShipmentSummaryRow key={shipment.id} shipment={shipment} />
        ))}
        {loading ? <EmptyRow message="Loading failures." /> : null}
        {!loading && failures.length === 0 ? <EmptyRow message="No routing failures." /> : null}
      </div>
    </section>
  );
}

function CourierPackageFilters({
  search,
  deliveryMode,
  packageStatus,
  trackingStatus,
  providerCode,
  onSearchChange,
  onDeliveryModeChange,
  onPackageStatusChange,
  onTrackingStatusChange,
  onProviderCodeChange,
  onRefresh,
}: {
  search: string;
  deliveryMode: string;
  packageStatus: string;
  trackingStatus: string;
  providerCode: string;
  onSearchChange: (value: string) => void;
  onDeliveryModeChange: (value: string) => void;
  onPackageStatusChange: (value: string) => void;
  onTrackingStatusChange: (value: string) => void;
  onProviderCodeChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[1fr_210px_210px_210px_160px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search package, order, shipment, seller, or AWB"
            className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
          />
        </label>
        <select value={deliveryMode} onChange={(event) => onDeliveryModeChange(event.target.value)} className={selectClassName}>
          <option value="">All modes</option>
          {deliveryModes.map((mode) => (
            <option key={mode} value={mode}>
              {label(mode)}
            </option>
          ))}
        </select>
        <select value={packageStatus} onChange={(event) => onPackageStatusChange(event.target.value)} className={selectClassName}>
          <option value="">All package states</option>
          {trackingStatuses
            .filter((status) => status !== "NOT_BOOKED")
            .map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
        </select>
        <select value={trackingStatus} onChange={(event) => onTrackingStatusChange(event.target.value)} className={selectClassName}>
          <option value="">All tracking states</option>
          {trackingStatuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
        <input
          value={providerCode}
          onChange={(event) => onProviderCodeChange(event.target.value)}
          placeholder="Provider"
          className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black uppercase text-[#1F2933] outline-none transition focus:border-[#ED3500]"
        />
        <Button type="button" variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </section>
  );
}

function CourierPackageTable({ packages, total }: { packages: CourierPackageRecord[]; total: number }) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">Package operations table</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{total} package records matched.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Courier</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className="px-4 py-3">
                  <p className="font-black text-[#153C55]">{pkg.packageNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{pkg.order.orderNumber}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusBadge tone={statusTone(pkg.status)}>{label(pkg.status)}</StatusBadge>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#1F2933]">{pkg.seller.storeName}</td>
                <td className="px-4 py-3 font-semibold text-[#667085]">{addressText(pkg.order.shippingAddressSnapshot)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={modeTone(pkg.deliveryMode)}>{label(pkg.deliveryMode)}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <p className="font-black text-[#1F2933]">{pkg.courierCode ?? "Not booked"}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">AWB: {pkg.awbNumber ?? "Pending"}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{label(pkg.courierTrackingStatus)}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={pkg.canDownloadLabel ? "success" : "warning"}>{pkg.canDownloadLabel ? "Ready" : "Not ready"}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="outline">
                    <Link href={`/courier/packages/${pkg.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {packages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-semibold text-[#667085]">
                  No courier packages found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoutingFailureRow({ shipment }: { shipment: CourierShipmentRecord }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(shipment.deliveryMode);
  const [providerCode, setProviderCode] = useState(shipment.courierProviderCode ?? "SHIPROCKET");
  const [partnerUserId, setPartnerUserId] = useState(shipment.deliveryPartnerUserId ?? "");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      overrideCourierRoutingFailure(auth.authHeaders, shipment.id, {
        deliveryMode,
        ...(deliveryMode === "THIRD_PARTY_COURIER" && providerCode.trim() ? { courierProviderCode: providerCode.trim().toUpperCase() } : {}),
        ...(deliveryMode === "LOCAL_DELIVERY_PARTNER" && partnerUserId ? { deliveryPartnerUserId: partnerUserId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
    },
  });

  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-center">
      <ShipmentSummaryContent shipment={shipment} />
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          First failed: <span className="font-black text-[#1F2933]">{shipment.routingFirstFailedAt ? new Date(shipment.routingFirstFailedAt).toLocaleString("en-IN") : "Not set"}</span>
        </p>
        <p>
          Reason: <span className="font-black text-[#1F2933]">{shipment.routingFailureReason ?? shipment.routingFailureNote ?? "Routing failed"}</span>
        </p>
      </div>
      <div className="grid gap-2">
        <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)} className={selectClassName}>
          {deliveryModes.map((mode) => (
            <option key={mode} value={mode}>
              {label(mode)}
            </option>
          ))}
        </select>
        {deliveryMode === "THIRD_PARTY_COURIER" ? (
          <input value={providerCode} onChange={(event) => setProviderCode(event.target.value)} placeholder="Provider code" className={inputClassName} />
        ) : null}
        {deliveryMode === "LOCAL_DELIVERY_PARTNER" ? (
          <input value={partnerUserId} onChange={(event) => setPartnerUserId(event.target.value)} placeholder="Delivery partner user id" className={inputClassName} />
        ) : null}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Override note" className={inputClassName} />
        {mutation.isError ? <MutationError error={mutation.error} /> : null}
      </div>
      <div className="flex justify-end">
        <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving..." : "Override"}
        </Button>
      </div>
    </article>
  );
}

function LocalDeliveryRow({ shipment, partners }: { shipment: CourierShipmentRecord; partners: DeliveryPartnerOption[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [partnerUserId, setPartnerUserId] = useState(shipment.deliveryPartnerUserId ?? "");
  const [assignmentNote, setAssignmentNote] = useState(shipment.assignmentNote ?? "");
  const mutation = useMutation({
    mutationFn: () =>
      assignCourierLocalDelivery(auth.authHeaders, shipment.id, {
        ...(partnerUserId ? { deliveryPartnerUserId: partnerUserId } : {}),
        ...(assignmentNote.trim() ? { assignmentNote: assignmentNote.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidateCourierQueries(queryClient);
    },
  });

  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-center">
      <ShipmentSummaryContent shipment={shipment} />
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Assignment: <span className="font-black text-[#1F2933]">{label(shipment.assignmentStatus ?? "UNASSIGNED")}</span>
        </p>
        <p>
          Current partner:{" "}
          {shipment.deliveryPartner ? (
            <Link
              href={`/courier/local-delivery/partners/${shipment.deliveryPartner.id}`}
              className="font-black text-[#153C55] underline decoration-[#ED3500]/40 underline-offset-4 hover:text-[#ED3500]"
            >
              {shipment.deliveryPartner.fullName ?? shipment.deliveryPartner.email}
            </Link>
          ) : (
            <span className="font-black text-[#1F2933]">Unassigned</span>
          )}
        </p>
      </div>
      <div className="grid gap-2">
        <select value={partnerUserId} onChange={(event) => setPartnerUserId(event.target.value)} className={selectClassName}>
          <option value="">Unassigned</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.fullName ?? partner.email}
            </option>
          ))}
        </select>
        <input value={assignmentNote} onChange={(event) => setAssignmentNote(event.target.value)} placeholder="Assignment note" className={inputClassName} />
        {mutation.isError ? <MutationError error={mutation.error} /> : null}
      </div>
      <div className="flex justify-end">
        <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Assigning..." : "Save assignment"}
        </Button>
      </div>
    </article>
  );
}

function DeliveryPartnerRow({ partner }: { partner: CourierDeliveryPartnerRecord }) {
  const profile = partner.deliveryProfile;

  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1.1fr_1fr_1fr_auto] xl:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-[#153C55]">{partner.fullName ?? partner.email}</p>
          {partnerStateBadges(partner)}
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">{partner.email}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">Phone: {profile.phone ?? partner.phone ?? "Not set"}</p>
      </div>
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          City: <span className="font-black text-[#1F2933]">{profile.serviceCityCode ?? "Not set"}</span>
        </p>
        <p>
          Pincodes: <span className="font-black text-[#1F2933]">{profile.servicePincodes.length || "None"}</span>
        </p>
        <p>
          Local areas: <span className="font-black text-[#1F2933]">{profile.serviceLocalAreaCodes.length || "None"}</span>
        </p>
      </div>
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Workload: <span className="font-black text-[#1F2933]">{partner.activeWorkload}</span>
        </p>
        <p>
          COD exposure: <span className="font-black text-[#1F2933]">{money(partner.pendingCodCashPaise)}</span>
        </p>
        <p>
          COD limit: <span className="font-black text-[#1F2933]">{money(profile.effectiveCodCashLimitPaise)}</span>
        </p>
      </div>
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/courier/local-delivery/partners/${partner.id}`}>Open profile</Link>
        </Button>
      </div>
    </article>
  );
}

function ProviderRow({ provider, busy, onToggle }: { provider: CourierProviderRecord; busy: boolean; onToggle: (isActive: boolean) => void }) {
  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-[#153C55]">{provider.displayName}</p>
          <StatusBadge tone={provider.isActive ? "success" : "warning"}>{provider.isActive ? "Active" : "Paused"}</StatusBadge>
          <StatusBadge tone="info">{provider.mode}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">{provider.providerCode}</p>
      </div>
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Credentials: <span className="font-black text-[#1F2933]">{provider.credentialsConfigured ? "Configured" : "Missing"}</span>
        </p>
        <p>
          Webhook: <span className="font-black text-[#1F2933]">{provider.webhookSecretConfigured ? "Configured" : "Not configured"}</span>
        </p>
      </div>
      <div className="text-sm font-semibold text-[#667085]">
        Countries: <span className="font-black text-[#1F2933]">{provider.serviceableCountryCodes.join(", ") || "All"}</span>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onToggle(!provider.isActive)}>
          {provider.isActive ? "Pause" : "Activate"}
        </Button>
      </div>
    </article>
  );
}

function CourierRemittanceRow({ remittance }: { remittance: CourierCodRemittance }) {
  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1fr_1fr_1fr] xl:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-[#153C55]">{remittance.orderShipment.shipmentNumber}</p>
          <StatusBadge tone={statusTone(remittance.status)}>{label(remittance.status)}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {remittance.order.orderNumber} / {remittance.seller?.storeName ?? "Seller"}
        </p>
      </div>
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Provider: <span className="font-black text-[#1F2933]">{remittance.providerCode}</span>
        </p>
        <p>
          AWB: <span className="font-black text-[#1F2933]">{remittance.awbNumber ?? "Not assigned"}</span>
        </p>
      </div>
      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Expected: <span className="font-black text-[#1F2933]">{money(remittance.expectedAmountPaise)}</span>
        </p>
        <p>
          Remitted: <span className="font-black text-[#1F2933]">{money(remittance.remittedAmountPaise ?? 0)}</span>
        </p>
        <p>
          Reference: <span className="font-black text-[#1F2933]">{remittance.remittanceReference ?? "Pending"}</span>
        </p>
      </div>
    </article>
  );
}

function PackageSummaryRow({ pkg }: { pkg: CourierPackageRecord }) {
  return (
    <Link href={`/courier/packages/${pkg.id}`} className="grid gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-[#153C55]">{pkg.packageNumber}</p>
          <StatusBadge tone={statusTone(pkg.status)}>{label(pkg.status)}</StatusBadge>
          <StatusBadge tone={modeTone(pkg.deliveryMode)}>{label(pkg.deliveryMode)}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {pkg.order.orderNumber} / {pkg.seller.storeName} / AWB {pkg.awbNumber ?? "pending"}
        </p>
      </div>
      <StatusBadge tone={pkg.canDownloadLabel ? "success" : "warning"}>{pkg.canDownloadLabel ? "Label ready" : label(pkg.courierTrackingStatus)}</StatusBadge>
    </Link>
  );
}

function ShipmentSummaryRow({ shipment }: { shipment: CourierShipmentRecord }) {
  return (
    <div className="px-4 py-3">
      <ShipmentSummaryContent shipment={shipment} />
    </div>
  );
}

function ShipmentSummaryContent({ shipment }: { shipment: CourierShipmentRecord }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-black text-[#153C55]">{shipment.shipmentNumber}</p>
        <StatusBadge tone={modeTone(shipment.deliveryMode)}>{label(shipment.deliveryMode)}</StatusBadge>
        {shipment.routingFailed ? <StatusBadge tone="danger">Routing failed</StatusBadge> : null}
      </div>
      <p className="mt-1 text-sm font-semibold text-[#667085]">
        {shipment.order.orderNumber} / {shipment.seller.storeName} / {shipment.packageCount} package{shipment.packageCount === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{addressText(shipment.order.shippingAddressSnapshot)}</p>
    </div>
  );
}

function PackageAddressPanel({ pkg }: { pkg: CourierPackageRecord }) {
  const sellerAddress = pkg.seller.storeName;
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="border-b border-[#E5E7EB] px-4 py-3">
        <h3 className="text-lg font-black text-[#1F2933]">Pickup and destination</h3>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <InfoCell label="Seller pickup" value={sellerAddress} />
        <InfoCell label="Buyer destination" value={addressText(pkg.order.shippingAddressSnapshot)} />
      </div>
    </article>
  );
}

function CourierFormPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
  onRefresh,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
          />
        </label>
        <Button type="button" variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </section>
  );
}

function TextInput({ label: labelText, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{labelText}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClassName} mt-2 w-full`} />
    </label>
  );
}

function NumberInput({ label: labelText, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{labelText}</span>
      <input
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        type="number"
        min={0}
        className={`${inputClassName} mt-2 w-full`}
      />
    </label>
  );
}

function TextArea({ label: labelText, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{labelText}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

function SelectInput({
  label: labelText,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{labelText}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${selectClassName} mt-2 w-full`}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type PartnerFormState = {
  phone: string;
  vehicleNumber: string;
  isAvailable: boolean;
  priority: string;
  serviceCountryCode: string;
  serviceStateCode: string;
  serviceCityCode: string;
  servicePincodes: string;
  serviceLocalAreaCodes: string;
  baseLatitude: string;
  baseLongitude: string;
  serviceRadiusKm: string;
  codCashLimitPaise: string;
  notes: string;
};

function emptyPartnerForm(): PartnerFormState {
  return {
    phone: "",
    vehicleNumber: "",
    isAvailable: true,
    priority: "100",
    serviceCountryCode: "",
    serviceStateCode: "",
    serviceCityCode: "",
    servicePincodes: "",
    serviceLocalAreaCodes: "",
    baseLatitude: "",
    baseLongitude: "",
    serviceRadiusKm: "",
    codCashLimitPaise: "",
    notes: "",
  };
}

function partnerToForm(partner: CourierDeliveryPartnerRecord): PartnerFormState {
  const profile = partner.deliveryProfile;
  return {
    phone: profile.phone ?? partner.phone ?? "",
    vehicleNumber: profile.vehicleNumber ?? "",
    isAvailable: profile.isAvailable,
    priority: String(profile.priority ?? 100),
    serviceCountryCode: profile.serviceCountryCode ?? "",
    serviceStateCode: profile.serviceStateCode ?? "",
    serviceCityCode: profile.serviceCityCode ?? "",
    servicePincodes: profile.servicePincodes.join(", "),
    serviceLocalAreaCodes: profile.serviceLocalAreaCodes.join(", "),
    baseLatitude: profile.baseLatitude ?? "",
    baseLongitude: profile.baseLongitude ?? "",
    serviceRadiusKm: profile.serviceRadiusKm ? String(profile.serviceRadiusKm) : "",
    codCashLimitPaise: profile.codCashLimitPaise !== null && profile.codCashLimitPaise !== undefined ? String(profile.codCashLimitPaise) : "",
    notes: profile.notes ?? "",
  };
}

function partnerFormToPayload(form: PartnerFormState): CourierDeliveryPartnerPayload {
  const payload: CourierDeliveryPartnerPayload = {
    isAvailable: form.isAvailable,
    vehicleNumber: form.vehicleNumber.trim(),
    serviceCountryCode: form.serviceCountryCode.trim(),
    serviceStateCode: form.serviceStateCode.trim(),
    serviceCityCode: form.serviceCityCode.trim(),
    servicePincodes: csvToArray(form.servicePincodes),
    serviceLocalAreaCodes: csvToArray(form.serviceLocalAreaCodes),
    notes: form.notes.trim(),
  };
  const phone = form.phone.trim();
  const priority = positiveIntegerOrUndefined(form.priority);
  const baseLatitude = numberOrUndefined(form.baseLatitude);
  const baseLongitude = numberOrUndefined(form.baseLongitude);
  const serviceRadiusKm = positiveIntegerOrUndefined(form.serviceRadiusKm);
  const codCashLimitPaise = nonNegativeIntegerOrUndefined(form.codCashLimitPaise);

  if (phone) payload.phone = phone;
  if (priority !== undefined) payload.priority = priority;
  if (baseLatitude !== undefined) payload.baseLatitude = baseLatitude;
  if (baseLongitude !== undefined) payload.baseLongitude = baseLongitude;
  if (serviceRadiusKm !== undefined) payload.serviceRadiusKm = serviceRadiusKm;
  if (codCashLimitPaise !== undefined) payload.codCashLimitPaise = codCashLimitPaise;

  return payload;
}

function csvToArray(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveIntegerOrUndefined(value: string) {
  const parsed = numberOrUndefined(value);
  return parsed !== undefined && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeIntegerOrUndefined(value: string) {
  const parsed = numberOrUndefined(value);
  return parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function partnerStateBadges(partner: CourierDeliveryPartnerRecord) {
  const badges = [
    partner.deliveryProfile.isAvailable
      ? <StatusBadge key="available" tone="success">Available</StatusBadge>
      : <StatusBadge key="paused" tone="warning">Paused</StatusBadge>,
  ];

  if (!partner.hasProfile) {
    badges.push(<StatusBadge key="missing" tone="danger">Missing profile</StatusBadge>);
  }
  if (!partner.hasServiceCoverage) {
    badges.push(<StatusBadge key="coverage" tone="warning">No service coverage</StatusBadge>);
  }
  if (partner.codLimitExceeded) {
    badges.push(<StatusBadge key="cod" tone="danger">COD limit exceeded</StatusBadge>);
  }
  if (partner.status !== "ACTIVE") {
    badges.push(<StatusBadge key="disabled" tone="danger">User disabled</StatusBadge>);
  }
  if (partner.assignmentReady) {
    badges.push(<StatusBadge key="ready" tone="success">Assignment ready</StatusBadge>);
  }

  return badges;
}

function InfoCell({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{labelText}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function CourierState({ message, action, error }: { message: string; action?: React.ReactNode; error?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-white p-5 shadow-sm", error ? "border-[#F5B7B7]" : "border-[#D8E2EA]")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-10 w-10 place-items-center rounded-md", error ? "bg-[#FDECEC] text-[#B42318]" : "bg-[#FFF0EC] text-[#ED3500]")}>
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-black text-[#1F2933]">{message}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function MutationError({ error }: { error: unknown }) {
  return <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-semibold text-[#9B1C1C]">{errorMessage(error, "Operation failed.")}</p>;
}

function EmptyRow({ message }: { message: string }) {
  return <div className="px-4 py-8 text-center text-sm font-semibold text-[#667085]">{message}</div>;
}

function invalidateCourierQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["courier-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["courier-packages"] }),
    queryClient.invalidateQueries({ queryKey: ["courier-package"] }),
    queryClient.invalidateQueries({ queryKey: ["courier-routing-failures"] }),
    queryClient.invalidateQueries({ queryKey: ["courier-local-delivery"] }),
    queryClient.invalidateQueries({ queryKey: ["courier-cod-remittances"] }),
  ]);
}

function cleanProviderPayload(form: CourierProviderPayload): CourierProviderPayload {
  const payload: CourierProviderPayload = {
    providerCode: form.providerCode.trim().toUpperCase(),
    displayName: form.displayName.trim(),
  };

  if (form.mode) {
    payload.mode = form.mode;
  }
  if (form.isActive !== undefined) {
    payload.isActive = form.isActive;
  }
  const countryCodes = form.serviceableCountryCodes?.map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (countryCodes?.length) {
    payload.serviceableCountryCodes = countryCodes;
  }
  assignCleanString(payload, "adapterCode", form.adapterCode);
  assignCleanString(payload, "apiBaseUrl", form.apiBaseUrl);
  assignCleanString(payload, "bookingEndpointPath", form.bookingEndpointPath);
  assignCleanString(payload, "trackingEndpointPath", form.trackingEndpointPath);
  assignCleanString(payload, "labelEndpointPath", form.labelEndpointPath);
  assignCleanString(payload, "cancellationEndpointPath", form.cancellationEndpointPath);
  assignCleanString(payload, "accountCode", form.accountCode);
  assignCleanString(payload, "username", form.username);
  assignCleanString(payload, "apiKey", form.apiKey);
  assignCleanString(payload, "apiSecret", form.apiSecret);
  assignCleanString(payload, "password", form.password);
  assignCleanString(payload, "webhookSecret", form.webhookSecret);
  assignCleanString(payload, "notes", form.notes);
  if (form.defaultPackageWeightGrams !== undefined) {
    payload.defaultPackageWeightGrams = form.defaultPackageWeightGrams;
  }
  if (form.defaultPackageLengthCm !== undefined) {
    payload.defaultPackageLengthCm = form.defaultPackageLengthCm;
  }
  if (form.defaultPackageBreadthCm !== undefined) {
    payload.defaultPackageBreadthCm = form.defaultPackageBreadthCm;
  }
  if (form.defaultPackageHeightCm !== undefined) {
    payload.defaultPackageHeightCm = form.defaultPackageHeightCm;
  }

  return payload;
}

function assignCleanString<T extends keyof CourierProviderPayload>(payload: CourierProviderPayload, key: T, value?: string) {
  const cleaned = cleanString(value);
  if (cleaned) {
    Object.assign(payload, { [key]: cleaned });
  }
}

function cleanString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function dimensions(pkg: CourierPackageRecord) {
  if (!pkg.lengthCm || !pkg.breadthCm || !pkg.heightCm) {
    return "Not set";
  }
  return `${pkg.lengthCm} x ${pkg.breadthCm} x ${pkg.heightCm} cm`;
}

function addressText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Address snapshot not available";
  }
  const snapshot = value as Record<string, unknown>;
  const parts = ["line1", "line2", "area", "city", "state", "pincode", "countryCode"]
    .map((key) => snapshot[key])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return parts.length ? parts.join(", ") : "Address snapshot not available";
}

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(amountPaise: number) {
  return moneyFormatter.format((amountPaise ?? 0) / 100);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusTone(status: string): "success" | "danger" | "warning" | "info" {
  if (["DELIVERED", "VERIFIED", "REMITTED", "BOOKED", "READY_FOR_BOOKING", "LABEL_READY"].includes(status)) {
    return "success";
  }
  if (["FAILED", "REJECTED", "DISPUTED", "CANCELLED", "RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(status)) {
    return "danger";
  }
  if (["PENDING", "PACKING_PENDING", "BOOKING_PENDING", "NOT_BOOKED", "COURIER_COLLECTED"].includes(status)) {
    return "warning";
  }
  return "info";
}

function modeTone(mode: string): "success" | "danger" | "warning" | "info" {
  if (mode === "LOCAL_DELIVERY_PARTNER") {
    return "success";
  }
  if (mode === "MANUAL_TRANSPORT") {
    return "warning";
  }
  if (mode === "STORE_PICKUP") {
    return "info";
  }
  return "info";
}

function iconTone(tone: "orange" | "green" | "blue" | "red") {
  if (tone === "green") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#ECFDF3] text-[#0F8A5F]";
  }
  if (tone === "blue") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#153C55]";
  }
  if (tone === "red") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#FDECEC] text-[#B42318]";
  }
  return "grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]";
}

const inputClassName =
  "h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white";
const selectClassName =
  "h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]";
