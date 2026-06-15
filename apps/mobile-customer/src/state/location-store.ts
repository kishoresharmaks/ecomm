import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { SelectedLocation } from "../types/storefront";

type LocationState = {
  selectedLocation: SelectedLocation;
  setSelectedLocation: (location: SelectedLocation) => void;
  clearSelectedLocation: () => void;
};

const defaultLocation: SelectedLocation = {
  label: "Select location",
};

const secureLocationStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedLocation: defaultLocation,
      setSelectedLocation: (selectedLocation) =>
        set((state) =>
          sameSelectedLocation(state.selectedLocation, selectedLocation)
            ? state
            : { selectedLocation },
        ),
      clearSelectedLocation: () =>
        set((state) =>
          sameSelectedLocation(state.selectedLocation, defaultLocation)
            ? state
            : { selectedLocation: defaultLocation },
        ),
    }),
    {
      name: "onehandindia-mobile-browsing-location",
      storage: createJSONStorage(() => secureLocationStorage),
      partialize: (state) => ({ selectedLocation: state.selectedLocation }),
    },
  ),
);

function sameSelectedLocation(left: SelectedLocation, right: SelectedLocation) {
  return (
    left.label === right.label &&
    left.pincode === right.pincode &&
    left.countryCode === right.countryCode &&
    left.stateCode === right.stateCode &&
    left.cityCode === right.cityCode &&
    left.localAreaCode === right.localAreaCode
  );
}
