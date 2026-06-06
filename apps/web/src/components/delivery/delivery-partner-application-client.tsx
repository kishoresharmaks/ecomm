"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  LogIn,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { Button, SectionHeading, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { LocationFields } from "@/components/locations/location-fields";
import { MapLocationPicker } from "@/components/maps/map-location-picker";
import {
  getOwnDeliveryPartnerApplication,
  submitDeliveryPartnerApplication,
  type DeliveryPartnerApplication,
  type DeliveryPartnerApplicationPayload,
} from "@/lib/delivery-partner-application-api";

const vehicleTypes = ["Bike", "Scooter", "Cycle", "Car", "Van", "Walking / foot delivery"];

type Notice = { tone: StatusTone; message: string } | null;

export function DeliveryPartnerApplicationClient() {
  const auth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const queryKey = useMemo(() => ["delivery-partner-application", auth.authKey], [auth.authKey]);
  const applicationQuery = useQuery({
    queryKey,
    queryFn: () => getOwnDeliveryPartnerApplication(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const submitMutation = useMutation({
    mutationFn: (payload: DeliveryPartnerApplicationPayload) =>
      submitDeliveryPartnerApplication(auth.authHeaders, payload),
    onSuccess: (application) => {
      setNotice({
        tone: "success",
        message:
          application.status === "PENDING_REVIEW"
            ? "Application submitted for admin review."
            : "Application saved.",
      });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Delivery partner application failed.",
      });
    },
  });

  if (!auth.enabled) {
    return <DeliveryPartnerSignInGate status={auth.status} error={auth.error} onRetry={auth.refresh} />;
  }

  if (applicationQuery.isLoading) {
    return <LoadingPanel />;
  }

  if (applicationQuery.error) {
    return (
      <StatePanel tone="danger" title="Unable to load application status" icon={<RefreshCw className="h-5 w-5" />}>
        <p className="text-sm font-semibold leading-6 text-[#8A1F1F]">
          {applicationQuery.error instanceof Error
            ? applicationQuery.error.message
            : "Application status could not be loaded."}
        </p>
        <Button type="button" variant="outline" onClick={() => void applicationQuery.refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </StatePanel>
    );
  }

  const application = applicationQuery.data?.application ?? null;
  const isDeliveryPartner = Boolean(applicationQuery.data?.isDeliveryPartner);

  if (isDeliveryPartner || application?.status === "APPROVED") {
    return (
      <StatePanel tone="success" title="Delivery partner account is active" icon={<CheckCircle2 className="h-5 w-5" />}>
        <p className="text-sm font-semibold leading-6 text-[#0F5132]">
          This account is approved for local delivery partner operations. You can manage availability, service
          area, wallet, and assigned orders from the delivery workspace.
        </p>
        <Button asChild>
          <Link href="/delivery">
            Open delivery workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </StatePanel>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const pincode = formValue(form, "pincode");
    const localAreaCode = optionalFormValue(form, "localAreaCode");
    const latitude = optionalNumberValue(form, "latitude");
    const longitude = optionalNumberValue(form, "longitude");
    const locationSource = optionalFormValue(form, "locationSource") as DeliveryPartnerApplicationPayload["locationSource"];
    const accuracyMeters = optionalNumberValue(form, "accuracyMeters");
    const locationConfidenceScore = optionalNumberValue(form, "locationConfidenceScore");
    const alternatePhone = optionalNormalizedPhone(form, "alternatePhone");
    const drivingLicenseNumber = optionalFormValue(form, "drivingLicenseNumber");
    const experienceSummary = optionalFormValue(form, "experienceSummary");
    const serviceCountryCode = optionalFormValue(form, "countryCode");
    const serviceStateCode = optionalFormValue(form, "stateCode");
    const serviceCityCode = optionalFormValue(form, "cityCode");
    const addressLine2 = optionalFormValue(form, "line2");
    const area = optionalFormValue(form, "area");
    const serviceRadiusKm = optionalNumberValue(form, "serviceRadiusKm");
    const availabilityNotes = optionalFormValue(form, "availabilityNotes");

    submitMutation.mutate({
      fullName: formValue(form, "fullName"),
      email: formValue(form, "email"),
      phone: normalizeIndianPhone(formValue(form, "phone")),
      vehicleType: formValue(form, "vehicleType"),
      vehicleNumber: formValue(form, "vehicleNumber"),
      servicePincodes: pincode ? [pincode] : [],
      serviceLocalAreaCodes: localAreaCode ? [localAreaCode] : [],
      addressLine1: formValue(form, "line1"),
      city: formValue(form, "city"),
      state: formValue(form, "state"),
      pincode,
      country: formValue(form, "country"),
      ...(alternatePhone !== undefined ? { alternatePhone } : {}),
      ...(drivingLicenseNumber !== undefined ? { drivingLicenseNumber } : {}),
      ...(experienceSummary !== undefined ? { experienceSummary } : {}),
      ...(serviceCountryCode !== undefined ? { serviceCountryCode } : {}),
      ...(serviceStateCode !== undefined ? { serviceStateCode } : {}),
      ...(serviceCityCode !== undefined ? { serviceCityCode } : {}),
      ...(addressLine2 !== undefined ? { addressLine2 } : {}),
      ...(area !== undefined ? { area } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(locationSource ? { locationSource } : {}),
      ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
      ...(locationConfidenceScore !== undefined ? { locationConfidenceScore } : {}),
      ...(serviceRadiusKm !== undefined ? { serviceRadiusKm } : {}),
      ...(availabilityNotes !== undefined ? { availabilityNotes } : {}),
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form
        key={application ? `${application.id}-${application.updatedAt}` : "new"}
        onSubmit={submit}
        className="grid gap-5"
      >
        <ApplicationStatusBanner application={application} />
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <IconTile>
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </IconTile>
            <SectionHeading
              title="Account and contact"
              description="Use the account that will sign in to the delivery partner workspace after approval."
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field
              label="Full name"
              name="fullName"
              required
              defaultValue={application?.fullName ?? auth.userProfile?.fullName ?? ""}
              placeholder="Delivery partner full name"
            />
            <Field
              label="Account email"
              name="email"
              type="email"
              required
              readOnly
              defaultValue={application?.email ?? auth.userProfile?.email ?? ""}
              placeholder="Signed-in email"
            />
            <Field
              label="Mobile number"
              name="phone"
              type="tel"
              required
              defaultValue={application?.phone ?? normalizeIndianPhone(auth.userProfile?.phone) ?? ""}
              placeholder="9876543210"
            />
            <Field
              label="Alternate mobile"
              name="alternatePhone"
              type="tel"
              defaultValue={application?.alternatePhone ?? ""}
              placeholder="Optional alternate number"
            />
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <IconTile>
              <Bike className="h-5 w-5" aria-hidden="true" />
            </IconTile>
            <SectionHeading
              title="Vehicle and verification"
              description="Admin will verify these details before approving delivery assignments."
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-bold text-[#1F2933]">Vehicle type</span>
              <select
                name="vehicleType"
                required
                defaultValue={application?.vehicleType ?? "Bike"}
                className={inputClassName}
              >
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Vehicle number"
              name="vehicleNumber"
              required
              defaultValue={application?.vehicleNumber ?? ""}
              placeholder="TN 30 AB 1234"
            />
            <Field
              label="Driving license number"
              name="drivingLicenseNumber"
              defaultValue={application?.drivingLicenseNumber ?? ""}
              placeholder="Optional for review"
            />
            <Field
              label="Preferred service radius"
              name="serviceRadiusKm"
              type="number"
              min="1"
              max="500"
              defaultValue={application?.serviceRadiusKm ? String(application.serviceRadiusKm) : "5"}
              placeholder="5"
            />
            <label className="space-y-2 md:col-span-2">
              <span className="block text-sm font-bold text-[#1F2933]">Delivery experience</span>
              <textarea
                name="experienceSummary"
                rows={3}
                defaultValue={application?.experienceSummary ?? ""}
                className={textareaClassName}
                placeholder="Previous delivery experience, known routes, vehicle capacity"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <IconTile>
              <MapPinned className="h-5 w-5" aria-hidden="true" />
            </IconTile>
            <SectionHeading
              title="Address and service area"
              description="Coordinates and pincode/local area help admin assign nearby local deliveries correctly."
            />
          </div>
          <div className="mt-5 grid gap-4">
            <Field
              label="Address line 1"
              name="line1"
              required
              defaultValue={application?.addressLine1 ?? ""}
              placeholder="House number, street"
            />
            <Field
              label="Address line 2"
              name="line2"
              defaultValue={application?.addressLine2 ?? ""}
              placeholder="Landmark, floor, or area note"
            />
            <LocationFields
              defaultValue={
                application
                  ? {
                      country: application.country,
                      countryCode: application.serviceCountryCode,
                      state: application.state,
                      stateCode: application.serviceStateCode,
                      city: application.city,
                      cityCode: application.serviceCityCode,
                      area: application.area,
                      localAreaCode: application.serviceLocalAreaCodes[0],
                      pincode: application.pincode,
                    }
                  : { countryCode: "IN" }
              }
              inputClassName={inputClassName}
            />
            <MapLocationPicker
              authHeaders={auth.authHeaders}
              defaultValue={{
                latitude: application?.latitude,
                longitude: application?.longitude,
                locationSource: application?.locationSource,
                accuracyMeters: application?.accuracyMeters,
                locationConfidenceScore: application?.locationConfidenceScore,
              }}
              radiusPreviewKm={application?.serviceRadiusKm ?? 5}
              inputClassName={inputClassName}
            />
            <label className="space-y-2">
              <span className="block text-sm font-bold text-[#1F2933]">Availability notes</span>
              <textarea
                name="availabilityNotes"
                rows={4}
                defaultValue={application?.availabilityNotes ?? ""}
                className={textareaClassName}
                placeholder="Preferred shift timing, routes, COD handling notes, weekly availability"
              />
            </label>
          </div>
        </section>

        {notice ? (
          <div className="rounded-md border border-[#D8E2EA] bg-white p-3">
            <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge>
          </div>
        ) : null}

        <div className="sticky bottom-3 z-10 flex justify-end">
          <Button type="submit" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {application?.status === "REJECTED"
              ? "Resubmit application"
              : application
                ? "Update application"
                : "Submit application"}
          </Button>
        </div>
      </form>

      <aside className="grid gap-4 self-start xl:sticky xl:top-8">
        <ChecklistCard application={application} />
      </aside>
    </div>
  );
}

function ApplicationStatusBanner({ application }: { application: DeliveryPartnerApplication | null }) {
  if (!application) {
    return (
      <StatePanel tone="info" title="New delivery partner application" icon={<Truck className="h-5 w-5" />}>
        <p className="text-sm font-semibold leading-6 text-[#536579]">
          Submit your service area, vehicle, and contact details. Admin approval is required before delivery orders
          can be assigned.
        </p>
      </StatePanel>
    );
  }

  const tone = statusTone(application.status);
  return (
    <StatePanel tone={tone} title={`Application ${humanize(application.status)}`} icon={<ShieldCheck className="h-5 w-5" />}>
      <div className="grid gap-2 text-sm font-semibold leading-6 text-[#536579]">
        <p>Submitted on {formatDate(application.createdAt)}. Last updated {formatDate(application.updatedAt)}.</p>
        {application.reviewNote ? <p>Review note: {application.reviewNote}</p> : null}
        {application.status === "PENDING_REVIEW" ? (
          <p>You can update details while admin review is pending.</p>
        ) : null}
      </div>
    </StatePanel>
  );
}

function ChecklistCard({ application }: { application: DeliveryPartnerApplication | null }) {
  const items = [
    { label: "Signed-in account", complete: true },
    { label: "Contact details", complete: Boolean(application?.phone) },
    { label: "Vehicle details", complete: Boolean(application?.vehicleType && application.vehicleNumber) },
    { label: "Service area", complete: Boolean(application?.pincode || application?.serviceCityCode) },
    { label: "Admin approval", complete: application?.status === "APPROVED" },
  ];
  const progress = Math.round((items.filter((item) => item.complete).length / items.length) * 100);

  return (
    <section className="rounded-lg border border-[#FFE0D6] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">Application readiness</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Admin approval unlocks delivery assignments.
          </p>
        </div>
        <StatusBadge tone={progress === 100 ? "success" : "info"}>{progress}%</StatusBadge>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 text-sm font-semibold text-[#536579]">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full",
                item.complete ? "bg-[#ECFDF3] text-[#0F8A5F]" : "bg-[#FFF0EC] text-[#ED3500]",
              )}
            >
              {item.complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function DeliveryPartnerSignInGate({
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
      <StatePanel tone="danger" title="Account session failed" icon={<RefreshCw className="h-5 w-5" />}>
        <p className="text-sm font-semibold leading-6 text-[#8A1F1F]">
          {error ?? "Unable to prepare your account session."}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </StatePanel>
    );
  }

  if (status !== "signed-out") {
    return <LoadingPanel />;
  }

  return (
    <StatePanel tone="warning" title="Sign in to apply" icon={<LogIn className="h-5 w-5" />}>
      <p className="max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
        Create or use your 1HandIndia account. After approval, this same account opens the delivery partner
        workspace.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/sign-in?redirect_url=/delivery/register">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up?redirect_url=/delivery/register">Create account</Link>
        </Button>
      </div>
    </StatePanel>
  );
}

function LoadingPanel() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-5 text-sm font-semibold text-[#667085] shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin text-[#ED3500]" aria-hidden="true" />
      Preparing delivery partner application
    </div>
  );
}

function StatePanel({
  tone,
  title,
  icon,
  children,
}: {
  tone: StatusTone;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-white p-5 shadow-sm",
        tone === "danger" && "border-[#F5B7B7] bg-[#FDECEC]",
        tone === "warning" && "border-[#FFD8A8] bg-[#FFF7E8]",
        tone === "success" && "border-[#BFEAD9] bg-[#F3FBF7]",
        tone === "info" && "border-[#C5D8E8] bg-white",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white text-[#ED3500] shadow-sm">
            {icon}
          </span>
          <div>
            <StatusBadge tone={tone}>{title}</StatusBadge>
            <div className="mt-3 grid gap-3">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
      {children}
    </span>
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
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null | undefined;
  readOnly?: boolean;
  min?: string;
  max?: string;
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
        min={min}
        max={max}
        className={inputClassName}
      />
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] read-only:bg-[#F8FAFC] read-only:text-[#667085]";
const textareaClassName =
  "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500]";

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? value : undefined;
}

function optionalNumberValue(form: FormData, name: string) {
  const value = optionalFormValue(form, name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalNormalizedPhone(form: FormData, name: string) {
  const value = optionalFormValue(form, name);
  return value ? normalizeIndianPhone(value) : undefined;
}

function normalizeIndianPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(normalized) ? normalized : "";
}

function statusTone(status: string): StatusTone {
  if (status === "APPROVED") {
    return "success";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  return "warning";
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
