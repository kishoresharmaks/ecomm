"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareReply, PackageSearch, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  cancelBusinessBuyerEnquiry,
  confirmBusinessBuyerEnquiry,
  getBusinessBuyerEnquiry,
  getBusinessBuyerProfile
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
  formatMoney
} from "./b2b-ui";

export function B2BEnquiryDetailClient({ enquiryId }: { enquiryId: string }) {
  const auth = useB2BAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false
  });
  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", auth.authKey, enquiryId],
    queryFn: () => getBusinessBuyerEnquiry(auth.authHeaders, enquiryId),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBusinessBuyerEnquiry(auth.authHeaders, enquiryId),
    onSuccess: () => {
      setNotice("Enquiry cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Enquiry cancellation failed.")
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmBusinessBuyerEnquiry(auth.authHeaders, enquiryId),
    onSuccess: () => {
      setNotice("Quotation confirmed. 1HandIndia admin can now approve and finalise it.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", auth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Quotation confirmation failed.")
  });

  const enquiry = enquiryQuery.data;
  const canCancel = enquiry ? ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(enquiry.status) : false;
  const canConfirm = enquiry?.status === "RESPONDED" && Boolean(enquiry.responses?.length);
  const actionPending = cancelMutation.isPending || confirmMutation.isPending;

  return (
    <B2BShell title="Enquiry detail" description="Review the bulk request, current status, and seller/admin quotation responses.">
      {confirmation.confirmationDialog}
      <B2BAuthNotice />

      <div className="mb-5">
        <Button asChild variant="ghost">
          <Link href="/b2b/enquiries">
            <ArrowLeft size={16} /> Back to enquiries
          </Link>
        </Button>
      </div>

      {profileQuery.isLoading || enquiryQuery.isLoading ? <B2BSkeleton /> : null}
      {profileQuery.error ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}
      {enquiryQuery.error ? <B2BErrorPanel error={enquiryQuery.error} onRetry={() => void enquiryQuery.refetch()} /> : null}

      {notice ? (
        <div className="mb-5">
          <StatusBadge tone={cancelMutation.isError || confirmMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
        </div>
      ) : null}

      {enquiry ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <B2BPanel>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-[#1F2933]">
                      {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement enquiry"}
                    </h2>
                    <B2BStatusPill status={enquiry.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#667085]">
                    Quantity {enquiry.quantity} / submitted {formatDateTime(enquiry.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canConfirm ? (
                    <Button
                      type="button"
                      disabled={actionPending}
                      onClick={() =>
                        confirmation.requestConfirmation({
                          title: "Confirm this quotation?",
                          description: "The enquiry will move to buyer confirmed. Seller responses and buyer cancellation will be locked while admin approval continues.",
                          confirmLabel: "Confirm quotation",
                          tone: "warning",
                          onConfirm: () => confirmMutation.mutate()
                        })
                      }
                    >
                      <CheckCircle2 size={16} /> Confirm quotation
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={actionPending}
                      onClick={() =>
                        confirmation.requestConfirmation({
                          title: "Cancel this B2B enquiry?",
                          description: "This enquiry will be closed for seller/admin response. You can submit a new enquiry later if procurement requirements change.",
                          confirmLabel: "Cancel enquiry",
                          onConfirm: () => cancelMutation.mutate()
                        })
                      }
                    >
                      <XCircle size={16} /> Cancel enquiry
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-7 text-[#667085]">
                {enquiry.message}
              </div>
            </B2BPanel>

            <B2BPanel>
              <SectionHeading title="Responses" description="Seller or admin replies are shown newest first." />
              <div className="mt-5 grid gap-3">
                {enquiry.responses?.length ? (
                  enquiry.responses.map((response) => (
                    <article key={response.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
                            <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-sm font-black text-[#1F2933]">
                              {response.responder?.fullName ?? response.responder?.email ?? "1HandIndia operations"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#667085]">{formatDateTime(response.createdAt)}</p>
                          </div>
                        </div>
                        <StatusBadge tone="info">{formatMoney(response.quotedPricePaise)}</StatusBadge>
                      </div>
                      <p className="mt-4 text-sm font-semibold leading-7 text-[#667085]">{response.responseMessage}</p>
                    </article>
                  ))
                ) : (
                  <B2BEmptyState
                    title="No responses yet"
                    message="Seller or admin replies will appear here after the enquiry is reviewed."
                  />
                )}
              </div>
            </B2BPanel>
          </div>

          <aside className="grid h-fit gap-4">
            <B2BPanel>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <PackageSearch className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#1F2933]">Request target</h2>
                  <div className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                    <p>{enquiry.product?.name ?? "General seller request"}</p>
                    <p>{enquiry.seller?.storeName ?? "No seller selected"}</p>
                    {enquiry.product?.variants?.[0]?.pricePaise ? <p>{formatMoney(enquiry.product.variants[0].pricePaise)}</p> : null}
                  </div>
                </div>
              </div>
            </B2BPanel>

            <B2BPanel>
              <h2 className="text-lg font-black text-[#1F2933]">Timeline</h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                <div className="rounded-md bg-[#F8FAFC] p-3">
                  <p className="font-black text-[#1F2933]">Submitted</p>
                  <p>{formatDateTime(enquiry.createdAt)}</p>
                </div>
                <div className="rounded-md bg-[#F8FAFC] p-3">
                  <p className="font-black text-[#1F2933]">Last updated</p>
                  <p>{formatDateTime(enquiry.updatedAt)}</p>
                </div>
              </div>
            </B2BPanel>
          </aside>
        </div>
      ) : null}
    </B2BShell>
  );
}
