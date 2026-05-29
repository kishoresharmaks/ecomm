"use client";

import { FormEvent, useState } from "react";
import { Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import {
  StorefrontNotice,
  StorefrontPageHeader,
  StorefrontFormPanel,
  StorefrontPanel,
} from "@/components/storefront/storefront-ui";
import { Field, TextAreaField, formValue, optionalFormValue } from "@/components/account/account-ui";
import { createPublicSupportRequest, type PublicSupportPayload } from "@/lib/storefront-api";

export function ContactPageClient() {
  const [notice, setNotice] = useState<string | null>(null);
  const supportMutation = useMutation({
    mutationFn: (payload: PublicSupportPayload) => createPublicSupportRequest(payload),
    onSuccess: () => setNotice("Contact request submitted. The admin team can review it from support requests."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Contact request failed.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = optionalFormValue(form, "phone");
    const payload: PublicSupportPayload = {
      name: formValue(form, "name"),
      email: formValue(form, "email"),
      ...(phone ? { phone } : {}),
      subject: formValue(form, "subject"),
      message: formValue(form, "message")
    };

    setNotice(null);
    supportMutation.mutate(payload);
  }

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <StorefrontPageHeader
          badge="Support"
          title="Contact 1HandIndia"
          description="Send customer, seller, delivery, or B2B enquiries into the admin support workflow."
        />

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:grid-cols-[1fr_360px] lg:px-6">
          <StorefrontFormPanel onSubmit={submit} className="rounded-lg">
            <SectionHeading title="Send request" description="Support requests are stored in the backend and can be managed from the admin panel." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Name" name="name" required />
              <Field label="Email" name="email" type="email" required />
              <Field label="Phone" name="phone" pattern="[6-9][0-9]{9}" />
              <Field label="Subject" name="subject" required placeholder="Product or order support" />
              <div className="md:col-span-2">
                <TextAreaField label="Message" name="message" required rows={6} placeholder="Explain what you need help with." />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={supportMutation.isPending}>
                {supportMutation.isPending ? "Submitting..." : "Submit request"}
              </Button>
              {notice ? <StorefrontNotice tone={supportMutation.isError ? "danger" : "success"}>{notice}</StorefrontNotice> : null}
            </div>
          </StorefrontFormPanel>

          <aside className="grid h-fit gap-5">
            <InfoPanel icon={Mail} title="Email setup" text="Official sender and support email are client configuration items before launch." />
            <InfoPanel icon={Phone} title="Phone support" text="Support contact numbers can be published after the client provides final details." />
            <InfoPanel icon={MapPin} title="Business address" text="Legal and operating address can be managed later through settings and CMS pages." />
          </aside>
        </section>
      </main>
    </StorefrontFrame>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  text
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <StorefrontPanel className="rounded-lg">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-black text-[#1F2933]">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{text}</p>
    </StorefrontPanel>
  );
}
