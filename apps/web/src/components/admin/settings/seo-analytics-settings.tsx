"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Globe, Save, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";
import {
  primaryGoogleAdsId,
  primaryGoogleAnalyticsId,
} from "@/lib/google-analytics";

type SettingRecord = {
  key: string;
  value: unknown;
};

const keys = {
  googleAnalyticsId: "seo.google_analytics_id",
  googleAdsId: "seo.google_ads_id",
  googleSearchConsoleId: "seo.google_search_console_id",
  googleTagManagerId: "seo.google_tag_manager_id",
} as const;

type FormState = {
  googleAnalyticsId: string;
  googleAdsId: string;
  googleSearchConsoleId: string;
  googleTagManagerId: string;
};

const emptyForm: FormState = {
  googleAnalyticsId: primaryGoogleAnalyticsId,
  googleAdsId: primaryGoogleAdsId,
  googleSearchConsoleId: "",
  googleTagManagerId: "",
};

export function SeoAnalyticsSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isDirty) {
      return;
    }

    setForm(settingsForm(settings));
  }, [isDirty, settings]);

  const validationErrors = validateForm(form);
  const hasGoogleTag = Boolean(
    form.googleTagManagerId.trim() ||
      form.googleAnalyticsId.trim() ||
      form.googleAdsId.trim(),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      await indihubFetch(
        "/api/admin/settings/seo/analytics",
        {
          method: "PUT",
          body: JSON.stringify(normalizedForm(form)),
        },
        auth.authHeaders,
      );
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
              The Google tag is installed directly across the website with Google Ads and Google Analytics 4 destinations. Configure optional Google Tag Manager and Search Console integrations here.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <label htmlFor="google-tag-manager-id" className="block text-sm font-black text-[#1F2933]">
            Google Tag Manager Container ID
          </label>
          <input
            id="google-tag-manager-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-white px-3.5 py-2 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
            placeholder="GTM-XXXXXXXX"
            value={form.googleTagManagerId}
            onChange={(e) => updateField("googleTagManagerId", e.target.value)}
            disabled={saveMutation.isPending}
            aria-invalid={Boolean(validationErrors.googleTagManagerId)}
          />
          <FieldHelp
            error={validationErrors.googleTagManagerId}
            text="Use the Container ID from Google Tag Manager. It must start with GTM-. When configured, manage GA4 and Ads tags inside that container to avoid duplicate tracking."
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="google-analytics-id" className="block text-sm font-black text-[#1F2933]">
            Google Analytics Measurement ID (installed)
          </label>
          <input
            id="google-analytics-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-[#F8FAFC] px-3.5 py-2 text-sm font-semibold text-[#475467] outline-none"
            value={primaryGoogleAnalyticsId}
            readOnly
            aria-readonly="true"
          />
          <FieldHelp
            error={undefined}
            text="This GA4 tag is emitted directly inside the head of every page. Do not add the same measurement ID inside Google Tag Manager, because that would duplicate page views."
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="google-ads-id" className="block text-sm font-black text-[#1F2933]">
            Google Ads tag ID (installed)
          </label>
          <input
            id="google-ads-id"
            type="text"
            className="w-full max-w-md rounded-[10px] border border-[#D1D5DB] bg-[#F8FAFC] px-3.5 py-2 text-sm font-semibold text-[#475467] outline-none"
            value={primaryGoogleAdsId}
            readOnly
            aria-readonly="true"
          />
          <FieldHelp
            error={undefined}
            text="This is the primary Google tag ID requested by the connected Google account. It is emitted once in the head and shares the tag with the GA4 destination above."
          />
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
            value={form.googleSearchConsoleId}
            onChange={(e) => updateField("googleSearchConsoleId", e.target.value)}
            disabled={saveMutation.isPending}
            aria-invalid={Boolean(validationErrors.googleSearchConsoleId)}
          />
          <FieldHelp
            error={validationErrors.googleSearchConsoleId}
            text={<>Paste only the token from the content attribute, not the full <code>&lt;meta&gt;</code> tag.</>}
          />
        </div>

        <div className={`flex items-start gap-3 rounded-md border p-4 ${hasGoogleTag ? "border-[#BFEAD9] bg-[#E9F7F1]" : "border-[#F3D39B] bg-[#FFF8E8]"}`}>
          {hasGoogleTag ? (
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087A55]" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#9A5B00]" aria-hidden="true" />
          )}
          <div>
            <p className={`text-sm font-black ${hasGoogleTag ? "text-[#064C35]" : "text-[#7A4700]"}`}>
              {hasGoogleTag ? "Google tag configuration saved" : "No analytics tag configured"}
            </p>
            <p className={`mt-1 text-xs font-semibold leading-5 ${hasGoogleTag ? "text-[#176B50]" : "text-[#8A5A12]"}`}>
              The Google tag is present in the page head for installation checks. Consent Mode controls storage and switches to full measurement after a visitor selects Allow analytics.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-5">
        <p className="text-xs font-semibold text-[#667085]">
          Make sure your site is published publicly to allow crawler access.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!auth.isAuthenticated || saveMutation.isPending || !isDirty || Object.keys(validationErrors).length > 0}
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

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
    setNotice(null);
  }
}

function stringSetting(settings: SettingRecord[], key: string, fallback: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  return typeof value === "string" ? value : fallback;
}

function settingsForm(settings: SettingRecord[]): FormState {
  const rawTagManagerId = stringSetting(settings, keys.googleTagManagerId, "").trim();

  return {
    googleAnalyticsId: primaryGoogleAnalyticsId,
    googleAdsId: primaryGoogleAdsId,
    googleSearchConsoleId: stringSetting(settings, keys.googleSearchConsoleId, "").trim(),
    googleTagManagerId: /^GTM-[A-Z0-9]+$/i.test(rawTagManagerId) ? rawTagManagerId.toUpperCase() : "",
  };
}

function normalizedForm(form: FormState): FormState {
  return {
    googleAnalyticsId: primaryGoogleAnalyticsId,
    googleAdsId: primaryGoogleAdsId,
    googleSearchConsoleId: form.googleSearchConsoleId.trim(),
    googleTagManagerId: form.googleTagManagerId.trim().toUpperCase(),
  };
}

function validateForm(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  const normalized = normalizedForm(form);

  if (normalized.googleTagManagerId && !/^GTM-[A-Z0-9]+$/.test(normalized.googleTagManagerId)) {
    errors.googleTagManagerId = "Enter a valid Container ID beginning with GTM-.";
  }
  if (normalized.googleAnalyticsId && !/^G-[A-Z0-9]+$/.test(normalized.googleAnalyticsId)) {
    errors.googleAnalyticsId = "Enter a valid GA4 Measurement ID beginning with G-.";
  }
  if (normalized.googleAdsId && !/^AW-[0-9]+$/.test(normalized.googleAdsId)) {
    errors.googleAdsId = "Enter a valid Google Ads tag ID beginning with AW-.";
  }
  if (normalized.googleSearchConsoleId && !/^[A-Z0-9_-]+$/i.test(normalized.googleSearchConsoleId)) {
    errors.googleSearchConsoleId = "Paste only the verification token, not the full meta tag.";
  }

  return errors;
}

function FieldHelp({
  error,
  text,
}: {
  error: string | undefined;
  text: React.ReactNode;
}) {
  return (
    <p className={`text-xs font-semibold leading-5 ${error ? "text-[#B42318]" : "text-[#667085]"}`}>
      {error ?? text}
    </p>
  );
}
