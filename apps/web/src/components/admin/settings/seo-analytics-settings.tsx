"use client";

import { useEffect, useState } from "react";
import { Globe, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";

type SettingRecord = {
  key: string;
  value: unknown;
};

const keys = {
  googleAnalyticsId: "seo.google_analytics_id",
  googleSearchConsoleId: "seo.google_search_console_id",
  googleTagManagerId: "seo.google_tag_manager_id",
} as const;

export function SeoAnalyticsSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");
  const [googleSearchConsoleId, setGoogleSearchConsoleId] = useState("");
  const [googleTagManagerId, setGoogleTagManagerId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isDirty) {
      return;
    }

    setGoogleAnalyticsId(stringSetting(settings, keys.googleAnalyticsId, ""));
    setGoogleSearchConsoleId(stringSetting(settings, keys.googleSearchConsoleId, ""));
    setGoogleTagManagerId(stringSetting(settings, keys.googleTagManagerId, ""));
  }, [isDirty, settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        upsertSetting(
          auth.authHeaders,
          keys.googleAnalyticsId,
          "STRING",
          googleAnalyticsId.trim(),
        ),
        upsertSetting(
          auth.authHeaders,
          keys.googleSearchConsoleId,
          "STRING",
          googleSearchConsoleId.trim(),
        ),
        upsertSetting(
          auth.authHeaders,
          keys.googleTagManagerId,
          "STRING",
          googleTagManagerId.trim(),
        ),
      ]);
    },
    onSuccess: async () => {
      setIsDirty(false);
      setNotice("SEO & Analytics configurations have been successfully saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save SEO & Analytics settings."),
  });

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">SEO & Analytics integration</h3>
              {isDirty ? (
                <StatusBadge tone="warning">Unsaved changes</StatusBadge>
              ) : (
                <StatusBadge tone="success">Synced</StatusBadge>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Configure integration identifiers for Google Tag Manager (GTM), Google Analytics 4 (GA4), and Google Search Console (GSC) verification.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <label htmlFor="google-tag-manager-id" className="block text-sm font-black text-[#1F2933]">
            Google Tag Manager Container ID (or Google Tag ID)
          </label>
          <input
            id="google-tag-manager-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-white px-3.5 py-2 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
            placeholder="e.g. GTM-WFXLFC8X"
            value={googleTagManagerId}
            onChange={(e) => {
              setGoogleTagManagerId(e.target.value);
              setIsDirty(true);
              setNotice(null);
            }}
            disabled={saveMutation.isPending}
          />
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            Paste your Google Tag Manager (GTM) container ID (starts with "GTM-"). If you paste a generic Google Tag ID starting with "AW-" or "G-", the platform will automatically resolve and load it.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="google-analytics-id" className="block text-sm font-black text-[#1F2933]">
            Google Analytics Measurement ID
          </label>
          <input
            id="google-analytics-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-white px-3.5 py-2 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
            placeholder="e.g. G-XXXXXXXXXX"
            value={googleAnalyticsId}
            onChange={(e) => {
              setGoogleAnalyticsId(e.target.value);
              setIsDirty(true);
              setNotice(null);
            }}
            disabled={saveMutation.isPending}
          />
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            Paste your Google Analytics 4 (GA4) web stream Measurement ID (starts with "G-").
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="google-search-console-id" className="block text-sm font-black text-[#1F2933]">
            Google Search Console HTML verification code
          </label>
          <input
            id="google-search-console-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-white px-3.5 py-2 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
            placeholder="e.g. dF87c8d76a..."
            value={googleSearchConsoleId}
            onChange={(e) => {
              setGoogleSearchConsoleId(e.target.value);
              setIsDirty(true);
              setNotice(null);
            }}
            disabled={saveMutation.isPending}
          />
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            Only paste the token key from the meta tag content attribute. (e.g. from <code>&lt;meta name="google-site-verification" content="TOKEN" /&gt;</code>)
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-5">
        <p className="text-xs font-semibold text-[#667085]">
          Make sure your site is published publicly to allow crawler access.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!auth.isAuthenticated || saveMutation.isPending || !isDirty}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save SEO settings"}
        </Button>
      </div>

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

function upsertSetting(
  authHeaders: { bearerToken?: string },
  key: string,
  valueType: "STRING",
  value: string,
) {
  return indihubFetch(
    `/api/admin/settings/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ group: "seo", valueType, value }),
    },
    authHeaders,
  );
}

function stringSetting(settings: SettingRecord[], key: string, fallback: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  return typeof value === "string" ? value : fallback;
}
