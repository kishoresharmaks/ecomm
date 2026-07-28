"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LifeBuoy, Lock, Send, TicketCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  claimStaffChat,
  getStaffChatConversation,
  linkChatSupportRequest,
  listStaffChatConversations,
  replyStaffChat,
  updateStaffChat,
  type ChatConversation,
  type StaffChatQuery,
} from "@/lib/chat-api";
import { userFacingApiErrorMessage } from "@/lib/api";

export function SupportChatClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<StaffChatQuery>({ assignment: "unassigned", sensitivity: "NORMAL" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [closeNote, setCloseNote] = useState("This chat was closed. Start a new chat if you still need help.");
  const isAdmin = auth.user?.roles.includes("ADMIN") ?? false;

  const conversationsQuery = useQuery({
    queryKey: ["staff-chat-conversations", query, auth.authHeaders],
    queryFn: () => listStaffChatConversations(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const conversations = conversationsQuery.data ?? [];
  const selectedConversationId = selectedId ?? conversations[0]?.id ?? null;
  const detailQuery = useQuery({
    queryKey: ["staff-chat-conversation", selectedConversationId, auth.authHeaders],
    queryFn: () => getStaffChatConversation(auth.authHeaders, selectedConversationId as string),
    enabled: Boolean(selectedConversationId),
    retry: false,
  });
  const selected = detailQuery.data;
  const selectedClosed = selected ? isTerminal(selected.status) : false;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-chat-conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-chat-conversation"] }),
    ]);
  };

  const claimMutation = useMutation({
    mutationFn: (conversationId: string) => claimStaffChat(auth.authHeaders, conversationId),
    onSuccess: refresh,
  });
  const replyMutation = useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      replyStaffChat(auth.authHeaders, conversationId, message),
    onSuccess: async () => {
      setReply("");
      await refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ conversationId, status, note }: { conversationId: string; status: string; note?: string }) =>
      updateStaffChat(auth.authHeaders, conversationId, { status, note }),
    onSuccess: async () => {
      setReply("");
      await refresh();
    },
  });
  const linkMutation = useMutation({
    mutationFn: (conversationId: string) => linkChatSupportRequest(auth.authHeaders, conversationId),
    onSuccess: refresh,
  });

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selectedClosed || !reply.trim()) return;
    replyMutation.mutate({ conversationId: selected.id, message: reply.trim() });
  }

  function closeSelected() {
    if (!selected || selectedClosed) return;
    statusMutation.mutate({
      conversationId: selected.id,
      status: "CLOSED",
      note: closeNote.trim() || "This chat was closed. Start a new chat if you still need help.",
    });
  }

  const error = conversationsQuery.error || detailQuery.error || claimMutation.error || replyMutation.error || statusMutation.error || linkMutation.error;

  return (
    <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
      <aside className="rounded-lg border border-[#D8E2EA] bg-white">
        <div className="border-b border-[#E5E7EB] p-3">
          <div className="grid grid-cols-2 gap-2">
            <FilterButton label="Open queue" active={query.assignment === "unassigned"} onClick={() => setQuery({ assignment: "unassigned", sensitivity: "NORMAL" })} />
            <FilterButton label="Mine" active={query.assignment === "mine"} onClick={() => setQuery({ assignment: "mine", sensitivity: "NORMAL" })} />
            {isAdmin ? <FilterButton label="All" active={!query.assignment} onClick={() => setQuery({})} /> : null}
            {isAdmin ? <FilterButton label="Sensitive" active={query.sensitivity === "FRAUD_REVIEW"} onClick={() => setQuery({ sensitivity: "FRAUD_REVIEW" })} /> : null}
          </div>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-2">
          {conversationsQuery.isLoading ? <ListState text="Loading chats" /> : null}
          {!conversations.length && !conversationsQuery.isLoading ? <ListState text="No chats in this queue" /> : null}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedId(conversation.id)}
              className={cn(
                "mb-2 w-full rounded-md border p-3 text-left",
                selectedConversationId === conversation.id ? "border-[#ED3500] bg-[#FFF0EC]" : "border-[#E5E7EB] bg-white hover:bg-[#F8FAFC]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-black text-[#1F2933]">{conversation.subject}</p>
                {conversation.staffUnreadCount ? <StatusBadge tone="danger">{conversation.staffUnreadCount}</StatusBadge> : null}
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-[#667085]">{conversation.user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <StatusBadge tone="info">{humanize(conversation.requesterType)}</StatusBadge>
                <StatusBadge tone={priorityTone(conversation.priority)}>{humanize(conversation.priority)}</StatusBadge>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-lg border border-[#D8E2EA] bg-white">
        <header className="border-b border-[#E5E7EB] p-4">
          {selected ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{selected.subject}</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{selected.user.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="info">{humanize(selected.status)}</StatusBadge>
                <StatusBadge tone={selected.sensitivity === "NORMAL" ? "success" : "danger"}>{humanize(selected.sensitivity)}</StatusBadge>
              </div>
            </div>
          ) : (
            <ListState text="Select a chat" />
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FFFCFB] p-4">
          {detailQuery.isLoading ? <ListState text="Loading conversation" /> : null}
          {selectedClosed ? (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#C5D8E8] bg-[#EAF1F7] p-3 text-sm font-semibold text-[#163B5C]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>This chat is closed. Replies, handover, and lifecycle changes are locked for both staff and user.</p>
            </div>
          ) : null}
          {selected?.messages?.filter((message) => message.visibleToUser || message.messageType === "INTERNAL_NOTE").map((message) => (
            <div key={message.id} className={cn("mb-3 flex", message.senderType === "USER" ? "justify-start" : "justify-end")}>
              <p className={cn("max-w-[76%] rounded-lg px-3 py-2 text-sm font-semibold", bubbleClass(message.senderType, message.messageType))}>
                {message.messageType === "INTERNAL_NOTE" ? "Internal note: " : ""}
                {message.body}
              </p>
            </div>
          ))}
        </div>
        {error ? <p className="border-t border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-semibold text-[#9B1C1C]">{userFacingApiErrorMessage(error)}</p> : null}
        {selected ? (
          <div className="border-t border-[#E5E7EB] p-3">
            <div className="mb-3 grid gap-3 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#1F2933]">Conversation controls</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">
                    {selectedClosed ? "Closed chats are preserved for audit and cannot be replied to." : "Claim, link, or close this chat from one controlled panel."}
                  </p>
                </div>
                {selectedClosed ? <StatusBadge tone="info">Read only</StatusBadge> : null}
              </div>
              <div className="flex flex-wrap gap-2">
              {!selected.assignedToUserId && selected.sensitivity === "NORMAL" && !selectedClosed ? (
                <Button type="button" variant="outline" onClick={() => claimMutation.mutate(selected.id)} disabled={claimMutation.isPending}>
                  <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                  Claim
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => linkMutation.mutate(selected.id)} disabled={linkMutation.isPending || selectedClosed}>
                <TicketCheck className="h-4 w-4" aria-hidden="true" />
                Link ticket
              </Button>
              </div>
              {!selectedClosed ? (
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-[0.1em] text-[#667085]" htmlFor="chat-close-note">
                    Close note shown to user
                  </label>
                  <textarea
                    id="chat-close-note"
                    value={closeNote}
                    onChange={(event) => setCloseNote(event.target.value)}
                    className="min-h-20 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                    maxLength={500}
                  />
                  <Button type="button" onClick={closeSelected} disabled={statusMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Resolve and close chat
                  </Button>
                </div>
              ) : null}
            </div>
            <form onSubmit={submitReply} className="flex gap-2">
              <input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                disabled={selectedClosed}
                className="min-h-11 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] disabled:bg-[#F2F4F7] disabled:text-[#667085]"
                placeholder={selectedClosed ? "Chat is closed" : selected.assignedToUserId || isAdmin ? "Reply to user" : "Claim before replying"}
              />
              <Button type="submit" disabled={selectedClosed || replyMutation.isPending || (!selected.assignedToUserId && !isAdmin)}>
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        ) : null}
      </section>

      <aside className="rounded-lg border border-[#D8E2EA] bg-white p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#667085]">Support context</h3>
        {selected ? <ContextPanel conversation={selected} /> : <ListState text="No context selected" />}
      </aside>
    </div>
  );
}

function ContextPanel({ conversation }: { conversation: ChatConversation }) {
  const context = conversation.supportContext;
  return (
    <div className="mt-4 grid gap-3 text-sm font-semibold text-[#344054]">
      <ContextRow label="Requester" value={humanize(conversation.requesterType)} />
      <ContextRow label="Topic" value={humanize(conversation.topic)} />
      <ContextRow label="Assigned" value={conversation.assignedTo?.email ?? "Unassigned"} />
      {context?.order ? (
        <>
          <ContextRow label="Order" value={context.order.orderNumber} />
          <ContextRow label="Order status" value={humanize(context.order.orderStatus)} />
          <ContextRow label="Payment" value={humanize(context.order.paymentStatus)} />
          <ContextRow label="Delivery" value={humanize(context.order.deliveryStatus)} />
        </>
      ) : null}
      {context?.product ? (
        <>
          <ContextRow label="Product" value={context.product.name} />
          <ContextRow label="Store" value={context.product.seller?.storeName ?? "Not linked"} />
        </>
      ) : null}
      {context?.b2bEnquiry ? <ContextRow label="B2B enquiry" value={humanize(context.b2bEnquiry.status)} /> : null}
      {context?.supportRequest ? <ContextRow label="Ticket" value={context.supportRequest.subject} /> : null}
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-[#667085]">{label}</p>
      <p className="mt-1 text-[#1F2933]">{value}</p>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("min-h-10 rounded-md border px-3 text-xs font-black", active ? "border-[#ED3500] bg-[#FFF0EC] text-[#B42318]" : "border-[#D8E2EA] text-[#344054]")}>
      {label}
    </button>
  );
}

function ListState({ text }: { text: string }) {
  return <p className="p-4 text-center text-sm font-black text-[#667085]">{text}</p>;
}

function priorityTone(priority: string) {
  return priority === "URGENT" || priority === "HIGH" ? "danger" : priority === "LOW" ? "neutral" : "success";
}

function isTerminal(status: string) {
  return status === "RESOLVED" || status === "CLOSED";
}

function bubbleClass(senderType: string, messageType: string) {
  if (messageType === "INTERNAL_NOTE") return "border border-[#D9A441] bg-[#FFF8E1] text-[#6B4E16]";
  if (senderType === "USER") return "border border-[#D8E2EA] bg-white text-[#1F2933]";
  return "bg-[#163B5C] text-white";
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
