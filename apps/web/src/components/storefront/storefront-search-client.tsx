"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Filter,
  Grid3X3,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  X,
} from "lucide-react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  addCartItem,
  listCategories,
  listStores,
  primaryVariant,
  searchStorefront,
  type CategorySummary,
  type ProductSummary,
  type SearchSort,
  type StoreProfile,
} from "@/lib/storefront-api";
import { ProductCard } from "./product-card";
import { StorefrontCategoryCard } from "./storefront-category-card";
import { StorefrontFrame } from "./storefront-frame";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontSection,
  StorefrontSkeleton,
  storefrontInputClassName,
} from "./storefront-ui";

type SearchFilters = {
  categoryId: string;
  sellerId: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  deals: boolean;
  rating: string;
  sort: SearchSort;
};

const defaultFilters: SearchFilters = {
  categoryId: "",
  sellerId: "",
  minPrice: "",
  maxPrice: "",
  inStock: false,
  deals: false,
  rating: "",
  sort: "relevance",
};

const suggestedTerms = ["smart watch", "bags", "electronics", "home kitchen"];

export function StorefrontSearchClient({ initialSearch = "" }: { initialSearch?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch.trim());
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const categoriesQuery = useQuery({
    queryKey: ["categories", "search-filters"],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  });
  const storesQuery = useQuery({
    queryKey: ["stores", "search-filters"],
    queryFn: () => listStores({ limit: 60 }),
    staleTime: 5 * 60 * 1000,
  });
  const effectiveQuery = submittedSearch.trim();
  const searchQuery = useInfiniteQuery({
    queryKey: ["advanced-search", effectiveQuery, filters],
    queryFn: ({ pageParam }) => {
      const minPricePaise = priceToPaise(filters.minPrice);
      const maxPricePaise = priceToPaise(filters.maxPrice);

      return searchStorefront(
        {
          q: effectiveQuery,
          sort: filters.sort,
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(minPricePaise !== undefined ? { minPricePaise } : {}),
          ...(maxPricePaise !== undefined ? { maxPricePaise } : {}),
          ...(filters.inStock ? { inStock: true } : {}),
          ...(filters.deals ? { deals: true } : {}),
          ...(filters.rating ? { rating: Number(filters.rating) } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: 24,
        },
        customerAuth.authHeaders,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    enabled: effectiveQuery.length >= 2,
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
    },
  });
  const products = useMemo(
    () => uniqueById(searchQuery.data?.pages.flatMap((page) => page.products) ?? []),
    [searchQuery.data],
  );
  const stores = useMemo(
    () => uniqueById(searchQuery.data?.pages.flatMap((page) => page.stores) ?? []),
    [searchQuery.data],
  );
  const categories = useMemo(
    () => uniqueById(searchQuery.data?.pages.flatMap((page) => page.categories) ?? []),
    [searchQuery.data],
  );
  const activeChips = activeFilterChips(filters, categoriesQuery.data ?? [], storesQuery.data ?? []);

  function submitSearch(event?: FormEvent<HTMLFormElement>, nextTerm = search) {
    event?.preventDefault();
    const trimmed = nextTerm.trim();
    setSearch(trimmed);
    setSubmittedSearch(trimmed);
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search", { scroll: false });
  }

  function clearFilter(key: keyof SearchFilters) {
    setFilters((current) => ({
      ...current,
      [key]: typeof defaultFilters[key] === "boolean" ? false : defaultFilters[key],
    }));
  }

  return (
    <StorefrontFrame>
      <section className="border-b border-[#f2e4dd] bg-[#fffaf7]">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a1f]">
                Marketplace search
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Find products, stores, and categories
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
                Search approved marketplace listings with verified seller and catalogue filters.
              </p>
            </div>
            <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
              <label className="relative min-w-0 flex-1 lg:w-[460px]">
                <span className="sr-only">Search marketplace</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ff5a1f]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products, stores, categories..."
                  className={cn(storefrontInputClassName, "h-12 rounded-2xl pl-12")}
                />
              </label>
              <Button type="submit" className="h-12 rounded-2xl px-5">
                <Search size={16} /> Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      <StorefrontSection className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <SearchFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            categories={categoriesQuery.data ?? []}
            stores={storesQuery.data ?? []}
          />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 rounded-[24px] border border-[#e8edf2] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#101828]">
                {effectiveQuery ? `Results for "${effectiveQuery}"` : "Start a search"}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">
                {effectiveQuery.length >= 2
                  ? `${products.length} products, ${stores.length} stores, ${categories.length} categories loaded`
                  : "Enter at least 2 characters to search the marketplace."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-2xl lg:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={16} /> Filters
              </Button>
              {activeChips.map((chip) => (
                <button
                  key={`${chip.key}-${chip.label}`}
                  type="button"
                  onClick={() => clearFilter(chip.key)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ffd6c7] bg-[#fff4ef] px-3 text-xs font-black text-[#c4320a]"
                >
                  {chip.label}
                  <X size={14} />
                </button>
              ))}
            </div>
          </div>

          {notice ? <StorefrontNotice className="mt-5">{notice}</StorefrontNotice> : null}

          {effectiveQuery.length < 2 ? (
            <StorefrontEmptyState
              className="mt-5"
              icon={Search}
              title="Search the marketplace"
              description="Try a product name, category, brand, or store name."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedTerms.map((term) => (
                    <Button key={term} type="button" variant="outline" onClick={() => submitSearch(undefined, term)}>
                      {term}
                    </Button>
                  ))}
                </div>
              }
              centered
            />
          ) : searchQuery.isLoading ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-64 sm:h-80" />
              ))}
            </div>
          ) : searchQuery.isError ? (
            <StorefrontErrorPanel
              className="mt-5"
              error={searchQuery.error}
              onRetry={() => void searchQuery.refetch()}
            />
          ) : products.length || stores.length || categories.length ? (
            <div className="mt-5 space-y-8">
              {stores.length ? (
                <SearchResultSection
                  icon={Store}
                  title="Stores"
                  description="Approved sellers matching your search."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {stores.map((store) => (
                      <StoreSearchCard key={store.id} store={store} />
                    ))}
                  </div>
                </SearchResultSection>
              ) : null}

              {categories.length ? (
                <SearchResultSection
                  icon={Grid3X3}
                  title="Categories"
                  description="Departments that match this term."
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {categories.map((category) => (
                      <StorefrontCategoryCard key={category.id} category={category} variant="directory" />
                    ))}
                  </div>
                </SearchResultSection>
              ) : null}

              <SearchResultSection
                icon={PackageCheck}
                title="Products"
                description="Approved live products from active sellers."
              >
                {products.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={(item) => addMutation.mutate(item)}
                        isAdding={addMutation.isPending}
                      />
                    ))}
                  </div>
                ) : (
                  <StorefrontEmptyState message="No matching products for the selected filters." />
                )}
              </SearchResultSection>

              {searchQuery.hasNextPage ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void searchQuery.fetchNextPage()}
                    disabled={searchQuery.isFetchingNextPage}
                  >
                    {searchQuery.isFetchingNextPage ? "Loading" : "Load more results"}
                    <ArrowRight size={16} />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <StorefrontEmptyState
              className="mt-5"
              icon={Search}
              title="No matching results"
              description="Try removing a filter or searching a broader product, category, or store term."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedTerms.map((term) => (
                    <Button key={term} type="button" variant="outline" onClick={() => submitSearch(undefined, term)}>
                      {term}
                    </Button>
                  ))}
                </div>
              }
              centered
            />
          )}

          {!customerAuth.enabled ? (
            <div className="mt-8">
              <CustomerAuthNotice />
            </div>
          ) : null}
        </div>
      </StorefrontSection>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[130] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#101828]/40 backdrop-blur-sm"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 right-0 max-h-[82svh] overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-[0_-20px_70px_rgba(17,24,39,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff5a1f]">Filters</p>
                <h2 className="text-2xl font-black text-[#101828]">Refine results</h2>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff1ea] text-[#101828]"
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>
            <SearchFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              categories={categoriesQuery.data ?? []}
              stores={storesQuery.data ?? []}
              compact
            />
          </aside>
        </div>
      ) : null}
    </StorefrontFrame>
  );
}

function SearchFilterPanel({
  filters,
  onFiltersChange,
  categories,
  stores,
  compact = false,
}: {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  categories: CategorySummary[];
  stores: StoreProfile[];
  compact?: boolean;
}) {
  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className={cn("rounded-[24px] border border-[#e8edf2] bg-white p-4 shadow-sm", !compact && "sticky top-32")}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff1ea] text-[#ff5a1f]">
          <Filter size={18} />
        </span>
        <SectionHeading title="Filters" description="Narrow results without changing the search term." />
      </div>
      <div className="mt-5 grid gap-4">
        <FilterField label="Sort by">
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value as SearchSort)} className={storefrontInputClassName}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="rating">Rating</option>
            <option value="discount">Discount</option>
          </select>
        </FilterField>

        <FilterField label="Category">
          <select value={filters.categoryId} onChange={(event) => update("categoryId", event.target.value)} className={storefrontInputClassName}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Store">
          <select value={filters.sellerId} onChange={(event) => update("sellerId", event.target.value)} className={storefrontInputClassName}>
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.storeName}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Min price">
            <input
              value={filters.minPrice}
              onChange={(event) => update("minPrice", event.target.value)}
              inputMode="numeric"
              placeholder="₹"
              className={storefrontInputClassName}
            />
          </FilterField>
          <FilterField label="Max price">
            <input
              value={filters.maxPrice}
              onChange={(event) => update("maxPrice", event.target.value)}
              inputMode="numeric"
              placeholder="₹"
              className={storefrontInputClassName}
            />
          </FilterField>
        </div>

        <FilterField label="Minimum rating">
          <select value={filters.rating} onChange={(event) => update("rating", event.target.value)} className={storefrontInputClassName}>
            <option value="">Any rating</option>
            <option value="4">4 stars & above</option>
            <option value="3">3 stars & above</option>
            <option value="2">2 stars & above</option>
          </select>
        </FilterField>

        <label className="flex items-center gap-3 rounded-2xl border border-[#e8edf2] px-3 py-3 text-sm font-black text-[#101828]">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(event) => update("inStock", event.target.checked)}
            className="h-4 w-4 accent-[#ff5a1f]"
          />
          In stock only
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-[#e8edf2] px-3 py-3 text-sm font-black text-[#101828]">
          <input
            type="checkbox"
            checked={filters.deals}
            onChange={(event) => update("deals", event.target.checked)}
            className="h-4 w-4 accent-[#ff5a1f]"
          />
          Deals only
        </label>

        <Button type="button" variant="outline" onClick={() => onFiltersChange(defaultFilters)}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#667085]">
      {label}
      {children}
    </label>
  );
}

function SearchResultSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Store;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff1ea] text-[#ff5a1f]">
          <Icon size={18} />
        </span>
        <SectionHeading title={title} description={description} />
      </div>
      {children}
    </section>
  );
}

function StoreSearchCard({ store }: { store: StoreProfile }) {
  const address = store.addresses[0];
  const rating = store.reviewSummary?.averageRating;
  const reviews = store.reviewSummary?.reviewCount ?? 0;

  return (
    <Link
      href={`/stores/${store.slug}`}
      className="group flex min-w-0 items-center gap-4 rounded-[24px] border border-[#e8edf2] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ffb99f] hover:shadow-[0_24px_48px_rgba(17,24,39,0.08)]"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#fff1ea] text-[#ff5a1f]">
        <Store size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black text-[#101828] group-hover:text-[#ff5a1f]">
          {store.storeName}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-[#667085]">
          {[address?.area, address?.city].filter(Boolean).join(", ") || "Approved marketplace seller"}
        </span>
        <span className="mt-2 flex flex-wrap gap-2 text-xs font-black">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f7f1] px-2.5 py-1 text-[#0f8a5f]">
            <PackageCheck size={13} /> {store._count?.products ?? 0} products
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1ea] px-2.5 py-1 text-[#ff5a1f]">
            <Star size={13} /> {rating ? `${rating.toFixed(1)} (${reviews})` : "No reviews yet"}
          </span>
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[#98a2b3] group-hover:text-[#ff5a1f]" />
    </Link>
  );
}

function priceToPaise(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function activeFilterChips(filters: SearchFilters, categories: CategorySummary[], stores: StoreProfile[]) {
  const chips: Array<{ key: keyof SearchFilters; label: string }> = [];
  const category = categories.find((item) => item.id === filters.categoryId);
  const store = stores.find((item) => item.id === filters.sellerId);

  if (filters.categoryId) chips.push({ key: "categoryId", label: category?.name ?? "Category" });
  if (filters.sellerId) chips.push({ key: "sellerId", label: store?.storeName ?? "Store" });
  if (filters.minPrice) chips.push({ key: "minPrice", label: `Min ₹${filters.minPrice}` });
  if (filters.maxPrice) chips.push({ key: "maxPrice", label: `Max ₹${filters.maxPrice}` });
  if (filters.inStock) chips.push({ key: "inStock", label: "In stock" });
  if (filters.deals) chips.push({ key: "deals", label: "Deals" });
  if (filters.rating) chips.push({ key: "rating", label: `${filters.rating}+ rating` });
  if (filters.sort !== "relevance") chips.push({ key: "sort", label: sortLabel(filters.sort) });

  return chips;
}

function sortLabel(sort: SearchSort) {
  const labels: Record<SearchSort, string> = {
    relevance: "Relevance",
    newest: "Newest",
    price_asc: "Price low to high",
    price_desc: "Price high to low",
    rating: "Rating",
    discount: "Discount",
  };

  return labels[sort];
}
