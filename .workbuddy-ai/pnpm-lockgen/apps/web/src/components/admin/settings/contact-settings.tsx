"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { AdminPanel, AdminStatusNotice, AdminSwitch } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { IndihubApiError, indihubFetch } from "@/lib/api";
import type { StorefrontContactConfig } from "@/lib/storefront-api";

type ContactSettingsFormState = Omit<StorefrontContactConfig, "enabledChannels" | "whatsappLink">;

const defaultContactSettings: ContactSettingsFormState = {
  supportEmail: "support@1handindia.com",
  supportPhone: "",
  whatsappNumber: "",
  whatsappUrl: "",
  businessAddress: "",
  workingHours: "Monday to Saturday, 10:00 AM - 6:00 PM IST",
  responseSla: "We usually respond within 1 business day.",
  mapUrl: "",
  enableEmail: true,
  enablePhone: false,
  enableWhatsapp: false,
  enableAddress: false,
  enableMap: false,
};

export function ContactSettingsPanel() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactSettingsFormState>(defaultContactSettings);
  const query = useQuery({
    queryKey: ["admin-contact-settings", auth.authHeaders],
    enabled: Boolean(auth.authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<StorefrontContactConfig>(
        "/api/admin/settings/contact",
        undefined,
        auth.authHeaders,
      ),
  });
  const mutation = useMutation({
    mutationFn: (payload: ContactSettingsFormState) =>
      indihubFetch<StorefrontContactConfig>(
        "/api/admin/settings/contact",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        auth.authHeaders,
      ),
    onSuccess: async (saved) => {
      setForm(contactFormState(saved));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-contact-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["storefront-contact"] }),
      ]);
    },
  });

  useEffect(() => {
    if (query.data) {
      setForm(contactFormState(query.data));
    }
  }, [query.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(form);
  }

  const error = mutation.error ?? query.error;
  const enabledChannels = query.data?.enabledChannels ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ContactReadinessCard title="Email" ready={enabledChannels.includes("EMAIL")} detail={form.supportEmail || "Not configured"} icon={<Mail className="h-5 w-5" />} />
        <ContactReadinessCard title="Phone" ready={enabledChannels.includes("PHONE")} detail={form.supportPhone || "Not configured"} icon={<Phone className="h-5 w-5" />} />
        <ContactReadinessCard title="WhatsApp" ready={enabledChannels.includes("WHATSAPP")} detail={form.whatsappNumber || form.whatsappUrl || "Not configured"} icon={<MessageCircle className="h-5 w-5" />} />
        <ContactReadinessCard title="Address" ready={form.enableAddress && Boolean(form.businessAddress)} detail={form.businessAddress || "Not configured"} icon={<Building2 className="h-5 w-5" />} />
        <ContactReadinessCard title="Map" ready={form.enableMap && Boolean(form.mapUrl)} detail={form.mapUrl || "Not configured"} icon={<MapPin className="h-5 w-5" />} />
      </div>

      {query.isLoading ? <div className="h-64 animate-pulse rounded-lg bg-[#F8FAFC]" /> : null}
      {error ? (
        <AdminStatusNotice
          title="Contact settings unavailable"
          message={error instanceof IndihubApiError ? error.message : "Contact settings could not be loaded or saved."}
          tone="danger"
          status={error instanceof IndihubApiError ? error.status : undefined}
        />
      ) : null}
      {mutation.isSuccess ? (
        <AdminStatusNotice
          title="Contact settings saved"
          message="The storefront contact page now reads this public support configuration."
          tone="success"
        />
      ) : null}

      <AdminPanel>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <TextInput label="Support email" value={form.supportEmail} onChange={(supportEmail) => setForm((current) => ({ ...current, supportEmail }))} type="email" />
            <TextInput label="Support phone" value={form.supportPhone} onChange={(supportPhone) => setForm((current) => ({ ...current, supportPhone }))} />
            <TextInput label="WhatsApp number" value={form.whatsappNumber} onChange={(whatsappNumber) => setForm((current) => ({ ...current, whatsappNumber }))} />
            <TextInput label="WhatsApp link" value={form.whatsappUrl} onChange={(whatsappUrl) => setForm((current) => ({ ...current, whatsappUrl }))} placeholder="https://wa.me/..." />
            <TextInput label="Working hours" value={form.workingHours} onChange={(workingHours) => setForm((current) => ({ ...current, workingHours }))} />
            <TextInput label="Response SLA" value={form.responseSla} onChange={(responseSla) => setForm((current) => ({ ...current, responseSla }))} />
            <TextInput label="Map URL" value={form.mapUrl} onChange={(mapUrl) => setForm((current) => ({ ...current, mapUrl }))} placeholder="https://maps.google.com/..." />
            <TextInput label="Business address" value={form.businessAddress} onChange={(businessAddress) => setForm((current) => ({ ...current, businessAddress }))} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <AdminSwitch label="Email channel" checked={form.enableEmail} onChange={(enableEmail) => setForm((current) => ({ ...current, enableEmail }))} />
            <AdminSwitch label="Phone channel" checked={form.enablePhone} onChange={(enablePhone) => setForm((current) => ({ ...current, enablePhone }))} />
            <AdminSwitch label="WhatsApp channel" checked={form.enableWhatsapp} onChange={(enableWhatsapp) => setForm((current) => ({ ...current, enableWhatsapp }))} />
            <AdminSwitch label="Show address" checked={form.enableAddress} onChange={(enableAddress) => setForm((current) => ({ ...current, enableAddress }))} />
            <AdminSwitch label="Show map" checked={form.enableMap} onChange={(enableMap) => setForm((current) => ({ ...current, enableMap }))} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={mutation.isPending || query.isLoading}>
              {mutation.isPending ? "Saving..." : "Save contact settings"}
            </Button>
            <p className="text-sm font-semibold text-[#667085]">
              Enabled channels publish only when the matching value is saved.
            </p>
          </div>
        </form>
      </AdminPanel>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[#344054]">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
      />
    </label>
  );
}

function ContactReadinessCard({
  title,
  ready,
  detail,
  icon,
}: {
  title: string;
  ready: boolean;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <AdminPanel>
      <div className="flex items-start gap-3">
        <span className={ready ? "text-[#0F8A5F]" : "text-[#D64545]"}>{icon}</span>
        <div className="min-w-0">
          <h2 className="font-black text-[#1F2933]">{title}</h2>
          <p className="mt-1 truncate text-sm font-semibold text-[#667085]">{detail}</p>
          <StatusBadge tone={ready ? "success" : "warning"} className="mt-3">
            {ready ? "Published" : "Hidden"}
          </StatusBadge>
        </div>
      </div>
    </AdminPanel>
  );
}

function contactFormState(input: StorefrontContactConfig): ContactSettingsFormState {
  return {
    supportEmail: input.supportEmail ?? defaultContactSettings.supportEmail,
    supportPhone: input.supportPhone ?? "",
    whatsappNumber: input.whatsappNumber ?? "",
    whatsappUrl: input.whatsappUrl ?? "",
    businessAddress: input.businessAddress ?? "",
    workingHours: input.workingHours ?? defaultContactSettings.workingHours,
    responseSla: input.responseSla ?? defaultContactSettings.responseSla,
    mapUrl: input.mapUrl ?? "",
    enableEmail: Boolean(input.enableEmail),
    enablePhone: Boolean(input.enablePhone),
    enableWhatsapp: Boolean(input.enableWhatsapp),
    enableAddress: Boolean(input.enableAddress),
    enableMap: Boolean(input.enableMap),
  };
}
