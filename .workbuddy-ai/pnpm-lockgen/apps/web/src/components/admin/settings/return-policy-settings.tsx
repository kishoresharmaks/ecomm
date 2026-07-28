"use client";

import { useEffect, useState } from "react";
import { CalendarClock, RefreshCcw, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";

type ReturnPolicySettingsResponse = {
  returnWindowDays: number;
  replacementWindowDays: number;
};

export function ReturnPolicySettings() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [returnWindowDays, setReturnWindowDays] = useState("7");
  const [replacementWindowDays, setReplacementWindowDays] = useState("7");
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-return-policy-settings", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<ReturnPolicySettingsResponse>(
        "/api/admin/settings/returns/policy",
        undefined,
        auth.authHeaders,
      ),
  });

  useEffect(() => {
    if (!settingsQuery.data || isDirty) {
      return;
    }
    setReturnWindowDays(String(settingsQuery.data.returnWindowDays));
    setReplacementWindowDays(String(settingsQuery.data.replacementWindowDays));
  }, [isDirty, settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      indihubFetch<ReturnPolicySettingsResponse>(
        "/api/admin/settings/returns/policy",
        {
          method: "PUT",
          body: JSON.stringify({
            returnWindowDays: boundedDays(returnWindowDays),
            replacementWindowDays: boundedDays(replacementWindowDays),
          }),
        },
        auth.authHeaders,
      ),
    onSuccess: async (settings) => {
      setReturnWindowDays(String(settings.returnWindowDays));
      setReplacementWindowDays(String(settings.replacementWindowDays));
      setIsDirty(false);
      setNotice("Return and replacement windows saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-return-policy-settings"] }),
      ]);
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Return policy settings could not be saved.");
    },
  });

  function updateDays(setter: (value: string) => void, value: string) {
    setter(value);
    setIsDirty(true);
    setNotice(null);
  }

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <RefreshCcw className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Return and replacement windows</h3>
              <StatusBadge tone={isDirty ? "warning" : "success"}>
                {isDirty ? "Unsaved changes" : "Active"}
              </StatusBadge>
            </div>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              Set how long customers can request a refund return or replacement after delivery.
              Enter 0 days to disable that option.
            </p>
          </div>
        </div>
      </div>

      {settingsQuery.isError ? (
        <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
          Return policy settings could not load.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <PolicyDaysInput
          label="Refund return window"
          description="Customers can submit a return for refund within this many days after delivery."
          value={returnWindowDays}
          disabled={saveMutation.isPending}
          onChange={(value) => updateDays(setReturnWindowDays, value)}
        />
        <PolicyDaysInput
          label="Replacement window"
          description="Customers can request a replacement within this many days after delivery."
          value={replacementWindowDays}
          disabled={saveMutation.isPending}
          onChange={(value) => updateDays(setReplacementWindowDays, value)}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">
          The selected deadline is shown on delivered order details and checked again when the request is submitted.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!auth.isAuthenticated || saveMutation.isPending || !isDirty}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save return policy"}
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

function PolicyDaysInput({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
      <span className="flex items-center gap-2 text-sm font-black text-[#1F2933]">
        <CalendarClock className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">{description}</span>
      <span className="mt-3 flex h-11 items-center rounded-md border border-[#D8E2EA] bg-white px-3 focus-within:border-[#ED3500]">
        <input
          type="number"
          min="0"
          max="365"
          step="1"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#1F2933] outline-none disabled:opacity-60"
        />
        <span className="text-xs font-black uppercase text-[#667085]">days</span>
      </span>
    </label>
  );
}

function boundedDays(value: string) {
  const parsed = Number(value);
  return Math.min(365, Math.max(0, Math.round(Number.isFinite(parsed) ? parsed : 0)));
}
