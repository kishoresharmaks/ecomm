"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MessageSquareWarning, Search } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "./admin-auth-context";
import { AdminPanel, AdminStatusNotice } from "./admin-ux";
import { userFacingApiErrorMessage } from "@/lib/api";
import { b2bAction, listB2BSupportCases } from "@/lib/b2b-operations-api";

const statuses = ["", "OPEN", "IN_REVIEW", "WAITING_FOR_BUYER", "WAITING_FOR_SELLER", "RESOLVED", "CLOSED"];

export function AdminB2BCasesClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-b2b-cases", submittedSearch, status, page, auth.authHeaders],
    queryFn: () =>
      listB2BSupportCases(auth.authHeaders, {
        search: submittedSearch,
        status,
        page,
        limit: 25,
      }),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({ caseId, nextStatus }: { caseId: string; nextStatus: string }) =>
      b2bAction(
        auth.authHeaders,
        `/api/support/b2b-cases/${caseId}`,
        {
          status: nextStatus,
          ...(resolutionById[caseId]?.trim()
            ? { resolution: resolutionById[caseId].trim() }
            : {}),
        },
        "PATCH",
      ),
    onSuccess: () => {
      setNotice("B2B case updated.");
      void query.refetch();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  }

  return (
    <div className="grid gap-5">
      {query.error ? (
        <AdminStatusNotice tone="danger" title="Could not load B2B cases" message={userFacingApiErrorMessage(query.error)} className="mb-0" />
      ) : null}
      {notice ? <AdminStatusNotice tone="info" title="Case action" message={notice} className="mb-0" /> : null}
      <AdminPanel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <MessageSquareWarning className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="B2B after-sales cases" description="Resolve order-linked warranty, shortage, damage, return, replacement, and billing disputes." />
          </div>
          <form onSubmit={submit} className="flex w-full gap-2 xl:max-w-md">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Case, order, or subject" className="h-10 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
            <Button type="submit" size="sm"><Search className="h-4 w-4" aria-hidden="true" /> Search</Button>
          </form>
        </div>
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="mt-4 h-10 w-full max-w-xs rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold">
          {statuses.map((value) => <option key={value || "all"} value={value}>{value ? humanize(value) : "All case statuses"}</option>)}
        </select>
        <div className="mt-5 grid gap-4">
          {query.data?.items.map((item) => (
            <article key={item.id} className="border-b border-[#E5E7EB] pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.caseNumber}</p><StatusBadge tone={["RESOLVED", "CLOSED"].includes(item.status) ? "success" : "warning"}>{humanize(item.status)}</StatusBadge></div>
                  <p className="mt-1 font-bold text-[#1F2933]">{item.subject}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{item.order.orderNumber} / {item.order.businessBuyer.companyName} / {item.order.seller?.storeName ?? "Seller"}</p>
                  <p className="mt-2 text-sm text-[#667085]">{item.description}</p>
                </div>
                <Button asChild size="sm" variant="outline"><Link href={`/admin/b2b-orders/${encodeURIComponent(item.order.orderNumber)}`}>Open order</Link></Button>
              </div>
              {!["RESOLVED", "CLOSED"].includes(item.status) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={resolutionById[item.id] ?? ""} onChange={(event) => setResolutionById((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution or next action" className="h-10 min-w-64 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                  <Button type="button" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ caseId: item.id, nextStatus: "IN_REVIEW" })}>Take case</Button>
                  <Button type="button" disabled={action.isPending || (resolutionById[item.id]?.trim().length ?? 0) < 3} onClick={() => action.mutate({ caseId: item.id, nextStatus: "RESOLVED" })}>Resolve</Button>
                </div>
              ) : item.resolution ? <p className="mt-3 text-sm font-bold text-[#027A48]">Resolution: {item.resolution}</p> : null}
            </article>
          ))}
          {!query.isLoading && !query.data?.items.length ? <p className="text-sm font-semibold text-[#667085]">No B2B cases match the current filters.</p> : null}
        </div>
        {(query.data?.total ?? 0) > 0 ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
            <p className="text-sm font-semibold text-[#667085]">Page {page} of {query.data?.totalPages ?? 1}</p>
            <div className="flex gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button type="button" variant="outline" disabled={page >= (query.data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
          </div>
        ) : null}
      </AdminPanel>
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
