"use client";

import { useEffect, useState } from "react";
import { PackageCheck, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminSwitch } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import { readBooleanSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

const keys = {
  autoApproveProducts: "products.auto_approve.enabled",
} as const;

export function ProductApprovalSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [autoApproveProducts, setAutoApproveProducts] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isDirty) {
      return;
    }

    setAutoApproveProducts(booleanSetting(settings, keys.autoApproveProducts, false));
  }, [isDirty, settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertSetting(
        auth.authHeaders,
        keys.autoApproveProducts,
        "BOOLEAN",
        autoApproveProducts,
      ),
    onSuccess: async () => {
      setIsDirty(false);
      setNotice(
        autoApproveProducts
          ? "Product auto approval is enabled for valid seller submissions."
          : "Product auto approval is disabled. Seller products will wait for admin review.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save product approval setting."),
  });

  function updateAutoApproveProducts(value: boolean) {
    setAutoApproveProducts(value);
    setIsDirty(true);
    setNotice(null);
  }

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <PackageCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Product approval rules</h3>
              <StatusBadge tone={isDirty ? "warning" : autoApproveProducts ? "success" : "warning"}>
                {isDirty ? "Unsaved changes" : autoApproveProducts ? "Auto approval on" : "Manual review"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Controls whether valid seller product submissions go live immediately or enter the admin approval queue.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <AdminSwitch
          label="Auto approve seller products"
          description="When enabled, seller-created or edited products become active after the required marketplace, tax, image, price, and stock checks pass."
          checked={autoApproveProducts}
          onChange={updateAutoApproveProducts}
          disabled={saveMutation.isPending}
        />
      </div>

      <div className="mt-5 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
        <p className="text-sm font-black text-[#1F2933]">
          {autoApproveProducts ? "Valid products publish immediately." : "Seller products need admin approval."}
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
          Products missing required marketplace essentials will still be blocked from going live. Admin archive,
          approval, audit, and notification records continue to work normally.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">
          Default is manual review, so existing production behavior is unchanged until this is saved.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!auth.isAuthenticated || saveMutation.isPending || !isDirty}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save product rule"}
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
  valueType: "BOOLEAN",
  value: boolean,
) {
  return indihubFetch(
    `/api/admin/settings/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ group: "products", valueType, value }),
    },
    authHeaders,
  );
}

function settingValue(settings: SettingRecord[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function booleanSetting(settings: SettingRecord[], key: string, fallback: boolean) {
  return readBooleanSettingValue(settingValue(settings, key), fallback);
}
