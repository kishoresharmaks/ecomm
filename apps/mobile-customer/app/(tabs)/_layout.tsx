import {
  GridViewIcon,
  Home01Icon,
  PackageIcon,
  Store01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type ColorValue,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabIconName = "home" | "categories" | "localShops" | "orders" | "account";
type TabRoute = "index" | "categories" | "local-shops" | "orders" | "account";

const tabIcons = {
  home: Home01Icon,
  categories: GridViewIcon,
  localShops: Store01Icon,
  orders: PackageIcon,
  account: UserCircleIcon,
} satisfies Record<TabIconName, IconSvgElement>;

const TAB_ROUTES: Array<{ name: TabRoute; label: string; iconKey: TabIconName }> = [
  { name: "index", label: "Home", iconKey: "home" },
  { name: "categories", label: "Categories", iconKey: "categories" },
  { name: "local-shops", label: "Local Shops", iconKey: "localShops" },
  { name: "orders", label: "Orders", iconKey: "orders" },
  { name: "account", label: "Account", iconKey: "account" },
];

const ACTIVE_COLOR = "#ED3500";
const ACTIVE_TEXT_COLOR = "#1F2933";
const INACTIVE_COLOR = "#8B949E";
const NAV_BORDER = "#EDE6E1";

// Spring config that mimics Reanimated's spring feel
const SPRING_CONFIG = { tension: 200, friction: 20, useNativeDriver: true };
const SPRING_OUT_CONFIG = { tension: 200, friction: 20, useNativeDriver: true };

function AnimatedTabItem({
  iconKey,
  label,
  isActive,
  onPress,
}: {
  iconKey: TabIconName;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const activeOpacity = useRef(new Animated.Value(0)).current;
  const activeLift = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1.05, ...SPRING_CONFIG }),
        Animated.spring(activeLift, { toValue: -3, ...SPRING_CONFIG }),
        Animated.timing(activeOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, ...SPRING_OUT_CONFIG }),
        Animated.spring(activeLift, { toValue: 0, ...SPRING_OUT_CONFIG }),
        Animated.timing(activeOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [isActive, scaleAnim, activeOpacity, activeLift]);

  function handlePressIn() {
    Animated.spring(pressScale, { toValue: 0.93, ...SPRING_CONFIG }).start();
  }

  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, ...SPRING_CONFIG }).start();
    onPress();
  }

  const activeScale = activeOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Animated.View style={[styles.tabItemWrapper, { transform: [{ scale: pressScale }] }]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        style={styles.tabItemPressable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.activeIconShell, { transform: [{ translateY: activeLift }] }]}>
          <Animated.View style={[styles.activeRingShadow, { opacity: activeOpacity, transform: [{ scale: activeScale }] }]} />
          <Animated.View style={[styles.activeRing, { opacity: activeOpacity, transform: [{ scale: activeScale }] }]} />
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <HugeiconsIcon
              color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
              icon={tabIcons[iconKey]}
              size={23}
              strokeWidth={isActive ? 2.25 : 1.9}
            />
          </Animated.View>
        </Animated.View>

        {/* Label */}
        <Text
          numberOfLines={1}
          style={[styles.tabLabel, { color: isActive ? ACTIVE_TEXT_COLOR : INACTIVE_COLOR }]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function FloatingNavBar({ activeRoute }: { activeRoute: TabRoute }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(18, insets.bottom + 8);

  // Entrance animation - slide up + fade in on mount
  const entranceY = useRef(new Animated.Value(120)).current;
  const entranceOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entranceY, { toValue: 0, tension: 80, friction: 16, useNativeDriver: true }),
      Animated.timing(entranceOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [entranceY, entranceOpacity]);

  function navigate(name: TabRoute) {
    if (name === "index") {
      router.push("/");
    } else {
      router.push(`/${name}` as never);
    }
  }

  return (
    <Animated.View
      style={[
        styles.navContainer,
        {
          bottom: bottomOffset,
          opacity: entranceOpacity,
          transform: [{ translateY: entranceY }],
        },
      ]}
    >
      <View style={styles.navbar}>
        {TAB_ROUTES.map((tab) => (
          <AnimatedTabItem
            key={tab.name}
            iconKey={tab.iconKey}
            isActive={activeRoute === tab.name}
            label={tab.label}
            onPress={() => navigate(tab.name)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1] ?? "index";
  const activeRoute = (lastSegment === "(tabs)" ? "index" : lastSegment) as TabRoute;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="categories" options={{ title: "Categories" }} />
        <Tabs.Screen name="local-shops" options={{ title: "Local Shops" }} />
        <Tabs.Screen name="orders" options={{ title: "Orders" }} />
        <Tabs.Screen name="account" options={{ title: "Account" }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
      </Tabs>
      <FloatingNavBar activeRoute={activeRoute} />
    </View>
  );
}

// Legacy icon renderer kept for reference
function _iconRenderer(name: TabIconName) {
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
  root: {
    flex: 1,
  },
  // --- Floating NavBar ---
  navContainer: {
    alignItems: "center",
    left: 0,
    paddingHorizontal: "5%",
    position: "absolute",
    right: 0,
    zIndex: 100,
  },
  navbar: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderColor: NAV_BORDER,
    borderRadius: 30,
    borderWidth: 1,
    elevation: 16,
    flexDirection: "row",
    height: 72,
    justifyContent: "space-around",
    paddingHorizontal: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    width: "100%",
  },
  tabItemWrapper: {
    alignItems: "center",
    flex: 1,
  },
  tabItemPressable: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 62,
    paddingBottom: 2,
    paddingTop: 6,
    position: "relative",
    width: 66,
  },
  activeIconShell: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    position: "relative",
    width: 46,
  },
  activeRing: {
    backgroundColor: "#FFFFFF",
    borderColor: ACTIVE_COLOR,
    borderWidth: 1.5,
    borderRadius: 999,
    height: 38,
    position: "absolute",
    width: 38,
  },
  activeRingShadow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    elevation: 6,
    height: 38,
    position: "absolute",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    width: 38,
  },
  iconWrapper: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 14,
    marginTop: 1,
    textAlign: "center",
  },
  // --- Legacy ---
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
