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

function createTabIcon(icon: IconSvgElement) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={[styles.tabIconBubble, focused ? styles.tabIconBubbleActive : null]}>
        <HugeiconsIcon
          color={String(color)}
          icon={icon}
          size={focused ? 22 : 21}
          strokeWidth={focused ? 2.25 : 1.9}
        />
      </View>
    );
  };
}

const HomeTabIcon = createTabIcon(Home01Icon);
const ProductsTabIcon = createTabIcon(ShoppingBag01Icon);
const OrdersTabIcon = createTabIcon(PackageIcon);
const ServicesTabIcon = createTabIcon(Suit02Icon);
const B2bTabIcon = createTabIcon(Suit02Icon);
const SalesTabIcon = createTabIcon(ChartIcon);
const FinanceTabIcon = createTabIcon(DollarSignIcon);
const ProfileTabIcon = createTabIcon(UserCircleIcon);

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
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: HomeTabIcon }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: ProductsTabIcon }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: OrdersTabIcon }} />
      <Tabs.Screen name="services" options={{ title: "Services", tabBarIcon: ServicesTabIcon }} />
      <Tabs.Screen name="b2b" options={{ title: "B2B", tabBarIcon: B2bTabIcon }} />
      <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: SalesTabIcon }} />
      <Tabs.Screen name="finance" options={{ title: "Finance", tabBarIcon: FinanceTabIcon }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ProfileTabIcon }} />
    </Tabs>
  );
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
