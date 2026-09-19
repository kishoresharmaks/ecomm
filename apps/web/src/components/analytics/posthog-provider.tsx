"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense, ReactNode } from "react";
import posthog from "posthog-js";
import { initPostHog, isPostHogConfigured } from "@/lib/posthog-client";

function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

    posthog.capture("$pageview", {
      $current_url: url,
    });
  }, [pathname, searchParams]);

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
      const bannerDismissed = window.localStorage.getItem("indihub:privacy:cookie-consent-dismissed") === "true";
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
