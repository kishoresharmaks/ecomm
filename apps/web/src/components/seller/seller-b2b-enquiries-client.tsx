"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, MessageSquareReply, MessageSquareText, Search, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerB2BEnquiry, listSellerB2BEnquiries, respondSellerB2BEnquiry } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formatDateTime,
  formValue,
  isSellerOnboardingRequiredError,
  optionalFormValue,
  rupeesToPaise,
  useSellerAuth
} from "./seller-ui";

const enquiryStatuses = ["", "SUBMITTED", "IN_REVIEW", "RESPONDED", "BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"];

export function SellerB2BEnquiriesClient() {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const enquiriesQuery = useQuery({
    queryKey: ["seller-b2b-enquiries", sellerAuth.authKey, submittedSearch, status],
    queryFn: () =>
      listSellerB2BEnquiries(sellerAuth.authHeaders, {
        search: submittedSearch,
        status,
        limit: 30
      }),
    enabled: sellerAuth.enabled,
    retry: false
  });

  const responseMutation = useMutation({
    mutationFn: ({ enquiryId, responseMessage, quotedPricePaise }: { enquiryId: string; responseMessage: string; quotedPricePaise?: number }) =>
      respondSellerB2BEnquiry(sellerAuth.authHeaders, enquiryId, {
        responseMessage,
        ...(quotedPricePaise !== undefined ? { quotedPricePaise } : {})
      }),
    onSuccess: () => {
      setNotice("B2B response added.");
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiries", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "B2B response failed.")
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function respond(event: FormEvent<HTMLFormElement>, enquiryId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quoted = optionalFormValue(form, "quotedPrice");
    setNotice(null);
    responseMutation.mutate({
      enquiryId,
      responseMessage: formValue(form, "responseMessage"),
      ...(quoted ? { quotedPricePaise: rupeesToPaise(quoted) } : {})
    });
    event.currentTarget.reset();
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (enquiriesQuery.error && isSellerOnboardingRequiredError(enquiriesQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before responding to B2B buyer enquiries." />;
  }

  const enquiries = enquiriesQuery.data?.items ?? [];

  return (
    <SellerPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title="B2B enquiries" description="Business-buyer product and store enquiries that need a manual response." />
        <form onSubmit={submitSearch} className="flex w-full gap-2 lg:max-w-md">
          <label className="relative flex-1">
            <span className="sr-only">Search B2B enquiries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search buyer, product, message"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[320px_1fr] lg:items-end">
        <SellerSelect label="Enquiry status" name="status" value={status} onChange={setStatus}>
          {enquiryStatuses.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replace(/_/g, " ") : "All enquiry statuses"}
            </option>
          ))}
        </SellerSelect>
        {notice ? <StatusBadge tone={responseMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}
      </div>

      <div className="mt-5 grid gap-4">
        {enquiriesQuery.isLoading ? <SellerSkeleton /> : null}
        {enquiriesQuery.error ? <SellerErrorPanel error={enquiriesQuery.error} onRetry={() => void enquiriesQuery.refetch()} /> : null}
        {!enquiriesQuery.isLoading && enquiries.length === 0 ? (
          <SellerEmptyState title="No B2B enquiries found" message="Buyer enquiries appear here after companies request product or store quotations." />
        ) : null}

        {enquiries.map((enquiry) => {
          const canRespond = ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(enquiry.status);

          return (
            <div key={enquiry.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                      <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="text-lg font-black text-[#1F2933]">{enquiry.businessBuyer?.companyName ?? "Business buyer"}</p>
                    <SellerStatusPill status={enquiry.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#667085]">
                    {enquiry.product?.name ?? "General seller enquiry"} - {enquiry.quantity ? `${enquiry.quantity} units` : "Quantity not specified"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#1F2933]">{enquiry.message}</p>
                  <p className="mt-2 text-xs font-semibold text-[#667085]">{formatDateTime(enquiry.createdAt)}</p>
                  <div className="mt-4 grid gap-2">
                    {(enquiry.responses ?? []).slice(0, 3).map((response) => (
                      <div key={response.id} className="rounded-md border border-[#E5E7EB] bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="info">{response.source ?? "response"}</StatusBadge>
                          {response.quotedPricePaise ? <StatusBadge tone="success">{formatMoney(response.quotedPricePaise)}</StatusBadge> : null}
                        </div>
                        <p className="mt-2 leading-6 text-[#1F2933]">{response.responseMessage}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {canRespond ? (
                  <form onSubmit={(event) => respond(event, enquiry.id)} className="grid gap-3 rounded-md border border-[#E5E7EB] bg-white p-4">
                    <SellerTextArea label="Seller response" name="responseMessage" required rows={4} placeholder="Share availability, lead time, and offer details." />
                    <SellerField label="Quoted unit price" name="quotedPrice" type="number" min={0} step="0.01" placeholder="450.00" />
                    <Button type="submit" disabled={responseMutation.isPending}>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {responseMutation.isPending ? "Sending..." : "Send response"}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-sm font-semibold leading-6 text-[#667085]">
                    Buyer confirmation or admin finalisation is already in progress. Further seller responses are locked for this enquiry.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SellerPanel>
  );
}

export function SellerB2BEnquiryDetailClient({ enquiryId }: { enquiryId: string }) {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const enquiryQuery = useQuery({
    queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId],
    queryFn: () => getSellerB2BEnquiry(sellerAuth.authHeaders, enquiryId),
    enabled: sellerAuth.enabled,
    retry: false
  });

  const responseMutation = useMutation({
    mutationFn: ({ responseMessage, quotedPricePaise }: { responseMessage: string; quotedPricePaise?: number }) =>
      respondSellerB2BEnquiry(sellerAuth.authHeaders, enquiryId, {
        responseMessage,
        ...(quotedPricePaise !== undefined ? { quotedPricePaise } : {})
      }),
    onSuccess: () => {
      setNotice("B2B response added.");
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiries", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "B2B response failed.")
  });

  function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quoted = optionalFormValue(form, "quotedPrice");
    setNotice(null);
    responseMutation.mutate({
      responseMessage: formValue(form, "responseMessage"),
      ...(quoted ? { quotedPricePaise: rupeesToPaise(quoted) } : {})
    });
    event.currentTarget.reset();
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (enquiryQuery.error && isSellerOnboardingRequiredError(enquiryQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before responding to B2B buyer enquiries." />;
  }

  const enquiry = enquiryQuery.data;
  const canRespond = enquiry ? ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(enquiry.status) : false;

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild variant="ghost">
          <Link href="/seller/b2b-enquiries">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to enquiries
          </Link>
        </Button>
      </div>

      {enquiryQuery.isLoading ? <SellerSkeleton /> : null}
      {enquiryQuery.error ? <SellerErrorPanel error={enquiryQuery.error} onRetry={() => void enquiryQuery.refetch()} /> : null}

      {notice ? <StatusBadge tone={responseMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}

      {enquiry ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SellerPanel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                    <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-2xl font-black text-[#1F2933]">{enquiry.businessBuyer?.companyName ?? "Business buyer"}</h2>
                  <SellerStatusPill status={enquiry.status} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
                  {enquiry.product?.name ?? "General seller enquiry"} - {enquiry.quantity ? `${enquiry.quantity} units` : "Quantity not specified"}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">Submitted {formatDateTime(enquiry.createdAt)}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-7 text-[#1F2933]">
              {enquiry.message}
            </div>

            <div className="mt-5">
              <SectionHeading title="Responses" description="Seller and admin replies are shown newest first." />
              <div className="mt-4 grid gap-3">
                {enquiry.responses?.length ? (
                  enquiry.responses.map((response) => (
                    <article key={response.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                            <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-sm font-black text-[#1F2933]">
                              {response.responder?.fullName ?? response.responder?.email ?? "1HandIndia operations"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#667085]">{formatDateTime(response.createdAt)}</p>
                          </div>
                        </div>
                        {response.quotedPricePaise ? <StatusBadge tone="success">{formatMoney(response.quotedPricePaise)}</StatusBadge> : null}
                      </div>
                      <p className="mt-4 text-sm font-semibold leading-7 text-[#667085]">{response.responseMessage}</p>
                    </article>
                  ))
                ) : (
                  <SellerEmptyState title="No responses yet" message="Add a response when availability, lead time, and quote details are ready." />
                )}
              </div>
            </div>
          </SellerPanel>

          <aside className="grid h-fit gap-4">
            <SellerPanel>
              <SectionHeading title="Buyer contact" description={enquiry.businessBuyer?.contactName ?? "Contact name unavailable"} />
              <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#667085]">
                <p>{enquiry.businessBuyer?.contactPhone ?? "Phone unavailable"}</p>
                <p>{enquiry.businessBuyer?.user?.email ?? "Email unavailable"}</p>
              </div>
            </SellerPanel>

            <SellerPanel>
              {canRespond ? (
                <form onSubmit={respond} className="grid gap-3">
                  <SectionHeading title="Send response" description="Share availability, lead time, and quoted unit price." />
                  <SellerTextArea label="Seller response" name="responseMessage" required rows={5} placeholder="Share availability, lead time, and offer details." />
                  <SellerField label="Quoted unit price" name="quotedPrice" type="number" min={0} step="0.01" placeholder="450.00" />
                  <Button type="submit" disabled={responseMutation.isPending}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {responseMutation.isPending ? "Sending..." : "Send response"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm font-semibold leading-6 text-[#667085]">
                  Buyer confirmation or admin finalisation is already in progress. Further seller responses are locked for this enquiry.
                </p>
              )}
            </SellerPanel>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
