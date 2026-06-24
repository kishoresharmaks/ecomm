"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, Lock, MessageCircle, Send, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  getChatSupportConfig,
  getMyChatConversation,
  listMyChatConversations,
  requestChatHandover,
  runMyChatGuidedAction,
  sendMyChatMessage,
  startChatConversation,
  type ChatOrderSummary,
  type ChatRequesterType,
  type ChatMessage,
  type ChatTopic,
} from "@/lib/chat-api";
import { userFacingApiErrorMessage } from "@/lib/api";
import { useChatSocket } from "./chat-socket-context";

export function ChatWidget() {
  const auth = useCustomerAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { socket, isConnected, joinConversation, leaveConversation } = useChatSocket();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState<ChatTopic>("ORDER");
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatConfigQuery = useQuery({
    queryKey: ["chat-config"],
    queryFn: getChatSupportConfig,
    staleTime: 60_000,
    retry: false,
  });
  const chatEnabled = chatConfigQuery.data?.enabled ?? true;

  const conversationsQuery = useQuery({
    queryKey: ["my-chat-conversations", auth.authKey],
    queryFn: () => listMyChatConversations(auth.authHeaders),
    enabled: auth.enabled && open && chatEnabled,
    retry: false,
  });

  const conversations = conversationsQuery.data ?? [];
  const topicConversation = conversations.find((conversation) => conversation.topic === topic && !isTerminal(conversation.status)) ?? null;
  const fallbackConversation = conversations.find((conversation) => !isTerminal(conversation.status)) ?? null;
  const activeConversationId = activeId ?? topicConversation?.id ?? fallbackConversation?.id ?? null;
  
  const activeConversationQuery = useQuery({
    queryKey: ["my-chat-conversation", activeConversationId, auth.authKey],
    queryFn: () => getMyChatConversation(auth.authHeaders, activeConversationId as string),
    enabled: Boolean(activeConversationId) && open,
    retry: false,
  });
  
  const activeConversation = activeConversationQuery.data ?? conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const requesterType = useMemo<ChatRequesterType>(() => requesterTypeFromPath(), []);
  const activeClosed = activeConversation ? isTerminal(activeConversation.status) : false;
  const canSendIntoActive = Boolean(activeConversation && !activeClosed && activeConversation.topic === topic);
  
  useEffect(() => {
    if (activeConversation?.topic && activeConversation.id === activeId) {
      setTopic(activeConversation.topic);
    }
  }, [activeConversation?.id, activeConversation?.topic, activeId]);

  const visibleMessages = useMemo(() => {
    const serverMessages = activeConversation?.messages?.filter((message) => message.visibleToUser) ?? [];
    const serverClientIds = new Set(serverMessages.map((message) => clientMessageId(message)).filter(Boolean));
    return [
      ...serverMessages,
      ...optimisticMessages.filter(
        (message) => message.conversationId === activeConversationId && !serverClientIds.has(clientMessageId(message)),
      ),
    ];
  }, [activeConversation?.messages, activeConversationId, optimisticMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [visibleMessages.length, open]);
  
  // Join conversation room when active conversation changes
  useEffect(() => {
    if (isConnected && activeConversationId) {
      joinConversation(activeConversationId);
    }
    
    return () => {
      if (isConnected && activeConversationId) {
        leaveConversation(activeConversationId);
      }
    };
  }, [isConnected, activeConversationId, joinConversation, leaveConversation]);
  
  // Listen for real-time message events
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    const handleMessage = (event: { payload?: ChatMessage }) => {
      const confirmedClientId = event.payload ? clientMessageId(event.payload) : null;
      if (confirmedClientId) {
        setOptimisticMessages((messages) => messages.filter((message) => clientMessageId(message) !== confirmedClientId));
      }
      queryClient.invalidateQueries({ queryKey: ["my-chat-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] });
    };
    
    const handleConversation = () => {
      queryClient.invalidateQueries({ queryKey: ["my-chat-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] });
    };
    
    socket.on("message", handleMessage);
    socket.on("conversation", handleConversation);
    
    return () => {
      socket.off("message", handleMessage);
      socket.off("conversation", handleConversation);
    };
  }, [socket, isConnected, queryClient]);

  const startMutation = useMutation({
    mutationFn: () =>
      startChatConversation(auth.authHeaders, {
        requesterType,
        topic,
        subject: subjectForTopic(topic),
        message: draft.trim() || subjectForTopic(topic),
      }),
    onSuccess: async (conversation) => {
      setActiveId(conversation.id);
      setDraft("");
      setOptimisticMessages([]);
      await queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] });
      queryClient.setQueryData(["my-chat-conversation", conversation.id, auth.authKey], conversation);
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversationId, message, clientMessageId }: { conversationId: string; message: string; clientMessageId: string }) =>
      sendMyChatMessage(auth.authHeaders, conversationId, message, clientMessageId),
    onSuccess: async (message) => {
      setDraft("");
      const confirmedClientId = clientMessageId(message);
      if (confirmedClientId) {
        setOptimisticMessages((messages) => messages.filter((item) => clientMessageId(item) !== confirmedClientId));
      }
      await queryClient.invalidateQueries({ queryKey: ["my-chat-conversation", message.conversationId, auth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] });
    },
    onError: (_error, variables) => {
      setOptimisticMessages((messages) => messages.filter((message) => clientMessageId(message) !== variables.clientMessageId));
    },
  });

  const handoverMutation = useMutation({
    mutationFn: (conversationId: string) => requestChatHandover(auth.authHeaders, conversationId, "Talk to staff"),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] }),
  });
  const guidedActionMutation = useMutation({
    mutationFn: ({ conversationId, action, selectedValue }: { conversationId: string; action: string; selectedValue?: string }) =>
      runMyChatGuidedAction(auth.authHeaders, conversationId, action, selectedValue),
    onSuccess: async (result) => {
      const conversationId = result.messages[0]?.conversationId ?? activeConversationId;
      if (conversationId) {
        await queryClient.invalidateQueries({ queryKey: ["my-chat-conversation", conversationId, auth.authKey] });
      }
      await queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] });
    },
  });

  if (!chatEnabled || !auth.enabled || pathname.startsWith("/admin") || pathname.startsWith("/finance") || pathname.startsWith("/courier") || pathname.startsWith("/support")) {
    return null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (canSendIntoActive && activeConversation && message) {
      const optimisticId = createClientMessageId();
      setOptimisticMessages((messages) => [
        ...messages,
        {
          id: optimisticId,
          conversationId: activeConversation.id,
          senderType: "USER",
          messageType: "TEXT",
          body: message,
          visibleToUser: true,
          metadata: { clientMessageId: optimisticId },
          createdAt: new Date().toISOString(),
        },
      ]);
      sendMutation.mutate({ conversationId: activeConversation.id, message, clientMessageId: optimisticId });
      return;
    }
    startMutation.mutate();
  }

  function sendGuidedOption(option: string) {
    if (!canSendIntoActive || !activeConversation) {
      setDraft(option);
      return;
    }
    if (option === "Talk to staff") {
      handoverMutation.mutate(activeConversation.id);
      return;
    }
    guidedActionMutation.mutate({ conversationId: activeConversation.id, action: option });
  }

  function selectGuidedOrder(action: string, orderNumber: string) {
    if (!activeConversation || activeClosed) return;
    guidedActionMutation.mutate({ conversationId: activeConversation.id, action, selectedValue: orderNumber });
  }

  function startFreshChat() {
    setActiveId(null);
    setDraft("");
    setOptimisticMessages([]);
  }

  function selectTopic(nextTopic: ChatTopic) {
    setTopic(nextTopic);
    const nextConversation = conversations.find((conversation) => conversation.topic === nextTopic && !isTerminal(conversation.status));
    setActiveId(nextConversation?.id ?? null);
    setOptimisticMessages([]);
  }

  const error = conversationsQuery.error || startMutation.error || sendMutation.error || handoverMutation.error || guidedActionMutation.error;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <section className="mb-3 flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[#D8E2EA] bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-[#163B5C] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-sm font-black">1HandIndia support chat</p>
              <p className="truncate text-xs font-semibold text-[#DCE8F2]">Guided help with staff handover</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-white/10"
              aria-label="Close support chat"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="border-b border-[#E5E7EB] p-3">
            <div className="grid grid-cols-2 gap-2">
              {(["ORDER", "PAYMENT", "DELIVERY", requesterType === "SELLER" ? "SELLER" : requesterType === "BUSINESS_BUYER" ? "B2B" : "GENERAL"] as ChatTopic[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectTopic(item)}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-xs font-black",
                    topic === item ? "border-[#ED3500] bg-[#FFF0EC] text-[#B42318]" : "border-[#D8E2EA] text-[#344054]",
                  )}
                >
                  {humanize(item)}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#FFFCFB] p-3">
            {conversationsQuery.isLoading ? <ChatState text="Loading chat history" /> : null}
            {!activeConversation && !conversationsQuery.isLoading ? (
              <ChatState text="Start a chat with one short message." />
            ) : null}
            {visibleMessages.map((message) => (
              <ChatBubble
                key={message.id}
                mine={message.senderType === "USER"}
                body={message.body}
                message={message}
                onSelectOrder={selectGuidedOrder}
                onRunAction={(action) => sendGuidedOption(action)}
              />
            ))}
            {activeClosed ? (
              <div className="my-3 rounded-lg border border-[#C5D8E8] bg-[#EAF1F7] p-3 text-sm font-semibold text-[#163B5C]">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>This chat is closed. Start a new session if you still need help.</p>
                </div>
                <button
                  type="button"
                  onClick={startFreshChat}
                  className="mt-3 min-h-9 rounded-md bg-[#163B5C] px-3 text-xs font-black text-white"
                >
                  Start new chat
                </button>
              </div>
            ) : null}
            {activeConversation && !visibleMessages.length && !isTerminal(activeConversation.status) ? (
              <ChatState text={`${activeConversation.subject} is ready. Send a message or talk to staff.`} />
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {error ? (
            <p className="border-t border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#9B1C1C]">
              {userFacingApiErrorMessage(error)}
            </p>
          ) : null}

          <div className="border-t border-[#E5E7EB] p-3">
            {!activeClosed ? (
              <div className="mb-2 grid grid-cols-2 gap-2">
                {guidedOptions(topic, requesterType).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => sendGuidedOption(option)}
                    disabled={guidedActionMutation.isPending || handoverMutation.isPending}
                    className="min-h-10 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-left text-xs font-black text-[#163B5C] hover:border-[#ED3500] hover:text-[#B42318] disabled:cursor-not-allowed disabled:bg-[#F2F4F7] disabled:text-[#98A2B3]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
            {activeConversation && !activeClosed ? (
              <button
                type="button"
                onClick={() => handoverMutation.mutate(activeConversation.id)}
                className="mb-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D8E2EA] px-3 text-xs font-black text-[#163B5C]"
                disabled={handoverMutation.isPending}
              >
                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                Talk to staff
              </button>
            ) : null}
            <form onSubmit={submit} className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={activeClosed}
                placeholder={activeClosed ? "Chat is closed" : activeConversation ? "Type your message" : "How can we help?"}
                className="min-h-11 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] disabled:bg-[#F2F4F7] disabled:text-[#667085]"
              />
              <Button type="submit" disabled={activeClosed || startMutation.isPending || sendMutation.isPending}>
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ED3500] text-white shadow-xl"
        aria-label="Open support chat"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}

function clientMessageId(message: Pick<ChatMessage, "metadata">) {
  return typeof message.metadata === "object" && message.metadata !== null && "clientMessageId" in message.metadata
    ? String(message.metadata.clientMessageId ?? "")
    : "";
}

function createClientMessageId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isTerminal(status: string) {
  return status === "RESOLVED" || status === "CLOSED";
}

function ChatBubble({
  mine,
  body,
  message,
  onSelectOrder,
  onRunAction,
}: {
  mine: boolean;
  body: string;
  message: ChatMessage;
  onSelectOrder: (action: string, orderNumber: string) => void;
  onRunAction: (action: string) => void;
}) {
  const metadata = message.metadata;
  return (
    <div className={cn("mb-2 flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-lg px-3 py-2 text-sm font-semibold leading-5",
          mine ? "bg-[#ED3500] text-white" : "border border-[#D8E2EA] bg-white text-[#1F2933]",
        )}
      >
        <p>{body}</p>
        {!mine ? <GuidedMessageContent metadata={metadata} onSelectOrder={onSelectOrder} onRunAction={onRunAction} /> : null}
      </div>
    </div>
  );
}

function GuidedMessageContent({
  metadata,
  onSelectOrder,
  onRunAction,
}: {
  metadata: ChatMessage["metadata"];
  onSelectOrder: (action: string, orderNumber: string) => void;
  onRunAction: (action: string) => void;
}) {
  if (!isRecord(metadata)) return null;
  const meta: Record<string, unknown> = metadata;
  if (typeof meta.kind !== "string") return null;
  const kind = meta.kind;

  if (kind === "order_picker" && Array.isArray(meta.orders)) {
    const action = typeof meta.action === "string" ? meta.action : "Track my order";
    const orders = meta.orders.filter(isOrderSummary);
    return (
      <div className="mt-3 grid gap-2">
        {orders.map((order) => (
          <button
            key={order.orderNumber}
            type="button"
            onClick={() => onSelectOrder(action, order.orderNumber)}
            className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-left hover:border-[#ED3500]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-black text-[#163B5C]">{order.orderNumber}</span>
              <span className="text-xs font-black text-[#B42318]">{formatMoney(order.totalPaise, order.currency)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#667085]">{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <MiniPill label={humanize(order.orderStatus)} />
              <MiniPill label={humanize(order.deliveryStatus)} />
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (kind === "order_status" && isOrderSummary(meta.order)) {
    const order = meta.order;
    return (
      <div className="mt-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-black text-[#163B5C]">{order.orderNumber}</span>
          <span className="text-xs font-black text-[#B42318]">{formatMoney(order.totalPaise, order.currency)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatusTile label="Order" value={humanize(order.orderStatus)} />
          <StatusTile label="Payment" value={humanize(order.paymentStatus)} />
          <StatusTile label="Delivery" value={humanize(order.deliveryStatus)} />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#667085]">{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/account/orders/${encodeURIComponent(order.orderNumber)}`} className="rounded-md bg-[#163B5C] px-3 py-2 text-xs font-black text-white">
            Open order details
          </a>
          <button type="button" onClick={() => onRunAction("Talk to staff")} className="rounded-md border border-[#D8E2EA] px-3 py-2 text-xs font-black text-[#163B5C]">
            Talk to staff
          </button>
        </div>
      </div>
    );
  }

  if ((kind === "guided_text" || kind === "empty_state") && Array.isArray(meta.actions)) {
    const actions = meta.actions.filter((action): action is string => typeof action === "string");
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button key={action} type="button" onClick={() => onRunAction(action)} className="rounded-md border border-[#D8E2EA] px-3 py-2 text-xs font-black text-[#163B5C]">
            {action}
          </button>
        ))}
      </div>
    );
  }

  return null;
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-2">
      <p className="text-[10px] font-black uppercase text-[#667085]">{label}</p>
      <p className="mt-1 text-xs font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function MiniPill({ label }: { label: string }) {
  return <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#344054]">{label}</span>;
}

function ChatState({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center text-center">
      <StatusBadge tone="info">{text}</StatusBadge>
    </div>
  );
}

function requesterTypeFromPath(): ChatRequesterType {
  if (typeof window === "undefined") {
    return "CUSTOMER";
  }
  const pathname = window.location.pathname;
  if (pathname.startsWith("/seller")) return "SELLER";
  if (pathname.startsWith("/b2b")) return "BUSINESS_BUYER";
  if (pathname.startsWith("/delivery")) return "DELIVERY_PARTNER";
  return "CUSTOMER";
}

function subjectForTopic(topic: ChatTopic) {
  return `${humanize(topic)} help`;
}

function guidedOptions(topic: ChatTopic, requesterType: ChatRequesterType) {
  if (requesterType === "SELLER") {
    return ["Product listing issue", "Order fulfilment help", "Payout or wallet help", "Talk to staff"];
  }
  if (requesterType === "BUSINESS_BUYER") {
    return ["Quotation status", "Company profile help", "Bulk order support", "Talk to staff"];
  }
  if (requesterType === "DELIVERY_PARTNER") {
    return ["Pickup issue", "Customer unavailable", "COD mismatch", "Talk to staff"];
  }
  const options: Record<ChatTopic, string[]> = {
    ORDER: ["Track my order", "Cancel or change order", "Wrong or missing item", "Talk to staff"],
    PAYMENT: ["Payment failed", "Refund status", "COD or bank transfer help", "Talk to staff"],
    DELIVERY: ["Delivery delayed", "Change delivery address", "Courier tracking help", "Talk to staff"],
    SELLER: ["Seller store question", "Product availability", "Talk to staff"],
    B2B: ["Bulk enquiry status", "Quotation help", "Talk to staff"],
    DOWNLOAD_APP: ["App download help", "Login on app", "Talk to staff"],
    GENERAL: ["Account help", "Policy question", "Report an issue", "Talk to staff"],
  };
  return options[topic] ?? options.GENERAL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOrderSummary(value: unknown): value is ChatOrderSummary {
  return (
    isRecord(value) &&
    typeof value.orderNumber === "string" &&
    typeof value.orderStatus === "string" &&
    typeof value.paymentStatus === "string" &&
    typeof value.deliveryStatus === "string" &&
    typeof value.totalPaise === "number" &&
    typeof value.currency === "string" &&
    Array.isArray(value.items)
  );
}

function formatMoney(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
