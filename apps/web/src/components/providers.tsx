"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { ConsentManagedScripts, CookieConsentBanner } from "./compliance/cookie-consent";
import { DevAuthProvider } from "./dev-auth/dev-auth-context";
import { AdminAuthProvider } from "./admin/admin-auth-context";
import { ClerkCustomerAuthProvider, LocalCustomerAuthProvider } from "./auth/indihub-auth-context";
import { ChatSocketProvider } from "./chat/chat-socket-context";
import { ChatWidget } from "./chat/chat-widget";
import { MarketProvider } from "./market/market-context";
import { StorefrontLocationProvider } from "./storefront/storefront-location-context";
import { I18nProvider } from "./i18n/i18n-provider";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function Providers({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce: string | undefined;
}) {
  const pathname = usePathname();
  const shouldUseClerk = Boolean(
    clerkPublishableKey &&
      !pathname.startsWith("/admin") &&
      !pathname.startsWith("/finance") &&
      !pathname.startsWith("/courier") &&
      !pathname.startsWith("/support"),
  );
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  const app = (
    <QueryClientProvider client={queryClient}>
      <MarketProvider>
        <AdminAuthProvider>
          <DevAuthProvider>
            {shouldUseClerk ? (
              <ClerkCustomerAuthProvider>
                <ChatSocketProvider>
                  <StorefrontLocationProvider>
                    <I18nProvider>
                      {children}
                      <ChatWidget />
                      <CookieConsentBanner />
                      <ConsentManagedScripts nonce={nonce} />
                    </I18nProvider>
                  </StorefrontLocationProvider>
                </ChatSocketProvider>
              </ClerkCustomerAuthProvider>
            ) : (
              <LocalCustomerAuthProvider>
                <ChatSocketProvider>
                  <StorefrontLocationProvider>
                    <I18nProvider>
                      {children}
                      <ChatWidget />
                      <CookieConsentBanner />
                      <ConsentManagedScripts nonce={nonce} />
                    </I18nProvider>
                  </StorefrontLocationProvider>
                </ChatSocketProvider>
              </LocalCustomerAuthProvider>
            )}
          </DevAuthProvider>
        </AdminAuthProvider>
      </MarketProvider>
    </QueryClientProvider>
  );

  const getClerkDomain = () => {
    if (process.env.NODE_ENV !== "production") {
      return undefined;
    }
    const webUrl = process.env.NEXT_PUBLIC_WEB_URL;
    if (!webUrl) {
      return "1handindia.com";
    }
    try {
      const hostname = new URL(webUrl).hostname;
      return hostname.replace(/^www\./, "");
    } catch {
      return "1handindia.com";
    }
  };

  const clerkDomain = getClerkDomain();

  if (!shouldUseClerk || !clerkPublishableKey) {
    return app;
  }

  const clerkProps: any = {
    publishableKey: clerkPublishableKey,
  };
  if (nonce) {
    clerkProps.nonce = nonce;
  }
  if (clerkDomain) {
    clerkProps.domain = clerkDomain;
    clerkProps.isSatellite = false;
  }

  return (
    <ClerkProvider {...clerkProps}>
      {app}
    </ClerkProvider>
  );
}
