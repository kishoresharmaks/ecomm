import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Camera01Icon,
  CheckmarkBadge02Icon,
  DeliveryReturn01Icon,
  Edit02Icon,
  HeadsetIcon,
  HeartIcon,
  Home01Icon,
  LegalDocument01Icon,
  Location01Icon,
  LockPasswordIcon,
  Logout03Icon,
  Notification02Icon,
  PackageIcon,
  QuestionIcon,
  Shield01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import {
  getBrowsingLocation,
  getCustomerProfile,
  getWishlist,
  listCustomerOrders,
} from "../../src/features/storefront/storefront-api";
import { accountErrorMessage } from "../../src/features/account/account-ui";
import { useLocationStore } from "../../src/state/location-store";
import { isMobileReturnsEnabled } from "../../src/features/returns/return-feature";
import { returnsCopy } from "../../src/features/returns/return-copy";
import { useCustomerPushNotificationStatus } from "../../src/features/notifications/use-customer-push-notifications";
import { colors } from "../../src/theme";

const CARD_BG = "#FFFFFF";
const BORDER = "#F3E7E2";
const TEXT = "#111827";
const MUTED = "#6B7280";
const SUCCESS = "#22C55E";

const profileRows = [
  { href: "/account/profile", icon: UserCircleIcon, text: "Name, email, phone number", title: "Personal information" },
  { href: "/account/addresses", icon: Home01Icon, text: "Manage your delivery addresses", title: "Addresses" },
  { href: "/account/location", icon: Location01Icon, text: "Browse and manage saved locations", title: "Saved locations" },
  { icon: LockPasswordIcon, text: "Update your account password", title: "Change password" },
  { href: "/account/notifications" as Href, icon: Notification02Icon, text: "Inbox and push preferences", title: "Notifications" },
] satisfies Array<{ href?: Href; icon: IconSvgElement; text: string; title: string }>;

const supportRows = [
  { href: "/account/support", icon: QuestionIcon, text: "FAQs and support articles", title: "Help center" },
  { href: "/account/support", icon: HeadsetIcon, text: "Get help from our team", title: "Contact support" },
  { icon: Shield01Icon, text: "Read our privacy policy", title: "Privacy policy" },
  { icon: LegalDocument01Icon, text: "Read our terms and conditions", title: "Terms & conditions" },
] satisfies Array<{ href?: Href; icon: IconSvgElement; text: string; title: string }>;

export default function AccountScreen() {
  const customerAuth = useMobileCustomerAuth();
  const { isSignedIn, signOut } = useAuth();
  const pushStatus = useCustomerPushNotificationStatus();
  const router = useRouter();
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const setSelectedLocation = useLocationStore((state) => state.setSelectedLocation);
  const entrance = useRef(new Animated.Value(0)).current;
  const returnsEnabled = isMobileReturnsEnabled(customerAuth.authKey);
  const returnCopy = returnsCopy();

  const profileQuery = useQuery({
    queryKey: ["mobile-account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const ordersQuery = useQuery({
    queryKey: ["mobile-orders", customerAuth.authKey, "account-preview"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, 3),
    enabled: customerAuth.enabled,
  });
  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const browsingLocationQuery = useQuery({
    queryKey: ["mobile-browsing-location", customerAuth.authKey],
    queryFn: () => getBrowsingLocation(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  useEffect(() => {
    Animated.spring(entrance, {
      damping: 18,
      mass: 0.9,
      stiffness: 95,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (browsingLocationQuery.data?.location) {
      setSelectedLocation(browsingLocationQuery.data.location);
    }
  }, [browsingLocationQuery.data?.location, setSelectedLocation]);

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <Screen>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Preparing account...</Text>
        </View>
      </Screen>
    );
  }

  if (!isSignedIn || !customerAuth.enabled) {
    return (
      <Screen>
        <View style={styles.signInWrap}>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>Manage your personal information</Text>
          <EmptyState title="Sign in to continue" message="Access orders, wishlist, addresses, saved location, and support history." />
          <Link href="/auth/sign-in" style={styles.primaryLink}>
            Sign in or create account
          </Link>
        </View>
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const orders = ordersQuery.data?.items ?? [];
  const wishlistCount = wishlistQuery.data?.items.length ?? profile?.wishlist?.items?.length ?? 0;
  const addressCount = profile?.addresses?.length ?? 0;
  const ordersCount = profile?._count?.orders ?? ordersQuery.data?.total ?? orders.length;
  const displayName =
    profile?.displayName ?? profile?.user?.fullName ?? customerAuth.userProfile.fullName ?? customerAuth.userProfile.email ?? "1HandIndia customer";
  const email = profile?.user?.email ?? customerAuth.userProfile.email ?? "";
  const phone = formatPhone(profile?.user?.phone);
  const profileSettingsRows = profileRows.map((item) =>
    item.title === "Saved locations"
      ? { ...item, text: selectedLocation.label || item.text }
      : item,
  );
  const supportSettingsRows = [
    ...(returnsEnabled
      ? [{
          href: "/account/returns" as Href,
          icon: DeliveryReturn01Icon,
          text: returnCopy.accountEntryText,
          title: returnCopy.accountEntryTitle,
        }]
      : []),
    ...supportRows,
  ];
  const animatedStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  return (
    <Screen padded={false}>
      <Animated.ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={animatedStyle}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => router.back()}>
            <HugeiconsIcon color={TEXT} icon={ArrowLeft02Icon} size={27} strokeWidth={2.3} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>My Profile</Text>
            <Text style={styles.subtitle}>Manage your personal information</Text>
          </View>
          <Pressable style={styles.editButton} onPress={() => router.push("/account/profile" as never)}>
            <HugeiconsIcon color={colors.primary} icon={Edit02Icon} size={24} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.userCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarGlow} />
              <View style={styles.avatar}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.avatarText}>
                  {initials(displayName)}
                </Text>
              </View>
              <View style={styles.cameraButton}>
                <HugeiconsIcon color="#475467" icon={Camera01Icon} size={21} strokeWidth={2.1} />
              </View>
            </View>
            <View style={styles.identityBody}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.identityName}>
                  {displayName}
                </Text>
                <HugeiconsIcon color={SUCCESS} icon={CheckmarkBadge02Icon} size={23} strokeWidth={2.1} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
              <Text numberOfLines={1} style={styles.identityMeta}>{email || "Add email address"}</Text>
              <Text numberOfLines={1} style={styles.identityMeta}>{phone}</Text>
            </View>
            <HugeiconsIcon color={MUTED} icon={ArrowRight02Icon} size={22} strokeWidth={2.2} />
          </View>

          <Pressable style={({ pressed }) => [styles.securityStrip, pressed ? styles.pressedLift : null]}>
            <View style={styles.securityIconWrap}>
              <HugeiconsIcon color={colors.primary} icon={Shield01Icon} size={31} strokeWidth={2.1} />
            </View>
            <View style={styles.securityCopy}>
              <Text style={styles.securityTitle}>Your account is secure</Text>
              <Text style={styles.securityText}>Secure 1HandIndia session active</Text>
            </View>
            <HugeiconsIcon color={MUTED} icon={ArrowRight02Icon} size={22} strokeWidth={2.1} />
          </Pressable>
        </View>

        {profileQuery.isError ? (
          <Text style={styles.errorText}>{accountErrorMessage(profileQuery.error, "Account profile could not load.")}</Text>
        ) : null}

        <SectionTitle title="Account overview" />
        <View style={styles.overviewCard}>
          <OverviewMetric color={colors.primary} icon={PackageIcon} label="Orders" value={String(ordersCount)} />
          <View style={styles.overviewDivider} />
          <OverviewMetric color="#0F9F55" icon={HeartIcon} label="Wishlist" value={String(wishlistCount)} />
          <View style={styles.overviewDivider} />
          <OverviewMetric color="#1475FF" icon={Location01Icon} label="Addresses" value={String(addressCount)} />
        </View>

        <SectionTitle title="Profile settings" />
        <View style={styles.listCard}>
          {profileSettingsRows.map((item, index) => (
            <SettingsRow
              icon={item.icon}
              isLast={index === profileRows.length - 1}
              key={item.title}
              onPress={item.href ? () => router.push(item.href as never) : undefined}
              text={item.text}
              title={item.title}
            />
          ))}
        </View>

        <SectionTitle title="Support & more" />
        <View style={styles.listCard}>
          {supportSettingsRows.map((item) => (
            <SettingsRow
              icon={item.icon}
              isLast={false}
              key={item.title}
              onPress={item.href ? () => router.push(item.href as never) : undefined}
              text={item.text}
              title={item.title}
            />
          ))}
          <SettingsRow
            danger
            icon={Logout03Icon}
            isLast
            onPress={() => {
              void pushStatus.revoke()?.finally(() => signOut());
            }}
            text="Sign out from your account"
            title="Sign out"
          />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function OverviewMetric({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: IconSvgElement;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.overviewMetric}>
      <HugeiconsIcon color={color} icon={icon} size={32} strokeWidth={2.1} />
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
    </View>
  );
}

function SettingsRow({
  danger = false,
  icon,
  isLast,
  onPress,
  text,
  title,
}: {
  danger?: boolean;
  icon: IconSvgElement;
  isLast: boolean;
  onPress: (() => void) | undefined;
  text: string;
  title: string;
}) {
  const iconColor = danger ? colors.primary : colors.primary;

  return (
    <Pressable disabled={!onPress} style={({ pressed }) => [styles.settingsRow, !isLast ? styles.settingsRowBorder : null, pressed ? styles.pressedLift : null]} onPress={onPress}>
      <View style={styles.rowIconWrap}>
        <HugeiconsIcon color={iconColor} icon={icon} size={29} strokeWidth={2.1} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger ? styles.rowTitleDanger : null]}>{title}</Text>
        <Text numberOfLines={1} style={styles.rowText}>{text}</Text>
      </View>
      <HugeiconsIcon color={MUTED} icon={ArrowRight02Icon} size={21} strokeWidth={2.2} />
    </Pressable>
  );
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "1H";
}

function formatPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (value?.trim()) {
    return value.trim();
  }

  return "Add phone number";
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 56,
    height: 112,
    justifyContent: "center",
    overflow: "hidden",
    width: 112,
  },
  avatarGlow: {
    backgroundColor: "rgba(237,53,0,0.08)",
    borderRadius: 999,
    height: 132,
    left: -10,
    position: "absolute",
    top: -10,
    width: 132,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 48,
    fontWeight: "900",
    maxWidth: 88,
  },
  avatarWrap: {
    height: 128,
    position: "relative",
    width: 128,
  },
  backButton: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 40,
  },
  cameraButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 9,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    shadowColor: "#A64B2A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: 44,
    elevation: 2,
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
  editButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 22,
    height: 58,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
    width: 58,
    elevation: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 22,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityBody: {
    flex: 1,
    minWidth: 0,
  },
  identityMeta: {
    color: "#536079",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  identityName: {
    color: TEXT,
    flexShrink: 1,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
    minWidth: 0,
  },
  listCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  overviewCard: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 132,
    paddingHorizontal: 10,
    paddingVertical: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  overviewDivider: {
    backgroundColor: BORDER,
    height: 82,
    width: 1,
  },
  overviewLabel: {
    color: "#536079",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 11,
  },
  overviewMetric: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  overviewValue: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 12,
  },
  pressedLift: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  primaryLink: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 18,
    overflow: "hidden",
    paddingVertical: 14,
    textAlign: "center",
  },
  profileTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rowText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  rowTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
  },
  rowTitleDanger: {
    color: colors.primary,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 13,
    marginTop: 26,
  },
  securityCopy: {
    flex: 1,
    minWidth: 0,
  },
  securityIconWrap: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  securityStrip: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  securityText: {
    color: "#536079",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  securityTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
  },
  settingsRow: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    flexDirection: "row",
    gap: 14,
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  settingsRowBorder: {
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
  },
  signInWrap: {
    flex: 1,
    justifyContent: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  subtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  userCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  verifiedText: {
    color: "#0F9F55",
    fontSize: 13,
    fontWeight: "900",
  },
});
