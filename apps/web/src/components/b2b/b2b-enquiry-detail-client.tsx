"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  MessageSquareReply,
  PackageSearch,
  Send,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { apiBaseUrl } from "@/lib/api";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  type B2BEnquiryMessage,
  type B2BEnquiryResponse,
  type BusinessBuyerEnquiry,
  cancelBusinessBuyerEnquiry,
  confirmBusinessBuyerEnquiry,
  getBusinessBuyerEnquiryDetail,
  getBusinessBuyerProfile,
  sendBusinessBuyerB2BMessage,
} from "@/lib/business-buyer-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BErrorPanel,
  B2BPanel,
  B2BSkeleton,
  B2BStatusPill,
  formatDateTime,
  formatMoney,
} from "./b2b-ui";

type RealtimeMessageEvent = {
  type: "MESSAGE";
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
  type: "STATUS_CHANGED";
  enquiryId: string;
  data: {
    previousStatus: string;
    newStatus: BusinessBuyerEnquiry["status"];
  };
};

const terminalStatuses = new Set(["BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"]);
const cancellableStatuses = new Set(["SUBMITTED", "IN_REVIEW", "RESPONDED", "NEGOTIATING"]);
const confirmableStatuses = new Set(["RESPONDED", "NEGOTIATING"]);

export function B2BEnquiryDetailClient({ enquiryId }: { enquiryId: string }) {
  const auth = useB2BAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<B2BEnquiryMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState<BusinessBuyerEnquiry["status"] | null>(null);

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", auth.authKey, enquiryId],
    queryFn: () => getBusinessBuyerEnquiryDetail(auth.authHeaders, enquiryId, { messageLimit: 50 }),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false,
  });

  const enquiry = enquiryQuery.data;
  const status = liveStatus ?? enquiry?.status ?? null;
  const sortedResponses = useMemo(
    () => [...(enquiry?.responses ?? [])].sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt)),
    [enquiry?.responses],
  );
  const latestResponse = sortedResponses[sortedResponses.length - 1] ?? null;
  const canCancel = status ? cancellableStatuses.has(status) : false;
  const canConfirm = status ? confirmableStatuses.has(status) && Boolean(latestResponse) : false;
  const canMessage = status ? !terminalStatuses.has(status) && ["RESPONDED", "NEGOTIATING"].includes(status) : false;

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
    if (!auth.enabled || !enquiryId) {
      return;
    }

    let socket: Socket | null = null;
    let mounted = true;

    async function connect() {
      const token = await auth.authHeaders.getBearerToken?.().catch(() => auth.authHeaders.bearerToken);
      if (!mounted) {
        return;
      }
      socket = io(`${apiBaseUrl}/b2b`, {
        auth: {
          ...(token ? { token } : {}),
          ...(auth.authHeaders.platformUserId ? { platformUserId: auth.authHeaders.platformUserId } : {}),
          ...(auth.authHeaders.clerkUserId && !token ? { clerkUserId: auth.authHeaders.clerkUserId } : {}),
        },
        withCredentials: true,
        transports: ["websocket"],
      });

      socket.on("connect", () => socket?.emit("b2b.enquiry.join", { enquiryId }));
      socket.io.on("reconnect", () => {
        socket?.emit("b2b.enquiry.join", { enquiryId });
        void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
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
              sender: { fullName: payload.data.senderName },
            },
          ]),
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
        void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
      });
    }

    void connect();
    return () => {
      mounted = false;
      socket?.emit("b2b.enquiry.leave", { enquiryId });
      socket?.disconnect();
    };
  }, [auth.authHeaders, auth.authKey, auth.enabled, enquiryId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => sendBusinessBuyerB2BMessage(auth.authHeaders, enquiryId, message),
    onMutate: async (message) => {
      const optimistic: B2BEnquiryMessage = {
        id: `temp-${Date.now()}`,
        enquiryId,
        senderUserId: profileQuery.data?.userId ?? "me",
        message,
        createdAt: new Date().toISOString(),
        sender: { fullName: profileQuery.data?.contactName ?? "You" },
      };
      setMessages((current) => orderMessages([...current, optimistic]));
      requestAnimationFrame(() => scrollToBottom("smooth"));
      return { optimisticId: optimistic.id };
    },
    onSuccess: (created, _message, context) => {
      setMessages((current) =>
        orderMessages(current.map((message) => (message.id === context?.optimisticId ? created : message))),
      );
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
    },
    onError: (error, _message, context) => {
      setMessages((current) => current.filter((message) => message.id !== context?.optimisticId));
      setNotice(error instanceof Error ? error.message : "Message could not be sent.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBusinessBuyerEnquiry(auth.authHeaders, enquiryId),
    onSuccess: (updated) => {
      setLiveStatus(updated.status);
      setNotice("Enquiry cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Enquiry cancellation failed."),
  });

  const confirmMutation = useMutation({
    mutationFn: (responseId: string) => confirmBusinessBuyerEnquiry(auth.authHeaders, enquiryId, responseId),
    onSuccess: (updated) => {
      setLiveStatus(updated.status);
      setNotice("Quotation confirmed. 1HandIndia admin can now approve and finalise it.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Quotation confirmation failed."),
  });

  async function loadOlderMessages() {
    if (!nextCursor || isLoadingOlder) {
      return;
    }
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setIsLoadingOlder(true);
    try {
      const page = await getBusinessBuyerEnquiryDetail(auth.authHeaders, enquiryId, {
        messageCursor: nextCursor,
        messageLimit: 50,
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

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) {
      return;
    }
    setNotice(null);
    setDraft("");
    sendMessageMutation.mutate(value);
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

  return (
    <B2BShell title="Enquiry negotiation" description="Review quotations, keep buyer-seller negotiation on platform, and confirm the latest active quotation.">
      {confirmation.confirmationDialog}
      <B2BAuthNotice />

      <div className="mb-5">
        <Button asChild variant="ghost">
          <Link href="/b2b/enquiries">
            <ArrowLeft size={16} /> Back to enquiries
          </Link>
        </Button>
      </div>

      {profileQuery.isLoading || enquiryQuery.isLoading ? <B2BSkeleton /> : null}
      {profileQuery.error ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}
      {enquiryQuery.error ? <B2BErrorPanel error={enquiryQuery.error} onRetry={() => void enquiryQuery.refetch()} /> : null}

      {notice ? (
        <div className="mb-5">
          <StatusBadge tone={cancelMutation.isError || confirmMutation.isError || sendMessageMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
        </div>
      ) : null}

      {enquiry ? (
        <div className="grid min-h-[720px] gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="grid h-fit gap-4">
            <B2BPanel>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <PackageSearch className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-[#1F2933]">
                      {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement"}
                    </h2>
                    <B2BStatusPill status={status} />
                  </div>
                  <div className="mt-3 grid gap-1 text-sm font-semibold leading-6 text-[#667085]">
                    <p>Quantity {enquiry.quantity}</p>
                    <p>{enquiry.seller?.storeName ?? "No seller selected"}</p>
                    <p>Submitted {formatDateTime(enquiry.createdAt)}</p>
                    <p>Updated {formatDateTime(enquiry.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </B2BPanel>

            {enquiry.b2bOrder ? (
              <B2BPanel>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-black text-[#1F2933]">B2B order</h2>
                    <div className="mt-2 grid gap-1 text-sm font-semibold leading-6 text-[#667085]">
                      <p>{enquiry.b2bOrder.orderNumber}</p>
                      <p>Proforma {enquiry.b2bOrder.proformaInvoiceNumber}</p>
                      <p>{formatMoney(enquiry.b2bOrder.subtotalPaise)}</p>
                      <p>Commission {formatMoney(enquiry.b2bOrder.commissionAmountPaise)}</p>
                    </div>
                    <Button asChild className="mt-4" size="sm">
                      <Link href={`/b2b/orders/${encodeURIComponent(enquiry.b2bOrder.orderNumber)}`}>Open order</Link>
                    </Button>
                  </div>
                </div>
              </B2BPanel>
            ) : null}

            <B2BPanel>
              <h2 className="text-lg font-black text-[#1F2933]">Actions</h2>
              <div className="mt-4 grid gap-2">
                {canConfirm && latestResponse ? (
                  <Button
                    type="button"
                    disabled={confirmMutation.isPending || cancelMutation.isPending}
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Confirm latest quotation?",
                        description: "The enquiry will move to buyer confirmed and wait for admin approval. Older quotations cannot be confirmed.",
                        confirmLabel: "Confirm quotation",
                        tone: "warning",
                        onConfirm: () => confirmMutation.mutate(latestResponse.id),
                      })
                    }
                  >
                    <CheckCircle2 size={16} /> Confirm latest quotation
                  </Button>
                ) : null}
                {canCancel ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={confirmMutation.isPending || cancelMutation.isPending}
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Cancel this B2B enquiry?",
                        description: "This enquiry will stop accepting messages and quotations.",
                        confirmLabel: "Cancel enquiry",
                        onConfirm: () => cancelMutation.mutate(),
                      })
                    }
                  >
                    <XCircle size={16} /> Cancel enquiry
                  </Button>
                ) : null}
                {!canCancel && !canConfirm ? (
                  <p className="text-sm font-semibold leading-6 text-[#667085]">
                    Lifecycle actions are locked for the current status.
                  </p>
                ) : null}
              </div>
            </B2BPanel>
          </aside>

          <section className="flex min-h-[720px] flex-col rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1F2933]">Negotiation thread</h2>
                <p className="text-sm font-semibold text-[#667085]">Initial request, quotations, and chat are kept together for audit and confirmation.</p>
              </div>
              <StatusBadge tone={canMessage ? "info" : "neutral"}>{canMessage ? "Open for messages" : "Messages locked"}</StatusBadge>
            </div>

            <div
              ref={scrollRef}
              className="relative flex-1 overflow-y-auto bg-[#F8FAFC] px-4 py-5"
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

              <div className="grid gap-4">
                <InitialRequestCard enquiry={enquiry} />
                {sortedResponses.map((response) => (
                  <QuotationCard
                    key={response.id}
                    enquiry={enquiry}
                    response={response}
                    isLatest={latestResponse?.id === response.id}
                    canConfirm={canConfirm && latestResponse?.id === response.id}
                    isPending={confirmMutation.isPending}
                    onConfirm={() =>
                      confirmation.requestConfirmation({
                        title: "Confirm latest quotation?",
                        description: "The enquiry will move to buyer confirmed and wait for admin approval.",
                        confirmLabel: "Confirm quotation",
                        tone: "warning",
                        onConfirm: () => confirmMutation.mutate(response.id),
                      })
                    }
                  />
                ))}
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isSelf={message.senderUserId === profileQuery.data?.userId || message.id.startsWith("temp-")}
                  />
                ))}
              </div>

              {newMessageCount ? (
                <button
                  type="button"
                  onClick={() => scrollToBottom("smooth")}
                  className="sticky bottom-4 left-1/2 mt-4 -translate-x-1/2 rounded-full bg-[#163B5C] px-4 py-2 text-xs font-black text-white shadow-lg"
                >
                  {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
                </button>
              ) : null}
            </div>

            {canMessage ? (
              <form onSubmit={submitMessage} className="border-t border-[#E5E7EB] bg-white p-4">
                <div className="flex items-end gap-3">
                  <label className="flex-1">
                    <span className="sr-only">Message</span>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                      placeholder="Write a negotiation message..."
                      rows={1}
                      maxLength={2000}
                      className="max-h-32 min-h-11 w-full resize-none rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                    />
                  </label>
                  <Button type="submit" disabled={!draft.trim() || sendMessageMutation.isPending}>
                    {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Send
                  </Button>
                </div>
              </form>
            ) : (
              <div className="border-t border-[#E5E7EB] bg-white p-4">
                <StatusBadge tone="neutral">
                  {status === "CANCELLED"
                    ? "This enquiry was cancelled. Messages are locked."
                    : "This enquiry has moved past negotiation. Messages are locked."}
                </StatusBadge>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </B2BShell>
  );
}

function InitialRequestCard({ enquiry }: { enquiry: BusinessBuyerEnquiry }) {
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
          <PackageSearch className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <StatusBadge tone="neutral">Initial request</StatusBadge>
          <h3 className="mt-2 text-base font-black text-[#1F2933]">{enquiry.product?.name ?? enquiry.seller?.storeName ?? "Procurement enquiry"}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{enquiry.message}</p>
          <p className="mt-2 text-xs font-bold text-[#667085]">Quantity {enquiry.quantity} / {formatDateTime(enquiry.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}

function QuotationCard({
  enquiry,
  response,
  isLatest,
  canConfirm,
  isPending,
  onConfirm,
}: {
  enquiry: BusinessBuyerEnquiry;
  response: B2BEnquiryResponse;
  isLatest: boolean;
  canConfirm: boolean;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const total = response.quotedPricePaise === null || response.quotedPricePaise === undefined
    ? null
    : response.quotedPricePaise * enquiry.quantity;

  return (
    <article className={cn("rounded-lg border bg-white p-4", isLatest ? "border-[#ED3500]" : "border-[#E5E7EB]")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
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
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="info">Unit {formatMoney(response.quotedPricePaise)}</StatusBadge>
          <StatusBadge tone="success">Total {formatMoney(total)}</StatusBadge>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#667085]">{response.responseMessage}</p>
      {canConfirm ? (
        <Button type="button" size="sm" className="mt-4" disabled={isPending} onClick={onConfirm}>
          <CheckCircle2 size={16} /> Confirm quotation
        </Button>
      ) : null}
    </article>
  );
}

function MessageBubble({ message, isSelf }: { message: B2BEnquiryMessage; isSelf: boolean }) {
  return (
    <div className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[min(76%,640px)] rounded-lg px-4 py-3 text-sm shadow-sm",
          isSelf ? "bg-[#163B5C] text-white" : "border border-[#E5E7EB] bg-white text-[#1F2933]",
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
