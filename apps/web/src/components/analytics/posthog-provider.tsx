"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense, ReactNode } from "react";
import posthog from "posthog-js";
import { initPostHog, isPostHogConfigured } from "@/lib/posthog-client";

function calculateScrollPercentages(): { currentScrollPercentage: number } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { currentScrollPercentage: 0 };
  }

  const scrollTop =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const winHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight,
  );

  if (docHeight <= winHeight) {
    return { currentScrollPercentage: 100 };
  }

  const percentage = Math.min(
    100,
    Math.max(0, Math.round(((scrollTop + winHeight) / docHeight) * 100)),
  );
  return { currentScrollPercentage: percentage };
}

function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);
  const pageviewTimestampRef = useRef<number>(Date.now());
  const maxScrollRef = useRef<number>(0);

  // Monitor scroll depth on active page
  useEffect(() => {
    function handleScroll() {
      const { currentScrollPercentage } = calculateScrollPercentages();
      if (currentScrollPercentage > maxScrollRef.current) {
        maxScrollRef.current = currentScrollPercentage;
      }
    }

    // Initialize with first view
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !isPostHogConfigured()) {
      return;
    }

    initPostHog();

    let url = window.location.origin + pathname;
    const searchString = searchParams?.toString();
    if (searchString) {
      url += `?${searchString}`;
    }

    // Capture $pageleave for previous page on SPA navigation
    if (previousUrlRef.current && previousUrlRef.current !== url) {
      const durationSeconds = Math.max(
        0,
        Math.round((Date.now() - pageviewTimestampRef.current) / 1000),
      );
      const { currentScrollPercentage } = calculateScrollPercentages();
      const maxScroll = Math.max(maxScrollRef.current, currentScrollPercentage);

      posthog.capture("$pageleave", {
        $current_url: previousUrlRef.current,
        $prev_pageview_duration: durationSeconds,
        $prev_pageview_max_content_percentage: maxScroll,
        $prev_pageview_max_scroll_percentage: maxScroll,
        $prev_pageview_last_scroll_percentage: currentScrollPercentage,
        "last scroll percentage": currentScrollPercentage,
        "max scroll percentage": maxScroll,
      });
    }

    previousUrlRef.current = url;
    pageviewTimestampRef.current = Date.now();
    maxScrollRef.current = calculateScrollPercentages().currentScrollPercentage;

    posthog.capture("$pageview", {
      $current_url: url,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    return () => {
      // Capture $pageleave on final unmount
      if (previousUrlRef.current && isPostHogConfigured()) {
        const durationSeconds = Math.max(
          0,
          Math.round((Date.now() - pageviewTimestampRef.current) / 1000),
        );
        const { currentScrollPercentage } = calculateScrollPercentages();
        const maxScroll = Math.max(maxScrollRef.current, currentScrollPercentage);

        posthog.capture("$pageleave", {
          $current_url: previousUrlRef.current,
          $prev_pageview_duration: durationSeconds,
          $prev_pageview_max_content_percentage: maxScroll,
          $prev_pageview_max_scroll_percentage: maxScroll,
          $prev_pageview_last_scroll_percentage: currentScrollPercentage,
          "last scroll percentage": currentScrollPercentage,
          "max scroll percentage": maxScroll,
        });
      }
    };
  }, []);

  return null;
}

export function PostHogProvider({ children }: { children?: ReactNode }) {
  useEffect(() => {
    if (!isPostHogConfigured()) {
      return;
    }

    const client = initPostHog();
    if (!client) {
      return;
    }

    function applyConsent(choice: string | null) {
      if (choice === "essential") {
        posthog.opt_out_capturing();
      } else {
        posthog.opt_in_capturing();
      }
    }

    try {
      const bannerDismissed =
        window.localStorage.getItem("indihub:privacy:cookie-consent-dismissed") === "true";
      if (bannerDismissed) {
        applyConsent("analytics");
      } else {
        const raw = window.localStorage.getItem("indihub:privacy:cookie-consent");
        if (raw) {
          const parsed = JSON.parse(raw) as { choice?: string };
          applyConsent(parsed.choice ?? null);
        }
      }
    } catch {
      // Ignore localStorage access errors
    }

    function handleConsentEvent(event: Event) {
      const choice = event instanceof CustomEvent ? (event.detail as string) : null;
      applyConsent(choice);
    }

    window.addEventListener("indihub-cookie-consent", handleConsentEvent);
    return () => {
      window.removeEventListener("indihub-cookie-consent", handleConsentEvent);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageViewTracker />
      </Suspense>
      {children}
    </>
  );
}
