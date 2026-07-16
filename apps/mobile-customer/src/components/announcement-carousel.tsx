import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, AccessibilityInfo } from "react-native";
import { BellDotIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import { useMobileAnnouncements } from "../features/storefront/use-mobile-announcements";
import { colors } from "../theme";
import type { MobileAnnouncement } from "../features/storefront/storefront-api";

function hexToRgba(hex: string | null | undefined, opacity: number): string | undefined {
  if (!hex) return undefined;
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return undefined;
  
  const r = parseInt(cleanHex.length === 3 ? cleanHex.charAt(0) + cleanHex.charAt(0) : cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.length === 3 ? cleanHex.charAt(1) + cleanHex.charAt(1) : cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.length === 3 ? cleanHex.charAt(2) + cleanHex.charAt(2) : cleanHex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const CAROUSEL_INTERVAL_MS = 3000;

export function AnnouncementCarousel() {
  const { data: announcements } = useMobileAnnouncements();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const router = useRouter();

  const slides = announcements ?? [];
  // Banner takes up width minus horizontal padding (e.g. 16px on each side)
  const slideWidth = width - 32;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setPrefersReducedMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setPrefersReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (activeIndex < slides.length) return;
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ animated: false, x: 0 });
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || slideWidth <= 0 || prefersReducedMotion) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      const next = (activeIndex + 1) % slides.length;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ animated: true, x: next * slideWidth });
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [activeIndex, prefersReducedMotion, slideWidth, slides.length]);

  if (slides.length === 0) {
    return null;
  }

  function handlePress(announcement: MobileAnnouncement) {
    if (!announcement.linkUrl) return;
    
    if (announcement.linkUrl.startsWith("http")) {
      void Linking.openURL(announcement.linkUrl);
    } else {
      router.push(announcement.linkUrl as never);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        scrollEnabled={slides.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
          setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
        }}
      >
        {slides.map((announcement) => {
          // Premium Glassmorphism: Convert backend color to a 15% opacity background
          const bg = hexToRgba(announcement.backgroundColor, 0.15) ?? "rgba(237, 53, 0, 0.08)";
          const border = hexToRgba(announcement.backgroundColor, 0.3) ?? "rgba(237, 53, 0, 0.15)";
          const textColors = announcement.textColor ?? colors.primary;

          return (
            <Pressable
              key={announcement.id}
              style={[
                styles.slide,
                { width: slideWidth, backgroundColor: bg, borderColor: border }
              ]}
              onPress={() => handlePress(announcement)}
            >
              <HugeiconsIcon color={textColors} icon={BellDotIcon} size={20} strokeWidth={2.2} />
              <Text 
                numberOfLines={1} 
                style={[styles.text, { color: textColors }]}
              >
                {announcement.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  slide: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    letterSpacing: -0.2,
  },
});
