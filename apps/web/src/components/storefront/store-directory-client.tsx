"use client";

import { RefreshCw, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { listStores } from "@/lib/storefront-api";
import { useStorefrontLocation } from "./storefront-location-context";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontStoreCard } from "./storefront-store-card";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontPageHeader,
  StorefrontSection,
  StorefrontSkeleton,
} from "./storefront-ui";
import {
  browsingLocationHeadline,
  browsingLocationLabel,
  browsingLocationQuery,
  splitStoresByLocationMatch,
} from "./storefront-location-utils";

export function StoreDirectoryClient() {
  const storefrontLocation = useStorefrontLocation();
  const storesQuery = useQuery({
    queryKey: [
      "stores",
      storefrontLocation.activeLocation?.countryCode ?? "",
      storefrontLocation.activeLocation?.stateCode ?? "",
      storefrontLocation.activeLocation?.cityCode ?? "",
      storefrontLocation.activeLocation?.localAreaCode ?? "",
      storefrontLocation.activeLocation?.pincode ?? "",
    ],
    queryFn: () => listStores(browsingLocationQuery(storefrontLocation.activeLocation, 80)),
    retry: false
  });
  const stores = storesQuery.data ?? [];
  const storeGroups = splitStoresByLocationMatch(stores);
  const hasLocalGrouping =
    storefrontLocation.source !== "global" && storeGroups.localStores.length > 0;

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FAF7F0]">
        <StorefrontPageHeader
          badge={
            storefrontLocation.source === "global"
              ? "Approved vendors and local shops"
              : `Browsing near ${browsingLocationHeadline(storefrontLocation.activeLocation)}`
          }
          title="Shop by store"
          description={
            storefrontLocation.source === "global"
              ? "Browse approved 1HandIndia sellers and public storefront pages, then set a browsing location to move nearby stores to the front."
              : `Local store discovery is currently tuned to ${browsingLocationLabel(storefrontLocation.activeLocation)}.`
          }
        >
          <div className="flex justify-start lg:justify-end">
            <Button type="button" variant="outline" onClick={() => void storesQuery.refetch()} disabled={storesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </StorefrontPageHeader>

        <StorefrontSection>
          {storesQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-56 bg-white sm:h-72" />
              ))}
            </div>
          ) : null}

          {storesQuery.isError ? (
            <StorefrontErrorPanel error={storesQuery.error} onRetry={() => void storesQuery.refetch()} retryLabel="Retry stores" />
          ) : null}

          {!storesQuery.isLoading && stores.length === 0 ? (
            <StorefrontEmptyState
              icon={Store}
              title="No approved stores yet"
              description="Stores appear here after admin approval and can still have their own page once approved."
              centered
            />
          ) : null}

          {hasLocalGrouping ? (
            <StoreGridSection
              title={`Stores near ${browsingLocationHeadline(storefrontLocation.activeLocation)}`}
              description="These approved sellers are ranked first because they match your current browsing location."
              stores={storeGroups.localStores}
              emphasize
            />
          ) : null}

          {stores.length > 0 ? (
            <StoreGridSection
              title={hasLocalGrouping ? "Broader approved stores" : "Storefronts"}
              description={
                hasLocalGrouping
                  ? "The wider marketplace remains available below your local matches."
                  : "Each store card opens the seller's customer-facing profile and live approved products."
              }
              stores={hasLocalGrouping ? storeGroups.broaderStores : stores}
            />
          ) : null}
        </StorefrontSection>
      </main>
    </StorefrontFrame>
  );
}

function StoreGridSection({
  title,
  description,
  stores,
  emphasize = false,
}: {
  title: string;
  description: string;
  stores: Awaited<ReturnType<typeof listStores>>;
  emphasize?: boolean;
}) {
  if (!stores.length) {
    return null;
  }

  return (
    <div className={emphasize ? "mb-10" : ""}>
      <SectionHeading title={title} description={description} />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((store) => (
          <StorefrontStoreCard key={store.id} store={store} emphasize={emphasize} />
        ))}
      </div>
    </div>
  );
}
