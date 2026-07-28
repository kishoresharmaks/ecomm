import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveImageUrl } from "../lib/image-url";
import { colors } from "../theme";
import { mobilePopupImage, type MobilePopupAnnouncement } from "../features/storefront/mobile-popup-announcement";
import { resolveMobileAnnouncementDestination } from "../features/storefront/mobile-announcement";
import { useMobilePopupAnnouncements } from "../features/storefront/use-mobile-popup-announcements";
import { RemoteImage } from "./remote-image";

export function PromotionalPopupSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const query = useMobilePopupAnnouncements();
  const scrollRef = useRef<ScrollView | null>(null);
  const openedVisit = useRef(0);
  const [visit, setVisit] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const items = query.data ?? [];
  const sheetWidth = Math.min(width - 24, 420);

  useFocusEffect(useCallback(() => {
    setVisit((current) => current + 1);
    setActiveIndex(0);
    setOpen(false);
    scrollRef.current?.scrollTo({ animated: false, x: 0 });
    return () => setOpen(false);
  }, []));

  useEffect(() => {
    const first = items[0];
    const source = resolveImageUrl(first ? mobilePopupImage(first) : null);
    if (!first || !source || visit <= 0 || openedVisit.current === visit) return;

    let active = true;
    void Image.prefetch(source).then((ready) => {
      if (active && ready && openedVisit.current !== visit) {
        openedVisit.current = visit;
        setOpen(true);
      }
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [items, visit]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [activeIndex, items.length]);

  async function follow(link: string | null) {
    const destination = resolveMobileAnnouncementDestination(link);
    if (!destination) return;
    setOpen(false);
    if (destination.type === "internal") {
      router.push(destination.href as Href);
      return;
    }
    if (await Linking.canOpenURL(destination.url)) await Linking.openURL(destination.url);
  }

  function updateIndex(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / sheetWidth))));
  }

  if (items.length === 0) return null;

  return (
    <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close promotional popup" style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14), width: sheetWidth }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerText}>Featured for you</Text>
            <Pressable accessibilityLabel="Close promotional popup" accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={updateIndex}
          >
            {items.map((popup) => (
              <PopupSlide key={popup.id} popup={popup} width={sheetWidth} onFollow={follow} />
            ))}
          </ScrollView>

          {items.length > 1 ? (
            <View style={styles.dots} accessibilityRole="tablist">
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityLabel={`Show promotion ${index + 1}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: index === activeIndex }}
                  onPress={() => {
                    setActiveIndex(index);
                    scrollRef.current?.scrollTo({ animated: true, x: index * sheetWidth });
                  }}
                  style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PopupSlide({ popup, width, onFollow }: { popup: MobilePopupAnnouncement; width: number; onFollow: (link: string | null) => Promise<void> }) {
  const primaryDestination = resolveMobileAnnouncementDestination(popup.primaryLinkUrl);
  return (
    <View style={[styles.slide, { width }]}>
      <Pressable
        accessibilityHint={primaryDestination ? "Opens this promotion" : undefined}
        accessibilityLabel={popup.imageAlt}
        accessibilityRole={primaryDestination ? "link" : "image"}
        disabled={!primaryDestination}
        onPress={() => void onFollow(popup.primaryLinkUrl)}
      >
        <RemoteImage
          fallbackLabel={popup.title}
          resizeMode="cover"
          style={styles.image}
          uri={resolveImageUrl(mobilePopupImage(popup))}
        />
      </Pressable>
      {popup.primaryCtaLabel || popup.secondaryCtaLabel ? (
        <View style={styles.actions}>
          {popup.primaryCtaLabel ? (
            <Pressable accessibilityRole="button" onPress={() => void onFollow(popup.primaryLinkUrl)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{popup.primaryCtaLabel}</Text>
            </Pressable>
          ) : null}
          {popup.secondaryCtaLabel ? (
            <Pressable accessibilityRole="button" onPress={() => void onFollow(popup.secondaryLinkUrl)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{popup.secondaryCtaLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(16, 24, 40, 0.62)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  sheet: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "92%",
    overflow: "hidden",
    paddingTop: 10,
  },
  handle: { alignSelf: "center", backgroundColor: "#D0D5DD", borderRadius: 999, height: 4, width: 44 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerText: { color: "#1F2933", fontSize: 15, fontWeight: "900" },
  closeText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  slide: { backgroundColor: colors.surface },
  image: { aspectRatio: 4 / 5, backgroundColor: "#FFF2EE", width: "100%" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 14 },
  primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexGrow: 1, paddingHorizontal: 16, paddingVertical: 13 },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, flexGrow: 1, paddingHorizontal: 16, paddingVertical: 13 },
  secondaryButtonText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  dots: { alignItems: "center", flexDirection: "row", gap: 7, justifyContent: "center", paddingBottom: 4, paddingTop: 10 },
  dot: { backgroundColor: "#D0D5DD", borderRadius: 999, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.primary, width: 24 },
});
