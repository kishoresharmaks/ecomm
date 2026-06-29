"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareWarning, Search, Star, Wrench, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { AccountShell } from "./account-shell";
import { EmptyState, ErrorPanel, PagePanel, SkeletonBlock, StatusPill, formatDateTime, formValue, optionalFormValue } from "./account-ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  acceptCustomerServiceQuote,
  confirmCustomerServiceCompletion,
  createCustomerServiceReview,
  getCustomerServiceBooking,
  listCustomerServiceBookings,
  raiseCustomerServiceDispute,
  rejectCustomerServiceQuote,
  type ServiceBooking,
  type ServiceQuote,
} from "@/lib/service-marketplace-api";
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

  return (
    <AccountShell title="Service bookings" description="Track service requests, quotes, provider updates, disputes, and reviews.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <PagePanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading title="Booking history" description="Open a service booking to manage quotes, completion, dispute, and review actions." />
          <form onSubmit={submit} className="flex w-full gap-2 lg:max-w-md">
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

        <div className="mt-5 grid gap-3">
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

          {filteredBookings.map((booking) => (
            <ServiceBookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      </PagePanel>
    </AccountShell>
  );
}

export function ServiceBookingDetailClient({ bookingNumber }: { bookingNumber: string }) {
  const customerAuth = useCustomerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger" | "warning">("success");

  const bookingQuery = useQuery({
    queryKey: ["customer-service-booking", customerAuth.authKey, bookingNumber],
    queryFn: () => getCustomerServiceBooking(customerAuth.authHeaders, bookingNumber),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, form }: { action: "acceptQuote" | "rejectQuote" | "confirmCompletion" | "dispute" | "review"; form?: FormData }): Promise<unknown> => {
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
        const rawEvidence = optionalFormValue(form ?? new FormData(), "evidence");
        const reason = description ? `${selectedReason} - ${description}` : selectedReason;
        const payload: { reason: string; evidence?: string[] } = { reason };
        const evidence = rawEvidence?.split(",").map((item) => item.trim()).filter(Boolean);
        if (evidence?.length) {
          payload.evidence = evidence;
        }
        return raiseCustomerServiceDispute(customerAuth.authHeaders, bookingNumber, payload);
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

  const booking = bookingQuery.data;
  const activeQuote = booking?.quotes?.find((quote) => quote.status === "SENT") ?? null;
  const latestDispute = booking?.disputes?.[0] ?? null;
  const latestReview = booking?.reviews?.[0] ?? null;

  return (
    <AccountShell title="Service booking detail" description={`Track service booking ${bookingNumber}.`}>
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="mb-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/service-bookings">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to service bookings
          </Link>
        </Button>
      </div>

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
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={booking.status} />
                  <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
                  <StatusBadge tone="neutral">{booking.paymentMode.replace(/_/g, " ")}</StatusBadge>
                </div>
                <h2 className="mt-3 text-2xl font-black text-[#123A5A]">{booking.bookingNumber}</h2>
                <p className="mt-2 text-sm font-semibold text-[#667085]">
                  Created {formatDateTime(booking.createdAt)} by {booking.seller.storeName}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/services/${booking.listing.slug}`}>View service</Link>
              </Button>
            </div>
          </PagePanel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4">
              <PagePanel>
                <SectionHeading title={booking.listing.title} description="Service summary and customer issue." />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Info label="Package" value={booking.package?.name ?? "Provider recommended"} />
                  <Info label="Scheduled" value={formatDateTime(booking.scheduledStartAt)} />
                  <Info label="Total" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
                </div>
                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm leading-6 text-[#667085]">
                  <p className="font-black text-[#1F2933]">Issue details</p>
                  <p className="mt-2">{booking.customerIssue}</p>
                  {booking.customerNote ? <p className="mt-2">Note: {booking.customerNote}</p> : null}
                  {booking.providerNote ? <p className="mt-2">Provider note: {booking.providerNote}</p> : null}
                </div>
              </PagePanel>

              <PagePanel>
                <SectionHeading title="Quote and payment" description="Provider quote, payable amount, and recorded service payments." />
                <div className="mt-5 grid gap-3">
                  {booking.quotes?.length ? booking.quotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />) : <Info label="Quote" value="No quote sent yet" />}
                  {booking.payments?.length ? booking.payments.map((payment) => (
                    <div key={payment.id} className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-[#1F2933]">{payment.purpose.replace(/_/g, " ")}</p>
                        <p className="mt-1 text-xs font-semibold text-[#667085]">{payment.referenceNumber ?? formatDateTime(payment.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={payment.status} />
                        <span className="font-black text-[#163B5C]">{formatMoney(payment.amountPaise, payment.currency)}</span>
                      </div>
                    </div>
                  )) : <Info label="Payments" value="No payment records yet" />}
                </div>
              </PagePanel>

              {latestDispute ? (
                <PagePanel>
                  <SectionHeading title="Dispute" description="Latest dispute raised for this service booking." />
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#667085]">{latestDispute.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill status={latestDispute.resolution ?? "OPEN"} />
                    <span className="text-sm font-bold text-[#667085]">{formatDateTime(latestDispute.createdAt)}</span>
                  </div>
                </PagePanel>
              ) : null}

              {latestReview ? (
                <PagePanel>
                  <SectionHeading title="Review" description="Your submitted review for this service." />
                  <p className="mt-4 text-sm font-black text-[#123A5A]">{latestReview.rating}/5 stars</p>
                  {latestReview.body ? <p className="mt-2 text-sm leading-6 text-[#667085]">{latestReview.body}</p> : null}
                </PagePanel>
              ) : null}
            </div>

            <CustomerServiceActions
              booking={booking}
              activeQuote={activeQuote}
              pending={actionMutation.isPending}
              onAction={(action, form) => actionMutation.mutate(form ? { action, form } : { action })}
            />
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
            {formatDateTime(booking.createdAt)} - {booking.seller.storeName}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <StatusPill status={booking.status} />
        <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
        <span className="text-base font-black text-[#163B5C]">{formatMoney(booking.totalPayablePaise, booking.currency)}</span>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
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
    default:
      return "Service booking updated.";
  }
}
