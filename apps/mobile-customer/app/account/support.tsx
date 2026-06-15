import { HeadsetIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import {
  createAuthenticatedSupportRequest,
  getCustomerProfile,
  getStorefrontContact,
  listCustomerSupportRequests,
  mobileSupportContactChannels,
  mobileSupportTopics,
  type MobileSupportContactChannel,
  type MobileSupportRequest,
  type MobileSupportTopic,
} from "../../src/features/storefront/storefront-api";
import {
  AccountLoadingState,
  accountErrorMessage,
  formatDateTime,
  formatStatus,
  RetryState,
  SignInRequiredState,
  StatusPill,
} from "../../src/features/account/account-ui";
import { colors } from "../../src/theme";

export default function SupportCenterScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string }>();
  const initialOrderNumber = Array.isArray(params.orderNumber) ? params.orderNumber[0] : params.orderNumber;
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState<MobileSupportTopic>("ORDER");
  const [channel, setChannel] = useState<MobileSupportContactChannel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? "");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["mobile-account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const contactQuery = useQuery({
    queryKey: ["mobile-storefront-contact"],
    queryFn: getStorefrontContact,
    staleTime: 5 * 60 * 1000,
  });
  const historyQuery = useQuery({
    queryKey: ["mobile-support-requests", customerAuth.authKey],
    queryFn: () => listCustomerSupportRequests(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const enabledChannels = useMemo(() => {
    if (contactQuery.isError) {
      return ["EMAIL"] satisfies MobileSupportContactChannel[];
    }

    const configured = contactQuery.data?.enabledChannels?.filter((item): item is MobileSupportContactChannel =>
      mobileSupportContactChannels.includes(item as MobileSupportContactChannel),
    );

    return configured?.length ? configured : contactQuery.isLoading ? [] : (["EMAIL"] satisfies MobileSupportContactChannel[]);
  }, [contactQuery.data?.enabledChannels, contactQuery.isError, contactQuery.isLoading]);

  useEffect(() => {
    const firstChannel = enabledChannels[0];
    if (firstChannel && !enabledChannels.includes(channel)) {
      setChannel(firstChannel);
    }
  }, [channel, enabledChannels]);

  const createMutation = useMutation({
    mutationFn: () =>
      createAuthenticatedSupportRequest(customerAuth.authHeaders, {
        topic,
        preferredContactChannel: channel,
        subject: subject.trim(),
        ...(orderNumber.trim() ? { orderNumber: orderNumber.trim() } : {}),
        message: message.trim(),
      }),
    onSuccess: async () => {
      setFormError("");
      setSubject("");
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-support-requests", customerAuth.authKey] });
    },
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || profileQuery.isLoading || historyQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Support" }} />
        <AccountLoadingState title="Loading support center..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Support" }} />
        <SignInRequiredState title="Sign in for support" message="Create tickets and view support history from your account." />
      </>
    );
  }

  if (historyQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Support" }} />
        <RetryState
          title="Support history could not load"
          message={accountErrorMessage(historyQuery.error, "Check your connection and refresh support history.")}
          onRetry={() => void historyQuery.refetch()}
        />
      </>
    );
  }

  const requests = historyQuery.data ?? [];
  const submitDisabled = createMutation.isPending || contactQuery.isLoading || !enabledChannels.length;

  function submit() {
    if (contactQuery.isLoading) {
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setFormError("Enter subject and message.");
      return;
    }

    if (message.trim().length < 10) {
      setFormError("Message must be at least 10 characters.");
      return;
    }

    setFormError("");
    createMutation.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Support" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={requests}
        keyExtractor={(request) => request.id}
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <HugeiconsIcon color={colors.primary} icon={HeadsetIcon} size={30} strokeWidth={2.1} />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.title}>Support center</Text>
                <Text style={styles.subtitle}>Create a ticket and track replies from your account.</Text>
              </View>
              <Pressable style={styles.refreshButton} onPress={() => void historyQuery.refetch()}>
                {historyQuery.isFetching ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={20} strokeWidth={2.1} />
                )}
              </Pressable>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>New ticket</Text>
              <Text style={styles.label}>Topic</Text>
              <View style={styles.optionWrap}>
                {mobileSupportTopics.map((item) => (
                  <OptionChip key={item} active={topic === item} label={formatStatus(item)} onPress={() => setTopic(item)} />
                ))}
              </View>

              <Text style={styles.label}>Contact channel</Text>
              {contactQuery.isLoading ? <Text style={styles.helpText}>Loading contact channels...</Text> : null}
              {contactQuery.isError ? (
                <View style={styles.inlineErrorRow}>
                  <Text style={styles.errorText}>Contact config could not load. Email is available as fallback.</Text>
                  <Pressable onPress={() => void contactQuery.refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.optionWrap}>
                {enabledChannels.map((item) => (
                  <OptionChip
                    key={item}
                    active={channel === item}
                    disabled={contactQuery.isLoading}
                    label={formatStatus(item)}
                    onPress={() => setChannel(item)}
                  />
                ))}
              </View>

              <TextInput
                onChangeText={setSubject}
                placeholder="Subject"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={subject}
              />
              <TextInput
                onChangeText={setOrderNumber}
                placeholder="Order number optional"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={orderNumber}
              />
              <TextInput
                multiline
                onChangeText={setMessage}
                placeholder="Message"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.messageInput]}
                value={message}
              />

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              {createMutation.isError ? (
                <Text style={styles.errorText}>{accountErrorMessage(createMutation.error, "Support ticket could not be created.")}</Text>
              ) : null}

              <Pressable disabled={submitDisabled} style={[styles.primaryButton, submitDisabled ? styles.buttonDisabled : null]} onPress={submit}>
                {createMutation.isPending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Submit ticket</Text>}
              </Pressable>
            </View>

            <Text style={styles.historyTitle}>History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState title="No support tickets" message="Submitted tickets will appear here." />
          </View>
        }
        renderItem={({ item }) => <SupportRequestCard request={item} />}
      />
    </>
  );
}

function OptionChip({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.optionChip, active ? styles.optionChipActive : null, disabled ? styles.optionChipDisabled : null]} onPress={onPress}>
      <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SupportRequestCard({ request }: { request: MobileSupportRequest }) {
  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <View style={styles.ticketBody}>
          <Text numberOfLines={2} style={styles.ticketSubject}>{request.subject}</Text>
          <Text style={styles.ticketMeta}>
            {formatStatus(request.topic)} · {formatDateTime(request.createdAt)}
          </Text>
        </View>
        <StatusPill label={request.status} tone={request.status === "RESPONDED" ? "success" : "neutral"} />
      </View>
      {request.orderNumber ? <Text style={styles.ticketText}>Order {request.orderNumber}</Text> : null}
      <Text numberOfLines={3} style={styles.ticketText}>{request.message}</Text>
      {request.responseMessage ? (
        <View style={styles.responseBox}>
          <Text style={styles.responseLabel}>Response</Text>
          <Text style={styles.responseText}>{request.responseMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 110,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    padding: 14,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 13,
    textTransform: "uppercase",
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipDisabled: {
    opacity: 0.5,
  },
  optionChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  optionChipTextActive: {
    color: colors.surface,
  },
  inlineErrorRow: {
    marginBottom: 8,
  },
  retryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  messageInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 14,
    minHeight: 50,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  ticketHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  ticketBody: {
    flex: 1,
    minWidth: 0,
  },
  ticketSubject: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  ticketMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  ticketText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 9,
  },
  responseBox: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    marginTop: 10,
    padding: 10,
  },
  responseLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  responseText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 5,
  },
});
