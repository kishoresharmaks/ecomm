"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense, ReactNode } from "react";
import posthog from "posthog-js";
import { initPostHog, isPostHogConfigured } from "@/lib/posthog-client";

function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);
  const pageviewTimestampRef = useRef<number>(Date.now());

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
      posthog.capture("$pageleave", {
        $current_url: previousUrlRef.current,
        $prev_pageview_duration: durationSeconds,
      });
    }

    previousUrlRef.current = url;
    pageviewTimestampRef.current = Date.now();

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
        posthog.capture("$pageleave", {
          $current_url: previousUrlRef.current,
          $prev_pageview_duration: durationSeconds,
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
