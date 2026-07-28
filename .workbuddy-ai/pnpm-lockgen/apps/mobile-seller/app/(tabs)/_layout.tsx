import {
  Home01Icon,
  PackageIcon,
  ShoppingBag01Icon,
  Suit02Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

function createTabIcon(icon: IconSvgElement) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <HugeiconsIcon color={String(color)} icon={icon} size={focused ? 22 : 21} strokeWidth={focused ? 2.3 : 1.9} />
    );
  };
}

const HomeTabIcon = createTabIcon(Home01Icon);
const ProductsTabIcon = createTabIcon(ShoppingBag01Icon);
const OrdersTabIcon = createTabIcon(PackageIcon);
const ServicesTabIcon = createTabIcon(Suit02Icon);
const MoreTabIcon = createTabIcon(UserCircleIcon);

export default function SellerTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "Plus Jakarta Sans",
          fontSize: 11,
          fontWeight: "900",
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 3,
          height: tabBarHeight,
          paddingBottom: Math.max(5, insets.bottom),
          paddingTop: 5,
          shadowColor: "#111827",
          shadowOffset: { height: -2, width: 0 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          minHeight: 52,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: HomeTabIcon }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: ProductsTabIcon }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: OrdersTabIcon }} />
      <Tabs.Screen name="services" options={{ title: "Services", tabBarIcon: ServicesTabIcon }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: MoreTabIcon }} />
      <Tabs.Screen name="b2b" options={{ href: null }} />
      <Tabs.Screen name="sales" options={{ href: null }} />
      <Tabs.Screen name="finance" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
