import {
  ChartIcon,
  Chat01Icon,
  CreditCardIcon,
  DollarSignIcon,
  PackageIcon,
  Settings02Icon,
  StarIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Header, Screen } from "../../src/components/screen";
import { colors, spacing } from "../../src/theme";

const moreItems: Array<{
  title: string;
  subtitle: string;
  href: Href;
  icon: IconSvgElement;
}> = [
  { title: "Finance", subtitle: "Wallet, payouts, ledger, and statements", href: "/(tabs)/finance", icon: DollarSignIcon },
  { title: "B2B", subtitle: "Enquiries and approved purchase orders", href: "/(tabs)/b2b", icon: Chat01Icon },
  { title: "Sales", subtitle: "Performance and growth tools", href: "/(tabs)/sales", icon: ChartIcon },
  { title: "Profile", subtitle: "Store, payout, and business details", href: "/(tabs)/profile", icon: UserCircleIcon },
  { title: "Reviews", subtitle: "Customer ratings and replies", href: "/reviews", icon: StarIcon },
  { title: "Coupons", subtitle: "Seller-funded campaign participation", href: "/coupons", icon: CreditCardIcon },
  { title: "Deals", subtitle: "Promotions and event participation", href: "/deals", icon: Settings02Icon },
  { title: "Returns", subtitle: "Review return requests and QC notes", href: "/returns", icon: PackageIcon },
  { title: "Subscription", subtitle: "Seller plan and renewal status", href: "/subscription", icon: Settings02Icon },
];

export default function SellerMoreScreen() {
  return (
    <Screen contentContainerStyle={styles.content}>
      <Header title="More" subtitle="Open the seller tools that do not need permanent bottom navigation space." />
      <Card style={styles.grid}>
        {moreItems.map((item) => (
          <Pressable key={item.title} accessibilityRole="button" onPress={() => router.push(item.href)} style={styles.row}>
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={item.icon} color={colors.primary} size={22} strokeWidth={2.1} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>{">"}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  grid: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  chevron: {
    color: colors.muted,
    fontSize: 26,
    fontWeight: "700",
  },
});
