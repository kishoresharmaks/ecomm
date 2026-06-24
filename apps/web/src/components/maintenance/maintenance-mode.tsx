"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, LifeBuoy, ShieldCheck, Store, Truck, Wrench } from "lucide-react";
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
  const Icon = scope === "delivery" ? Truck : scope === "seller" ? Store : Wrench;
  const message = setting?.message || scopeDescriptions[scope];

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-5 py-10 text-[#1F2933]">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-5xl items-center">
        <section className="w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-[#123A5A] p-8 text-white sm:p-10">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-[#ED3500] text-sm font-black">1HI</span>
                <span>
                  <span className="block text-xl font-black">1HandIndia</span>
                  <span className="block text-xs font-black uppercase tracking-[0.18em] text-[#FFB19B]">Maintenance</span>
                </span>
              </Link>
              <div className="mt-12 grid h-24 w-24 place-items-center rounded-lg bg-white/10 text-[#FFB19B]">
                <Icon className="h-11 w-11" aria-hidden="true" />
              </div>
              <p className="mt-8 max-w-sm text-sm font-semibold leading-6 text-[#DCE8F2]">
                Platform teams are keeping unaffected workspaces available while this area is updated.
              </p>
            </div>

            <div className="p-8 sm:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-md bg-[#FFF0EC] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ED3500]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Temporarily unavailable
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-normal text-[#123A5A] sm:text-5xl">
                {scopeLabels[scope]}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#536579]">{message}</p>
              {setting?.eta ? (
                <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-black text-[#123A5A]">
                  <Clock className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                  {setting.eta}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/support">
                    <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                    Contact support
                  </Link>
                </Button>
                {scope === "storefront" ? (
                  <Button asChild variant="outline">
                    <Link href="/account/orders">View orders</Link>
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
