"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "./admin-auth-context";
import { AdminPanel, AdminStatusNotice } from "./admin-ux";
import { userFacingApiErrorMessage } from "@/lib/api";
import { listAdminB2BExceptions } from "@/lib/b2b-operations-api";

export function AdminB2BExceptionsClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-b2b-exceptions", submittedSearch, page, auth.authHeaders],
    queryFn: () =>
      listAdminB2BExceptions(auth.authHeaders, {
        search: submittedSearch,
        page,
        limit: 25,
      }),
    enabled: auth.isAuthenticated,
    retry: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  }

  return (
    <div className="grid gap-5">
      {query.error ? (
        <AdminStatusNotice
          tone="danger"
          title="Could not load B2B exceptions"
          message={userFacingApiErrorMessage(query.error)}
          className="mb-0"
        />
      ) : null}
      <AdminPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="B2B exception queue"
              description="Orders needing migration review, PO correction, payment attention, delivery resolution, or GST provider follow-up."
            />
          </div>
          <form onSubmit={submit} className="flex w-full gap-2 lg:max-w-md">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order, buyer, or seller"
              className="h-10 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
            />
            <Button type="submit" size="sm">
              <Search className="h-4 w-4" aria-hidden="true" /> Search
            </Button>
          </form>
        </div>
        <div className="mt-5 grid gap-3">
          {query.isLoading ? <div className="h-56 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
          {query.data?.items.map((item) => {
            const providerErrors = item.taxDocuments.flatMap((document) =>
              [
                document.compliance?.eInvoiceError,
                document.compliance?.eWayBillError,
              ].filter((value): value is string => Boolean(value)),
            );
            return (
              <article
                key={item.id}
                className="grid gap-3 border-b border-[#E5E7EB] pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#1F2933]">{item.orderNumber}</p>
                    <StatusBadge tone={item.status === "DELIVERY_DISPUTED" ? "danger" : "warning"}>
                      {humanize(item.status)}
                    </StatusBadge>
                    {item.legacyMigrationReviewRequired ? (
                      <StatusBadge tone="danger">Migration review</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {item.businessBuyer.companyName} / {item.seller?.storeName ?? "Seller"}
                  </p>
                  {item.poReview?.note ? (
                    <p className="mt-2 text-xs font-bold text-[#B54708]">{item.poReview.note}</p>
                  ) : null}
                  {providerErrors[0] ? (
                    <p className="mt-2 text-xs font-bold text-[#B42318]">{providerErrors[0]}</p>
                  ) : null}
                </div>
                <Button asChild size="sm">
                  <Link href={`/admin/b2b-orders/${encodeURIComponent(item.orderNumber)}`}>
                    Review order
                  </Link>
                </Button>
              </article>
            );
          })}
          {!query.isLoading && !query.data?.items.length ? (
            <p className="text-sm font-semibold text-[#667085]">No B2B exceptions match the current search.</p>
          ) : null}
        </div>
        {(query.data?.total ?? 0) > 0 ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
            <p className="text-sm font-semibold text-[#667085]">
              Page {page} of {query.data?.totalPages ?? 1} / {query.data?.total ?? 0} exceptions
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button type="button" variant="outline" disabled={page >= (query.data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </AdminPanel>
    </div>
  );
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
