import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { io, type Socket } from "socket.io-client";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import {
  canCancelEnquiry,
  canConfirmEnquiry,
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import type {
  B2BEnquiryMessage,
  B2BEnquiryResponse,
  BusinessBuyerEnquiry,
} from "../../../../src/features/b2b/b2b-types";
import {
  cancelB2BEnquiry,
  confirmB2BEnquiry,
  getB2BEnquiry,
  sendB2BEnquiryMessage,
} from "../../../../src/lib/mobile-b2b-api";
import { apiBaseUrl } from "../../../../src/lib/api";
import { colors, spacing } from "../../../../src/theme";

type ThreadItem =
  | { type: "message"; id: string; message: B2BEnquiryMessage }
  | { type: "quote"; id: string; response: B2BEnquiryResponse; isLatest: boolean }
  | { type: "initial"; id: string; enquiry: BusinessBuyerEnquiry };

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
    newStatus: BusinessBuyerEnquiry["status"];
  };
};

const terminalStatuses = new Set(["BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"]);

function B2BEnquiryDetailContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ enquiryId: string }>();
  const enquiryId = params.enquiryId ?? "";
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<B2BEnquiryMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<BusinessBuyerEnquiry["status"] | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId],
    queryFn: () => getB2BEnquiry(customerAuth.authHeaders, enquiryId, { messageLimit: 50 }),
    enabled: customerAuth.enabled && Boolean(enquiryId),
  });

  const enquiry = enquiryQuery.data;
  const status = liveStatus ?? enquiry?.status;
  const sortedResponses = useMemo(
    () => [...(enquiry?.responses ?? [])].sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt)),
    [enquiry?.responses],
  );
  const latestResponse = sortedResponses[sortedResponses.length - 1] ?? null;
  const threadItems = useMemo(() => {
    if (!enquiry) return [];
    return [
      ...orderMessages(messages).map((message): ThreadItem => ({ type: "message", id: `message-${message.id}`, message })),
      ...sortedResponses
        .slice()
        .reverse()
        .map((response): ThreadItem => ({ type: "quote", id: `quote-${response.id}`, response, isLatest: response.id === latestResponse?.id })),
      { type: "initial", id: "initial-request", enquiry },
    ] satisfies ThreadItem[];
  }, [enquiry, latestResponse?.id, messages, sortedResponses]);

  useEffect(() => {
    if (!enquiry) return;
    setLiveStatus(enquiry.status);
    setMessages(orderMessages(enquiry.messages?.items ?? []));
    setNextCursor(enquiry.messages?.nextCursor ?? null);
  }, [enquiry]);

  useEffect(() => {
    if (!customerAuth.enabled || !enquiryId) return;
    let socket: Socket | null = null;
    let mounted = true;

    async function connect() {
      const token = await customerAuth.authHeaders.getBearerToken?.().catch(() => customerAuth.authHeaders.bearerToken);
      if (!mounted) return;
      socket = io(apiBaseUrl().replace(/\/api$/, "") + "/b2b", {
        auth: token ? { token } : {},
        transports: ["websocket"],
      });
      socket.on("connect", () => socket?.emit("b2b.enquiry.join", { enquiryId }));
      socket.io.on("reconnect", () => {
        socket?.emit("b2b.enquiry.join", { enquiryId });
        void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      });
      socket.on("b2b.enquiry.message", (payload: RealtimeMessageEvent) => {
        if (payload.enquiryId !== enquiryId) return;
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
      });
      socket.on("b2b.enquiry.status_changed", (payload: RealtimeStatusEvent) => {
        if (payload.enquiryId === enquiryId) {
          setLiveStatus(payload.data.newStatus);
        }
      });
      socket.on("b2b.enquiry.quotation_added", () => {
        void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      });
    }

    void connect();
    return () => {
      mounted = false;
      socket?.emit("b2b.enquiry.leave", { enquiryId });
      socket?.disconnect();
    };
  }, [customerAuth.authHeaders, customerAuth.authKey, customerAuth.enabled, enquiryId, queryClient]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelB2BEnquiry(customerAuth.authHeaders, enquiryId),
    onSuccess: (updated) => {
      setLiveStatus(updated.status);
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", customerAuth.authKey] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (responseId: string) => confirmB2BEnquiry(customerAuth.authHeaders, enquiryId, responseId),
    onSuccess: (updated) => {
      setLiveStatus(updated.status);
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", customerAuth.authKey] });
    },
  });

  const messageMutation = useMutation({
    mutationFn: (message: string) => sendB2BEnquiryMessage(customerAuth.authHeaders, enquiryId, message),
    onMutate: (message) => {
      const optimistic: B2BEnquiryMessage = {
        id: `temp-${Date.now()}`,
        enquiryId,
        senderUserId: "me",
        message,
        createdAt: new Date().toISOString(),
        sending: true,
        sender: { fullName: customerAuth.userProfile.fullName ?? "You" },
      };
      setMessages((current) => orderMessages([...current, optimistic]));
      return { optimisticId: optimistic.id };
    },
    onSuccess: (created, _message, context) => {
      setMessages((current) => orderMessages(current.map((item) => (item.id === context?.optimisticId ? created : item))));
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
    },
    onError: (_error, _message, context) => {
      setMessages((current) =>
        current.map((item) =>
          item.id === context?.optimisticId ? { ...item, sending: false, failed: true } : item,
        ),
      );
    },
  });

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await getB2BEnquiry(customerAuth.authHeaders, enquiryId, {
        messageCursor: nextCursor,
        messageLimit: 50,
      });
      setMessages((current) => orderMessages([...(older.messages?.items ?? []), ...current]));
      setNextCursor(older.messages?.nextCursor ?? null);
    } finally {
      setLoadingOlder(false);
    }
  }

  function submitMessage() {
    const message = draft.trim();
    if (!message || messageMutation.isPending) return;
    setDraft("");
    messageMutation.mutate(message);
  }

  if (enquiryQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Enquiry" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (enquiryQuery.isError || !enquiry) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Enquiry" }} />
        <EmptyState title="Could not load enquiry" message="Check your connection and try again." />
        <Pressable style={styles.retryBtn} onPress={() => void enquiryQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  const statusColor = ENQUIRY_STATUS_COLOR[status ?? enquiry.status];
  const statusLabel = ENQUIRY_STATUS_LABEL[status ?? enquiry.status];
  const showCancel = canCancelEnquiry(status ?? enquiry.status);
  const showConfirm = canConfirmEnquiry(status ?? enquiry.status) && Boolean(latestResponse);
  const canMessage = !terminalStatuses.has(status ?? enquiry.status) && ["RESPONDED", "NEGOTIATING"].includes(status ?? enquiry.status);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "B2B Negotiation" }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={88}>
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.title}>{enquiry.product?.name ?? enquiry.seller?.storeName ?? "Procurement enquiry"}</Text>
          <Text style={styles.subtitle}>Quantity {enquiry.quantity} / {formatDate(enquiry.createdAt)}</Text>
        </View>

        <FlatList
          inverted
          data={threadItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.threadContent}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} /> : null}
          renderItem={({ item }) => {
            switch (item.type) {
              case "initial":
                return <InitialRequestCard enquiry={item.enquiry} />;
              case "quote":
                return (
                  <QuotationCard
                    enquiry={enquiry}
                    response={item.response}
                    isLatest={item.isLatest}
                    canConfirm={showConfirm && item.isLatest}
                    isPending={confirmMutation.isPending}
                    onConfirm={() =>
                      Alert.alert("Confirm this quotation?", "The enquiry will move to buyer confirmed and wait for admin approval.", [
                        { text: "Keep reviewing", style: "cancel" },
                        { text: "Confirm quotation", onPress: () => latestResponse && confirmMutation.mutate(latestResponse.id) },
                      ])
                    }
                  />
                );
              case "message":
                return <MessageBubble message={item.message} isSelf={item.message.senderUserId === "me" || item.message.id.startsWith("temp-")} />;
            }
          }}
        />

        {enquiry.b2bOrder ? (
          <Pressable style={styles.orderLink} onPress={() => router.push(`/account/b2b/orders/${enquiry.b2bOrder!.orderNumber}` as never)}>
            <Text style={styles.orderLinkText}>View B2B Order</Text>
          </Pressable>
        ) : null}

        {cancelMutation.isError || confirmMutation.isError || messageMutation.isError ? (
          <Text style={styles.errorText}>
            {mutationError(cancelMutation.error ?? confirmMutation.error ?? messageMutation.error)}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          {showCancel ? (
            <Pressable
              disabled={cancelMutation.isPending}
              style={[styles.cancelBtn, cancelMutation.isPending && styles.disabled]}
              onPress={() =>
                Alert.alert("Cancel this enquiry?", "This enquiry will stop accepting messages and quotations.", [
                  { text: "Keep open", style: "cancel" },
                  { text: "Cancel enquiry", style: "destructive", onPress: () => cancelMutation.mutate() },
                ])
              }
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        {canMessage ? (
          <View style={styles.inputBar}>
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.slice(0, 2000))}
              placeholder="Write a negotiation message..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              style={styles.input}
            />
            <Pressable
              disabled={!draft.trim() || messageMutation.isPending}
              style={[styles.sendBtn, (!draft.trim() || messageMutation.isPending) && styles.disabled]}
              onPress={submitMessage}
            >
              {messageMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.lockedBar}>
            <Text style={styles.lockedText}>
              {status === "CANCELLED" ? "This enquiry was cancelled. Messages are locked." : "This enquiry has moved past negotiation. Messages are locked."}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function B2BEnquiryDetailScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Enquiry" }} />
      <B2BAuthGate requireProfile={false}>
        <B2BEnquiryDetailContent />
      </B2BAuthGate>
    </Screen>
  );
}

function InitialRequestCard({ enquiry }: { enquiry: BusinessBuyerEnquiry }) {
  return (
    <View style={styles.initialCard}>
      <Text style={styles.cardKicker}>Initial request</Text>
      <Text style={styles.cardTitle}>{enquiry.product?.name ?? enquiry.seller?.storeName ?? "Procurement enquiry"}</Text>
      <Text style={styles.cardBody}>{enquiry.message}</Text>
      <Text style={styles.cardMeta}>Quantity {enquiry.quantity}</Text>
    </View>
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
    <View style={[styles.quoteCard, isLatest && styles.quoteCardActive]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardKicker}>{isLatest ? "Active quotation" : "Superseded"}</Text>
        <Text style={styles.quotePrice}>{formatMoney(total ?? response.quotedPricePaise)}</Text>
      </View>
      <Text style={styles.cardTitle}>{response.responder?.fullName ?? response.responder?.email ?? "1HandIndia operations"}</Text>
      <Text style={styles.cardBody}>{response.responseMessage}</Text>
      <Text style={styles.cardMeta}>{formatDate(response.createdAt)}</Text>
      {canConfirm ? (
        <Pressable disabled={isPending} style={[styles.confirmBtn, isPending && styles.disabled]} onPress={onConfirm}>
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm quotation</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

function MessageBubble({ message, isSelf }: { message: B2BEnquiryMessage; isSelf: boolean }) {
  return (
    <View style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowOther]}>
      <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther, message.failed && styles.bubbleFailed]}>
        <Text style={[styles.bubbleSender, isSelf && styles.bubbleSenderSelf]}>
          {message.sender?.fullName ?? message.sender?.email ?? (isSelf ? "You" : "Participant")}
        </Text>
        <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{message.message}</Text>
        <Text style={[styles.bubbleTime, isSelf && styles.bubbleTimeSelf]}>
          {message.failed ? "Failed. Pull to refresh or resend." : message.sending ? "Sending..." : formatDate(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function orderMessages(messages: B2BEnquiryMessage[]) {
  const byId = new Map<string, B2BEnquiryMessage>();
  for (const message of messages) byId.set(message.id, message);
  return Array.from(byId.values()).sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt));
}

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function formatDate(iso?: string | null) {
  if (!iso) return "Not available";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatMoney(paise?: number | null) {
  if (paise === null || paise === undefined) return "Not quoted";
  return `Rs. ${(paise / 100).toFixed(2)}`;
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  header: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    padding: spacing.lg,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: { fontSize: 13, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  threadContent: { gap: spacing.sm, padding: spacing.lg },
  initialCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: spacing.md,
  },
  quoteCardActive: { borderColor: colors.primary, borderWidth: 1.5 },
  rowBetween: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardKicker: { color: colors.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  cardBody: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  quotePrice: { color: colors.success, fontSize: 14, fontWeight: "900" },
  confirmBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  bubbleRow: { flexDirection: "row" },
  bubbleRowSelf: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    borderRadius: 16,
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleSelf: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  bubbleFailed: { borderColor: colors.danger, borderWidth: 1.5 },
  bubbleSender: { color: colors.muted, fontSize: 11, fontWeight: "900", marginBottom: 2 },
  bubbleSenderSelf: { color: "rgba(255,255,255,0.78)" },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  bubbleTextSelf: { color: "#fff" },
  bubbleTime: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 4 },
  bubbleTimeSelf: { color: "rgba(255,255,255,0.7)" },
  orderLink: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  orderLinkText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  actionRow: { paddingHorizontal: spacing.lg },
  cancelBtn: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cancelBtnText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  sendBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  lockedBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.md,
  },
  lockedText: { color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "center" },
  errorText: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, textAlign: "center" },
  disabled: { opacity: 0.6 },
  retryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  retryBtnText: { color: "#fff", fontWeight: "700" },
});
