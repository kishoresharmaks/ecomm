"use client";

import { ReactNode, Suspense } from "react";
import type { CmsMenuItem } from "@/lib/storefront-api";
import { StorefrontMaintenanceGate } from "@/components/maintenance/maintenance-mode";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontMobileTabs } from "./storefront-mobile-tabs";

type StorefrontFrameMenus = {
  header?: CmsMenuItem[];
  footer?: CmsMenuItem[];
  legal?: CmsMenuItem[];
};

export function StorefrontFrame({
  children,
  initialMenus,
}: {
  children: ReactNode;
  initialMenus?: StorefrontFrameMenus | undefined;
}) {
  return (
    <StorefrontMaintenanceGate>
      <div className="flex min-h-screen flex-col bg-[#FAF7F0] text-[#1F2933]">
        <Suspense fallback={<div className="h-[160px] bg-[#FAF7F0]" />}>
          <StorefrontHeader initialMenu={initialMenus?.header} />
        </Suspense>
        <div className="flex flex-1 flex-col pb-28 lg:pb-0">
          <main className="flex-1">
            {children}
          </main>
          <StorefrontFooter initialFooterMenu={initialMenus?.footer} initialLegalMenu={initialMenus?.legal} />
        </div>
        <StorefrontMobileTabs />
      </div>
    </StorefrontMaintenanceGate>
  );
}
