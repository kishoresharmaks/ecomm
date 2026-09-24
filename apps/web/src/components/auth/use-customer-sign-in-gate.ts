"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { capturePostHogEvent } from "@/lib/posthog-client";
import { customerSignInHref } from "./auth-page-routing";
import { useCustomerAuth } from "./indihub-auth-context";

export const customerSignInRequiredMessage = "Sign in before using cart actions.";

// Returns false when the customer must sign in first. A signed-out Clerk visitor goes to the
// sign-in page and returns to the current page after sign-in.
export function useCustomerSignInGate() {
  const auth = useCustomerAuth();
  const router = useRouter();

  return useCallback(
    (source: string) => {
      if (auth.enabled) {
        return true;
      }

      const redirected = auth.mode === "clerk" && auth.status === "signed-out";
      capturePostHogEvent("customer_sign_in_prompted", {
        source,
        auth_status: auth.status,
        redirected,
      });
      if (redirected) {
        router.push(customerSignInHref(`${window.location.pathname}${window.location.search}`) as Route);
      }
      return false;
    },
    [auth.enabled, auth.mode, auth.status, router],
  );
}
