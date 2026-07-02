"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Eye, Search, ShieldAlert, XCircle } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  adminApproveServiceRefund,
  adminCancelServiceBooking,
  adminInitiateServiceRefund,
  adminHideServiceReview,
  adminDecideServiceReceivableWaiver,
  adminListServiceBookings,
  adminListServiceReceivables,
  adminListServiceRefunds,
  adminListServiceReviews,
  adminListServices,
  adminRecordServicePayment,
  adminRecordManualServiceRefund,
  adminRestoreServiceReview,
  adminRequestServiceReceivableWaiver,
  adminResolveServiceDispute,
  adminResolveServiceReceivable,
  adminSetServiceReceivableOffsetPolicy,
  adminSettleServiceReceivable,
  adminUpdateServiceApproval,
  type ApprovalStatus,
  type ServiceCashDisputeResolution,
  type ServiceBooking,
  type ServiceDisputeResolution,
  type ServiceListing,
  type ServicePaymentPurpose,
  type ServiceReceivableOffsetPolicy,
  type ServiceRefundRequest,
  type ServiceReview,
  type ServiceSellerReceivable,
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
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [reviewRating, setReviewRating] = useState("ALL");
  const [reviewSearch, setReviewSearch] = useState("");
  const bookingsQuery = useQuery({
    queryKey: ["admin-service-bookings", adminAuth.token],
    queryFn: () => adminListServiceBookings(adminAuth.authHeaders, { limit: 60 }),
    enabled: adminAuth.isAuthenticated,
  });
  const receivablesQuery = useQuery({
    queryKey: ["admin-service-receivables", adminAuth.token],
    queryFn: () => adminListServiceReceivables(adminAuth.authHeaders, { limit: 30 }),
    enabled: adminAuth.isAuthenticated,
  });
  const refundsQuery = useQuery({
    queryKey: ["admin-service-refunds", adminAuth.token],
    queryFn: () => adminListServiceRefunds(adminAuth.authHeaders, { limit: 30 }),
    enabled: adminAuth.isAuthenticated,
  });
  const reviewsQuery = useQuery({
    queryKey: ["admin-service-reviews", adminAuth.token, reviewStatus, reviewRating, reviewSearch],
    queryFn: () =>
      adminListServiceReviews(adminAuth.authHeaders, {
        limit: 30,
        ...(reviewStatus !== "ALL" ? { status: reviewStatus } : {}),
        ...(reviewRating !== "ALL" ? { rating: Number(reviewRating) } : {}),
        ...(reviewSearch ? { search: reviewSearch } : {}),
      }),
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
      const refundAmount = optionalFormValue(form, "refundAmount");
      return adminResolveServiceDispute(adminAuth.authHeaders, booking.bookingNumber, disputeId, {
        resolution: formValue(form, "resolution") as ServiceDisputeResolution,
        adminNote: formValue(form, "adminNote"),
        ...(refundAmount ? { refundAmountPaise: rupeesToPaise(refundAmount) } : {}),
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-service-bookings"] }),
  });
  const receivableMutation = useMutation({
    mutationFn: async ({ receivable, action, form }: { receivable: ServiceSellerReceivable; action: string; form: FormData }) => {
      if (action === "resolve") {
        const acceptedCash = optionalFormValue(form, "acceptedCash");
        return adminResolveServiceReceivable(adminAuth.authHeaders, receivable.receivableNumber, {
          resolution: formValue(form, "resolution") as ServiceCashDisputeResolution,
          ...(acceptedCash ? { acceptedCashPaise: rupeesToPaise(acceptedCash) } : {}),
          note: formValue(form, "note"),
        });
      }
      if (action === "settle") {
        const referenceNumber = optionalFormValue(form, "referenceNumber");
        const note = optionalFormValue(form, "note");
        return adminSettleServiceReceivable(adminAuth.authHeaders, receivable.receivableNumber, {
          amountPaise: rupeesToPaise(formValue(form, "amount")),
          ...(referenceNumber ? { referenceNumber } : {}),
          ...(note ? { note } : {}),
        });
      }
      if (action === "waiver") {
        return adminRequestServiceReceivableWaiver(adminAuth.authHeaders, receivable.receivableNumber, {
          amountPaise: rupeesToPaise(formValue(form, "amount")),
          reason: formValue(form, "reason"),
        });
      }
      if (action === "waiverDecision") {
        const note = optionalFormValue(form, "note");
        return adminDecideServiceReceivableWaiver(adminAuth.authHeaders, receivable.receivableNumber, {
          decision: formValue(form, "decision") as "APPROVED" | "REJECTED",
          ...(note ? { note } : {}),
        });
      }
      const note = optionalFormValue(form, "note");
      return adminSetServiceReceivableOffsetPolicy(adminAuth.authHeaders, receivable.receivableNumber, {
        offsetPolicy: formValue(form, "offsetPolicy") as ServiceReceivableOffsetPolicy,
        ...(note ? { note } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-service-receivables"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-bookings"] });
    },
  });
  const refundMutation = useMutation({
    mutationFn: async ({ refund, action, form }: { refund: ServiceRefundRequest; action: string; form: FormData }) => {
      const note = optionalFormValue(form, "note");
      if (action === "approve") {
        return adminApproveServiceRefund(adminAuth.authHeaders, refund.refundNumber, note ? { note } : {});
      }
      if (action === "razorpay") {
        return adminInitiateServiceRefund(adminAuth.authHeaders, refund.refundNumber, {
          method: "RAZORPAY",
          ...(note ? { note } : {}),
        });
      }
      return adminRecordManualServiceRefund(adminAuth.authHeaders, refund.refundNumber, {
        method: formValue(form, "method") as "BANK_TRANSFER" | "UPI" | "MANUAL" | "COD_CASH",
        manualReference: formValue(form, "manualReference"),
        paidAt: new Date(formValue(form, "paidAt")).toISOString(),
        ...(note ? { note } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-service-refunds"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-bookings"] });
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ review, action }: { review: ServiceReview; action: "hide" | "restore" }) =>
      action === "hide"
        ? adminHideServiceReview(adminAuth.authHeaders, review.id)
        : adminRestoreServiceReview(adminAuth.authHeaders, review.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-service-reviews"] }),
  });

  const bookings = bookingsQuery.data?.items ?? [];
  const receivables = receivablesQuery.data?.items ?? [];
  const refunds = refundsQuery.data?.items ?? [];
  const reviews = reviewsQuery.data?.items ?? [];
  const disputed = bookings.filter((booking) => booking.status === "COMPLETION_DISPUTED").length;
  const completed = bookings.filter((booking) => booking.status === "COMPLETED").length;
  const openReceivablePaise = receivables.reduce((sum, item) => sum + receivableOutstanding(item), 0);
  const openRefundPaise = refunds.filter((refund) => !["SUCCESS", "CANCELLED"].includes(refund.status)).reduce((sum, item) => sum + item.amountPaise, 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="Service bookings" value={bookingsQuery.data?.total ?? 0} />
        <Metric label="Disputed" value={disputed} />
        <Metric label="Completed" value={completed} />
        <Metric label="Provider dues" value={formatMoney(openReceivablePaise, "INR")} />
        <Metric label="Refunds open" value={formatMoney(openRefundPaise, "INR")} />
      </div>
      {bookingsQuery.isLoading ? <Skeleton /> : null}
      {bookingsQuery.error ? <ErrorBox error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} /> : null}
      {receivablesQuery.error ? <ErrorBox error={receivablesQuery.error} onRetry={() => void receivablesQuery.refetch()} /> : null}
      {refundsQuery.error ? <ErrorBox error={refundsQuery.error} onRetry={() => void refundsQuery.refetch()} /> : null}
      {reviewsQuery.error ? <ErrorBox error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} /> : null}
      <AdminServiceReceivablesPanel
        receivables={receivables}
        pending={receivableMutation.isPending}
        onSubmit={(receivable, action, form) => receivableMutation.mutate({ receivable, action, form })}
      />
      <AdminServiceRefundsPanel
        refunds={refunds}
        pending={refundMutation.isPending}
        onSubmit={(refund, action, form) => refundMutation.mutate({ refund, action, form })}
      />
      <AdminServiceReviewsPanel
        reviews={reviews}
        total={reviewsQuery.data?.total ?? 0}
        status={reviewStatus}
        rating={reviewRating}
        search={reviewSearch}
        onStatusChange={setReviewStatus}
        onRatingChange={setReviewRating}
        onSearchChange={setReviewSearch}
        pending={reviewMutation.isPending}
        onSubmit={(review, action) => reviewMutation.mutate({ review, action })}
      />
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
                {booking.refundRequests?.length ? (
                  <div className="mt-4 rounded-lg border border-[#F0E4DE] bg-[#FFFCFB] p-3">
                    <p className="text-sm font-black text-[#123A5A]">Refund activity</p>
                    <div className="mt-2 grid gap-2">
                      {booking.refundRequests.map((refund) => (
                        <p key={refund.id} className="text-sm font-semibold text-[#667085]">
                          {refund.refundNumber} / {refund.status.replace(/_/g, " ")} / {formatMoney(refund.amountPaise, refund.currency)}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
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

function AdminServiceReceivablesPanel({
  receivables,
  pending,
  onSubmit,
}: {
  receivables: ServiceSellerReceivable[];
  pending: boolean;
  onSubmit: (receivable: ServiceSellerReceivable, action: string, form: FormData) => void;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#123A5A]">Provider cash receivables</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Cash collected by service providers is tracked here as platform dues. It is not seller payout money.
          </p>
        </div>
        <StatusBadge tone="info">{receivables.length} records</StatusBadge>
      </div>
      <div className="mt-4 grid gap-4">
        {receivables.map((receivable) => (
          <div key={receivable.id} className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge value={receivable.status} />
                  <StatusBadge tone="neutral">{receivable.offsetPolicy.replace(/_/g, " ")}</StatusBadge>
                </div>
                <p className="mt-2 text-base font-black text-[#123A5A]">{receivable.receivableNumber}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  {receivable.booking?.bookingNumber ?? "Service booking"} / {receivable.seller?.storeName ?? "Provider"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Outstanding</p>
                <p className="mt-1 text-xl font-black text-[#123A5A]">{formatMoney(receivableOutstanding(receivable), receivable.currency)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <Info label="Cash collected" value={formatMoney(receivable.grossCashCollectedPaise, receivable.currency)} />
              <Info label="Commission/GST" value={formatMoney(receivable.commissionPaise + receivable.gstOnCommissionPaise, receivable.currency)} />
              <Info label="Tax deductions" value={formatMoney(receivable.tdsPaise + receivable.tcsPaise, receivable.currency)} />
              <Info label="Settled/offset" value={formatMoney(receivable.settledPaise + receivable.offsetPaise + receivable.waivedPaise, receivable.currency)} />
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(receivable, "resolve", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Resolve cash status</p>
                <select name="resolution" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                  <option value="ADMIN_FORCE_CONFIRMED">Force confirm full cash</option>
                  <option value="PARTIALLY_ACCEPTED">Partially accept</option>
                  <option value="REJECTED">Reject cash record</option>
                  <option value="REOPENED_FOR_EVIDENCE">Reopen for evidence</option>
                </select>
                <input name="acceptedCash" type="number" min="0" step="0.01" placeholder="Accepted cash INR for partial only" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <textarea name="note" required minLength={5} rows={2} placeholder="Resolution note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
                <Button type="submit" size="sm" disabled={pending}>Resolve</Button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(receivable, "settle", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Settle receivable</p>
                <input name="amount" type="number" min="0" step="0.01" placeholder="Amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <input name="referenceNumber" placeholder="UPI/bank/reference" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <input name="note" placeholder="Settlement note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>Record settlement</Button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(receivable, "policy", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Payout offset policy</p>
                <select name="offsetPolicy" defaultValue={receivable.offsetPolicy} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                  <option value="MANUAL_ONLY">Manual only</option>
                  <option value="AUTO_OFFSET_NEXT_PAYOUT">Auto offset next payout</option>
                  <option value="HOLD_PAYOUT_UNTIL_SETTLED">Hold payout until settled</option>
                </select>
                <input name="note" placeholder="Policy note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>Save policy</Button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(receivable, receivable.waiverApprovalStatus === "PENDING" ? "waiverDecision" : "waiver", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Waiver control</p>
                {receivable.waiverApprovalStatus === "PENDING" ? (
                  <select name="decision" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                    <option value="APPROVED">Approve waiver</option>
                    <option value="REJECTED">Reject waiver</option>
                  </select>
                ) : (
                  <>
                    <input name="amount" type="number" min="0" step="0.01" placeholder="Waiver amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                    <input name="reason" required minLength={5} placeholder="Waiver reason" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                  </>
                )}
                <input name="note" placeholder="Decision note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  {receivable.waiverApprovalStatus === "PENDING" ? "Save decision" : "Request waiver"}
                </Button>
              </form>
            </div>
          </div>
        ))}
        {!receivables.length ? <p className="rounded-md bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">No provider cash receivables yet.</p> : null}
      </div>
    </Panel>
  );
}

function AdminServiceRefundsPanel({
  refunds,
  pending,
  onSubmit,
}: {
  refunds: ServiceRefundRequest[];
  pending: boolean;
  onSubmit: (refund: ServiceRefundRequest, action: string, form: FormData) => void;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#123A5A]">Service refunds</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Cancellation and dispute refunds are approved here, then processed through Razorpay or recorded manually.
          </p>
        </div>
        <StatusBadge tone="warning">{refunds.filter((refund) => !["SUCCESS", "CANCELLED"].includes(refund.status)).length} open</StatusBadge>
      </div>
      <div className="mt-4 grid gap-4">
        {refunds.map((refund) => (
          <div key={refund.id} className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge value={refund.status} />
                  <StatusBadge tone="neutral">{refund.reason.replace(/_/g, " ")}</StatusBadge>
                </div>
                <p className="mt-2 text-base font-black text-[#123A5A]">{refund.refundNumber}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  {refund.booking?.bookingNumber ?? "Service booking"} / {refund.booking?.listing?.title ?? "Service"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Refund amount</p>
                <p className="mt-1 text-xl font-black text-[#123A5A]">{formatMoney(refund.amountPaise, refund.currency)}</p>
              </div>
            </div>
            {refund.transactions?.length ? (
              <div className="mt-3 rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Latest transaction</p>
                <p className="mt-1 text-sm font-semibold text-[#123A5A]">
                  {refund.transactions[0]?.method} / {refund.transactions[0]?.status} / {refund.transactions[0]?.providerRefundId ?? refund.transactions[0]?.manualReference ?? "No reference yet"}
                </p>
                {refund.transactions[0]?.failureReason ? <p className="mt-1 text-sm font-semibold text-[#8A1F1F]">{refund.transactions[0].failureReason}</p> : null}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(refund, "approve", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Approval</p>
                <input name="note" placeholder="Approval note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" disabled={pending || !["PENDING_REVIEW", "APPROVED"].includes(refund.status)}>Approve</Button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(refund, "razorpay", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Razorpay</p>
                <input name="note" placeholder="Provider refund note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" variant="outline" disabled={pending || !["PENDING_REVIEW", "APPROVED", "FAILED", "RETRY_PENDING"].includes(refund.status)}>Initiate</Button>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); onSubmit(refund, "manual", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-md bg-white p-3">
                <p className="text-sm font-black text-[#123A5A]">Manual record</p>
                <select name="method" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="MANUAL">Manual</option>
                  <option value="COD_CASH">Cash</option>
                </select>
                <input name="manualReference" required placeholder="Reference" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <input name="paidAt" required type="datetime-local" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <input name="note" placeholder="Manual note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="submit" size="sm" variant="outline" disabled={pending || !["PENDING_REVIEW", "APPROVED", "FAILED", "RETRY_PENDING"].includes(refund.status)}>Record paid</Button>
              </form>
            </div>
          </div>
        ))}
        {!refunds.length ? <p className="rounded-md bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">No service refund requests yet.</p> : null}
      </div>
    </Panel>
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

function AdminServiceReviewsPanel({
  reviews,
  total,
  status,
  rating,
  search,
  onStatusChange,
  onRatingChange,
  onSearchChange,
  pending,
  onSubmit,
}: {
  reviews: ServiceReview[];
  total: number;
  status: string;
  rating: string;
  search: string;
  onStatusChange: (value: string) => void;
  onRatingChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  pending: boolean;
  onSubmit: (review: ServiceReview, action: "hide" | "restore") => void;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#123A5A]">Service review moderation</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Hide policy-violating reviews or restore reviews after moderation review.
          </p>
        </div>
        <StatusBadge tone="info">{total} matched</StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px]">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search booking, service, customer, review"
          className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
        />
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
          <option value="ALL">All statuses</option>
          <option value="VISIBLE">Visible</option>
          <option value="HIDDEN">Hidden</option>
          <option value="REPLIED">Replied</option>
          <option value="UNREPLIED">Unreplied</option>
        </select>
        <select value={rating} onChange={(event) => onRatingChange(event.target.value)} className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
          <option value="ALL">All ratings</option>
          {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item}/5</option>)}
        </select>
      </div>
      <div className="mt-4 grid gap-3">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={review.isVisible === false ? "warning" : "success"}>{review.isVisible === false ? "Hidden" : "Visible"}</StatusBadge>
                  <span className="text-sm font-black text-[#ED3500]">{review.rating}/5 rating</span>
                </div>
                <p className="mt-2 text-sm font-black text-[#123A5A]">{review.listing?.title ?? "Service"} / {review.seller?.storeName ?? "Provider"}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#1F2933]">{review.body || "No written review."}</p>
                <p className="mt-2 text-xs font-semibold text-[#667085]">
                  {review.booking?.bookingNumber ?? "Booking"} / {review.customer?.displayName ?? review.customer?.user?.fullName ?? "Customer"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onSubmit(review, review.isVisible === false ? "restore" : "hide")}
              >
                {review.isVisible === false ? "Restore" : "Hide"}
              </Button>
            </div>
            {review.reply ? <p className="mt-3 rounded-md bg-white p-3 text-sm font-semibold text-[#667085]">Reply: {review.reply.body}</p> : null}
          </div>
        ))}
        {!reviews.length ? <p className="rounded-md bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">No service reviews yet.</p> : null}
      </div>
    </Panel>
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
        <option value="CANCEL_AFTER_DISPUTE">Cancel booking</option>
        <option value="REFUND_CUSTOMER">Refund customer</option>
        <option value="PARTIAL_REFUND">Partial refund</option>
      </select>
      <input name="refundAmount" type="number" min="0" step="0.01" placeholder="Partial refund amount INR" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
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

function receivableOutstanding(receivable: {
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
