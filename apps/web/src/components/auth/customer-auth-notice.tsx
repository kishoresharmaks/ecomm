"use client";

import Link from "next/link";
import { Loader2, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { DevAuthPanel } from "@/components/dev-auth/dev-auth-panel";
import { userFacingApiErrorMessage } from "@/lib/api";
import { useCustomerAuth } from "./indihub-auth-context";

export function CustomerAuthNotice() {
  const auth = useCustomerAuth();

  if (auth.enabled) {
    return null;
  }

  if (auth.mode === "local") {
    return <DevAuthPanel role="customer" />;
  }

  if (auth.status === "signed-out") {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />
            <p className="text-sm font-black text-[#1F2933]">Customer sign in required</p>
            <StatusBadge tone="warning">Signed out</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#667085]">Sign in to use customer cart, checkout, orders, wishlist, and account pages.</p>
        </div>
        <Button asChild>
          <Link href="/sign-in">
            <LogIn size={16} /> Sign in
          </Link>
        </Button>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#8A1F1F]">Customer account sync failed</p>
          <p className="mt-1 text-xs leading-5 text-[#8A1F1F]">{auth.error ? userFacingApiErrorMessage(auth.error) : "Unable to prepare your customer session."}</p>
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
      Syncing customer account
    </div>
  );
}
