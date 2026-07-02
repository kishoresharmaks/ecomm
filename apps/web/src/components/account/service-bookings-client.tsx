"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gauge,
  Loader2,
  MessageSquareWarning,
  Search,
  Star,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { AccountShell } from "./account-shell";
import {
  AccountMetric,
  EmptyState,
  ErrorPanel,
  PagePanel,
  SkeletonBlock,
  StatusPill,
  formatDateTime,
  formValue,
  optionalFormValue,
} from "./account-ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  acceptCustomerServiceQuote,
  confirmCustomerServiceCashCollection,
  confirmCustomerServiceCompletion,
  createCustomerServiceReview,
  createCustomerServiceRazorpayOrder,
  disputeCustomerServiceCashCollection,
  getCustomerServiceBooking,
  listCustomerServiceBookings,
  raiseCustomerServiceDispute,
  rejectCustomerServiceQuote,
  verifyCustomerServiceRazorpayPayment,
  type ServiceBooking,
  type ServicePayment,
  type ServiceQuote,
} from "@/lib/service-marketplace-api";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { uploadSellerDocument } from "@/lib/seller-document-upload";
import { formatMoney } from "@/lib/storefront-api";

export function ServiceBookingsClient() {
  const customerAuth = useCustomerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["customer-service-bookings", customerAuth.authKey],
    queryFn: () => listCustomerServiceBookings(customerAuth.authHeaders, { limit: 50 }),
    enabled: customerAuth.enabled,
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const bookings = bookingsQuery.data?.items ?? [];
  const filteredBookings = submittedSearch
    ? bookings.filter((booking) =>
        [booking.bookingNumber, booking.listing.title, booking.status, booking.seller.storeName]
          .join(" ")
          .toLowerCase()
          .includes(submittedSearch.toLowerCase()),
      )
    : bookings;
  const awaitingActionCount = bookings.filter((booking) => ["QUOTE_SENT", "COMPLETION_SUBMITTED"].includes(booking.status)).length;
  const upcomingCount = bookings.filter((booking) => booking.scheduledStartAt && new Date(booking.scheduledStartAt).getTime() >= Date.now()).length;
  const completedCount = bookings.filter((booking) => booking.status === "COMPLETED").length;

  return (
    <AccountShell title="Service bookings" description="Track service requests, quotes, provider updates, disputes, and reviews.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="grid gap-4">
        <PagePanel>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <SectionHeading
                title="Booking history"
                description="Open a service booking to manage quotes, completion, dispute, and review actions."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AccountMetric label="Total bookings" value={bookings.length} note="Recent requests and older history" />
                <AccountMetric label="Awaiting action" value={awaitingActionCount} note="Quotes or completion confirmations" />
                <AccountMetric label="Upcoming" value={upcomingCount} note="Scheduled service visits ahead" />
                <AccountMetric label="Completed" value={completedCount} note="Closed bookings with review access" />
              </div>
            </div>

            <form onSubmit={submit} className="flex w-full gap-2 xl:max-w-md">
              <label className="relative flex-1">
                <span className="sr-only">Search service booking</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search booking or service"
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <Button type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </form>
          </div>
        </PagePanel>

        <div className="grid gap-3">
          {bookingsQuery.isLoading ? <SkeletonBlock className="h-72" /> : null}
          {bookingsQuery.error ? <ErrorPanel error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} /> : null}
          {!bookingsQuery.isLoading && filteredBookings.length === 0 ? (
            <EmptyState
              title="No service bookings found"
              message="Booked services will appear here with provider, schedule, quote, and completion status."
              action={
                <Button asChild>
                  <Link href="/services">Browse services</Link>
                </Button>
              }
            />
          ) : null}

          {filteredBookings.length ? (
            <div className="grid gap-3">
              {filteredBookings.map((booking) => (
                <ServiceBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </AccountShell>
  );
}

export function ServiceBookingDetailClient({ bookingNumber }: { bookingNumber: string }) {
  const customerAuth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger" | "warning">("success");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  const bookingQuery = useQuery({
    queryKey: ["customer-service-booking", customerAuth.authKey, bookingNumber],
    queryFn: () => getCustomerServiceBooking(customerAuth.authHeaders, bookingNumber),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      form,
      payment,
    }: {
      action: "acceptQuote" | "rejectQuote" | "confirmCompletion" | "dispute" | "review" | "confirmCash" | "disputeCash";
      form?: FormData;
      payment?: ServicePayment;
    }): Promise<unknown> => {
      if (action === "acceptQuote") {
        return acceptCustomerServiceQuote(customerAuth.authHeaders, bookingNumber);
      }
      if (action === "rejectQuote") {
        return rejectCustomerServiceQuote(customerAuth.authHeaders, bookingNumber);
      }
      if (action === "confirmCompletion") {
        return confirmCustomerServiceCompletion(customerAuth.authHeaders, bookingNumber);
      }
      if (action === "dispute") {
        const selectedReason = formValue(form ?? new FormData(), "reason");
        const description = optionalFormValue(form ?? new FormData(), "description");
        const workingForm = form ?? new FormData();
        const rawEvidence = optionalFormValue(workingForm, "evidence");
        const reason = description ? `${selectedReason} - ${description}` : selectedReason;
        const payload: { reason: string; evidence?: string[]; evidenceKeys?: string[] } = { reason };
        const evidence = rawEvidence?.split(",").map((item) => item.trim()).filter(Boolean);
        if (evidence?.length) {
          payload.evidence = evidence;
        }
        const evidenceFiles = workingForm.getAll("evidenceFiles").filter((item): item is File => item instanceof File && item.size > 0);
        if (evidenceFiles.length) {
          const uploaded = await Promise.all(
            evidenceFiles.slice(0, 8).map((file) =>
              uploadSellerDocument(customerAuth.authHeaders, file, "SERVICE_DISPUTE_EVIDENCE", {
                serviceBookingNumber: bookingNumber,
              }),
            ),
          );
          payload.evidenceKeys = uploaded.map((item) => item.fileUrl);
        }
        return raiseCustomerServiceDispute(customerAuth.authHeaders, bookingNumber, payload);
      }
      if (action === "confirmCash") {
        if (!payment) throw new Error("Cash payment record is required.");
        const note = form ? optionalFormValue(form, "note") : undefined;
        return confirmCustomerServiceCashCollection(
          customerAuth.authHeaders,
          bookingNumber,
          payment.id,
          note ? { note } : {},
        );
      }
      if (action === "disputeCash") {
        if (!payment) throw new Error("Cash payment record is required.");
        return disputeCustomerServiceCashCollection(customerAuth.authHeaders, bookingNumber, payment.id, {
          reason: formValue(form ?? new FormData(), "reason"),
        });
      }
      const rating = Number(formValue(form ?? new FormData(), "rating"));
      const body = optionalFormValue(form ?? new FormData(), "body");
      return createCustomerServiceReview(customerAuth.authHeaders, bookingNumber, body ? { rating, body } : { rating });
    },
    onSuccess: (_result, variables) => {
      setNoticeTone("success");
      setNotice(actionSuccessMessage(variables.action));
      void queryClient.invalidateQueries({ queryKey: ["customer-service-booking", customerAuth.authKey, bookingNumber] });
      void queryClient.invalidateQueries({ queryKey: ["customer-service-bookings", customerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Service booking action failed.");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (payment: ServicePayment) => {
      setActivePaymentId(payment.id);
      const providerOrder = await createCustomerServiceRazorpayOrder(
        customerAuth.authHeaders,
        bookingNumber,
        payment.id,
      );
      const checkoutResponse = await openRazorpayCheckout(
        providerOrder,
        `Service booking ${providerOrder.bookingNumber}`,
      );
      if (!checkoutResponse) {
        throw new Error("Payment was not completed. You can retry from this booking.");
      }
      return verifyCustomerServiceRazorpayPayment(customerAuth.authHeaders, bookingNumber, {
        razorpayOrderId: checkoutResponse.razorpay_order_id,
        razorpayPaymentId: checkoutResponse.razorpay_payment_id,
        razorpaySignature: checkoutResponse.razorpay_signature,
      });
    },
    onSuccess: (result) => {
      setNoticeTone(result.status === "PAID" ? "success" : "warning");
      setNotice(
        result.status === "PAID"
          ? "Service payment completed successfully."
          : "Razorpay payment is still pending. Refresh this booking after provider confirmation.",
      );
      setActivePaymentId(null);
      void queryClient.invalidateQueries({ queryKey: ["customer-service-booking", customerAuth.authKey, bookingNumber] });
      void queryClient.invalidateQueries({ queryKey: ["customer-service-bookings", customerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Service payment could not be completed.");
      setActivePaymentId(null);
      void queryClient.invalidateQueries({ queryKey: ["customer-service-booking", customerAuth.authKey, bookingNumber] });
    },
  });

  const booking = bookingQuery.data;
  const activeQuote = booking?.quotes?.find((quote) => quote.status === "SENT") ?? null;
  const latestDispute = booking?.disputes?.[0] ?? null;
  const latestReview = booking?.reviews?.[0] ?? null;
  const overviewSections = [
    { id: "booking-overview", label: "Overview" },
    { id: "booking-payment", label: "Quote & payment" },
    { id: "booking-actions", label: "Actions" },
    ...(latestDispute ? [{ id: "booking-dispute", label: "Dispute" }] : []),
    ...(latestReview ? [{ id: "booking-review", label: "Review" }] : []),
  ];
  const duePaise = booking ? Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise) : 0;

  return (
    <AccountShell title="Service booking detail" description={`Track service booking ${bookingNumber}.`}>
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      {bookingQuery.isLoading ? <SkeletonBlock /> : null}
      {bookingQuery.error ? <ErrorPanel error={bookingQuery.error} onRetry={() => void bookingQuery.refetch()} /> : null}
      {notice ? (
        <div className="mb-4">
          <StatusBadge tone={noticeTone}>{notice}</StatusBadge>
        </div>
      ) : null}

      {booking ? (
        <div className="grid gap-4">
          <PagePanel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="-ml-2">
                    <Link href="/account/service-bookings">
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Back to bookings
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={booking.status} />
                  <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
                  <StatusBadge tone="neutral">{booking.paymentMode.replace(/_/g, " ")}</StatusBadge>
                  <StatusBadge tone="neutral">{booking.cancellationPolicy.replace(/_/g, " ")}</StatusBadge>
                </div>
                <h2 className="mt-3 text-2xl font-black text-[#123A5A] md:text-3xl">{booking.bookingNumber}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
                  {booking.listing.title} by {booking.seller.storeName}. Created {formatDateTime(booking.createdAt)}.
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link href={`/services/${booking.listing.slug}`}>
                  View service
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AccountMetric label="Total payable" value={formatMoney(booking.totalPayablePaise, booking.currency)} note="Captured from the booking summary" />
              <AccountMetric label="Paid so far" value={formatMoney(booking.paidAmountPaise, booking.currency)} note="Recorded customer payments" />
              <AccountMetric label="Balance due" value={formatMoney(duePaise, booking.currency)} note="Pending amount on this booking" />
              <AccountMetric label="Schedule" value={formatDateTime(booking.scheduledStartAt)} note={booking.scheduledEndAt ? `Ends ${formatDateTime(booking.scheduledEndAt)}` : "No end time recorded"} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {overviewSections.map((section) => (
                <Button key={section.id} asChild variant="outline" size="sm">
                  <a href={`#${section.id}`}>{section.label}</a>
                </Button>
              ))}
            </div>
          </PagePanel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4">
              <PagePanel id="booking-overview" className="scroll-mt-24">
                <SectionHeading title="Overview" description="Service summary, customer issue, and booking context." />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Info label="Package" value={booking.package?.name ?? "Provider recommended"} />
                  <Info label="Technician" value={booking.assignedTechnician?.name ?? "Not assigned yet"} />
                  <Info label="Location" value={booking.visitMode.replace(/_/g, " ")} />
                </div>
                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm leading-6 text-[#667085]">
                  <p className="font-black text-[#1F2933]">Issue details</p>
                  <p className="mt-2">{booking.customerIssue}</p>
                  {booking.customerNote ? <p className="mt-2">Note: {booking.customerNote}</p> : null}
                  {booking.providerNote ? <p className="mt-2">Provider note: {booking.providerNote}</p> : null}
                  {booking.addressSnapshot ? <p className="mt-2">Service address is captured in the booking record.</p> : null}
                </div>
              </PagePanel>

              <PagePanel id="booking-payment" className="scroll-mt-24">
                <SectionHeading title="Quote & payment" description="Provider quote, payable amount, and recorded service payments." />
                <div className="mt-5 grid gap-3">
                  {booking.quotes?.length ? booking.quotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />) : <Info label="Quote" value="No quote sent yet" />}
                  <PaymentSummary booking={booking} />
                  {booking.payments?.length ? booking.payments.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      bookingNumber={booking.bookingNumber}
                      pending={paymentMutation.isPending && activePaymentId === payment.id}
                      disabled={paymentMutation.isPending || actionMutation.isPending}
                      onPay={() => paymentMutation.mutate(payment)}
                      onConfirmCash={(form) => {
                        actionMutation.mutate(
                          form ? { action: "confirmCash", payment, form } : { action: "confirmCash", payment },
                        );
                      }}
                      onDisputeCash={(form) => actionMutation.mutate({ action: "disputeCash", payment, form })}
                    />
                  )) : <Info label="Payments" value="No payment records yet" />}
                </div>
              </PagePanel>

              {latestDispute ? (
                <PagePanel id="booking-dispute" className="scroll-mt-24">
                  <SectionHeading title="Dispute" description="Latest dispute raised for this service booking." />
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#667085]">{latestDispute.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill status={latestDispute.resolution ?? "OPEN"} />
                    <span className="text-sm font-bold text-[#667085]">{formatDateTime(latestDispute.createdAt)}</span>
                  </div>
                </PagePanel>
              ) : null}

              {latestReview ? (
                <PagePanel id="booking-review" className="scroll-mt-24">
                  <SectionHeading title="Review" description="Your submitted review for this service." />
                  <p className="mt-4 text-sm font-black text-[#123A5A]">{latestReview.rating}/5 stars</p>
                  {latestReview.body ? <p className="mt-2 text-sm leading-6 text-[#667085]">{latestReview.body}</p> : null}
                </PagePanel>
              ) : null}
            </div>

            <div className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
              <PagePanel className="h-fit">
                <SectionHeading title="At a glance" description="Key booking context and current progress." />
                <div className="mt-5 grid gap-3">
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#667085]">
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      Current stage
                    </div>
                    <p className="mt-2 text-sm font-black text-[#1F2933]">{serviceBookingStageLabel(booking.status)}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">{serviceBookingStageNote(booking.status)}</p>
                  </div>

                  <Info label="Provider" value={booking.seller.storeName} />
                  <Info label="Payment mode" value={booking.paymentMode.replace(/_/g, " ")} />
                  <Info label="Visit mode" value={booking.visitMode.replace(/_/g, " ")} />
                  <Info label="Scheduled" value={formatDateTime(booking.scheduledStartAt)} />
                </div>
              </PagePanel>

              <div id="booking-actions" className="scroll-mt-24">
                <CustomerServiceActions
                  booking={booking}
                  activeQuote={activeQuote}
                  pending={actionMutation.isPending}
                  onAction={(action, form) => actionMutation.mutate(form ? { action, form } : { action })}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AccountShell>
  );
}

function ServiceBookingCard({ booking }: { booking: ServiceBooking }) {
  return (
    <Link
      href={`/account/service-bookings/${booking.bookingNumber}`}
      className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
          <Wrench className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-black text-[#1F2933]">{booking.bookingNumber}</p>
          <p className="mt-1 text-sm font-bold text-[#123A5A]">{booking.listing.title}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {formatDateTime(booking.createdAt)} · {booking.seller.storeName}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <StatusPill status={booking.status} />
        <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
        <span className="text-base font-black text-[#163B5C]">{formatMoney(booking.totalPayablePaise, booking.currency)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-[#ED3500]">
          Open
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function CustomerServiceActions({
  booking,
  activeQuote,
  pending,
  onAction,
}: {
  booking: ServiceBooking;
  activeQuote: ServiceQuote | null;
  pending: boolean;
  onAction: (action: "acceptQuote" | "rejectQuote" | "confirmCompletion" | "dispute" | "review", form?: FormData) => void;
}) {
  const canReview = booking.status === "COMPLETED" && !booking.reviews?.length;

  return (
    <PagePanel className="h-fit">
      <SectionHeading title="Customer actions" description="Available actions are based on the current booking status." />
      <div className="mt-5 grid gap-3">
        {booking.status === "QUOTE_SENT" && activeQuote ? (
          <div className="grid gap-2">
            <Button type="button" disabled={pending} onClick={() => onAction("acceptQuote")}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Accept quote
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onAction("rejectQuote")}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject quote
            </Button>
          </div>
        ) : null}

        {booking.status === "COMPLETION_SUBMITTED" ? (
          <>
            <Button type="button" disabled={pending} onClick={() => onAction("confirmCompletion")}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm completion
            </Button>
            <form onSubmit={(event) => { event.preventDefault(); onAction("dispute", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-lg border border-[#F0E4DE] bg-[#FFFCFB] p-3">
              <select name="reason" required className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
                <option value="Work not completed">Work not completed</option>
                <option value="Quality issue">Quality issue</option>
                <option value="Incorrect charge">Incorrect charge</option>
                <option value="Provider no-show">Provider no-show</option>
                <option value="Other">Other</option>
              </select>
              <textarea name="description" rows={3} placeholder="Describe the issue" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
              <input name="evidence" placeholder="Evidence URLs or references, comma-separated" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
              <input name="evidenceFiles" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold" />
              <Button type="submit" variant="outline" disabled={pending}>
                <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
                Raise dispute
              </Button>
            </form>
          </>
        ) : null}

        {canReview ? (
          <form onSubmit={(event) => { event.preventDefault(); onAction("review", new FormData(event.currentTarget)); }} className="grid gap-2 rounded-lg border border-[#F0E4DE] bg-[#FFFCFB] p-3">
            <select name="rating" required className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold">
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
            <textarea name="body" rows={3} placeholder="Tell us more (optional)" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
            <Button type="submit" disabled={pending}>
              <Star className="h-4 w-4" aria-hidden="true" />
              Submit review
            </Button>
          </form>
        ) : null}

        {!activeQuote && booking.status !== "COMPLETION_SUBMITTED" && !canReview ? (
          <p className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085]">
            No customer action is required right now. Provider updates, quotes, and completion requests will appear here.
          </p>
        ) : null}
      </div>
    </PagePanel>
  );
}

function QuoteRow({ quote }: { quote: ServiceQuote }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-[#1F2933]">{quote.quoteNumber}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">{quote.note ?? formatDateTime(quote.sentAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status={quote.status} />
        <span className="font-black text-[#163B5C]">{formatMoney(quote.totalPaise, quote.currency)}</span>
      </div>
    </div>
  );
}

function PaymentSummary({ booking }: { booking: ServiceBooking }) {
  const duePaise = Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise);
  const pendingOnlineCount = booking.payments?.filter((payment) => payment.provider === "RAZORPAY" && ["PENDING", "FAILED"].includes(payment.status)).length ?? 0;
  const refundPaise = booking.refundRequests
    ?.filter((refund) => !["FAILED", "CANCELLED"].includes(refund.status))
    .reduce((sum, refund) => sum + refund.amountPaise, 0) ?? 0;

  return (
    <div className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:grid-cols-4">
      <SummaryMetric label="Paid" value={formatMoney(booking.paidAmountPaise, booking.currency)} />
      <SummaryMetric label="Balance due" value={formatMoney(duePaise, booking.currency)} />
      <SummaryMetric label="Refunds" value={formatMoney(refundPaise, booking.currency)} />
      <SummaryMetric label="Online action" value={pendingOnlineCount ? `${pendingOnlineCount} Razorpay payment pending` : "No online payment pending"} />
    </div>
  );
}

function PaymentRow({
  payment,
  bookingNumber,
  pending,
  disabled,
  onPay,
  onConfirmCash,
  onDisputeCash,
}: {
  payment: ServicePayment;
  bookingNumber: string;
  pending: boolean;
  disabled: boolean;
  onPay: () => void;
  onConfirmCash: (form?: FormData) => void;
  onDisputeCash: (form: FormData) => void;
}) {
  const payableOnline = payment.provider === "RAZORPAY" && (payment.status === "PENDING" || payment.status === "FAILED");
  const providerCash = payment.collectionType === "PROVIDER_CASH";
  const cashAwaitingCustomer = providerCash && ["RECORDED", "REOPENED"].includes(payment.cashCollectionStatus ?? "");
  const providerReference = payment.providerPaymentId ?? payment.providerOrderId ?? payment.referenceNumber;
  const actionLabel = payment.status === "FAILED" ? "Retry payment" : "Pay now";

  return (
    <div className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-[#1F2933]">{payment.purpose.replace(/_/g, " ")}</p>
          <StatusBadge tone={payment.provider === "RAZORPAY" ? "info" : "neutral"}>{payment.provider.replace(/_/g, " ")}</StatusBadge>
        </div>
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          {providerReference ?? `Created ${formatDateTime(payment.createdAt)}`}
        </p>
        {payableOnline ? (
          <p className="mt-2 text-xs font-bold text-[#8A3A20]">
            Complete this online payment to keep service booking {bookingNumber} moving.
          </p>
        ) : providerCash ? (
          <p className="mt-2 text-xs font-bold text-[#667085]">
            Provider recorded cash collection. Confirm only if the amount was actually paid.
          </p>
        ) : payment.provider === "MANUAL" && payment.status === "PENDING" ? (
          <p className="mt-2 text-xs font-bold text-[#667085]">
            Pay-at-visit or offline payment will be updated by the provider or admin after collection.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <StatusPill status={payment.status} />
        <span className="font-black text-[#163B5C]">{formatMoney(payment.amountPaise, payment.currency)}</span>
        {payableOnline ? (
          <Button type="button" size="sm" disabled={disabled} onClick={onPay}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
            {pending ? "Opening" : actionLabel}
          </Button>
        ) : null}
      </div>
      {cashAwaitingCustomer ? (
        <div className="grid gap-2 rounded-lg border border-[#F0E4DE] bg-white p-3 sm:col-span-2">
          <Button type="button" size="sm" disabled={disabled} onClick={() => onConfirmCash()}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Confirm cash paid
          </Button>
          <form onSubmit={(event) => { event.preventDefault(); onDisputeCash(new FormData(event.currentTarget)); }} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input name="reason" required minLength={5} placeholder="Dispute reason" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" variant="outline" size="sm" disabled={disabled}>
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
              Dispute
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function serviceBookingStageLabel(status: ServiceBooking["status"]) {
  switch (status) {
    case "REQUESTED":
      return "Request received";
    case "ACCEPTED":
    case "QUOTE_SENT":
      return "Waiting for quote action";
    case "QUOTE_ACCEPTED":
    case "SCHEDULED":
      return "Scheduled for service";
    case "IN_PROGRESS":
      return "Service in progress";
    case "COMPLETION_SUBMITTED":
      return "Completion awaiting confirmation";
    case "COMPLETION_DISPUTED":
      return "Completion disputed";
    case "COMPLETED":
      return "Completed";
    case "QUOTE_REJECTED":
    case "QUOTE_EXPIRED":
    case "REJECTED":
    case "CANCELLED":
    case "CANCELLED_AFTER_DISPUTE":
    case "CLOSED_AFTER_INSPECTION":
      return "Closed";
    default:
      return "In progress";
  }
}

function serviceBookingStageNote(status: ServiceBooking["status"]) {
  switch (status) {
    case "REQUESTED":
      return "The provider has not responded yet.";
    case "ACCEPTED":
    case "QUOTE_SENT":
      return "Review the quote and decide the next step.";
    case "QUOTE_ACCEPTED":
    case "SCHEDULED":
      return "Keep this booking on your radar for the scheduled visit.";
    case "IN_PROGRESS":
      return "The provider is actively working on the service.";
    case "COMPLETION_SUBMITTED":
      return "Confirm completion once the service outcome looks right.";
    case "COMPLETION_DISPUTED":
      return "A dispute is open. Review updates and evidence together.";
    case "COMPLETED":
      return "The booking is closed and ready for review if you have not submitted one.";
    case "QUOTE_REJECTED":
    case "QUOTE_EXPIRED":
    case "REJECTED":
    case "CANCELLED":
    case "CANCELLED_AFTER_DISPUTE":
    case "CLOSED_AFTER_INSPECTION":
      return "This booking is no longer active.";
    default:
      return "Use the action panel on the right when the provider requests a response.";
  }
}

function actionSuccessMessage(action: string) {
  switch (action) {
    case "acceptQuote":
      return "Quote accepted.";
    case "rejectQuote":
      return "Quote rejected.";
    case "confirmCompletion":
      return "Completion confirmed.";
    case "dispute":
      return "Dispute raised.";
    case "review":
      return "Review submitted.";
    case "confirmCash":
      return "Cash collection confirmed.";
    case "disputeCash":
      return "Cash collection disputed.";
    default:
      return "Service booking updated.";
  }
}
