"use client";

import { ReactNode, Suspense } from "react";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontMobileTabs } from "./storefront-mobile-tabs";

export function StorefrontFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1F2933]">
      <Suspense fallback={<div className="h-[160px] bg-[#FAF7F0]" />}>
        <StorefrontHeader />
      </Suspense>
      <div className="pb-28 lg:pb-0">
        {children}
        <StorefrontFooter />
      </div>
      <StorefrontMobileTabs />
    </div>
  );
}
