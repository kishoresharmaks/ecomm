"use client";

import Link from "next/link";
import { ArrowLeft, Building2, MapPin, RefreshCw, ShieldCheck, ShoppingBag, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  addCartItem,
  getStoreProfile,
  listProducts,
  primaryVariant,
  type ProductSummary
} from "@/lib/storefront-api";
import { ProductCard } from "./product-card";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontPanel,
  StorefrontSummaryRow,
  StorefrontSkeleton,
} from "./storefront-ui";
import { locationMatchLabel, sellerLocationLabel } from "./storefront-location-utils";

export function StoreProfileClient({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const storeQuery = useQuery({
    queryKey: ["store-profile", slug],
    queryFn: () => getStoreProfile(slug),
    retry: false
  });
  const productsQuery = useQuery({
    queryKey: ["products", "store", storeQuery.data?.id],
    queryFn: () => listProducts({ sellerId: storeQuery.data?.id ?? "", limit: 24 }),
    enabled: Boolean(storeQuery.data?.id)
  });
  const addMutation = useMutation({
    mutationFn: (product: ProductSummary) => {
      const variant = primaryVariant(product);
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (!variant) {
        throw new Error("This product does not have an active variant.");
      }

      return addCartItem(customerAuth.authHeaders, variant.id, 1);
    },
    onSuccess: (_cart, product) => {
      setNotice(`${product.name} added to cart.`);
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to add product to cart.")
  });

  const store = storeQuery.data;
  const address = store?.addresses[0];
  const bannerUrl = store?.profile?.bannerUrl ?? null;
  const logoUrl = store?.profile?.logoUrl ?? null;

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FAF7F0]">
        <section className="mx-auto max-w-7xl px-5 py-6 lg:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/search">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to products
            </Link>
          </Button>
        </section>

        {storeQuery.isLoading ? (
          <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-6">
            <StorefrontSkeleton className="h-96 bg-white" />
          </section>
        ) : null}

        {store ? (
          <>
            <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-6">
              <div className="overflow-hidden rounded-[34px] border border-[#E5E7EB] bg-white shadow-[0_24px_70px_rgba(22,59,92,0.08)]">
                <div className="relative min-h-72 bg-[#163B5C]">
                  <StorefrontImage src={bannerUrl} alt={`${store.storeName} banner`} priority sizes="100vw" fallbackLabel={store.storeName} />
                  <div className="absolute inset-0 bg-[#102F49]/65" />
                  <div className="relative flex min-h-72 flex-col justify-end p-5 text-white md:p-8">
                    <div className="mb-5 flex items-center gap-4">
                      <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/30 bg-white/15 text-2xl font-black">
                        <StorefrontImage src={logoUrl} alt={`${store.storeName} logo`} sizes="80px" fallbackLabel={store.storeName.slice(0, 2).toUpperCase()} />
                      </span>
                      <div>
                        <StatusBadge tone="success" className="border-white/30 bg-white/15 text-white">
                          {locationMatchLabel(store.locationMatchLevel)}
                        </StatusBadge>
                        <h1 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">{store.storeName}</h1>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm font-semibold leading-7 text-white/90">
                      {store.profile?.description ?? "Approved 1HandIndia seller profile with products, store details, and customer-facing catalogue."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-[#E5E7EB] p-5 md:grid-cols-3">
                  <Info icon={ShoppingBag} label="Products" value={`${store._count?.products ?? 0} live products`} />
                  <Info icon={ShieldCheck} label="Status" value="Approved for selling" />
                  <Info
                    icon={MapPin}
                    label="Location"
                    value={sellerLocationLabel(address)}
                  />
                </div>
              </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-12 lg:grid-cols-[1fr_320px] lg:px-6">
              <div>
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <SectionHeading title="Store products" description="Approved active products from this seller." />
                  <Button type="button" variant="outline" onClick={() => void productsQuery.refetch()} disabled={productsQuery.isFetching}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Refresh
                  </Button>
                </div>

                {notice ? (
                  <StorefrontNotice className="mt-5">{notice}</StorefrontNotice>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5 xl:grid-cols-3">
                  {productsQuery.isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => <StorefrontSkeleton key={index} className="h-64 bg-white sm:h-80" />)
                  ) : productsQuery.data?.items.length ? (
                    productsQuery.data.items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={(item) => addMutation.mutate(item)}
                        isAdding={addMutation.isPending}
                      />
                    ))
                  ) : (
                    <StorefrontEmptyState className="col-span-2 xl:col-span-3" message="No approved products are live for this store yet." />
                  )}
                </div>

                {productsQuery.isError ? <StorefrontErrorPanel className="mt-6" error={productsQuery.error} onRetry={() => void productsQuery.refetch()} /> : null}
              </div>

              <StorefrontPanel className="h-fit" as="aside">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EAF1F7] text-[#163B5C]">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Store details" description="Public seller contact and location summary." />
                </div>
                <div className="mt-5 rounded-2xl border border-[#E8EDF2] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#425466]">
                  This store serves from <span className="font-black text-[#163B5C]">{sellerLocationLabel(address)}</span>.
                </div>
                <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
                  <InfoLine label="Contact" value={store.profile?.contactName ?? store.user?.fullName ?? store.storeName} />
                  <InfoLine label="Email" value={store.profile?.contactEmail ?? store.user?.email ?? "Not listed"} />
                  <InfoLine label="Phone" value={store.profile?.contactPhone ?? store.user?.phone ?? "Not listed"} />
                  <InfoLine label="City" value={address?.city ?? "Not listed"} />
                  <InfoLine label={address?.countryCode === "IN" || !address?.countryCode ? "Pincode" : "Postal code"} value={address?.pincode ?? "Not listed"} />
                  <InfoLine label="Country" value={address?.country ?? address?.countryCode ?? "Not listed"} />
                </div>
                {!customerAuth.enabled ? (
                  <div className="mt-5">
                    <CustomerAuthNotice />
                  </div>
                ) : null}
              </StorefrontPanel>
            </section>
          </>
        ) : null}

        {storeQuery.isError ? (
          <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
            <StorefrontErrorPanel error={storeQuery.error} onRetry={() => void storeQuery.refetch()} />
          </section>
        ) : null}
      </main>
    </StorefrontFrame>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[#F8FAFC] p-4">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-[#163B5C]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
        <span className="mt-1 block text-sm font-black text-[#1F2933]">{value}</span>
      </span>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <StorefrontSummaryRow className="border-b border-[#E5E7EB] pb-3 last:border-b-0 last:pb-0" label={label} value={value} />
  );
}
