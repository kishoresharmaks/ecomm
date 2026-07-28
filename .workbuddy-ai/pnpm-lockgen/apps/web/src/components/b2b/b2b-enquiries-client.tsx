"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { FilePlus2, Search, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { IndihubApiError } from "@/lib/api";
import {
  cancelBusinessBuyerEnquiry,
  getBusinessBuyerProfile,
  listBusinessBuyerEnquiries
} from "@/lib/business-buyer-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BEmptyState,
  B2BErrorPanel,
  B2BPanel,
  B2BSkeleton,
  B2BStatusPill,
  formatDateTime,
  formValue
} from "./b2b-ui";

const statuses = ["", "SUBMITTED", "IN_REVIEW", "RESPONDED", "BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"];

export function B2BEnquiriesClient() {
  const auth = useB2BAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false
  });
  const profileMissing = profileQuery.error instanceof IndihubApiError && profileQuery.error.status === 404;
  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", auth.authKey, filters],
    queryFn: () => listBusinessBuyerEnquiries(auth.authHeaders, { ...filters, limit: 50 }),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false
  });

  const cancelMutation = useMutation({
    mutationFn: (enquiryId: string) => cancelBusinessBuyerEnquiry(auth.authHeaders, enquiryId),
    onSuccess: () => {
      setNotice("Enquiry cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Enquiry cancellation failed.")
  });

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({
      search: formValue(form, "search"),
      status: formValue(form, "status")
    });
  }

  const enquiries = enquiriesQuery.data?.items ?? [];

  return (
    <B2BShell title="My B2B enquiries" description="Track submitted bulk requests, seller responses, and enquiry status from one place.">
      {confirmation.confirmationDialog}
      <B2BAuthNotice />

      {profileQuery.isLoading ? <B2BSkeleton /> : null}
      {profileMissing ? (
        <B2BEmptyState
          title="Business profile required"
          message="Create your company profile before submitting or tracking enquiries."
          action={
            <Button asChild>
              <Link href="/b2b/register">Register business</Link>
            </Button>
          }
        />
      ) : null}
      {profileQuery.error && !profileMissing ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      {profileQuery.data ? (
        <B2BPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading title="Submitted enquiries" description="Search by product, seller, company, or request message." />
            <Button asChild>
              <Link href="/b2b/enquiries/new">
                <FilePlus2 size={16} /> New enquiry
              </Link>
            </Button>
          </div>

          <form onSubmit={submitFilters} className="mt-5 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 md:grid-cols-[1fr_220px_auto]">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Search</span>
              <input
                name="search"
                defaultValue={filters.search}
                placeholder="Product, seller, or message"
                className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Status</span>
              <select
                name="status"
                defaultValue={filters.status}
                className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
              >
                {statuses.map((status) => (
                  <option key={status || "all"} value={status}>
                    {status ? status.replace(/_/g, " ") : "All statuses"}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="self-end">
              <Search size={16} /> Apply
            </Button>
          </form>

          {notice ? (
            <div className="mt-4">
              <StatusBadge tone={cancelMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {enquiriesQuery.isLoading ? <B2BSkeleton className="h-56" /> : null}
            {enquiriesQuery.error ? <B2BErrorPanel error={enquiriesQuery.error} onRetry={() => void enquiriesQuery.refetch()} /> : null}
            {!enquiriesQuery.isLoading && enquiries.length === 0 ? (
              <B2BEmptyState
                title="No matching enquiries"
                message="Submit a bulk request from an approved product or seller to start collecting quotations."
                action={
                  <Button asChild>
                    <Link href="/b2b/enquiries/new">
                      <FilePlus2 size={16} /> Create enquiry
                    </Link>
                  </Button>
                }
              />
            ) : null}
            {enquiries.map((enquiry) => {
              const canCancel = ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(enquiry.status);
              return (
                <article key={enquiry.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-[#1F2933]">
                          {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement enquiry"}
                        </h2>
                        <B2BStatusPill status={enquiry.status} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">
                        Quantity {enquiry.quantity} / {formatDateTime(enquiry.createdAt)}
                      </p>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#667085]">{enquiry.message}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/b2b/enquiries/${enquiry.id}`}>View detail</Link>
                      </Button>
                      {canCancel ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={cancelMutation.isPending}
                          onClick={() =>
                            confirmation.requestConfirmation({
                              title: "Cancel this B2B enquiry?",
                              description: `"${enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement enquiry"}" will be closed for further responses.`,
                              confirmLabel: "Cancel enquiry",
                              onConfirm: () => cancelMutation.mutate(enquiry.id)
                            })
                          }
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </B2BPanel>
      ) : null}
    </B2BShell>
  );
}
