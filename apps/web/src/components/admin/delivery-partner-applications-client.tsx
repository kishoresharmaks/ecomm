"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  CheckCircle2,
  Loader2,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button, SectionHeading, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  decideAdminDeliveryPartnerApplication,
  listAdminDeliveryPartnerApplications,
  type DeliveryPartnerApplication,
  type DeliveryPartnerApplicationStatus,
} from "@/lib/delivery-partner-application-api";

const statuses: Array<{ value: "" | DeliveryPartnerApplicationStatus; label: string }> = [
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "", label: "All statuses" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

type ReviewState = {
  applicationId: string;
  decision: "APPROVE" | "REJECT";
};

export function DeliveryPartnerApplicationsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"" | DeliveryPartnerApplicationStatus>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [notice, setNotice] = useState<{ tone: StatusTone; message: string } | null>(null);
  const queryKey = useMemo(
    () => ["admin-delivery-partner-applications", status, submittedSearch],
    [status, submittedSearch],
  );
  const applicationsQuery = useQuery({
    queryKey,
    queryFn: () =>
      listAdminDeliveryPartnerApplications(auth.authHeaders, {
        ...(status ? { status } : {}),
        ...(submittedSearch ? { search: submittedSearch } : {}),
        limit: 50,
      }),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const decisionMutation = useMutation({
    mutationFn: ({
      applicationId,
      decision,
      note,
      priority,
      codCashLimitPaise,
    }: {
      applicationId: string;
      decision: "APPROVE" | "REJECT";
      note?: string;
      priority?: number;
      codCashLimitPaise?: number;
    }) => {
      const payload: {
        decision: "APPROVE" | "REJECT";
        note?: string;
        priority?: number;
        codCashLimitPaise?: number;
      } = { decision };

      if (note !== undefined) {
        payload.note = note;
      }
      if (priority !== undefined) {
        payload.priority = priority;
      }
      if (codCashLimitPaise !== undefined) {
        payload.codCashLimitPaise = codCashLimitPaise;
      }

      return decideAdminDeliveryPartnerApplication(auth.authHeaders, applicationId, payload);
    },
    onSuccess: (application) => {
      setNotice({
        tone: application.status === "APPROVED" ? "success" : "warning",
        message: `${application.fullName} marked ${humanize(application.status)}.`,
      });
      setReview(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-partner-applications"] });
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Application review failed.",
      });
    },
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const note = optionalFormValue(form, "note");
    const priority = review.decision === "APPROVE" ? optionalNumberValue(form, "priority") : undefined;
    const codLimitRupees = review.decision === "APPROVE" ? optionalNumberValue(form, "codCashLimitRupees") : undefined;
    decisionMutation.mutate({
      applicationId: review.applicationId,
      decision: review.decision,
      ...(note !== undefined ? { note } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(codLimitRupees !== undefined ? { codCashLimitPaise: Math.round(codLimitRupees * 100) } : {}),
    });
  }

  const items = applicationsQuery.data?.items ?? [];

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | DeliveryPartnerApplicationStatus)}
              className={inputClassName}
            >
              {statuses.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={submitSearch} className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Search</span>
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={inputClassName}
                placeholder="Name, phone, vehicle, city, pincode"
              />
              <Button type="submit" variant="outline">
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </div>
          </form>
          <Button type="button" variant="outline" onClick={() => void applicationsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </section>

      {notice ? (
        <div className="rounded-md border border-[#D8E2EA] bg-white p-3">
          <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge>
        </div>
      ) : null}

      {applicationsQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white p-5 text-sm font-black text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin text-[#ED3500]" aria-hidden="true" />
          Loading delivery partner applications
        </div>
      ) : null}

      {applicationsQuery.error ? (
        <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-5 text-sm font-semibold text-[#8A1F1F]">
          {applicationsQuery.error instanceof Error
            ? applicationsQuery.error.message
            : "Unable to load delivery partner applications."}
        </div>
      ) : null}

      {!applicationsQuery.isLoading && !items.length ? (
        <div className="rounded-lg border border-[#D8E2EA] bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[#ED3500]" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-[#1F2933]">No delivery partner applications</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            New applications submitted from `/delivery/register` will appear here.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4">
        {items.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            review={review}
            busy={decisionMutation.isPending}
            onReview={setReview}
            onSubmitReview={submitReview}
          />
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  review,
  busy,
  onReview,
  onSubmitReview,
}: {
  application: DeliveryPartnerApplication;
  review: ReviewState | null;
  busy: boolean;
  onReview: (review: ReviewState | null) => void;
  onSubmitReview: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isReviewing = review?.applicationId === application.id;
  const canReview = application.status === "PENDING_REVIEW";

  return (
    <article className="overflow-hidden rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[#1F2933]">{application.fullName}</h2>
            <StatusBadge tone={statusTone(application.status)}>{humanize(application.status)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{application.email}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Phone: {application.phone}</p>
          <p className="mt-1 text-xs font-bold text-[#98A2B3]">
            Submitted {formatDate(application.createdAt)}
          </p>
        </div>

        <InfoBlock
          icon={<Bike className="h-4 w-4" aria-hidden="true" />}
          title="Vehicle"
          lines={[
            application.vehicleType,
            application.vehicleNumber,
            application.drivingLicenseNumber ? `License: ${application.drivingLicenseNumber}` : "License not set",
          ]}
        />

        <InfoBlock
          icon={<MapPinned className="h-4 w-4" aria-hidden="true" />}
          title="Service area"
          lines={[
            [application.area, application.city, application.state, application.pincode].filter(Boolean).join(", "),
            application.servicePincodes.length
              ? `Pincodes: ${application.servicePincodes.join(", ")}`
              : "No pincode coverage",
            application.latitude !== null &&
            application.latitude !== undefined &&
            application.longitude !== null &&
            application.longitude !== undefined
              ? `Coordinates: ${application.latitude}, ${application.longitude}`
              : "Coordinates not set",
          ]}
        />

        {canReview ? (
          <div className="flex flex-wrap justify-end gap-2 xl:flex-col">
            <Button type="button" onClick={() => onReview({ applicationId: application.id, decision: "APPROVE" })}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onReview({ applicationId: application.id, decision: "REJECT" })}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="text-right text-xs font-bold text-[#667085]">
            {application.reviewedAt ? `Reviewed ${formatDate(application.reviewedAt)}` : "Reviewed"}
          </div>
        )}
      </div>

      {application.experienceSummary || application.availabilityNotes || application.reviewNote ? (
        <div className="grid gap-2 border-t border-[#E5E7EB] bg-[#F8FAFC] px-5 py-4 text-sm font-semibold leading-6 text-[#536579]">
          {application.experienceSummary ? <p>Experience: {application.experienceSummary}</p> : null}
          {application.availabilityNotes ? <p>Availability: {application.availabilityNotes}</p> : null}
          {application.reviewNote ? <p>Review note: {application.reviewNote}</p> : null}
        </div>
      ) : null}

      {isReviewing ? (
        <form onSubmit={onSubmitReview} className="border-t border-[#FFE0D6] bg-[#FFF8F5] p-5">
          <SectionHeading
            title={review.decision === "APPROVE" ? "Approve delivery partner" : "Reject application"}
            description={
              review.decision === "APPROVE"
                ? "Approval creates the delivery partner role and operational profile."
                : "Rejection keeps the user account unchanged and allows resubmission later."
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {review.decision === "APPROVE" ? (
              <>
                <Field name="priority" label="Assignment priority" defaultValue="100" />
                <Field name="codCashLimitRupees" label="COD cash limit (Rs)" defaultValue="" />
              </>
            ) : null}
            <label className={cn("grid gap-2", review.decision === "APPROVE" ? "md:col-span-1" : "md:col-span-3")}>
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Review note</span>
              <textarea
                name="note"
                rows={3}
                className="w-full rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                placeholder="Phone verified, vehicle checked, service area confirmed"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onReview(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {review.decision === "APPROVE" ? "Approve and activate" : "Reject application"}
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function InfoBlock({ icon, title, lines }: { icon: ReactNode; title: string; lines: string[] }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#667085]">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-[#ED3500]">{icon}</span>
        {title}
      </div>
      <div className="mt-3 grid gap-1 text-sm font-semibold text-[#536579]">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input name={name} defaultValue={defaultValue} className={inputClassName} />
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]";

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

function optionalFormValue(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
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
