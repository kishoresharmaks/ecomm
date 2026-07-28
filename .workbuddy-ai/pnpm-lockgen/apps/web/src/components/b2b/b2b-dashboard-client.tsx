"use client";

import Link from "next/link";
import { ArrowRight, Building2, FilePlus2, ListChecks } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { IndihubApiError } from "@/lib/api";
import { getBusinessBuyerProfile, listBusinessBuyerEnquiries } from "@/lib/business-buyer-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BEmptyState,
  B2BErrorPanel,
  B2BMetric,
  B2BPanel,
  B2BSkeleton,
  B2BStatusPill,
  formatDateTime
} from "./b2b-ui";

export function B2BDashboardClient() {
  const auth = useB2BAuth();
  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false
  });
  const hasProfile = Boolean(profileQuery.data);
  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", auth.authKey, "dashboard"],
    queryFn: () => listBusinessBuyerEnquiries(auth.authHeaders, { limit: 5 }),
    enabled: auth.enabled && hasProfile,
    retry: false
  });

  const profileMissing = profileQuery.error instanceof IndihubApiError && profileQuery.error.status === 404;
  const enquiries = enquiriesQuery.data?.items ?? [];
  const openCount = enquiriesQuery.data?.items.filter((item) => ["SUBMITTED", "IN_REVIEW"].includes(item.status)).length ?? 0;
  const responsePendingCount = enquiriesQuery.data?.items.filter((item) => item.status === "RESPONDED").length ?? 0;
  const confirmedCount =
    enquiriesQuery.data?.items.filter((item) => ["BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED"].includes(item.status)).length ?? 0;

  return (
    <B2BShell
      title="Business buying workspace"
      description="Manage company details, submit bulk purchase enquiries, and review seller or admin quotation responses."
    >
      <B2BAuthNotice />

      {profileQuery.isLoading ? <B2BSkeleton /> : null}
      {profileQuery.error && !profileMissing ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      {profileMissing ? (
        <B2BEmptyState
          title="Set up your business profile"
          message="Add company, GST, contact, and address details before submitting bulk purchase enquiries."
          action={
            <Button asChild>
              <Link href="/b2b/register">
                Register business <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
      ) : null}

      {profileQuery.data ? (
        <div className="grid gap-5">
          <B2BPanel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-[#1F2933]">{profileQuery.data.companyName}</h2>
                    <B2BStatusPill status={profileQuery.data.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                    {profileQuery.data.contactName} / {profileQuery.data.contactPhone}
                    {profileQuery.data.gstNumber ? ` / GST ${profileQuery.data.gstNumber}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/b2b/company-profile">Edit profile</Link>
                </Button>
                <Button asChild>
                  <Link href="/b2b/enquiries/new">
                    New enquiry <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>
          </B2BPanel>

          <div className="grid gap-4 md:grid-cols-4">
            <B2BMetric label="Total enquiries" value={enquiriesQuery.data?.total ?? 0} note="Submitted by this company" />
            <B2BMetric label="Open enquiries" value={openCount} note="Awaiting review or response" />
            <B2BMetric label="Responses" value={responsePendingCount} note="Ready for your confirmation" />
            <B2BMetric label="Confirmed" value={confirmedCount} note="Approved or finalised requests" />
          </div>

          <B2BPanel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading title="Recent enquiries" description="Latest bulk requests and quotation responses for this company." />
              <Button asChild variant="outline">
                <Link href="/b2b/enquiries">
                  <ListChecks size={16} /> View all
                </Link>
              </Button>
            </div>
            <div className="mt-5 grid gap-3">
              {enquiriesQuery.isLoading ? <B2BSkeleton className="h-40" /> : null}
              {enquiriesQuery.error ? <B2BErrorPanel error={enquiriesQuery.error} onRetry={() => void enquiriesQuery.refetch()} /> : null}
              {!enquiriesQuery.isLoading && enquiries.length === 0 ? (
                <B2BEmptyState
                  title="No enquiries yet"
                  message="Create your first bulk purchase enquiry from an approved product or seller."
                  action={
                    <Button asChild>
                      <Link href="/b2b/enquiries/new">
                        <FilePlus2 size={16} /> Create enquiry
                      </Link>
                    </Button>
                  }
                />
              ) : null}
              {enquiries.map((enquiry) => (
                <Link
                  key={enquiry.id}
                  href={`/b2b/enquiries/${enquiry.id}`}
                  className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] hover:bg-white"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-black text-[#1F2933]">
                        {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement enquiry"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">
                        Quantity {enquiry.quantity} / {formatDateTime(enquiry.createdAt)}
                      </p>
                    </div>
                    <B2BStatusPill status={enquiry.status} />
                  </div>
                </Link>
              ))}
            </div>
          </B2BPanel>
        </div>
      ) : null}
    </B2BShell>
  );
}
