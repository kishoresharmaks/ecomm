"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import {
  googleAnalyticsDirectScript,
  googleConsentDefaultScript,
  primaryGoogleAnalyticsId,
  primaryGoogleTagManagerId,
} from "@/lib/google-analytics";

type ConsentChoice = "essential" | "analytics";

const consentStorageKey = "indihub:privacy:cookie-consent";
const consentEventName = "indihub-cookie-consent";
const bannerDismissedKey = "indihub:privacy:cookie-consent-dismissed";
const cloudflareBeaconToken = process.env.NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN?.trim();

export function CookieConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const stored = readConsentChoice();
    if (stored) {
      setChoice(stored);
      return;
    }

    // If banner was already dismissed once in a previous session, treat as implied consent.
    const wasDismissed = typeof window !== "undefined" && window.localStorage.getItem(bannerDismissedKey) === "true";
    if (wasDismissed) {
      setChoice("analytics");
      return;
    }

    setBannerVisible(true);
  }, []);

  function saveChoice(nextChoice: ConsentChoice) {
    setChoice(nextChoice);
    try {
      window.localStorage.setItem(consentStorageKey, JSON.stringify({ choice: nextChoice, savedAt: new Date().toISOString() }));
    } catch {
      // Ignore storage errors; consent still applies for the current page view.
    }
    window.dispatchEvent(new CustomEvent(consentEventName, { detail: nextChoice }));
  }

  function dismissBanner() {
    setBannerVisible(false);
    try {
      window.localStorage.setItem(bannerDismissedKey, "true");
    } catch {
      // Ignore storage errors.
    }
    // Treating dismissal as implied consent for analytics.
    saveChoice("analytics");
  }

  function handleEssentialOnly() {
    saveChoice("essential");
  }

  if (!bannerVisible || choice !== null) {
    return null;
  }

  return (
    <section
      aria-label="Privacy preferences"
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-[#ffc7b8] bg-[#FFFCFB] px-4 py-4 shadow-[0_-18px_48px_rgba(31,41,51,0.16)]"
    >
      <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="space-y-1">
          <p className="text-sm font-black text-[#1F2933]">Your privacy choices</p>
          <p className="max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
            We use essential storage for secure sign-in, cart, checkout, and marketplace preferences.
            Basic analytics are enabled by default to help us improve the site. You can choose to allow personalized ads as well, or keep them off.
          </p>
          <Link href="/privacy-policy" className="text-sm font-black text-[#ED3500] underline underline-offset-4">
            Privacy policy
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEssentialOnly}
            className="min-h-11 rounded-md border border-[#d8e2ea] bg-white px-4 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500]"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="min-h-11 rounded-md bg-[#ED3500] px-4 text-sm font-black text-white transition hover:bg-[#c72d00]"
          >
            Got it
          </button>
        </div>
      </div>
    </section>
  );
}

export function ConsentManagedScripts({
  nonce,
}: {
  nonce: string | undefined;
}) {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    setChoice(readConsentChoice());

    function handleConsent(event: Event) {
      const nextChoice = event instanceof CustomEvent ? event.detail : readConsentChoice();
      setChoice(nextChoice === "analytics" ? "analytics" : "essential");
    }

    window.addEventListener(consentEventName, handleConsent);
    return () => window.removeEventListener(consentEventName, handleConsent);
  }, []);

  const analyticsAllowed = choice === "analytics";

  if (!analyticsAllowed) {
    return (
      <Script id="indihub-google-consent-denied" nonce={nonce} strategy="afterInteractive">
        {`
          gtag('consent', 'update', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
        `}
      </Script>
    );
  }

  return (
    <>
      <Script id="indihub-google-consent-granted" nonce={nonce} strategy="afterInteractive">
        {`
          gtag('consent', 'update', {
            analytics_storage: 'granted',
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted'
          });
          window.dataLayer.push({ event: 'indihub_consent_granted' });
        `}
      </Script>
      <Script
        id="indihub-google-analytics-direct"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleAnalyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="indihub-google-analytics-init" nonce={nonce} strategy="afterInteractive">
        {googleAnalyticsDirectScript()}
      </Script>
      {cloudflareBeaconToken ? (
        <Script
          id="indihub-cloudflare-beacon"
          nonce={nonce}
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: cloudflareBeaconToken })}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}

function readConsentChoice(): ConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(consentStorageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { choice?: string };
    return parsed.choice === "analytics" ? "analytics" : "essential";
  } catch {
    return null;
  }
}
