import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

const maxRecentSearches = 8;
const minSearchLength = 2;

type SearchHistoryState = {
  recentSearches: string[];
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
};

const secureSearchStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecentSearch: (term) => {
        const normalizedTerm = normalizeSearchTerm(term);
        if (normalizedTerm.length < minSearchLength) {
          return;
        }

        set((state) => ({
          recentSearches: [
            normalizedTerm,
            ...state.recentSearches.filter((item) => item.toLocaleLowerCase() !== normalizedTerm.toLocaleLowerCase()),
          ].slice(0, maxRecentSearches),
        }));
      },
      removeRecentSearch: (term) => {
        const normalizedTerm = normalizeSearchTerm(term);
        set((state) => ({
          recentSearches: state.recentSearches.filter((item) => item.toLocaleLowerCase() !== normalizedTerm.toLocaleLowerCase()),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "onehandindia-mobile-search-history",
      storage: createJSONStorage(() => secureSearchStorage),
      partialize: (state) => ({ recentSearches: state.recentSearches }),
    },
  ),
);

function normalizeSearchTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}
