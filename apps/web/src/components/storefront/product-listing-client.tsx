"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useStorefrontLocation } from "@/components/storefront/storefront-location-context";
import {
  addCartItem,
  getCategory,
  listCategories,
  listProducts,
  primaryVariant,
  type ProductSummary
} from "@/lib/storefront-api";
import { ProductCard } from "./product-card";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontCategoryCard } from "./storefront-category-card";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontPageHeader,
  StorefrontSection,
  StorefrontSkeleton,
  storefrontInputClassName,
} from "./storefront-ui";
import { browsingLocationLabel } from "./storefront-location-utils";

type ProductListingClientProps = {
  mode: "categories" | "category" | "search";
  categorySlug?: string;
  initialSearch?: string;
};

export function ProductListingClient({ mode, categorySlug, initialSearch = "" }: ProductListingClientProps) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const storefrontLocation = useStorefrontLocation();
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [notice, setNotice] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories
  });
  const categoryQuery = useQuery({
    queryKey: ["category", categorySlug],
    queryFn: () => getCategory(categorySlug ?? ""),
    enabled: Boolean(categorySlug)
  });
  const categoryId = categoryQuery.data?.id;
  const productsQuery = useQuery({
    queryKey: ["products", mode, categoryId, submittedSearch],
    queryFn: () => {
      const query = {
        ...(categoryId ? { categoryId } : {}),
        ...(submittedSearch ? { search: submittedSearch } : {}),
        limit: 24
      };

      return listProducts(query);
    },
    enabled: mode !== "category" || Boolean(categoryId)
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
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to add product to cart.");
    }
  });

  const title =
    mode === "category" ? (categoryQuery.data?.name ?? "Category products") : mode === "search" ? "Search products" : "All categories";
  const description =
    mode === "category"
      ? (categoryQuery.data?.description ?? "Products approved for this category.")
      : mode === "search"
        ? "Search live approved products across active sellers."
        : "Browse the active launch categories managed from the catalogue.";

  return (
    <StorefrontFrame>
      <StorefrontPageHeader
        badge="Storefront"
        title={title}
        description={
          <>
            {description}
            {storefrontLocation.source !== "global" ? (
              <>
                <br />
                Products are still shown platform-wide. Nearby stores for{" "}
                <Link href="/stores" className="font-black text-[#163B5C] underline decoration-[#ED3500]/40 underline-offset-4">
                  {browsingLocationLabel(storefrontLocation.activeLocation)}
                </Link>{" "}
                remain available from the store directory.
              </>
            ) : null}
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
          className="flex w-full gap-2"
        >
          <label className="relative flex-1">
            <span className="sr-only">Search catalogue</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              className={cn(storefrontInputClassName, "pl-10")}
            />
          </label>
          <Button type="submit">
            <Search size={16} /> Search
          </Button>
        </form>
      </StorefrontPageHeader>

      {mode === "categories" ? (
        <StorefrontSection>
          <SectionHeading title="Categories" description="Each category links into live product browsing." />
          <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-5">
            {categoriesQuery.data?.map((category) => (
              <StorefrontCategoryCard key={category.id} category={category} variant="directory" />
            ))}
          </div>
        </StorefrontSection>
      ) : null}

      {mode !== "categories" ? (
        <StorefrontSection>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              title={submittedSearch ? `Results for "${submittedSearch}"` : "Product results"}
              description={`${productsQuery.data?.total ?? 0} products found.`}
            />
            {mode === "category" ? (
              <Button asChild variant="outline">
                <Link href="/categories">
                  All categories <ArrowRight size={16} />
                </Link>
              </Button>
            ) : null}
          </div>

          {notice ? (
            <StorefrontNotice className="mt-5">{notice}</StorefrontNotice>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {productsQuery.isLoading || categoryQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-64 sm:h-80" />
              ))
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
              <StorefrontEmptyState className="col-span-2 md:col-span-3 lg:col-span-full" message="No matching approved products are live yet." />
            )}
          </div>

          {!customerAuth.enabled ? (
            <div className="mt-8">
              <CustomerAuthNotice />
            </div>
          ) : null}

          {productsQuery.isError || categoryQuery.isError ? (
            <StorefrontErrorPanel
              className="mt-6"
              error={(productsQuery.error ?? categoryQuery.error) as Error}
              onRetry={() => {
                void productsQuery.refetch();
                void categoryQuery.refetch();
              }}
            />
          ) : null}
        </StorefrontSection>
      ) : null}
    </StorefrontFrame>
  );
}
