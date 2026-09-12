import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import { openB2BWeb } from "../../../../src/features/b2b/b2b-web-redirect";
import {
  ENQUIRY_STATUS_LABEL,
  ENQUIRY_STATUS_COLOR,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import { getB2BEnquiry } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";
import type { BusinessBuyerEnquiry } from "../../../../src/features/b2b/b2b-types";

function EnquiryDetailContent() {
  const customerAuth = useMobileCustomerAuth();
  const params = useLocalSearchParams<{ enquiryId: string }>();
  const enquiryId = params.enquiryId ?? "";

  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId],
    queryFn: () => getB2BEnquiry(customerAuth.authHeaders, enquiryId, { messageLimit: 1 }),
    enabled: customerAuth.enabled && Boolean(enquiryId),
  });

  const enquiry: BusinessBuyerEnquiry | undefined = enquiryQuery.data;
  const statusLabel = enquiry ? ENQUIRY_STATUS_LABEL[enquiry.status] : "";
  const statusColor = enquiry ? ENQUIRY_STATUS_COLOR[enquiry.status] : colors.muted;

  if (enquiryQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading enquiry...</Text>
      </View>
    );
  }

  if (!enquiry) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Enquiry not found</Text>
        <Pressable style={styles.primaryBtn} onPress={() => openB2BWeb("/b2b/enquiries")}>
          <Text style={styles.primaryBtnText}>Go to B2B enquiries</Text>
        </Pressable>
      </View>
    );
  }

  const title = enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement enquiry";

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
        <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="Quantity" value={`${enquiry.quantity}`} />
        <InfoRow label="Submitted" value={enquiry.createdAt ? formatDate(enquiry.createdAt) : "—"} />
        {enquiry.product?.name ? <InfoRow label="Product" value={enquiry.product.name} /> : null}
        {enquiry.seller?.storeName ? <InfoRow label="Seller" value={enquiry.seller.storeName} /> : null}
      </View>

      {enquiry.message ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageLabel}>Your request</Text>
          <Text style={styles.messageText}>{enquiry.message}</Text>
        </View>
      ) : null}

      <View style={styles.cardSpacer} />

      <Pressable style={styles.primaryBtn} onPress={() => openB2BWeb(`/b2b/enquiries/${enquiryId}`)}>
        <Text style={styles.primaryBtnText}>Open full enquiry on web</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function B2BEnquiryDetailScreen() {
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "B2B Enquiry" }} />
      <B2BAuthGate requireProfile={false}>
        <EnquiryDetailContent />
      </B2BAuthGate>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
  heading: { color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" },
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  statusPill: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  statusPillText: { fontSize: 13, fontWeight: "700" },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  infoValue: { color: colors.ink, fontSize: 13, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  messageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  messageLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  messageText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  cardSpacer: { height: spacing.lg },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
