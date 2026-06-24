import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type ChatConversationStatus = "OPEN" | "WAITING_FOR_STAFF" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ChatConversationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ChatConversationSensitivity = "NORMAL" | "DISPUTE" | "FRAUD_REVIEW" | "LEGAL_HOLD";
export type ChatRequesterType = "CUSTOMER" | "SELLER" | "BUSINESS_BUYER" | "DELIVERY_PARTNER";
export type ChatMessageSenderType = "USER" | "BOT" | "SUPPORT_AGENT" | "ADMIN" | "SYSTEM";
export type ChatMessageType = "TEXT" | "GUIDED_ACTION" | "STAFF_HANDOVER" | "INTERNAL_NOTE" | "SYSTEM_EVENT";
export type ChatTopic = "ORDER" | "PAYMENT" | "DELIVERY" | "SELLER" | "B2B" | "DOWNLOAD_APP" | "GENERAL";

export type ChatOrderSummary = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalPaise: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  items: Array<{ name: string; quantity: number }>;
};

export type ChatMessageMetadata =
  | { clientMessageId?: string }
  | { kind: "order_picker"; action: string; orders: ChatOrderSummary[] }
  | { kind: "order_status"; action: string; order: ChatOrderSummary; actions?: string[] }
  | { kind: "guided_text"; action: string; actions?: string[] }
  | { kind: "empty_state"; action: string; actions?: string[] }
  | Record<string, unknown>;

export type ChatUser = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId?: string | null;
  senderType: ChatMessageSenderType;
  messageType: ChatMessageType;
  body: string;
  visibleToUser: boolean;
  metadata?: ChatMessageMetadata | null;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  userId: string;
  assignedToUserId?: string | null;
  requesterType: ChatRequesterType;
  topic: ChatTopic;
  subject: string;
  status: ChatConversationStatus;
  priority: ChatConversationPriority;
  sensitivity: ChatConversationSensitivity;
  escalationReason?: string | null;
  firstResponseDueAt?: string | null;
  slaBreachedAt?: string | null;
  lastMessageAt: string;
  staffUnreadCount: number;
  userUnreadCount: number;
  user: ChatUser;
  assignedTo?: ChatUser | null;
  messages?: ChatMessage[];
  supportContext?: {
    order?: {
      orderNumber: string;
      orderStatus: string;
      paymentStatus: string;
      deliveryStatus: string;
    } | null;
    product?: {
      name: string;
      slug: string;
      status: string;
      approvalStatus: string;
      seller?: { storeName: string; status: string } | null;
    } | null;
    b2bEnquiry?: { id: string; status: string; quantity: number; createdAt: string } | null;
    supportRequest?: { id: string; status: string; subject: string; createdAt: string } | null;
  };
};

export type StartChatPayload = {
  requesterType: ChatRequesterType;
  topic: ChatTopic;
  subject: string;
  message: string;
};

export type StaffChatQuery = {
  status?: ChatConversationStatus | "ALL";
  priority?: ChatConversationPriority | "ALL";
  sensitivity?: ChatConversationSensitivity | "ALL";
  requesterType?: ChatRequesterType | "ALL";
  assignment?: "assigned" | "unassigned" | "mine" | "ALL";
  search?: string;
};

export type ChatSupportConfig = {
  enabled: boolean;
};

export function getChatSupportConfig() {
  return indihubFetch<ChatSupportConfig>("/api/chat/config");
}

export function listMyChatConversations(auth: IndihubAuthHeaders) {
  return indihubFetch<ChatConversation[]>("/api/chat/conversations", undefined, auth);
}

export function startChatConversation(auth: IndihubAuthHeaders, payload: StartChatPayload) {
  return indihubFetch<ChatConversation>(
    "/api/chat/conversations",
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function getMyChatConversation(auth: IndihubAuthHeaders, conversationId: string) {
  return indihubFetch<ChatConversation>(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, undefined, auth);
}

export function sendMyChatMessage(auth: IndihubAuthHeaders, conversationId: string, message: string, clientMessageId?: string) {
  return indihubFetch<ChatMessage>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify({ message, clientMessageId }) },
    auth,
  );
}

export function runMyChatGuidedAction(auth: IndihubAuthHeaders, conversationId: string, action: string, selectedValue?: string) {
  return indihubFetch<{ messages: ChatMessage[] }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/guided-actions`,
    { method: "POST", body: JSON.stringify({ action, selectedValue }) },
    auth,
  );
}

export function requestChatHandover(auth: IndihubAuthHeaders, conversationId: string, note?: string) {
  return indihubFetch<ChatConversation>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/handover`,
    { method: "POST", body: JSON.stringify({ note }) },
    auth,
  );
}

export function listStaffChatConversations(auth: IndihubAuthHeaders, query: StaffChatQuery = {}) {
  return indihubFetch<ChatConversation[]>(`/api/admin/chat/conversations${queryString(query)}`, undefined, auth);
}

export function getStaffChatConversation(auth: IndihubAuthHeaders, conversationId: string) {
  return indihubFetch<ChatConversation>(`/api/admin/chat/conversations/${encodeURIComponent(conversationId)}`, undefined, auth);
}

export function claimStaffChat(auth: IndihubAuthHeaders, conversationId: string) {
  return indihubFetch<ChatConversation>(
    `/api/admin/chat/conversations/${encodeURIComponent(conversationId)}/claim`,
    { method: "POST" },
    auth,
  );
}

export function replyStaffChat(auth: IndihubAuthHeaders, conversationId: string, message: string, clientMessageId?: string) {
  return indihubFetch<ChatMessage>(
    `/api/admin/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify({ message, clientMessageId }) },
    auth,
  );
}

export function updateStaffChat(auth: IndihubAuthHeaders, conversationId: string, payload: Record<string, unknown>) {
  return indihubFetch<ChatConversation>(
    `/api/admin/chat/conversations/${encodeURIComponent(conversationId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function linkChatSupportRequest(auth: IndihubAuthHeaders, conversationId: string) {
  return indihubFetch<ChatConversation>(
    `/api/admin/chat/conversations/${encodeURIComponent(conversationId)}/support-request`,
    { method: "POST" },
    auth,
  );
}

function queryString(query: StaffChatQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && value !== "ALL") {
      params.set(key, value);
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
