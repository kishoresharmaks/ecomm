"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { DevAuthProvider } from "./dev-auth/dev-auth-context";
import { AdminAuthProvider } from "./admin/admin-auth-context";
import { ClerkCustomerAuthProvider, LocalCustomerAuthProvider } from "./auth/indihub-auth-context";
import { ChatSocketProvider } from "./chat/chat-socket-context";
import { ChatWidget } from "./chat/chat-widget";
import { MarketProvider } from "./market/market-context";
import { StorefrontLocationProvider } from "./storefront/storefront-location-context";
import { I18nProvider } from "./i18n/i18n-provider";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function Providers({ children }: { children: ReactNode }) {
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

  if (!shouldUseClerk || !clerkPublishableKey) {
    return app;
  }

  return <ClerkProvider publishableKey={clerkPublishableKey}>{app}</ClerkProvider>;
}
