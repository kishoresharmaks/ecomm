"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Eye, Search, ShieldAlert, XCircle } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  adminCancelServiceBooking,
  adminListServiceBookings,
  adminListServices,
  adminRecordServicePayment,
  adminResolveServiceDispute,
  adminUpdateServiceApproval,
  type ApprovalStatus,
  type ServiceBooking,
  type ServiceDisputeResolution,
  type ServiceListing,
  type ServicePaymentPurpose,
} from "@/lib/service-marketplace-api";
import { formatMoney } from "@/lib/storefront-api";
import { StorefrontImage } from "@/components/storefront/storefront-image";

type AdminServicesClientProps = {
  mode?: "services" | "bookings";
};

export function AdminServicesClient({ mode = "services" }: AdminServicesClientProps) {
  return mode === "bookings" ? <AdminServiceBookings /> : <AdminServiceApprovals />;
}

function AdminServiceApprovals() {
  const adminAuth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const servicesQuery = useQuery({
    queryKey: ["admin-services", submittedSearch, adminAuth.token],
    queryFn: () => adminListServices(adminAuth.authHeaders, { search: submittedSearch, limit: 50 }),
    enabled: adminAuth.isAuthenticated,
  });
  const approvalMutation = useMutation({
    mutationFn: ({ service, approvalStatus, note }: { service: ServiceListing; approvalStatus: ApprovalStatus; note?: string }) =>
      adminUpdateServiceApproval(adminAuth.authHeaders, service.id, {
        approvalStatus,
        status: approvalStatus === "APPROVED" ? "ACTIVE" : "INACTIVE",
        ...(note ? { note } : {}),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
  });

  const services = servicesQuery.data?.items ?? [];
  const pending = services.filter((service) => service.approvalStatus === "PENDING_APPROVAL").length;
  const live = services.filter((service) => service.status === "ACTIVE").length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total services" value={servicesQuery.data?.total ?? 0} />
        <Metric label="Pending review" value={pending} />
        <Metric label="Live services" value={live} />
      </div>
      <Panel>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search service title or provider"
            className="h-11 min-w-0 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
          />
          <Button type="submit" variant="outline"><Search className="h-4 w-4" /> Search</Button>
        </form>
      </Panel>
      {servicesQuery.isLoading ? <Skeleton /> : null}
      {servicesQuery.error ? <ErrorBox error={servicesQuery.error} onRetry={() => void servicesQuery.refetch()} /> : null}
      <div className="grid gap-4">
        {services.map((service) => (
          <Panel key={service.id} className="p-0">
            <div className="grid gap-4 p-4 lg:grid-cols-[130px_minmax(0,1fr)_auto] lg:items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[#D9E2EA] bg-[#F8FAFC]">
                <StorefrontImage src={service.images?.find((image) => image.isPrimary)?.url ?? service.images?.[0]?.url ?? ""} alt={service.title} sizes="160px" fallbackLabel={service.title} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge value={service.status} />
                  <Badge value={service.approvalStatus} />
                  <StatusBadge tone="info">{service.paymentMode.replace(/_/g, " ")}</StatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-black text-[#123A5A]">{service.title}</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{service.seller.storeName} · {service.category?.name ?? "Service category"}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">{service.description}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/services/${service.slug}`}><Eye className="h-4 w-4" /> View</Link>
                </Button>
                <Button type="button" size="sm" onClick={() => approvalMutation.mutate({ service, approvalStatus: "APPROVED", note: "Approved from admin service queue." })} disabled={approvalMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => approvalMutation.mutate({ service, approvalStatus: "REJECTED", note: "Rejected from admin service queue." })} disabled={approvalMutation.isPending}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function AdminServiceBookings() {
  const adminAuth = useAdminAuth();
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["admin-service-bookings", adminAuth.token],
    queryFn: () => adminListServiceBookings(adminAuth.authHeaders, { limit: 60 }),
    enabled: adminAuth.isAuthenticated,
  });
  const actionMutation = useMutation({
    mutationFn: async ({ booking, action, form }: { booking: ServiceBooking; action: string; form: FormData }) => {
      if (action === "payment") {
        const payload: {
          provider: "MANUAL";
          purpose: ServicePaymentPurpose;
          amountPaise: number;
          referenceNumber?: string;
          markPaid: true;
        } = {
          provider: "MANUAL",
          purpose: formValue(form, "purpose") as ServicePaymentPurpose,
          amountPaise: rupeesToPaise(formValue(form, "amount")),
          markPaid: true,
        };
        const referenceNumber = optionalFormValue(form, "referenceNumber");
        if (referenceNumber) {
          payload.referenceNumber = referenceNumber;
        }
        return adminRecordServicePayment(adminAuth.authHeaders, booking.bookingNumber, payload);
      }
      if (action === "cancel") {
        return adminCancelServiceBooking(adminAuth.authHeaders, booking.bookingNumber, formValue(form, "reason"));
      }
      const disputeId = formValue(form, "disputeId");
      return adminResolveServiceDispute(adminAuth.authHeaders, booking.bookingNumber, disputeId, {
        resolution: formValue(form, "resolution") as ServiceDisputeResolution,
        adminNote: formValue(form, "adminNote"),
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-service-bookings"] }),
  });

  const bookings = bookingsQuery.data?.items ?? [];
  const disputed = bookings.filter((booking) => booking.status === "COMPLETION_DISPUTED").length;
  const completed = bookings.filter((booking) => booking.status === "COMPLETED").length;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Service bookings" value={bookingsQuery.data?.total ?? 0} />
        <Metric label="Disputed" value={disputed} />
        <Metric label="Completed" value={completed} />
      </div>
      {bookingsQuery.isLoading ? <Skeleton /> : null}
      {bookingsQuery.error ? <ErrorBox error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} /> : null}
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Panel key={booking.id}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge value={booking.status} />
                  <StatusBadge tone="info">{booking.paymentMode.replace(/_/g, " ")}</StatusBadge>
                </div>
                <h2 className="mt-3 text-lg font-black text-[#123A5A]">{booking.bookingNumber}</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{booking.listing.title} · {booking.seller.storeName}</p>
                <p className="mt-3 text-sm leading-6 text-[#667085]">{booking.customerIssue}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Info label="Payable" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
                  <Info label="Paid" value={formatMoney(booking.paidAmountPaise, booking.currency)} />
                  <Info label="Settlement" value={booking.settlement ? formatMoney(booking.settlement.netPayablePaise, booking.currency) : "Not eligible"} />
                  <Info label="Customer" value={booking.customer?.displayName ?? booking.customer?.user?.email ?? "Customer"} />
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
                <AdminBookingPaymentForm booking={booking} pending={actionMutation.isPending} onSubmit={(form) => actionMutation.mutate({ booking, action: "payment", form })} />
                <AdminBookingCancelForm booking={booking} pending={actionMutation.isPending} onSubmit={(form) => actionMutation.mutate({ booking, action: "cancel", form })} />
                {booking.disputes?.filter((dispute) => !dispute.resolvedAt).map((dispute) => (
                  <AdminDisputeForm key={dispute.id} disputeId={dispute.id} pending={actionMutation.isPending} onSubmit={(form) => actionMutation.mutate({ booking, action: "dispute", form })} />
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function AdminBookingPaymentForm({ pending, onSubmit }: { booking: ServiceBooking; pending: boolean; onSubmit: (form: FormData) => void }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }} className="grid gap-2">
      <p className="flex items-center gap-2 text-sm font-black text-[#123A5A]"><CreditCard className="h-4 w-4" /> Record service payment</p>
      <select name="purpose" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
        <option value="FULL_PAYMENT">Full payment</option>
        <option value="ADVANCE_PAYMENT">Advance payment</option>
        <option value="INSPECTION_FEE">Inspection fee</option>
        <option value="FINAL_QUOTE">Final quote</option>
        <option value="PAY_AT_VISIT">Pay at visit</option>
      </select>
      <input name="amount" type="number" min="0" step="0.01" placeholder="Amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
      <input name="referenceNumber" placeholder="Reference" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Record paid</Button>
    </form>
  );
}

function AdminBookingCancelForm({ pending, onSubmit }: { booking: ServiceBooking; pending: boolean; onSubmit: (form: FormData) => void }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }} className="grid gap-2 border-t border-[#D9E2EA] pt-3">
      <p className="text-sm font-black text-[#123A5A]">Cancel booking</p>
      <input name="reason" required minLength={5} placeholder="Cancellation reason" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Cancel with audit</Button>
    </form>
  );
}

function AdminDisputeForm({ disputeId, pending, onSubmit }: { disputeId: string; pending: boolean; onSubmit: (form: FormData) => void }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }} className="grid gap-2 border-t border-[#D9E2EA] pt-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <p className="flex items-center gap-2 text-sm font-black text-[#8A1F1F]"><ShieldAlert className="h-4 w-4" /> Resolve dispute</p>
      <select name="resolution" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
        <option value="COMPLETE_BOOKING">Complete booking</option>
        <option value="RELEASE_TO_PROVIDER">Release to provider</option>
        <option value="CANCEL_BOOKING">Cancel booking</option>
        <option value="REFUND_CUSTOMER">Refund customer</option>
      </select>
      <textarea name="adminNote" required minLength={5} rows={3} placeholder="Admin resolution note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
      <Button type="submit" size="sm" disabled={pending}>Resolve dispute</Button>
    </form>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel>
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#123A5A]">{value}</p>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#123A5A]">{value}</p>
    </div>
  );
}

function Badge({ value }: { value?: string | null }) {
  const danger = ["REJECTED", "CANCELLED", "CANCELLED_AFTER_DISPUTE", "ARCHIVED"].includes(value ?? "");
  const success = ["APPROVED", "ACTIVE", "COMPLETED"].includes(value ?? "");
  return <StatusBadge tone={danger ? "danger" : success ? "success" : "warning"}>{(value ?? "pending").replace(/_/g, " ")}</StatusBadge>;
}

function Skeleton() {
  return <div className="h-72 animate-pulse rounded-lg bg-white" />;
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Panel className="border-[#F5B7B7] bg-[#FDECEC]">
      <div className="flex flex-col gap-3 text-sm font-bold text-[#8A1F1F] sm:flex-row sm:items-center sm:justify-between">
        <span>{error instanceof Error ? error.message : "Unable to load service data."}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    </Panel>
  );
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value || undefined;
}

function rupeesToPaise(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}
