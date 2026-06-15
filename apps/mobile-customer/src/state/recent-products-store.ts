import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { ProductSummary } from "../types/storefront";

export type RecentProductSnapshot = {
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sellerId?: string | null;
  sellerName: string;
  sellerSlug?: string | null;
  pricePaise: number | null;
  mrpPaise: number | null;
  viewedAt: string;
};

type RecentProductsState = {
  recentProducts: RecentProductSnapshot[];
  rememberRecentProduct: (product: ProductSummary) => void;
  clearRecentProducts: () => void;
};

const maxRecentProducts = 12;
const secureRecentProductsStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export const useRecentProductsStore = create<RecentProductsState>()(
  persist(
    (set) => ({
      recentProducts: [],
      rememberRecentProduct: (product) => {
        const snapshot = productToSnapshot(product);
        set((state) => ({
          recentProducts: [
            snapshot,
            ...state.recentProducts.filter((item) => item.id !== snapshot.id && item.slug !== snapshot.slug),
          ].slice(0, maxRecentProducts),
        }));
      },
      clearRecentProducts: () => set({ recentProducts: [] }),
    }),
    {
      name: "onehandindia-mobile-recent-products",
      storage: createJSONStorage(() => secureRecentProductsStorage),
      partialize: (state) => ({ recentProducts: state.recentProducts }),
    },
  ),
);

function productToSnapshot(product: ProductSummary): RecentProductSnapshot {
  const variant = product.variants[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null,
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: product.category?.name ?? null,
    categorySlug: product.category?.slug ?? null,
    sellerId: product.sellerId ?? product.seller?.id ?? null,
    sellerName: product.seller?.storeName ?? "1HandIndia seller",
    sellerSlug: product.seller?.slug ?? null,
    pricePaise: variant?.pricePaise ?? null,
    mrpPaise: variant?.mrpPaise ?? null,
    viewedAt: new Date().toISOString(),
  };
}
