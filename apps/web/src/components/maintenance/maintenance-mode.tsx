"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, LifeBuoy, ShieldCheck, ShoppingBag, Store, Truck } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  canBypassMaintenancePreview,
  getMaintenanceSettings,
  isDeliveryMaintenancePath,
  isStorefrontMaintenancePath,
  maintenanceForScope,
  type MaintenanceScope,
  type MaintenanceScopeSetting,
} from "@/lib/maintenance-mode";

type MaintenanceGateProps = {
  scope: MaintenanceScope;
  children: ReactNode;
  block?: boolean;
};

const scopeLabels: Record<MaintenanceScope, string> = {
  storefront: "Shopping is under maintenance",
  seller: "Seller Center is under maintenance",
  delivery: "Delivery workspace is under maintenance",
};

const scopeDescriptions: Record<MaintenanceScope, string> = {
  storefront: "We are improving the shopping experience. Your account, order history, B2B portal, and support remain available.",
  seller: "Store operations are paused while we update Seller Center. Customer storefront and admin operations remain separate.",
  delivery: "Assigned delivery operations are paused while we update the delivery partner workspace.",
};

export function MaintenanceGate({ scope, children, block = true }: MaintenanceGateProps) {
  return (
    <Suspense fallback={<>{children}</>}>
      <MaintenanceGateContent scope={scope} block={block}>
        {children}
      </MaintenanceGateContent>
    </Suspense>
  );
}

function MaintenanceGateContent({ scope, children, block = true }: MaintenanceGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const admin = useAdminAuth();
  const query = useQuery({
    queryKey: ["maintenance-settings"],
    queryFn: getMaintenanceSettings,
    staleTime: 30_000,
  });
  const maintenance = maintenanceForScope(query.data, scope);
  const blocked = block && Boolean(maintenance?.enabled);
  const bypass = blocked && canBypassMaintenancePreview(searchParams, {
    isAuthenticated: admin.isAuthenticated,
    ...(admin.user?.roles ? { roles: admin.user.roles } : {}),
  });

  if (blocked && !bypass) {
    return <MaintenancePage scope={scope} setting={maintenance} />;
  }

  return (
    <>
      {bypass ? <MaintenanceBypassBanner scope={scope} pathname={pathname} /> : null}
      {children}
    </>
  );
}

export function StorefrontMaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <MaintenanceGate scope="storefront" block={isStorefrontMaintenancePath(pathname)}>
      {children}
    </MaintenanceGate>
  );
}

export function DeliveryMaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <MaintenanceGate scope="delivery" block={isDeliveryMaintenancePath(pathname)}>
      {children}
    </MaintenanceGate>
  );
}

function MaintenancePage({
  scope,
  setting,
}: {
  scope: MaintenanceScope;
  setting: MaintenanceScopeSetting | null;
}) {
  const Icon = scope === "delivery" ? Truck : scope === "seller" ? Store : ShoppingBag;
  const message = setting?.message || scopeDescriptions[scope];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFDFB] px-4 py-8 sm:px-6 lg:px-8 text-[#1F2933]">
      {/* Soft ambient background glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#ED3500]/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#ED3500]/5 blur-3xl" />

      <div className="relative mx-auto w-full max-w-4xl">
        <section className="overflow-hidden rounded-3xl border border-[#F3E8E2] bg-white shadow-[0_20px_50px_rgba(237,53,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
            {/* Left Brand & Visual Panel */}
            <div className="relative flex flex-col justify-between border-b border-[#F7E7DF] bg-gradient-to-br from-[#FFF5F1] via-[#FFF9F6] to-[#FFF0EB] p-8 sm:p-10 lg:border-b-0 lg:border-r">
              <Link href="/" className="inline-flex items-center gap-3 self-start">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ED3500] text-sm font-black text-white shadow-lg shadow-[#ED3500]/25">
                  1HI
                </span>
                <div>
                  <span className="block text-xl font-black text-[#1F2933]">1HandIndia</span>
                  <span className="inline-flex items-center rounded-full bg-[#ED3500]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ED3500]">
                    Maintenance
                  </span>
                </div>
              </Link>

              {/* Central 3D Styled Icon Container */}
              <div className="relative my-8 flex items-center justify-center sm:my-10">
                <div className="absolute h-36 w-36 rounded-full bg-[#ED3500]/15 blur-2xl" />
                <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-3xl border border-white/90 bg-white/80 p-6 shadow-[0_12px_32px_rgba(237,53,0,0.12)] backdrop-blur-md sm:h-40 sm:w-40">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-tr from-[#ED3500] to-[#FF6B42] text-white shadow-md shadow-[#ED3500]/30 sm:h-20 sm:w-20">
                    <Icon className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <p className="text-center text-xs font-semibold leading-relaxed text-[#7A8B99] lg:text-left">
                Platform teams are keeping unaffected workspaces available while this area is updated.
              </p>
            </div>

            {/* Right Content Panel */}
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#FCD9CE] bg-[#FFF0EC] px-3.5 py-1.5 text-xs font-bold text-[#ED3500]">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>We&apos;re polishing a few things — please check back in a moment.</span>
              </div>

              <h1 className="mt-5 text-2xl font-black tracking-tight text-[#1F2933] sm:text-4xl lg:text-[2.4rem] lg:leading-tight">
                {scopeLabels[scope]}
              </h1>

              <p className="mt-4 text-sm font-medium leading-relaxed text-[#5B6B79] sm:text-base">
                {message}
              </p>

              {setting?.eta ? (
                <div className="mt-5 inline-flex items-center gap-2 self-start rounded-full border border-[#E9EEF2] bg-[#F8FAFC] px-4 py-2 text-xs font-bold text-[#1F2933] shadow-sm sm:text-sm">
                  <Clock className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                  <span>
                    Estimated completion: <strong className="font-extrabold text-[#ED3500]">{setting.eta}</strong>
                  </span>
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild className="h-11 rounded-full bg-[#ED3500] px-6 font-bold text-white shadow-lg shadow-[#ED3500]/20 hover:bg-[#D93000]">
                  <Link href="/support">
                    <LifeBuoy className="mr-2 h-4 w-4" aria-hidden="true" />
                    Contact support
                  </Link>
                </Button>
                {scope === "storefront" ? (
                  <Button asChild variant="outline" className="h-11 rounded-full border-[#D8E2EA] px-6 font-bold text-[#1F2933] hover:bg-[#F8FAFC]">
                    <Link href="/account/orders">View orders</Link>
                  </Button>
                ) : scope === "seller" ? (
                  <Button asChild variant="outline" className="h-11 rounded-full border-[#D8E2EA] px-6 font-bold text-[#1F2933] hover:bg-[#F8FAFC]">
                    <Link href="/">Customer storefront</Link>
                  </Button>
                ) : scope === "delivery" ? (
                  <Button asChild variant="outline" className="h-11 rounded-full border-[#D8E2EA] px-6 font-bold text-[#1F2933] hover:bg-[#F8FAFC]">
                    <Link href="/support">Delivery help</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MaintenanceBypassBanner({
  scope,
  pathname,
}: {
  scope: MaintenanceScope;
  pathname: string;
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-[#F6C7B8] bg-[#FFF0EC] px-4 py-2 text-sm font-bold text-[#9F2600]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Maintenance preview bypass is active for {scope}.
        </span>
        <Link href={pathname} className="underline">
          View normal maintenance state
        </Link>
      </div>
    </div>
  );
}
