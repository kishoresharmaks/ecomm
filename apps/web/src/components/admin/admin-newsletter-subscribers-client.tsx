"use client";

import { useMemo, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, MailCheck, RefreshCw, Trash2 } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { AdminPanel, AdminActionMenu, AdminConfirmationDialog } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";

export type NewsletterSubscriberRecord = {
  email: string;
  name: string | null;
  status: "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED";
  source: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
};

const ITEMS_PER_PAGE = 20;

export function AdminNewsletterSubscribersClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const subscribersQuery = useQuery({
    queryKey: ["admin-newsletter-subscribers", page, ITEMS_PER_PAGE, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      return indihubFetch<{
        items: NewsletterSubscriberRecord[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/admin/newsletter/subscribers?${params.toString()}`, undefined, auth.authHeaders);
    },
    enabled: auth.isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      indihubFetch(`/api/admin/newsletter/subscribers/${encodeURIComponent(email)}`, { method: "DELETE" }, auth.authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter-subscribers"] });
      setConfirmDeleteEmail(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) =>
      indihubFetch(
        `/api/admin/newsletter/subscribers/${encodeURIComponent(email)}/resend-welcome`,
        { method: "POST" },
        auth.authHeaders,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter-subscribers"] });
    },
  });

  const items = subscribersQuery.data?.items ?? [];
  const total = subscribersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const statusTone = (status: string): "success" | "neutral" | "danger" | "warning" => {
    if (status === "ACTIVE") return "success";
    if (status === "UNSUBSCRIBED") return "neutral";
    return "danger";
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F2933]">Newsletter subscribers</h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {total.toLocaleString("en-IN")} subscriber{total === 1 ? "" : "s"} total
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void subscribersQuery.refetch()}
          disabled={subscribersQuery.isFetching}
        >
          <RefreshCw className={classNames("h-4 w-4", subscribersQuery.isFetching && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex-1 min-w-[220px]">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by email or name..."
            className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
          <option value="BOUNCED">Bounced</option>
        </select>
      </div>

      <AdminPanel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Email</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Name</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Status</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Source</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Subscribed</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#667085] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {items.map((subscriber) => (
                <tr key={subscriber.email} className="hover:bg-[#FCFDFE]">
                  <td className="px-4 py-3 font-semibold text-[#1F2933]">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-[#667085]" aria-hidden="true" />
                      {subscriber.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#667085]">{subscriber.name || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(subscriber.status)}>{subscriber.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#667085]">{subscriber.source}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#667085]">
                    {new Date(subscriber.subscribedAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AdminActionMenu
                      items={[
                        {
                          label: "Resend welcome email",
                          icon: <MailCheck className="h-4 w-4" aria-hidden="true" />,
                          onSelect: () => void resendMutation.mutate(subscriber.email),
                          disabled: subscriber.status !== "ACTIVE",
                        },
                        {
                          label: "Unsubscribe",
                          icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                          onSelect: () => setConfirmDeleteEmail(subscriber.email),
                          disabled: subscriber.status === "UNSUBSCRIBED",
                          destructive: true,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {!subscribersQuery.isLoading && !items.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-[#667085]">
                    No subscribers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3">
            <p className="text-xs font-semibold text-[#667085]">
              Page {page} of {totalPages} &middot; {total.toLocaleString("en-IN")} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || subscribersQuery.isFetching}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || subscribersQuery.isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </AdminPanel>

      <AdminConfirmationDialog
        open={Boolean(confirmDeleteEmail)}
        onClose={() => setConfirmDeleteEmail(null)}
        onConfirm={() => {
          if (confirmDeleteEmail) void deleteMutation.mutate(confirmDeleteEmail);
        }}
        title="Unsubscribe subscriber"
        description={
          confirmDeleteEmail
            ? `Are you sure you want to unsubscribe ${confirmDeleteEmail}? You can re-subscribe them later.`
            : ""
        }
        confirmLabel="Unsubscribe"
        tone="danger"
      />
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function classNames(...values: (string | boolean | undefined | false)[]) {
  return values.filter(Boolean).join(" ");
}
