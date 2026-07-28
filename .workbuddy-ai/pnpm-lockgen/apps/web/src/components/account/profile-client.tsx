"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Wrench } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { AccountShell } from "./account-shell";
import { ErrorPanel, Field, PagePanel, SkeletonBlock, formValue, optionalFormValue } from "./account-ui";
import { getCustomerProfile, updateCustomerProfile, type CustomerProfilePayload } from "@/lib/account-api";

export function ProfileClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CustomerProfilePayload) => updateCustomerProfile(customerAuth.authHeaders, payload),
    onSuccess: () => {
      setNotice("Profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Profile update failed.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = formValue(form, "fullName");
    const displayName = formValue(form, "displayName");
    const phone = optionalFormValue(form, "phone");
    const payload: CustomerProfilePayload = {
      fullName,
      displayName,
      ...(phone ? { phone } : {})
    };

    setNotice(null);
    updateMutation.mutate(payload);
  }

  return (
    <AccountShell title="Profile" description="Keep the customer name and contact details clean for orders and support requests.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      {profileQuery.isLoading ? <SkeletonBlock /> : null}
      {profileQuery.error ? <ErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      {profileQuery.data ? (
        <div className="grid gap-5">
          <PagePanel>
            <SectionHeading title="Customer details" description="This profile is tied to the active 1HandIndia customer user." />
            <form key={profileQuery.data.updatedAt ?? profileQuery.data.id} onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Full name" name="fullName" required defaultValue={profileQuery.data.user.fullName ?? ""} />
              <Field label="Display name" name="displayName" required defaultValue={profileQuery.data.displayName ?? ""} />
              <Field label="Email" name="email" type="email" defaultValue={profileQuery.data.user.email} readOnly />
              <Field label="Phone" name="phone" pattern="[6-9][0-9]{9}" defaultValue={profileQuery.data.user.phone ?? ""} />

              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save profile"}
                </Button>
                {notice ? <StatusBadge tone={updateMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}
              </div>
            </form>
          </PagePanel>

          <PagePanel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-[#123A5A]">Booked services</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                  View service requests, quotes, provider updates, completion actions, disputes, and reviews.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/account/service-bookings">View booked services</Link>
            </Button>
          </PagePanel>
        </div>
      ) : null}
    </AccountShell>
  );
}
