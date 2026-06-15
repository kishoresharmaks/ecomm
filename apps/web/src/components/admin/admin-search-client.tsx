"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";
import type { SearchSort } from "@/lib/storefront-api";

type SearchJobOverview = {
  counts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  lastCompleted?: {
    completedAt?: string | null;
    entityType: string;
    entityId: string;
  } | null;
};

type ReindexResponse = {
  queued: {
    products: number;
    stores: number;
    categories: number;
    total: number;
  };
};

type ProcessJobsResponse = {
  claimed: number;
  completed: number;
  failed: number;
};

type ExplainRow = {
  "QUERY PLAN": string;
};

const sorts: Array<{ value: SearchSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
  { value: "rating", label: "Rating" },
  { value: "discount", label: "Discount" },
];

export function AdminSearchClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [explainQuery, setExplainQuery] = useState("watch");
  const [submittedExplainQuery, setSubmittedExplainQuery] = useState("watch");
  const [explainSort, setExplainSort] = useState<SearchSort>("relevance");

  const overviewQuery = useQuery({
    queryKey: ["admin-search-overview", auth.token],
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<SearchJobOverview>("/api/admin/search", undefined, auth.authHeaders),
  });

  const reindexMutation = useMutation({
    mutationFn: () =>
      indihubFetch<ReindexResponse>(
        "/api/admin/search/reindex",
        { method: "POST" },
        auth.authHeaders,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-search-overview"] }),
  });

  const processMutation = useMutation({
    mutationFn: () =>
      indihubFetch<ProcessJobsResponse>(
        "/api/admin/search/jobs/process",
        { method: "POST" },
        auth.authHeaders,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-search-overview"] }),
  });

  const explain = useQuery({
    queryKey: ["admin-search-explain", auth.token, submittedExplainQuery, explainSort],
    enabled: auth.isAuthenticated && submittedExplainQuery.trim().length >= 2,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("q", submittedExplainQuery.trim());
      params.set("sort", explainSort);
      params.set("limit", "24");
      return indihubFetch<ExplainRow[]>(`/api/admin/search/explain?${params.toString()}`, undefined, auth.authHeaders);
    },
  });

  function submitExplain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedExplainQuery(explainQuery.trim());
  }

  const counts = overviewQuery.data?.counts;
  const mutationError = reindexMutation.error ?? processMutation.error;
  const lastAction = reindexMutation.data
    ? `Queued ${reindexMutation.data.queued.total} documents: ${reindexMutation.data.queued.products} products, ${reindexMutation.data.queued.stores} stores, ${reindexMutation.data.queued.categories} categories.`
    : processMutation.data
      ? `Processed ${processMutation.data.claimed} jobs: ${processMutation.data.completed} completed, ${processMutation.data.failed} failed.`
      : "";

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending" value={counts?.pending ?? 0} tone="warning" />
        <MetricCard label="Processing" value={counts?.processing ?? 0} tone="info" />
        <MetricCard label="Completed" value={counts?.completed ?? 0} tone="success" />
        <MetricCard label="Failed" value={counts?.failed ?? 0} tone="danger" />
      </section>

      <section className="rounded-xl border border-[#D8E2EA] bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#FFF0EC] text-[#ED3500]">
              <DatabaseZap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <SectionHeading
                title="PostgreSQL search index"
                description="Search documents are updated by DB-backed jobs. Redis is not used for this search flow."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone="success">GIN full-text</StatusBadge>
                <StatusBadge tone="info">pg_trgm</StatusBadge>
                <StatusBadge tone="info">FOR UPDATE SKIP LOCKED</StatusBadge>
                <StatusBadge tone="warning">Cursor pagination</StatusBadge>
              </div>
              {overviewQuery.data?.lastCompleted ? (
                <p className="mt-3 text-sm font-semibold text-[#667085]">
                  Last completed: {overviewQuery.data.lastCompleted.entityType} {formatDate(overviewQuery.data.lastCompleted.completedAt)}
                </p>
              ) : (
                <p className="mt-3 text-sm font-semibold text-[#667085]">
                  No completed search indexing job has been recorded yet.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button type="button" variant="outline" onClick={() => void overviewQuery.refetch()} disabled={overviewQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4", overviewQuery.isFetching && "animate-spin")} aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {processMutation.isPending ? "Processing" : "Process batch"}
            </Button>
            <Button type="button" onClick={() => reindexMutation.mutate()} disabled={reindexMutation.isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {reindexMutation.isPending ? "Queueing" : "Full reindex"}
            </Button>
          </div>
        </div>

        {lastAction ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#BFEAD9] bg-[#E9F7F1] px-3 py-2 text-sm font-bold text-[#0F8A5F]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {lastAction}
          </div>
        ) : null}

        {mutationError ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#B42318]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {errorMessage(mutationError)}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#D8E2EA] bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div>
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#EAF1F7] text-[#163B5C]">
                <Search className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                title="Explain search query"
                description="Run EXPLAIN to verify the search SQL stays index-backed before high traffic."
              />
            </div>

            <form onSubmit={submitExplain} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[#667085]">
                Query
                <input
                  value={explainQuery}
                  onChange={(event) => setExplainQuery(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  className="h-11 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#1F2933] outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
                  placeholder="watch"
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-[#667085]">
                Sort
                <select
                  value={explainSort}
                  onChange={(event) => setExplainSort(event.target.value as SearchSort)}
                  className="h-11 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1F2933] outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
                >
                  {sorts.map((sort) => (
                    <option key={sort.value} value={sort.value}>
                      {sort.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" className="h-11 self-end" disabled={explainQuery.trim().length < 2 || explain.isFetching}>
                <Activity className="h-4 w-4" aria-hidden="true" />
                {explain.isFetching ? "Checking" : "Run explain"}
              </Button>
            </form>
          </div>

          <div className="rounded-lg border border-[#E5E7EB] bg-[#0B1824] p-4 text-xs font-semibold leading-6 text-[#DCE8F2]">
            {explain.isLoading ? (
              <p>Loading query plan...</p>
            ) : explain.isError ? (
              <p className="text-[#FFB4A2]">{errorMessage(explain.error)}</p>
            ) : explain.data?.length ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap">
                {explain.data.map((row) => row["QUERY PLAN"]).join("\n")}
              </pre>
            ) : (
              <p>Submit a query to inspect the PostgreSQL plan.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    info: "border-[#B8D9F2] bg-[#F0F7FC] text-[#163B5C]",
    success: "border-[#BFEAD9] bg-[#E9F7F1] text-[#0F8A5F]",
    warning: "border-[#F6D58D] bg-[#FFF8E6] text-[#8A5A00]",
    danger: "border-[#F5B7B7] bg-[#FDECEC] text-[#B42318]",
  }[tone];

  return (
    <article className={cn("rounded-xl border p-4 shadow-sm", toneClass)}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-normal">{value}</p>
    </article>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Search operation failed.";
}
