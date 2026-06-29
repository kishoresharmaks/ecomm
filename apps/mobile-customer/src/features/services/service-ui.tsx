import { Alert02Icon, Calendar03Icon, Location01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RemoteImage } from "../../components/remote-image";
import { colors } from "../../theme";
import { formatStatus, StatusPill } from "../account/account-ui";
import { getPricingLabel } from "./utils/pricingLabel";
import { serviceBookingStatusTone } from "./utils/bookingActions";
import type { MobileServiceBooking, MobileServiceListing } from "./types";

export function ServiceCard({
  service,
  compact = false,
  onPress,
}: {
  compact?: boolean;
  onPress: () => void;
  service: MobileServiceListing;
}) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.serviceCard, compact ? styles.compactCard : null, pressed ? styles.pressed : null]} onPress={onPress}>
      <View style={styles.imageWrap}>
        {service.coverImageUrl ? (
          <RemoteImage uri={service.coverImageUrl} style={styles.serviceImage} />
        ) : (
          <View style={styles.imageFallback}>
            <HugeiconsIcon color={colors.primary} icon={StarIcon} size={25} strokeWidth={2} />
          </View>
        )}
      </View>
      <View style={styles.serviceBody}>
        <Text numberOfLines={2} style={styles.serviceName}>{service.name}</Text>
        <Text numberOfLines={1} style={styles.serviceMeta}>{[service.categoryName, service.sellerName].filter(Boolean).join(" · ") || "Verified service"}</Text>
        <Text style={styles.servicePrice}>{getPricingLabel(service)}</Text>
        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.visitText}>{visitModeSummary(service)}</Text>
          {service.serviceability && !service.serviceability.serviceable ? (
            <HugeiconsIcon color={colors.warning} icon={Alert02Icon} size={17} strokeWidth={2.1} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function BookingCard({ booking, onPress }: { booking: MobileServiceBooking; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.bookingCard, pressed ? styles.pressed : null]} onPress={onPress}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingTitleBlock}>
          <Text numberOfLines={1} style={styles.serviceName}>{booking.serviceName}</Text>
          <Text style={styles.serviceMeta}>#{booking.bookingNumber}</Text>
        </View>
        <StatusPill label={booking.status} tone={serviceBookingStatusTone(booking.status)} />
      </View>
      <InfoLine icon={Calendar03Icon} text={booking.scheduledStartAt ? formatDateTimeShort(booking.scheduledStartAt) : "Not scheduled"} />
      <InfoLine icon={Location01Icon} text={booking.packageName ?? booking.providerName ?? "Not yet assigned"} />
      <Text style={styles.bookingAmount}>{booking.totalPayablePaise > 0 ? formatPaiseLocal(booking.totalPayablePaise, booking.currency) : "Quoted"}</Text>
    </Pressable>
  );
}

export function InfoLine({ icon, text }: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; text: string }) {
  return (
    <View style={styles.infoLine}>
      <HugeiconsIcon color={colors.muted} icon={icon} size={17} strokeWidth={2} />
      <Text numberOfLines={2} style={styles.infoText}>{text}</Text>
    </View>
  );
}

export function formatPaiseLocal(valuePaise?: number | null, currency = "INR") {
  const amount = Math.max(0, valuePaise ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2, style: "currency" }).format(amount);
  } catch {
    return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

export function formatDateTimeShort(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(date);
}

export function serviceStatusLabel(value: string) {
  return formatStatus(value);
}

function visitModeSummary(service: MobileServiceListing) {
  if (service.visitModes.includes("customer_location")) {
    return "At your location";
  }
  if (service.visitModes.includes("provider_location")) {
    return "Provider location";
  }
  return "Remote";
}

const styles = StyleSheet.create({
  serviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 12,
  },
  compactCard: {
    marginBottom: 0,
    width: 260,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
  imageWrap: {
    borderRadius: 8,
    height: 92,
    overflow: "hidden",
    width: 92,
  },
  serviceImage: {
    height: "100%",
    width: "100%",
  },
  imageFallback: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    flex: 1,
    justifyContent: "center",
  },
  serviceBody: {
    flex: 1,
    justifyContent: "center",
  },
  serviceName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  serviceMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  servicePrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 7,
  },
  visitText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  bookingHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  bookingTitleBlock: {
    flex: 1,
  },
  infoLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 7,
  },
  infoText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  bookingAmount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 11,
  },
});
