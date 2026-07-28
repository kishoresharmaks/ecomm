import {
  Building04Icon,
  FileCheckIcon,
  Location01Icon,
  Message02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../src/features/b2b/b2b-auth-gate";
import {
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
} from "../../../src/features/b2b/b2b-enquiry-status";
import { getB2BProfile, listB2BEnquiries, listB2BOrders } from "../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../src/theme";

function B2BOverviewContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", customerAuth.authKey],
    queryFn: () => getB2BProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", customerAuth.authKey, "overview"],
    queryFn: () => listB2BEnquiries(customerAuth.authHeaders, { limit: 3 }),
    enabled: customerAuth.enabled,
  });

  const ordersQuery = useQuery({
    queryKey: ["b2b-orders", customerAuth.authKey, "overview"],
    queryFn: () => listB2BOrders(customerAuth.authHeaders, { limit: 3 }),
    enabled: customerAuth.enabled,
  });

  const profile = profileQuery.data;
  const enquiries = enquiriesQuery.data?.items ?? [];
  const orders = ordersQuery.data?.items ?? [];
  const totalEnquiries = enquiriesQuery.data?.total ?? 0;
  const totalOrders = ordersQuery.data?.total ?? 0;
  const openCount = enquiries.filter((e) => e.status === "SUBMITTED" || e.status === "IN_REVIEW").length;
  const respondedCount = enquiries.filter((e) => e.status === "RESPONDED").length;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile summary card */}
      <Pressable
        style={styles.profileCard}
        onPress={() => router.push("/account/b2b/profile" as never)}
      >
        <View style={styles.profileCardIcon}>
          <HugeiconsIcon color={colors.primary} icon={Building04Icon} size={28} strokeWidth={2} />
        </View>
        <View style={styles.profileCardBody}>
          <Text numberOfLines={1} style={styles.profileCardName}>
            {profile?.companyName ?? "Business Profile"}
          </Text>
          <Text style={styles.profileCardSub}>
            {profile?.status === "ACTIVE"
              ? "Profile active"
              : profile?.status === "PENDING"
                ? "Profile under review"
                : "Set up your B2B profile"}
          </Text>
        </View>
        <Text style={styles.profileCardEdit}>Edit</Text>
      </Pressable>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Enquiries" value={String(totalEnquiries)} color={colors.primary} />
        <StatCard label="Open" value={String(openCount)} color={colors.warning} />
        <StatCard label="Responded" value={String(respondedCount)} color="#1475FF" />
        <StatCard label="B2B Orders" value={String(totalOrders)} color={colors.success} />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.actionsRow}>
        <QuickAction
          icon={<HugeiconsIcon color={colors.primary} icon={PlusSignIcon} size={22} strokeWidth={2.2} />}
          label="New Enquiry"
          onPress={() => router.push("/account/b2b/enquiries/new" as never)}
        />
        <QuickAction
          icon={<HugeiconsIcon color="#1475FF" icon={Message02Icon} size={22} strokeWidth={2.2} />}
          label="My Enquiries"
          onPress={() => router.push("/account/b2b/enquiries" as never)}
        />
        <QuickAction
          icon={<HugeiconsIcon color={colors.success} icon={FileCheckIcon} size={22} strokeWidth={2.2} />}
          label="B2B Orders"
          onPress={() => router.push("/account/b2b/orders" as never)}
        />
        <QuickAction
          icon={<HugeiconsIcon color={colors.muted} icon={Location01Icon} size={22} strokeWidth={2.2} />}
          label="Addresses"
          onPress={() => router.push("/account/b2b/addresses" as never)}
        />
      </View>

      {/* Recent enquiries */}
      {enquiriesQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : enquiries.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recent enquiries</Text>
          {enquiries.map((enq) => (
            <Pressable
              key={enq.id}
              style={styles.listItem}
              onPress={() => router.push(`/account/b2b/enquiries/${enq.id}` as never)}
            >
              <View style={styles.listItemBody}>
                <Text numberOfLines={1} style={styles.listItemTitle}>
                  {enq.product?.name ?? enq.seller?.storeName ?? "General enquiry"}
                </Text>
                <Text style={styles.listItemSub}>Qty: {enq.quantity}</Text>
              </View>
              <Text
                style={[
                  styles.statusPill,
                  { backgroundColor: ENQUIRY_STATUS_COLOR[enq.status] + "22" },
                ]}
              >
                <Text style={{ color: ENQUIRY_STATUS_COLOR[enq.status], fontWeight: "700" }}>
                  {ENQUIRY_STATUS_LABEL[enq.status]}
                </Text>
              </Text>
            </Pressable>
          ))}
          {totalEnquiries > 3 ? (
            <Pressable
              style={styles.viewAllBtn}
              onPress={() => router.push("/account/b2b/enquiries" as never)}
            >
              <Text style={styles.viewAllText}>View all {totalEnquiries} enquiries</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {/* Recent orders */}
      {orders.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recent B2B orders</Text>
          {orders.map((order) => (
            <Pressable
              key={order.id}
              style={styles.listItem}
              onPress={() => router.push(`/account/b2b/orders/${order.orderNumber}` as never)}
            >
              <View style={styles.listItemBody}>
                <Text numberOfLines={1} style={styles.listItemTitle}>
                  {order.proformaInvoiceNumber}
                </Text>
                <Text style={styles.listItemSub}>Qty: {order.quantity}</Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

export default function B2BOverviewScreen() {
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "B2B Workspace" }} />
      <B2BAuthGate>
        <B2BOverviewContent />
      </B2BAuthGate>
    </Screen>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "33" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>{icon}</View>
      <Text numberOfLines={1} style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

import React from "react";

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  profileCardIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  profileCardBody: { flex: 1 },
  profileCardName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  profileCardSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  profileCardEdit: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: "47%",
    flex: 1,
    paddingVertical: spacing.md,
  },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 13, marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: spacing.sm },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickAction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: "47%",
  },
  quickActionIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  quickActionLabel: { color: colors.ink, fontSize: 13, fontWeight: "600", textAlign: "center" },
  listItem: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  listItemBody: { flex: 1 },
  listItemTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  listItemSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  viewAllBtn: { alignItems: "center", padding: spacing.md },
  viewAllText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
