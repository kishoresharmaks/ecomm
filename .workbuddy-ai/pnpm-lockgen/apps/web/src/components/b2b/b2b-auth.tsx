"use client";

import Link from "next/link";
import { Loader2, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { DevAuthPanel } from "@/components/dev-auth/dev-auth-panel";
import { useDevAuth } from "@/components/dev-auth/dev-auth-context";
import type { IndihubAuthHeaders } from "@/lib/api";

export type B2BAuthState = {
  mode: "clerk" | "local";
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  enabled: boolean;
  status: "signed-out" | "syncing" | "ready" | "error";
  error?: string;
  refresh: () => void;
};

export function useB2BAuth(): B2BAuthState {
  const customerAuth = useCustomerAuth();
  const devAuth = useDevAuth();
  const localAuthEnabled = customerAuth.mode === "local" || process.env.NEXT_PUBLIC_INDIHUB_ENABLE_LOCAL_AUTH === "true";

  if (localAuthEnabled) {
    const platformUserId = devAuth.userIds.businessBuyer.trim();

    return {
      mode: "local",
      authHeaders: platformUserId ? { platformUserId } : {},
      authKey: platformUserId ? `local:b2b:${platformUserId}` : "local:b2b:anonymous",
      enabled: Boolean(platformUserId),
      status: platformUserId ? "ready" : "signed-out",
      refresh: () => undefined
    };
  }

  return customerAuth;
}

export function B2BAuthNotice() {
  const auth = useB2BAuth();

  if (auth.enabled) {
    return null;
  }

  if (auth.mode === "local") {
    return <DevAuthPanel role="businessBuyer" />;
  }

  if (auth.status === "signed-out") {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />
            <p className="text-sm font-black text-[#1F2933]">Business buyer sign in required</p>
            <StatusBadge tone="warning">Signed out</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Sign in to manage company details and submit bulk product enquiries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/b2b/sign-up">
              <LogIn size={16} /> Create account
            </Link>
          </Button>
          <Button asChild>
            <Link href="/b2b/sign-in">
              <LogIn size={16} /> Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#8A1F1F]">Business buyer account sync failed</p>
          <p className="mt-1 text-xs leading-5 text-[#8A1F1F]">{auth.error ?? "Unable to sync the signed-in account."}</p>
        </div>
        <Button type="button" variant="outline" onClick={auth.refresh}>
          <RefreshCw size={16} /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 text-sm font-semibold text-[#667085]">
      <Loader2 className="h-4 w-4 animate-spin text-[#163B5C]" aria-hidden="true" />
      Syncing business buyer account
    </div>
  );
}
