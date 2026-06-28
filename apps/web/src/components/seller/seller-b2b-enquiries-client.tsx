"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ArrowLeft, CreditCard, FileText, Loader2, MessageSquare, MessageSquareReply, MessageSquareText, Search, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { apiBaseUrl, type IndihubAuthHeaders } from "@/lib/api";
import { formatMoney } from "@/lib/storefront-api";
import {
  type B2BEnquiry,
  type B2BEnquiryMessage,
  getSellerB2BEnquiry,
  listSellerB2BEnquiries,
  respondSellerB2BEnquiry,
  sendSellerB2BMessage
} from "@/lib/seller-api";
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

const liveEnquiryStatuses = ["", "SUBMITTED", "IN_REVIEW", "RESPONDED", "NEGOTIATING", "BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"];
const terminalStatuses = new Set(["BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"]);
const responseAllowedStatuses = new Set(["SUBMITTED", "IN_REVIEW", "RESPONDED", "NEGOTIATING"]);
const messageAllowedStatuses = new Set(["RESPONDED", "NEGOTIATING"]);
const upgradeMessage = "Upgrade your subscription plan to respond to B2B enquiries.";

type RealtimeMessageEvent = {
  enquiryId: string;
  data: {
    id: string;
    senderUserId: string;
    senderName: string;
    senderRole: "BUYER" | "SELLER" | "ADMIN";
    message: string;
    createdAt: string;
  };
};

type RealtimeStatusEvent = {
  enquiryId: string;
  data: {
    previousStatus: string;
    newStatus: B2BEnquiry["status"];
  };
};

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
          {liveEnquiryStatuses.map((option) => (
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
          const canRespond = responseAllowedStatuses.has(enquiry.status);

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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/seller/b2b-enquiries/${encodeURIComponent(enquiry.id)}`}>
                        <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        Open negotiation
                      </Link>
                    </Button>
                    {enquiry.b2bOrder ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/seller/b2b-orders/${encodeURIComponent(enquiry.b2bOrder.orderNumber)}`}>
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Open B2B order
                      </Link>
                    </Button>
                    ) : null}
                  </div>
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<B2BEnquiryMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<B2BEnquiry["status"] | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [responseBlockedByPlan, setResponseBlockedByPlan] = useState(false);

  const enquiryQuery = useQuery({
    queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId],
    queryFn: () => getSellerB2BEnquiry(sellerAuth.authHeaders, enquiryId, { messageLimit: 50 }),
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
      setResponseBlockedByPlan(false);
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiries", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "B2B response failed.";
      setResponseBlockedByPlan(message.includes("Upgrade your subscription plan"));
      setNotice(message);
    }
  });

  const messageMutation = useMutation({
    mutationFn: (message: string) => sendSellerB2BMessage(sellerAuth.authHeaders, enquiryId, message),
    onMutate: (message) => {
      const optimistic: B2BEnquiryMessage = {
        id: `temp-${Date.now()}`,
        enquiryId,
        senderUserId: "seller",
        message,
        createdAt: new Date().toISOString(),
        sender: { fullName: "You" }
      };
      setMessages((current) => orderMessages([...current, optimistic]));
      requestAnimationFrame(() => scrollToBottom("smooth"));
      return { optimisticId: optimistic.id };
    },
    onSuccess: (created, _message, context) => {
      const ownSenderUserId = created.senderUserId;
      setMessages((current) =>
        orderMessages(
          current.map((message) =>
            message.id === context?.optimisticId
              ? created
              : message.senderUserId === ownSenderUserId
                ? { ...message, sender: message.sender ?? { fullName: "You" } }
                : message,
          ),
        ),
      );
      setResponseBlockedByPlan(false);
      void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId] });
    },
    onError: (error, _message, context) => {
      const message = error instanceof Error ? error.message : "Message could not be sent.";
      setMessages((current) => current.filter((item) => item.id !== context?.optimisticId));
      setResponseBlockedByPlan(message.includes("Upgrade your subscription plan"));
      setNotice(message);
    }
  });

  const enquiry = enquiryQuery.data;
  const status = liveStatus ?? enquiry?.status ?? null;
  const sortedResponses = useMemo(
    () => [...(enquiry?.responses ?? [])].sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt)),
    [enquiry?.responses]
  );
  const latestResponse = sortedResponses[sortedResponses.length - 1] ?? null;
  const canRespond = status ? responseAllowedStatuses.has(status) : false;
  const canMessage = status ? messageAllowedStatuses.has(status) && !terminalStatuses.has(status) : false;

  useEffect(() => {
    if (!enquiry) {
      return;
    }
    setLiveStatus(enquiry.status);
    setMessages(orderMessages(enquiry.messages?.items ?? []));
    setNextCursor(enquiry.messages?.nextCursor ?? null);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [enquiry]);

  useEffect(() => {
    if (!sellerAuth.enabled || !enquiryId) {
      return;
    }

    let socket: Socket | null = null;
    let mounted = true;
    const authHeaders = sellerAuth.authHeaders as IndihubAuthHeaders;

    async function connect() {
      const token = await authHeaders.getBearerToken?.().catch(() => authHeaders.bearerToken);
      if (!mounted) {
        return;
      }

      socket = io(`${apiBaseUrl}/b2b`, {
        auth: {
          ...(token ? { token } : {}),
          ...(authHeaders.platformUserId ? { platformUserId: authHeaders.platformUserId } : {}),
          ...(authHeaders.clerkUserId && !token ? { clerkUserId: authHeaders.clerkUserId } : {})
        },
        withCredentials: true,
        transports: ["websocket"]
      });
      socket.on("connect", () => socket?.emit("b2b.enquiry.join", { enquiryId }));
      socket.io.on("reconnect", () => {
        socket?.emit("b2b.enquiry.join", { enquiryId });
        void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId] });
      });
      socket.on("b2b.enquiry.message", (payload: RealtimeMessageEvent) => {
        if (payload.enquiryId !== enquiryId) {
          return;
        }
        const nearBottom = isNearBottom();
        setMessages((current) =>
          orderMessages([
            ...current,
            {
              id: payload.data.id,
              enquiryId,
              senderUserId: payload.data.senderUserId,
              message: payload.data.message,
              createdAt: payload.data.createdAt,
              sender: { fullName: payload.data.senderName }
            }
          ])
        );
        if (nearBottom) {
          requestAnimationFrame(() => scrollToBottom("smooth"));
        } else {
          setNewMessageCount((count) => count + 1);
        }
      });
      socket.on("b2b.enquiry.status_changed", (payload: RealtimeStatusEvent) => {
        if (payload.enquiryId === enquiryId) {
          setLiveStatus(payload.data.newStatus);
        }
      });
      socket.on("b2b.enquiry.quotation_added", () => {
        void queryClient.invalidateQueries({ queryKey: ["seller-b2b-enquiry", sellerAuth.authKey, enquiryId] });
      });
    }

    void connect();
    return () => {
      mounted = false;
      socket?.emit("b2b.enquiry.leave", { enquiryId });
      socket?.disconnect();
    };
  }, [enquiryId, queryClient, sellerAuth.authHeaders, sellerAuth.authKey, sellerAuth.enabled]);

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

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      return;
    }
    setNotice(null);
    setDraft("");
    messageMutation.mutate(message);
  }

  async function loadOlderMessages() {
    if (!nextCursor || isLoadingOlder) {
      return;
    }
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setIsLoadingOlder(true);
    try {
      const page = await getSellerB2BEnquiry(sellerAuth.authHeaders, enquiryId, {
        messageCursor: nextCursor,
        messageLimit: 50
      });
      setMessages((current) => orderMessages([...(page.messages?.items ?? []), ...current]));
      setNextCursor(page.messages?.nextCursor ?? null);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousHeight;
        }
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Older messages could not be loaded.");
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function isNearBottom() {
    const container = scrollRef.current;
    if (!container) {
      return true;
    }
    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      setNewMessageCount(0);
    }
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (enquiryQuery.error && isSellerOnboardingRequiredError(enquiryQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before responding to B2B buyer enquiries." />;
  }

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
                  <SellerStatusPill status={status} />
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
              <SectionHeading title="Quotation history" description="The newest priced response is the active quotation. Older quotations remain visible for audit." />
              <div className="mt-4 grid gap-3">
                {sortedResponses.length ? (
                  sortedResponses.map((response) => {
                    const isLatest = latestResponse?.id === response.id;
                    return (
                    <article key={response.id} className={cn("rounded-lg border bg-white p-4", isLatest ? "border-[#ED3500]" : "border-[#E5E7EB]")}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                            <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-[#1F2933]">
                                {response.responder?.fullName ?? response.responder?.email ?? "1HandIndia operations"}
                              </p>
                              <StatusBadge tone={isLatest ? "success" : "neutral"}>{isLatest ? "Active quotation" : "Superseded"}</StatusBadge>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[#667085]">{formatDateTime(response.createdAt)}</p>
                          </div>
                        </div>
                        {response.quotedPricePaise ? <StatusBadge tone="success">{formatMoney(response.quotedPricePaise)}</StatusBadge> : null}
                      </div>
                      <p className="mt-4 text-sm font-semibold leading-7 text-[#667085]">{response.responseMessage}</p>
                    </article>
                  );})
                ) : (
                  <SellerEmptyState title="No responses yet" message="Add a response when availability, lead time, and quote details are ready." />
                )}
              </div>
            </div>

            <div className="mt-5">
              <SectionHeading title="Negotiation chat" description="Messages stay on platform with the enquiry and quotation history." />
              <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                <div
                  ref={scrollRef}
                  className="max-h-[520px] overflow-y-auto bg-[#F8FAFC] px-4 py-5"
                  onScroll={() => {
                    if (scrollRef.current?.scrollTop === 0 && nextCursor) {
                      void loadOlderMessages();
                    }
                    if (isNearBottom()) {
                      setNewMessageCount(0);
                    }
                  }}
                >
                  {nextCursor ? (
                    <div className="mb-4 flex justify-center">
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingOlder} onClick={() => void loadOlderMessages()}>
                        {isLoadingOlder ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Load older
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    <InitialRequestCard enquiry={enquiry} />
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isSelf={message.id.startsWith("temp-") || message.sender?.fullName === "You"}
                      />
                    ))}
                  </div>
                  {newMessageCount ? (
                    <button
                      type="button"
                      onClick={() => scrollToBottom("smooth")}
                      className="sticky bottom-4 left-1/2 mt-4 -translate-x-1/2 rounded-full bg-[#123A5A] px-4 py-2 text-xs font-black text-white shadow-lg"
                    >
                      {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
                    </button>
                  ) : null}
                </div>
                {canMessage ? (
                  <form onSubmit={sendMessage} className="border-t border-[#E5E7EB] bg-white p-4">
                    <div className="flex items-end gap-3">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                        rows={1}
                        maxLength={2000}
                        placeholder="Write a negotiation message..."
                        className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                      />
                      <Button type="submit" disabled={!draft.trim() || messageMutation.isPending}>
                        {messageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                        Send
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="border-t border-[#E5E7EB] bg-white p-4">
                    <StatusBadge tone="neutral">
                      {status === "CANCELLED" ? "This enquiry was cancelled. Messages are locked." : "Messages open after the first quotation and lock after confirmation or closure."}
                    </StatusBadge>
                  </div>
                )}
              </div>
            </div>
          </SellerPanel>

          <aside className="grid h-fit gap-4">
            <SellerPanel>
              <SectionHeading title="Buyer contact" description={enquiry.businessBuyer?.contactName ?? "Buyer name hidden"} />
              <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#667085]">
                <p>{enquiry.businessBuyer?.contactPhone ?? "Phone hidden until B2B payment is confirmed"}</p>
                <p>{enquiry.businessBuyer?.user?.email ?? "Email hidden until B2B payment is confirmed"}</p>
              </div>
            </SellerPanel>

            {enquiry.b2bOrder ? (
              <SellerPanel>
                <SectionHeading title="B2B order" description={`Proforma ${enquiry.b2bOrder.proformaInvoiceNumber}`} />
                <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-[#667085]">
                  <p>{enquiry.b2bOrder.orderNumber}</p>
                  <p>{formatMoney(enquiry.b2bOrder.subtotalPaise)}</p>
                </div>
                <Button asChild size="sm" className="mt-4">
                  <Link href={`/seller/b2b-orders/${encodeURIComponent(enquiry.b2bOrder.orderNumber)}`}>
                    Open B2B order
                  </Link>
                </Button>
              </SellerPanel>
            ) : null}

            <SellerPanel>
              {responseBlockedByPlan ? <SellerPlanUpgradePrompt /> : null}
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

function InitialRequestCard({ enquiry }: { enquiry: B2BEnquiry }) {
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <StatusBadge tone="neutral">Initial request</StatusBadge>
          <h3 className="mt-2 text-base font-black text-[#1F2933]">
            {enquiry.product?.name ?? enquiry.businessBuyer?.companyName ?? "Procurement enquiry"}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{enquiry.message}</p>
          <p className="mt-2 text-xs font-bold text-[#667085]">
            {enquiry.quantity ? `Quantity ${enquiry.quantity}` : "Quantity not specified"} / {formatDateTime(enquiry.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function MessageBubble({ message, isSelf }: { message: B2BEnquiryMessage; isSelf: boolean }) {
  return (
    <div className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[min(78%,640px)] rounded-lg px-4 py-3 text-sm shadow-sm",
          isSelf ? "bg-[#123A5A] text-white" : "border border-[#E5E7EB] bg-white text-[#1F2933]",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs font-black opacity-80">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {message.sender?.fullName ?? message.sender?.email ?? (isSelf ? "You" : "Participant")}
        </div>
        <p className="whitespace-pre-wrap leading-6">{message.message}</p>
        <p className="mt-2 text-[11px] font-semibold opacity-70">{formatDateTime(message.createdAt)}</p>
      </article>
    </div>
  );
}

function SellerPlanUpgradePrompt() {
  return (
    <div className="mb-4 rounded-lg border border-[#FFC7B8] bg-[#FFF0EC] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#ED3500]">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black text-[#9F2600]">{upgradeMessage}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#9F2600]">
            View B2B Starter or higher plans to respond to this enquiry.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/seller/subscription">View plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function orderMessages(messages: B2BEnquiryMessage[]) {
  const byId = new Map<string, B2BEnquiryMessage>();
  for (const message of messages) {
    byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt));
}

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}
