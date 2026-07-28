import { ArrowRight01Icon, Megaphone02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useMobileAnnouncements } from "../features/storefront/use-mobile-announcements";
import {
  mobileAnnouncementPalette,
  resolveMobileAnnouncementDestination,
  type MobileAnnouncement,
} from "../features/storefront/mobile-announcement";

const CAROUSEL_INTERVAL_MS = 3000;

export function AnnouncementCarousel() {
  const { data: announcements } = useMobileAnnouncements();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const router = useRouter();

  const slides = announcements ?? [];
  const slideWidth = Math.max(1, carouselWidth);

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
    if (slides.length <= 1 || carouselWidth <= 0 || isInteracting || prefersReducedMotion) {
      return undefined;
    }

    const intervalId = setTimeout(() => {
      const next = (activeIndex + 1) % slides.length;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ animated: true, x: next * slideWidth });
    }, CAROUSEL_INTERVAL_MS);

    return () => clearTimeout(intervalId);
  }, [activeIndex, carouselWidth, isInteracting, prefersReducedMotion, slideWidth, slides.length]);

  if (slides.length === 0) {
    return null;
  }

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== carouselWidth) {
      setCarouselWidth(nextWidth);
      setActiveIndex(0);
      scrollRef.current?.scrollTo({ animated: false, x: 0 });
    }
  }

  async function handlePress(announcement: MobileAnnouncement) {
    const destination = resolveMobileAnnouncementDestination(announcement.linkUrl);
    if (!destination) {
      return;
    }

    if (destination.type === "internal") {
      router.push(destination.href as Href);
      return;
    }

    if (await Linking.canOpenURL(destination.url)) {
      await Linking.openURL(destination.url);
    }
  }

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEnabled={slides.length > 1}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setIsInteracting(true)}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
          setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
          setIsInteracting(false);
        }}
        onScrollEndDrag={() => setIsInteracting(false)}
      >
        {slides.map((announcement) => {
          const palette = mobileAnnouncementPalette(announcement.backgroundColor, announcement.textColor);
          const destination = resolveMobileAnnouncementDestination(announcement.linkUrl);

          return (
            <Pressable
              key={announcement.id}
              accessibilityHint={destination ? "Opens announcement details" : undefined}
              accessibilityLabel={announcement.title}
              accessibilityRole={destination ? "link" : "text"}
              disabled={!destination}
              style={({ pressed }) => [
                styles.slide,
                {
                  width: slideWidth,
                  backgroundColor: palette.backgroundColor,
                  borderColor: palette.borderColor,
                },
                pressed && destination ? styles.slidePressed : null,
              ]}
              onPress={() => handlePress(announcement)}
            >
              <View style={[styles.iconWrap, { backgroundColor: palette.iconBackgroundColor }]}>
                <HugeiconsIcon color={palette.toneColor} icon={Megaphone02Icon} size={22} strokeWidth={2} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.eyebrow, { color: palette.toneColor }]}>Announcement</Text>
                <Text numberOfLines={2} style={[styles.text, { color: palette.accentColor }]}>
                  {announcement.title}
                </Text>
              </View>
              {destination ? (
                <View style={[styles.actionIcon, { backgroundColor: palette.iconBackgroundColor }]}>
                  <HugeiconsIcon color={palette.toneColor} icon={ArrowRight01Icon} size={18} strokeWidth={2.4} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {slides.length > 1 ? (
        <View accessibilityLabel={`Announcement ${activeIndex + 1} of ${slides.length}`} style={styles.pagination}>
          {slides.map((announcement, index) => (
            <View
              key={`${announcement.id}-indicator`}
              style={[styles.paginationDot, index === activeIndex ? styles.paginationDotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    width: "100%",
  },
  slide: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slidePressed: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  text: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  pagination: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 8,
  },
  paginationDot: {
    backgroundColor: "#E5D5CE",
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  paginationDotActive: {
    backgroundColor: "#ED3500",
    width: 18,
  },
});
