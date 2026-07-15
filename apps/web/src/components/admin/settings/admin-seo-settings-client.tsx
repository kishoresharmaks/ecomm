"use client";

import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";
import { SeoAnalyticsSettings } from "./seo-analytics-settings";
import { Globe } from "lucide-react";
import { useMemo } from "react";

type SettingRecord = {
  key: string;
  value: unknown;
};

export function AdminSeoSettingsClient() {
  const auth = useAdminAuth();
  const settingsQuery = useQuery({
    queryKey: ["admin-settings", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<SettingRecord[]>("/api/admin/settings", undefined, auth.authHeaders),
  });

  const settings = useMemo(() => settingsQuery.data ?? [], [settingsQuery.data]);

  if (settingsQuery.isLoading) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ED3500]/20 border-t-[#ED3500]" />
          <p className="text-sm font-semibold text-[#667085]">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-5 text-center shadow-sm">
        <Globe className="mx-auto h-8 w-8 text-[#8A1F1F]" />
        <h4 className="mt-3 text-base font-black text-[#8A1F1F]">Unable to load configurations</h4>
        <p className="mt-1 text-sm font-semibold text-[#8A1F1F]/80">
          {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Network error"}
        </p>
      </div>
    );
  }

  return <SeoAnalyticsSettings settings={settings} />;
}
