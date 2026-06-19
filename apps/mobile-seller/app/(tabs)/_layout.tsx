import {
  Home01Icon,
  PackageIcon,
  ShoppingBag01Icon,
  Suit02Icon,
  UserCircleIcon,
  ChartIcon,
  DollarSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { Tabs } from "expo-router";
import { StyleSheet, type ColorValue, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

type TabIconName = "home" | "products" | "orders" | "b2b" | "sales" | "finance" | "profile";

const tabIcons = {
  home: Home01Icon,
  products: ShoppingBag01Icon,
  orders: PackageIcon,
  b2b: Suit02Icon,
  sales: ChartIcon,
  finance: DollarSignIcon,
  profile: UserCircleIcon,
} satisfies Record<TabIconName, IconSvgElement>;

export default function SellerTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(10, insets.bottom);
  const tabBarHeight = 74 + Math.max(0, insets.bottom - 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "Plus Jakarta Sans",
          fontSize: 10,
          fontWeight: "900",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderColor: colors.border,
          borderRadius: 28,
          borderTopColor: colors.border,
          borderWidth: 1,
          bottom: tabBarBottom,
          elevation: 8,
          height: tabBarHeight,
          left: 12,
          paddingBottom: Math.max(8, insets.bottom > 0 ? 10 : 8),
          paddingTop: 7,
          position: "absolute",
          right: 12,
          shadowColor: colors.primary,
          shadowOffset: { height: 10, width: 0 },
          shadowOpacity: 0.07,
          shadowRadius: 24,
        },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          borderRadius: 22,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: iconRenderer("home") }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: iconRenderer("products") }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: iconRenderer("orders") }} />
      <Tabs.Screen name="b2b" options={{ title: "B2B", tabBarIcon: iconRenderer("b2b") }} />
      <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: iconRenderer("sales") }} />
      <Tabs.Screen name="finance" options={{ title: "Finance", tabBarIcon: iconRenderer("finance") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: iconRenderer("profile") }} />
    </Tabs>
  );
}

function iconRenderer(name: TabIconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={[styles.tabIconBubble, focused ? styles.tabIconBubbleActive : null]}>
        <HugeiconsIcon
          color={String(color)}
          icon={tabIcons[name]}
          size={focused ? 22 : 21}
          strokeWidth={focused ? 2.25 : 1.9}
        />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  tabIconBubble: {
    alignItems: "center",
    borderRadius: 16,
    height: 28,
    justifyContent: "center",
    width: 30,
  },
  tabIconBubbleActive: {
    backgroundColor: "#FFF2EE",
  },
});
