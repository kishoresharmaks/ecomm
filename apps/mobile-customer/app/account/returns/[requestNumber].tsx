import {
  ArrowRight02Icon,
  DeliveryReturn01Icon,
  Home01Icon,
  PackageIcon,
  TruckDeliveryIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../../src/components/empty-state";
import { RemoteImage } from "../../../src/components/remote-image";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { accountErrorMessage, formatDate, formatDateTime, StatusPill, SignInRequiredState } from "../../../src/features/account/account-ui";
import { formatMoney, useMobileMarket } from "../../../src/features/market/mobile-market";
import { customerSafeReturnDetail } from "../../../src/features/returns/return-eligibility";
import { isMobileReturnsEnabled } from "../../../src/features/returns/return-feature";
import { returnsCopy } from "../../../src/features/returns/return-copy";
import { formatReturnStatus, returnStatusPresentationFor, returnTimeline } from "../../../src/features/returns/return-status";
import { getCustomerReturn, type MobileReturnRequest, type MobileReturnRequestItem } from "../../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../../src/lib/image-url";
import { captureMobileException, trackMobileEvent } from "../../../src/lib/mobile-telemetry";
import { colors } from "../../../src/theme";

export default function ReturnDetailScreen() {
  const params = useLocalSearchParams<{ requestNumber?: string }>();
  const requestNumber = Array.isArray(params.requestNumber) ? params.requestNumber[0] : params.requestNumber;
  const customerAuth = useMobileCustomerAuth();
  const market = useMobileMarket();
  const copy = returnsCopy(market.market.locale);
  const featureEnabled = isMobileReturnsEnabled(customerAuth.authKey);

  const returnQuery = useQuery({
    queryKey: ["mobile-return-detail", customerAuth.authKey, requestNumber],
    queryFn: () => getCustomerReturn(customerAuth.authHeaders, requestNumber ?? ""),
    enabled: customerAuth.enabled && featureEnabled && Boolean(requestNumber),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (customerAuth.enabled && featureEnabled && requestNumber) {
      trackMobileEvent("return_detail_viewed", { source: "account" });
    }
  }, [customerAuth.enabled, featureEnabled, requestNumber]);

  useEffect(() => {
    if (returnQuery.isError) {
      captureMobileException(returnQuery.error, "return_detail_load_failed", {
        status: "detail_error",
      });
    }
  }, [returnQuery.error, returnQuery.isError]);

  if (!featureEnabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <EmptyState title={copy.disabledTitle} message={copy.disabledMessage} />
      </Screen>
    );
  }

  if (!requestNumber) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <EmptyState title={copy.returnNotFoundTitle} message={copy.returnNotFoundMessage} />
      </Screen>
    );
  }

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || returnQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: requestNumber }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>{copy.detailLoading}</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <SignInRequiredState title={copy.detailSignInTitle} message={copy.detailSignInMessage} />
      </>
    );
  }

  if (returnQuery.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: requestNumber }} />
        <EmptyState title={copy.detailLoadErrorTitle} message={accountErrorMessage(returnQuery.error, copy.genericRetryMessage)} />
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void returnQuery.refetch()}>
          <Text style={styles.primaryButtonText}>{copy.retry}</Text>
        </Pressable>
      </Screen>
    );
  }

  const detail = returnQuery.data;
  if (!detail) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: requestNumber }} />
        <EmptyState title={copy.returnNotFoundTitle} message={copy.returnUnavailableMessage} />
      </Screen>
    );
  }

  return <ReturnDetailContent copy={copy} detail={detail} />;
}

function ReturnDetailContent({ copy, detail }: { copy: ReturnType<typeof returnsCopy>; detail: MobileReturnRequest }) {
  const presentation = returnStatusPresentationFor(detail.status);
  const safeDetail = customerSafeReturnDetail(detail);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: detail.requestNumber }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <HugeiconsIcon color={colors.primary} icon={DeliveryReturn01Icon} size={30} strokeWidth={2.1} />
            </View>
            <View style={styles.heroCopy}>
              <Text numberOfLines={1} style={styles.heroTitle}>{detail.requestNumber}</Text>
              <Text style={styles.heroMeta}>Requested {formatDate(detail.createdAt)}</Text>
            </View>
            <StatusPill label={presentation.label} tone={presentation.tone} />
          </View>
          <Text style={styles.heroDescription}>{presentation.description}</Text>
          <View style={styles.heroActions}>
            <Link href={`/orders/${encodeURIComponent(detail.order.orderNumber)}` as never} asChild>
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{copy.viewOrder}</Text>
                <HugeiconsIcon color={colors.primary} icon={ArrowRight02Icon} size={17} strokeWidth={2.2} />
              </Pressable>
            </Link>
          </View>
        </View>

        <Section icon={PackageIcon} title={copy.selectedItemsLabel}>
          {detail.items.map((item) => (
            <ReturnItemRow currency={detail.currency} item={item} key={item.id} />
          ))}
        </Section>

        <Section icon={DeliveryReturn01Icon} title={copy.timelineTitle}>
          <View style={styles.timeline}>
            {returnTimeline(detail.status).map((event) => (
              <View
                accessibilityLabel={`${event.label}. ${event.current ? "Current status." : event.completed ? "Completed." : "Pending."}`}
                key={event.status}
                style={styles.timelineRow}
              >
                <View style={[styles.timelineDot, event.completed ? styles.timelineDotDone : null, event.current ? styles.timelineDotCurrent : null]} />
                <View style={styles.timelineBody}>
                  <Text style={[styles.timelineTitle, event.current ? styles.timelineTitleCurrent : null]}>{event.label}</Text>
                  <Text style={styles.timelineText}>{event.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section icon={TruckDeliveryIcon} title={copy.pickupShipmentTitle}>
          <View style={styles.detailGrid}>
            <Detail label={copy.modeLabel} value={formatReturnStatus(detail.reverseShipments?.[0]?.mode ?? "PLATFORM_PICKUP")} />
            <Detail label={copy.trackingLabel} value={detail.reverseShipments?.[0]?.trackingReference ?? copy.notAssigned} />
            <Detail label={copy.courierLabel} value={detail.reverseShipments?.[0]?.courierName ?? copy.notAssigned} />
            <Detail label={copy.updatedLabel} value={formatDateTime(detail.reviewedAt ?? detail.createdAt)} />
          </View>
        </Section>

        <Section icon={Home01Icon} title={copy.pickupAddressTitle}>
          {detail.pickupAddress ? (
            <View>
              <Text style={styles.addressName}>{detail.pickupAddress.fullName ?? copy.deliveryAddressFallback}</Text>
              <Text style={styles.addressText}>
                {[detail.pickupAddress.line1, detail.pickupAddress.line2, detail.pickupAddress.area].filter(Boolean).join(", ")}
              </Text>
              <Text style={styles.addressText}>
                {[detail.pickupAddress.city, detail.pickupAddress.state, detail.pickupAddress.pincode].filter(Boolean).join(" - ")}
              </Text>
              {detail.pickupAddress.phone ? <Text style={styles.addressText}>{detail.pickupAddress.phone}</Text> : null}
            </View>
          ) : (
            <Text style={styles.helpText}>{copy.pickupAddressUnavailable}</Text>
          )}
          <Text style={styles.helpText}>{copy.addressHelp}</Text>
        </Section>

        <Section icon={DeliveryReturn01Icon} title={copy.returnRequestTitle}>
          <Detail label={copy.resolutionSafeLabel} value={formatReturnStatus(detail.resolution)} />
          {safeDetail.reason ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>{copy.reasonSafeLabel}</Text>
              <Text style={styles.noteText}>{safeDetail.reason}</Text>
            </View>
          ) : null}
          {safeDetail.note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>{copy.noteSafeLabel}</Text>
              <Text style={styles.noteText}>{safeDetail.note}</Text>
            </View>
          ) : null}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ children, icon, title }: { children: ReactNode; icon: IconSvgElement; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <HugeiconsIcon color={colors.primary} icon={icon} size={22} strokeWidth={2.1} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ReturnItemRow({ currency, item }: { currency: string; item: MobileReturnRequestItem }) {
  const imageUrl = resolveImageUrl(item.product?.imageUrl ?? item.product?.images?.[0]?.url);
  const sellerName = item.sellerName ?? item.seller?.storeName;
  return (
    <View style={styles.itemRow}>
      <RemoteImage fallbackLabel={item.productName} resizeMode="contain" style={styles.itemImage} uri={imageUrl} />
      <View style={styles.itemBody}>
        <Text numberOfLines={2} style={styles.itemName}>{item.productName}</Text>
        <Text numberOfLines={1} style={styles.itemMeta}>
          Qty {item.quantity}
          {sellerName ? ` - ${sellerName}` : ""}
        </Text>
        <StatusPill label={formatReturnStatus(item.status)} tone={returnStatusPresentationFor(item.status).tone} />
      </View>
      {typeof item.requestedRefundPaise === "number" ? (
        <Text style={styles.itemAmount}>{formatMoney(item.requestedRefundPaise, currency, "en-IN")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addressName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  addressText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 128,
  },
  detailBox: {
    backgroundColor: "#FFF9F6",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: "45%",
    padding: 12,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },
  helpText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 10,
  },
  heroActions: {
    flexDirection: "row",
    marginTop: 16,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 14,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderRadius: 20,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  heroMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  itemAmount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemImage: {
    backgroundColor: "#FFF9F6",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 70,
    width: 70,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  itemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  noteBox: {
    backgroundColor: "#FFF9F6",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  noteLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 5,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginTop: 16,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  timeline: {
    gap: 12,
  },
  timelineBody: {
    flex: 1,
  },
  timelineDot: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    height: 14,
    marginTop: 3,
    width: 14,
  },
  timelineDotCurrent: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  timelineDotDone: {
    backgroundColor: colors.primary,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timelineText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  timelineTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  timelineTitleCurrent: {
    color: colors.primary,
    fontWeight: "900",
  },
});
