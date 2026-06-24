"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminSwitch } from "@/components/admin/admin-ux";
import { indihubFetch, type IndihubAuthHeaders } from "@/lib/api";
import { readBooleanSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

const chatSupportEnabledKey = "support.chat.enabled";

export function ChatSupportSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(readBooleanSettingValue(settings.find((setting) => setting.key === chatSupportEnabledKey)?.value, true));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => upsertSetting(auth.authHeaders, chatSupportEnabledKey, enabled),
    onSuccess: async () => {
      setNotice(enabled ? "Support chat is enabled for customer-facing portals." : "Support chat is disabled for customer-facing portals.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["chat-config"] }),
        queryClient.invalidateQueries({ queryKey: ["my-chat-conversations"] }),
      ]);
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to save support chat setting."),
  });

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Realtime support chat</h3>
              <StatusBadge tone={enabled ? "success" : "warning"}>{enabled ? "Enabled" : "Disabled"}</StatusBadge>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Controls the floating chat widget, guided chat actions, user messages, and staff handover on customer-facing portals.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <AdminSwitch
          label="Enable support chat"
          description="When disabled, the chat widget is hidden and chat API actions reject new user activity. Admin chat history remains available for audit."
          checked={enabled}
          onChange={setEnabled}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">Existing conversations are preserved. Disable only when support chat should be unavailable to users.</p>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={!auth.isAuthenticated || saveMutation.isPending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save chat setting"}
        </Button>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-md border p-3 text-sm font-semibold ${saveMutation.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}>
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function upsertSetting(authHeaders: IndihubAuthHeaders, key: string, value: boolean) {
  return indihubFetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ group: "support", valueType: "BOOLEAN", value }),
  }, authHeaders);
}
