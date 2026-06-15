"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Clock,
  CreditCard,
  Download,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  PackageSearch,
  Phone,
  Send,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import type {
  SupportContactChannel,
  SupportRequesterType,
  SupportRequestTopic,
} from "@indihub/shared-types";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import {
  StorefrontNotice,
  StorefrontFormPanel,
  StorefrontPanel,
} from "@/components/storefront/storefront-ui";
import { Field, TextAreaField, formValue, optionalFormValue } from "@/components/account/account-ui";
import {
  createPublicSupportRequest,
  getStorefrontContact,
  type PublicSupportPayload,
  type StorefrontContactConfig,
} from "@/lib/storefront-api";
import {
  contactChannelLabels,
  contactChannelOptions,
  contactTopicDescriptions,
  contactTopicLabels,
  defaultSubjectForTopic,
  requesterTypeOptions,
  supportTopicFromQuery,
  supportTopicOptions,
} from "./contact-utils";

const topicIcons: Record<SupportRequestTopic, LucideIcon> = {
  ORDER: PackageSearch,
  PAYMENT: CreditCard,
  DELIVERY: Truck,
  SELLER: Store,
  B2B: Building2,
  DOWNLOAD_APP: Download,
  GENERAL: LifeBuoy,
};

export function ContactPageClient() {
  const searchParams = useSearchParams();
  const queryTopic = useMemo(
    () => supportTopicFromQuery(searchParams.get("topic")),
    [searchParams],
  );
  const [topic, setTopic] = useState<SupportRequestTopic>(queryTopic);
  const [requesterType, setRequesterType] = useState<SupportRequesterType>("GUEST");
  const [preferredContactChannel, setPreferredContactChannel] =
    useState<SupportContactChannel>("EMAIL");
  const [subject, setSubject] = useState(defaultSubjectForTopic(queryTopic));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setTopic(queryTopic);
    setSubject(defaultSubjectForTopic(queryTopic));
  }, [queryTopic]);

  const contactQuery = useQuery({
    queryKey: ["storefront-contact"],
    queryFn: getStorefrontContact,
    retry: false,
  });
  const contact = contactQuery.data;
  const visibleChannels = contact?.enabledChannels.length
    ? contact.enabledChannels
    : (["EMAIL"] as SupportContactChannel[]);

  useEffect(() => {
    if (contact?.enabledChannels.length && !contact.enabledChannels.includes(preferredContactChannel)) {
      setPreferredContactChannel(contact.enabledChannels[0] ?? "EMAIL");
    }
  }, [contact?.enabledChannels, preferredContactChannel]);

  const supportMutation = useMutation({
    mutationFn: (payload: PublicSupportPayload) => createPublicSupportRequest(payload),
    onSuccess: () => {
      setNotice("Support request submitted. Our team will follow up through your preferred channel.");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Contact request failed."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = optionalFormValue(form, "phone");
    const orderNumber = optionalFormValue(form, "orderNumber");
    const payload: PublicSupportPayload = {
      name: formValue(form, "name"),
      email: formValue(form, "email"),
      ...(phone ? { phone } : {}),
      topic,
      requesterType,
      preferredContactChannel,
      subject: subject.trim(),
      ...(orderNumber ? { orderNumber } : {}),
      message: formValue(form, "message"),
    };

    setNotice(null);
    supportMutation.mutate(payload);
  }

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <section className="border-b border-[#F0E4DF] bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-6">
            <div className="flex min-w-0 flex-col justify-center">
              <span className="w-fit rounded-md bg-[#FFF1EC] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#ED3500]">
                Support center
              </span>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#1F2933] md:text-5xl">
                Contact 1HandIndia
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#667085]">
                Choose the right support topic and send a request into the marketplace operations queue.
              </p>
              <div className="mt-6 grid gap-3 text-sm font-bold text-[#344054] sm:grid-cols-2">
                <InlineFact icon={Clock} label={contact?.workingHours ?? "Monday to Saturday, 10:00 AM - 6:00 PM IST"} />
                <InlineFact icon={LifeBuoy} label={contact?.responseSla ?? "We usually respond within 1 business day."} />
              </div>
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-lg border border-[#F0E4DF] bg-[#163B5C]">
              <Image
                src="/brand/1handindia_hero_mark.png"
                alt="1HandIndia support"
                fill
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#163B5C]/90 via-[#163B5C]/35 to-transparent" />
              <div className="absolute bottom-0 p-5 text-white">
                <p className="text-sm font-black uppercase tracking-wide">Marketplace help</p>
                <p className="mt-2 max-w-xs text-sm font-semibold leading-6 text-white/85">
                  Orders, payments, seller operations, B2B procurement, delivery, and app help in one queue.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
          <div className="grid gap-5">
            <StorefrontPanel className="rounded-lg">
              <SectionHeading
                title="What do you need help with?"
                description={contactTopicDescriptions[topic]}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {supportTopicOptions.map((option) => {
                  const Icon = topicIcons[option.value];
                  const selected = topic === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTopic(option.value);
                        setSubject(defaultSubjectForTopic(option.value));
                      }}
                      className={cn(
                        "min-h-28 rounded-lg border p-4 text-left transition",
                        selected
                          ? "border-[#ED3500] bg-[#FFF1EC] shadow-sm"
                          : "border-[#E5E7EB] bg-white hover:border-[#ED3500]/50",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-md",
                          selected ? "bg-[#ED3500] text-white" : "bg-[#EAF1F7] text-[#163B5C]",
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="mt-3 block text-sm font-black text-[#1F2933]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StorefrontPanel>

            <StorefrontFormPanel onSubmit={submit} className="rounded-lg">
              <SectionHeading
                title={`${contactTopicLabels[topic]} request`}
                description="Your request will be stored with topic, requester type, preferred channel, and optional order reference for admin triage."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SelectField
                  label="I am a"
                  value={requesterType}
                  options={requesterTypeOptions}
                  onChange={(value) => setRequesterType(value as SupportRequesterType)}
                />
                <SelectField
                  label="Preferred contact"
                  value={preferredContactChannel}
                  options={contactChannelOptions.filter((option) => visibleChannels.includes(option.value))}
                  onChange={(value) => setPreferredContactChannel(value as SupportContactChannel)}
                />
                <Field label="Name" name="name" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone" name="phone" pattern="[6-9][0-9]{9}" />
                <Field label="Order number" name="orderNumber" placeholder="Optional free-text reference" />
                <label className="grid gap-1 text-sm font-bold text-[#344054] md:col-span-2">
                  <span>Subject</span>
                  <input
                    name="subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                    className="min-h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                  />
                </label>
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Message"
                    name="message"
                    required
                    rows={6}
                    placeholder="Explain what happened and what support you need."
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={supportMutation.isPending}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {supportMutation.isPending ? "Submitting..." : "Submit request"}
                </Button>
                {notice ? (
                  <StorefrontNotice tone={supportMutation.isError ? "danger" : "success"}>
                    {notice}
                  </StorefrontNotice>
                ) : null}
              </div>
            </StorefrontFormPanel>
          </div>

          <aside className="grid h-fit gap-5">
            <ContactChannelsPanel contact={contact} isLoading={contactQuery.isLoading} />
            {contact?.businessAddress ? (
              <InfoPanel icon={MapPin} title="Business address" text={contact.businessAddress} />
            ) : null}
            {contact?.mapUrl ? (
              <StorefrontPanel className="rounded-lg">
                <Button asChild variant="outline" className="w-full justify-center">
                  <a href={contact.mapUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Open map
                  </a>
                </Button>
              </StorefrontPanel>
            ) : null}
          </aside>
        </section>
      </main>
    </StorefrontFrame>
  );
}

function ContactChannelsPanel({
  contact,
  isLoading,
}: {
  contact: StorefrontContactConfig | undefined;
  isLoading: boolean;
}) {
  const channels = contact?.enabledChannels.length ? contact.enabledChannels : (["EMAIL"] as SupportContactChannel[]);
  return (
    <StorefrontPanel className="rounded-lg">
      <SectionHeading title="Support channels" description={contact?.responseSla ?? "Response SLA is managed by admin settings."} />
      {isLoading ? <div className="mt-5 h-28 animate-pulse rounded-lg bg-[#F8FAFC]" /> : null}
      <div className="mt-5 grid gap-3">
        {channels.map((channel) => (
          <ChannelCard key={channel} channel={channel} contact={contact} />
        ))}
      </div>
    </StorefrontPanel>
  );
}

function ChannelCard({
  channel,
  contact,
}: {
  channel: SupportContactChannel;
  contact: StorefrontContactConfig | undefined;
}) {
  if (channel === "PHONE") {
    return <InfoPanel icon={Phone} title="Phone" text={contact?.supportPhone || "Phone support not configured"} compact />;
  }
  if (channel === "WHATSAPP") {
    return (
      <InfoPanel
        icon={MessageCircle}
        title="WhatsApp"
        text={contact?.whatsappNumber || contact?.whatsappLink || "WhatsApp not configured"}
        href={contact?.whatsappLink || undefined}
        compact
      />
    );
  }
  return <InfoPanel icon={Mail} title={contactChannelLabels.EMAIL} text={contact?.supportEmail || "support@1handindia.com"} compact />;
}

function InlineFact({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-[#ED3500]" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  text,
  href,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  href?: string | undefined;
  compact?: boolean;
}) {
  const body = (
    <div className={cn("rounded-lg border border-[#E5E7EB] bg-white p-4", compact ? "" : "shadow-sm")}>
      <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-black text-[#1F2933]">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{text}</p>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {body}
      </a>
    );
  }

  return body;
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
