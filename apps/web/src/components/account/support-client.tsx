"use client";

import { FormEvent, useState } from "react";
import { LifeBuoy, Mail, Phone } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { AccountShell } from "./account-shell";
import { ErrorPanel, Field, PagePanel, SkeletonBlock, TextAreaField, formValue, optionalFormValue } from "./account-ui";
import { createAuthenticatedSupportRequest, getCustomerProfile, type SupportRequestPayload } from "@/lib/account-api";

export function SupportClient() {
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
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
    const phone = optionalFormValue(form, "phone");
    const payload: SupportRequestPayload = {
      name: formValue(form, "name"),
      email: formValue(form, "email"),
      ...(phone ? { phone } : {}),
      subject: formValue(form, "subject"),
      message: formValue(form, "message")
    };

    setNotice(null);
    supportMutation.mutate(payload);
  }

  const profile = profileQuery.data;

  return (
    <AccountShell title="Support" description="Create a customer support request connected to the active account.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <PagePanel>
          <SectionHeading title="New support request" description="Send order, delivery, account, or product support requests to the admin queue." />
          {profileQuery.isLoading ? <SkeletonBlock className="mt-5 h-32" /> : null}
          {profileQuery.error ? <div className="mt-5"><ErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /></div> : null}
          {profile ? (
            <form key={profile.updatedAt ?? profile.id} onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Name" name="name" required defaultValue={profile.user.fullName ?? profile.displayName ?? ""} />
              <Field label="Email" name="email" type="email" required defaultValue={profile.user.email} />
              <Field label="Phone" name="phone" pattern="[6-9][0-9]{9}" defaultValue={profile.user.phone ?? ""} />
              <Field label="Subject" name="subject" required placeholder="Order delivery support" />
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
              <SectionHeading title="Support scope" description="Phase 1 keeps support simple and admin-managed." />
            </div>
            <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
              <p>Use this for delivery status questions, account corrections, product issues, and order help.</p>
              <p>Admin users can update status and notes from the admin support screen when that frontend slice is built.</p>
            </div>
          </PagePanel>

          <PagePanel>
            <SectionHeading title="Contact readiness" description="Client contact details can be added through CMS/settings later." />
            <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />
                Email provider setup remains a client configuration item.
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />
                Phone/WhatsApp automation is not part of frozen Phase 1.
              </p>
            </div>
          </PagePanel>
        </div>
      </div>
    </AccountShell>
  );
}
