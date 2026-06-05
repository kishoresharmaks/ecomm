"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, AdminSwitch, type AdminSelectOption } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";

type MapRoutingProvider = "HAVERSINE" | "GOOGLE_ROUTES" | "MAPBOX_DIRECTIONS";
type GoogleTravelMode = "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE";

type MapRoutingSettingsResponse = {
  enabled: boolean;
  provider: MapRoutingProvider;
  googleApiToken: "";
  googleApiTokenConfigured: boolean;
  googleTravelMode: GoogleTravelMode;
  mapboxAccessToken: "";
  mapboxAccessTokenConfigured: boolean;
  mapboxProfile: string;
  fallbackToHaversine: boolean;
};

type MapRoutingSettingsForm = {
  enabled: boolean;
  provider: MapRoutingProvider;
  googleApiToken: string;
  googleTravelMode: GoogleTravelMode;
  mapboxAccessToken: string;
  mapboxProfile: string;
  fallbackToHaversine: boolean;
};

const defaults: MapRoutingSettingsResponse = {
  enabled: false,
  provider: "HAVERSINE",
  googleApiToken: "",
  googleApiTokenConfigured: false,
  googleTravelMode: "DRIVE",
  mapboxAccessToken: "",
  mapboxAccessTokenConfigured: false,
  mapboxProfile: "mapbox/driving",
  fallbackToHaversine: true,
};

const providerOptions: AdminSelectOption[] = [
  {
    value: "HAVERSINE",
    label: "Haversine fallback",
    description: "Straight-line distance only. No external map provider.",
  },
  {
    value: "GOOGLE_ROUTES",
    label: "Google Routes",
    description: "Uses road route distance when an API token is configured.",
  },
  {
    value: "MAPBOX_DIRECTIONS",
    label: "Mapbox Directions",
    description: "Uses Mapbox road route distance when an access token is configured.",
  },
];

const googleTravelModeOptions: AdminSelectOption[] = [
  { value: "DRIVE", label: "Drive" },
  { value: "TWO_WHEELER", label: "Two wheeler" },
  { value: "WALK", label: "Walk" },
  { value: "BICYCLE", label: "Bicycle" },
];

const mapboxProfileOptions: AdminSelectOption[] = [
  { value: "mapbox/driving", label: "Driving" },
  { value: "mapbox/driving-traffic", label: "Driving with traffic" },
  { value: "mapbox/walking", label: "Walking" },
  { value: "mapbox/cycling", label: "Cycling" },
];

export function MapRoutingSettings() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MapRoutingSettingsForm>(() => formFromSettings(defaults));
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["map-routing-settings", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<MapRoutingSettingsResponse>(
        "/api/admin/settings/maps/routing",
        undefined,
        auth.authHeaders,
      ),
  });

  const savedSettings = settingsQuery.data ?? defaults;
  const savedForm = useMemo(() => formFromSettings(savedSettings), [savedSettings]);
  const isDirty = hasUserEdited && JSON.stringify(form) !== JSON.stringify(savedForm);
  const validationError = validateForm(form, savedSettings);
  const activeProviderLabel =
    providerOptions.find((option) => option.value === form.provider)?.label ?? form.provider;

  useEffect(() => {
    if (!hasUserEdited) {
      setForm(savedForm);
    }
  }, [hasUserEdited, savedForm]);

  function updateForm(updater: (current: MapRoutingSettingsForm) => MapRoutingSettingsForm) {
    setNotice(null);
    setHasUserEdited(true);
    setForm(updater);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validateForm(form, savedSettings);
      if (error) {
        throw new Error(error);
      }

      return indihubFetch<MapRoutingSettingsResponse>(
        "/api/admin/settings/maps/routing",
        {
          method: "PUT",
          body: JSON.stringify(payloadFromForm(form)),
        },
        auth.authHeaders,
      );
    },
    onSuccess: async () => {
      setNotice("Map routing settings saved.");
      setHasUserEdited(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["map-routing-settings"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save map routing settings."),
  });

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">
                Delivery distance and routing
              </h3>
              <StatusBadge tone={form.enabled ? "success" : "warning"}>
                {form.enabled ? activeProviderLabel : "Disabled"}
              </StatusBadge>
              {isDirty ? <StatusBadge tone="warning">Unsaved</StatusBadge> : null}
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Controls how local delivery partner earnings calculate seller pickup to customer distance.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AdminSwitch
          label="Use routed distance"
          description="When enabled, completed local deliveries can use the selected map provider."
          checked={form.enabled}
          onChange={(enabled) => updateForm((current) => ({ ...current, enabled }))}
          disabled={saveMutation.isPending}
        />
        <AdminListbox
          label="Routing provider"
          value={form.provider}
          options={providerOptions}
          onChange={(provider) =>
            updateForm((current) => ({
              ...current,
              provider: provider as MapRoutingProvider,
            }))
          }
          disabled={saveMutation.isPending}
        />
        <AdminSwitch
          label="Fallback to Haversine"
          description="Use straight-line distance when the external route provider fails."
          checked={form.fallbackToHaversine}
          onChange={(fallbackToHaversine) =>
            updateForm((current) => ({ ...current, fallbackToHaversine }))
          }
          disabled={saveMutation.isPending}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-[#1F2933]">Google Routes</p>
            <StatusBadge tone={savedSettings.googleApiTokenConfigured ? "success" : "warning"}>
              {savedSettings.googleApiTokenConfigured ? "Token saved" : "No token"}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SecretInput
              label="Google API token"
              value={form.googleApiToken}
              placeholder={
                savedSettings.googleApiTokenConfigured
                  ? "Leave blank to keep saved token"
                  : "Paste Google API token"
              }
              onChange={(googleApiToken) =>
                updateForm((current) => ({ ...current, googleApiToken }))
              }
              disabled={saveMutation.isPending}
            />
            <AdminListbox
              label="Travel mode"
              value={form.googleTravelMode}
              options={googleTravelModeOptions}
              onChange={(googleTravelMode) =>
                updateForm((current) => ({
                  ...current,
                  googleTravelMode: googleTravelMode as GoogleTravelMode,
                }))
              }
              disabled={saveMutation.isPending}
            />
          </div>
        </div>

        <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-[#1F2933]">Mapbox Directions</p>
            <StatusBadge tone={savedSettings.mapboxAccessTokenConfigured ? "success" : "warning"}>
              {savedSettings.mapboxAccessTokenConfigured ? "Token saved" : "No token"}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SecretInput
              label="Mapbox access token"
              value={form.mapboxAccessToken}
              placeholder={
                savedSettings.mapboxAccessTokenConfigured
                  ? "Leave blank to keep saved token"
                  : "Paste Mapbox access token"
              }
              onChange={(mapboxAccessToken) =>
                updateForm((current) => ({ ...current, mapboxAccessToken }))
              }
              disabled={saveMutation.isPending}
            />
            <AdminListbox
              label="Profile"
              value={form.mapboxProfile}
              options={mapboxProfileOptions}
              onChange={(mapboxProfile) => updateForm((current) => ({ ...current, mapboxProfile }))}
              disabled={saveMutation.isPending}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">
          Saved changes apply only to future delivery wallet credits.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={
            !auth.isAuthenticated ||
            saveMutation.isPending ||
            Boolean(validationError) ||
            !isDirty
          }
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save routing settings"}
        </Button>
      </div>

      {settingsQuery.error ? (
        <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
          {settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : "Unable to load map routing settings."}
        </p>
      ) : null}
      {validationError ? (
        <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
          {validationError}
        </p>
      ) : null}
      {notice ? (
        <p
          className={`mt-4 rounded-md border p-3 text-sm font-semibold ${
            saveMutation.isError
              ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]"
              : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"
          }`}
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function SecretInput({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">
        {label}
      </span>
      <input
        type="password"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] disabled:cursor-not-allowed disabled:opacity-55"
      />
    </label>
  );
}

function formFromSettings(settings: MapRoutingSettingsResponse): MapRoutingSettingsForm {
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    googleApiToken: "",
    googleTravelMode: settings.googleTravelMode,
    mapboxAccessToken: "",
    mapboxProfile: settings.mapboxProfile,
    fallbackToHaversine: settings.fallbackToHaversine,
  };
}

function payloadFromForm(form: MapRoutingSettingsForm) {
  const googleApiToken = form.googleApiToken.trim();
  const mapboxAccessToken = form.mapboxAccessToken.trim();

  return {
    enabled: form.enabled,
    provider: form.provider,
    ...(googleApiToken ? { googleApiToken } : {}),
    googleTravelMode: form.googleTravelMode,
    ...(mapboxAccessToken ? { mapboxAccessToken } : {}),
    mapboxProfile: form.mapboxProfile,
    fallbackToHaversine: form.fallbackToHaversine,
  };
}

function validateForm(form: MapRoutingSettingsForm, savedSettings: MapRoutingSettingsResponse) {
  if (
    form.enabled &&
    form.provider === "GOOGLE_ROUTES" &&
    !savedSettings.googleApiTokenConfigured &&
    !form.googleApiToken.trim()
  ) {
    return "Enter a Google API token before enabling Google Routes.";
  }

  if (
    form.enabled &&
    form.provider === "MAPBOX_DIRECTIONS" &&
    !savedSettings.mapboxAccessTokenConfigured &&
    !form.mapboxAccessToken.trim()
  ) {
    return "Enter a Mapbox access token before enabling Mapbox Directions.";
  }

  if (!mapboxProfileOptions.some((option) => option.value === form.mapboxProfile)) {
    return "Select a valid Mapbox profile.";
  }

  return null;
}
