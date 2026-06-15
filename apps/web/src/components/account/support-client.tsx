"use client";

import { FormEvent, useState } from "react";
import { LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import type {
  SupportContactChannel,
  SupportRequesterType,
  SupportRequestTopic,
} from "@indihub/shared-types";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  contactChannelLabels,
  contactChannelOptions,
  contactTopicDescriptions,
  contactTopicLabels,
  requesterTypeOptions,
  supportTopicOptions,
} from "@/components/cms/contact-utils";
import { AccountShell } from "./account-shell";
import { ErrorPanel, Field, PagePanel, SkeletonBlock, TextAreaField, formValue, optionalFormValue } from "./account-ui";
import { createAuthenticatedSupportRequest, getCustomerProfile, type SupportRequestPayload } from "@/lib/account-api";
import { getStorefrontContact } from "@/lib/storefront-api";

export function SupportClient() {
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [topic, setTopic] = useState<SupportRequestTopic>("ORDER");
  const [requesterType, setRequesterType] = useState<SupportRequesterType>("CUSTOMER");
  const [preferredContactChannel, setPreferredContactChannel] =
    useState<SupportContactChannel>("EMAIL");

  const profileQuery = useQuery({
    queryKey: ["account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });
  const contactQuery = useQuery({
    queryKey: ["storefront-contact"],
    queryFn: getStorefrontContact,
    enabled: customerAuth.enabled,
    retry: false
  });

  const supportMutation = useMutation({
    mutationFn: (payload: SupportRequestPayload) => createAuthenticatedSupportRequest(customerAuth.authHeaders, payload),
    onSuccess: () => setNotice("Support request submitted. Admin can review it from the support queue."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Support request failed.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = optionalFormValue(form, "name");
    const email = optionalFormValue(form, "email");
    const phone = optionalFormValue(form, "phone");
    const orderNumber = optionalFormValue(form, "orderNumber");
    const firstEnabledChannel = enabledChannels[0] ?? "EMAIL";
    const effectivePreferredContactChannel = enabledChannels.includes(preferredContactChannel)
      ? preferredContactChannel
      : firstEnabledChannel;
    const payload: SupportRequestPayload = {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      topic,
      requesterType,
      preferredContactChannel: effectivePreferredContactChannel,
      subject: formValue(form, "subject"),
      ...(orderNumber ? { orderNumber } : {}),
      message: formValue(form, "message")
    };

    setNotice(null);
    supportMutation.mutate(payload);
  }

  const profile = profileQuery.data;
  const enabledChannels = contactQuery.data?.enabledChannels.length
    ? contactQuery.data.enabledChannels
    : (["EMAIL"] as SupportContactChannel[]);
  const firstEnabledChannel = enabledChannels[0] ?? "EMAIL";
  const effectivePreferredContactChannel = enabledChannels.includes(preferredContactChannel)
    ? preferredContactChannel
    : firstEnabledChannel;

  return (
    <AccountShell title="Support" description="Create a customer support request connected to the active account.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <PagePanel>
          <SectionHeading title="New support request" description={contactTopicDescriptions[topic]} />
          {profileQuery.isLoading ? <SkeletonBlock className="mt-5 h-32" /> : null}
          {profileQuery.error ? <div className="mt-5"><ErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /></div> : null}
          {profile ? (
            <form key={profile.updatedAt ?? profile.id} onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
              <SelectField
                label="Topic"
                value={topic}
                options={supportTopicOptions}
                onChange={(value) => setTopic(value as SupportRequestTopic)}
              />
              <SelectField
                label="Requester type"
                value={requesterType}
                options={requesterTypeOptions.filter((option) => option.value !== "GUEST")}
                onChange={(value) => setRequesterType(value as SupportRequesterType)}
              />
              <Field label="Name override" name="name" defaultValue={profile.user.fullName ?? profile.displayName ?? ""} />
              <Field label="Email override" name="email" type="email" defaultValue={profile.user.email} />
              <Field label="Phone" name="phone" pattern="[6-9][0-9]{9}" defaultValue={profile.user.phone ?? ""} />
              <SelectField
                label="Preferred contact"
                value={effectivePreferredContactChannel}
                options={contactChannelOptions.filter((option) => enabledChannels.includes(option.value))}
                onChange={(value) => setPreferredContactChannel(value as SupportContactChannel)}
              />
              <Field label="Order number" name="orderNumber" placeholder="Optional free-text reference" />
              <Field label="Subject" name="subject" required placeholder={`${contactTopicLabels[topic]} request`} />
              <div className="md:col-span-2">
                <TextAreaField label="Message" name="message" required rows={6} placeholder="Explain the issue clearly for the admin team." />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <Button type="submit" disabled={supportMutation.isPending}>
                  {supportMutation.isPending ? "Submitting..." : "Submit support request"}
                </Button>
                {notice ? <StatusBadge tone={supportMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}
              </div>
            </form>
          ) : null}
        </PagePanel>

        <div className="grid gap-5">
          <PagePanel>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <LifeBuoy className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading title="Support scope" description="Account requests are linked to your signed-in profile." />
            </div>
            <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
              <p>Use this for order help, delivery status questions, payment follow-up, product issues, and account support.</p>
              <p>Order number is optional free text in this pass, so you can paste any marketplace reference you have.</p>
            </div>
          </PagePanel>

          <PagePanel>
            <SectionHeading title="Contact channels" description={contactQuery.data?.responseSla ?? "Support channels are managed by admin settings."} />
            <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
              {enabledChannels.map((channel) => (
                <p key={channel} className="flex items-center gap-2">
                  {channel === "PHONE" ? <Phone className="h-4 w-4 text-[#163B5C]" aria-hidden="true" /> : null}
                  {channel === "WHATSAPP" ? <MessageCircle className="h-4 w-4 text-[#163B5C]" aria-hidden="true" /> : null}
                  {channel === "EMAIL" ? <Mail className="h-4 w-4 text-[#163B5C]" aria-hidden="true" /> : null}
                  {channel === "EMAIL" ? (contactQuery.data?.supportEmail ?? "support@1handindia.com") : contactChannelLabels[channel]}
                  {channel === "PHONE" ? contactQuery.data?.supportPhone ?? "" : ""}
                  {channel === "WHATSAPP" ? contactQuery.data?.whatsappNumber ?? "" : ""}
                </p>
              ))}
            </div>
          </PagePanel>
        </div>
      </div>
    </AccountShell>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[#344054]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
