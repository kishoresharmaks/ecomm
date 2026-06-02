"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { IndihubApiError, indihubFetch } from "@/lib/api";
import type { AdminLocationCoverage, AdminLocationImportRun } from "@/lib/location-api";

export function AdminLocationsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const queryKey = ["admin-locations", auth.authHeaders];
  const confirmation = useConfirmationDialog();

  const coverageQuery = useQuery({
    queryKey,
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<AdminLocationCoverage[]>("/api/admin/locations/coverage", undefined, auth.authHeaders)
  });
  const importRunsQuery = useQuery({
    queryKey: ["admin-location-import-runs", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<AdminLocationImportRun[]>("/api/admin/locations/import-runs", undefined, auth.authHeaders)
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      indihubFetch(
        "/api/admin/locations/import-runs",
        {
          method: "POST",
          body: JSON.stringify({ sourceCode: "BUNDLED_LOCATION_BASELINE", mode: "REFRESH" })
        },
        auth.authHeaders
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["admin-location-import-runs", auth.authHeaders] });
    }
  });

  const toggleCountryMutation = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      indihubFetch(
        `/api/admin/locations/countries/${code}`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled })
        },
        auth.authHeaders
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["locations", "countries"] });
    }
  });

  return (
    <>
      {confirmation.confirmationDialog}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D8E2EA] bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <Database className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-[#1F2933]">Market address coverage</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">
                  Country metadata is bootstrapped by seed. State, city, local area, and postal-code rows are loaded through controlled import runs.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/locations/import">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Import India data
                </Link>
              </Button>
              <Button type="button" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh baseline
              </Button>
            </div>
          </div>

          {coverageQuery.error ? (
            <PanelStatus
              tone="danger"
              title="Locations blocked"
              message={coverageQuery.error instanceof Error ? coverageQuery.error.message : "Unable to load location coverage."}
              status={coverageQuery.error instanceof IndihubApiError ? coverageQuery.error.status : undefined}
            />
          ) : null}

          {refreshMutation.error ? (
            <PanelStatus
              tone="danger"
              title="Import failed"
              message={refreshMutation.error instanceof Error ? refreshMutation.error.message : "Unable to refresh location data."}
              status={refreshMutation.error instanceof IndihubApiError ? refreshMutation.error.status : undefined}
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="overflow-x-auto rounded-lg border border-[#D8E2EA] bg-white">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#667085]">
                  <span>Country</span>
                  <span>States</span>
                  <span>Cities</span>
                  <span>Areas</span>
                  <span>Latest source</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {(coverageQuery.data ?? []).map((item) => (
                    <div
                      key={item.country.code}
                      className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] gap-3 px-4 py-4 text-sm"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-[#1F2933]">{item.country.name}</p>
                          <StatusBadge tone={item.country.enabled ? "success" : "warning"}>
                            {item.country.enabled ? "Enabled" : "Disabled"}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#667085]">
                          {item.country.code} / {item.country.currency}
                        </p>
                      </div>
                      <CountCell value={item.counts.subdivisions} />
                      <CountCell value={item.counts.cities} />
                      <CountCell value={item.counts.areas} />
                      <div className="text-sm font-semibold text-[#1F2933]">
                        <p>{item.latestRun?.source?.name ?? "No import run yet"}</p>
                        <p className="mt-1 text-xs text-[#667085]">{formatDate(item.latestRun?.finishedAt ?? item.latestRun?.startedAt)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          confirmation.requestConfirmation({
                            title: item.country.enabled ? "Disable market coverage?" : "Enable market coverage?",
                            description: `${item.country.name} will be ${item.country.enabled ? "hidden from customer and seller location selectors" : "available in location selectors"}.`,
                            confirmLabel: item.country.enabled ? "Disable country" : "Enable country",
                            tone: item.country.enabled ? "danger" : "warning",
                            onConfirm: () => toggleCountryMutation.mutate({ code: item.country.code, enabled: !item.country.enabled })
                          })
                        }
                        disabled={toggleCountryMutation.isPending}
                      >
                        {item.country.enabled ? (
                          <ToggleRight className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" aria-hidden="true" />
                        )}
                        {item.country.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  ))}
                  {coverageQuery.isLoading ? <SkeletonRows /> : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#D8E2EA] bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#ECFDF3] text-[#0F8A5F]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#1F2933]">Recent imports</h2>
                  <p className="text-sm font-semibold text-[#667085]">Source, status, and loaded row counts.</p>
                </div>
              </div>
              <div className="space-y-3">
                {(importRunsQuery.data ?? []).slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-md border border-[#E5E7EB] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#1F2933]">{run.source?.name ?? "Location import"}</p>
                      <StatusBadge tone={run.status === "FAILED" ? "danger" : "success"}>{run.status.replaceAll("_", " ")}</StatusBadge>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#667085]">
                      {run.mode} / {formatDate(run.finishedAt ?? run.startedAt)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[#1F2933]">
                      {run.importedSubdivisions} states, {run.importedCities} cities, {run.importedAreas} areas
                    </p>
                    {run.errorMessage ? <p className="mt-2 text-xs font-semibold text-[#D64545]">{run.errorMessage}</p> : null}
                  </div>
                ))}
                {!importRunsQuery.isLoading && !importRunsQuery.data?.length ? (
                  <div className="rounded-md border border-dashed border-[#D8E2EA] p-4 text-sm font-semibold text-[#667085]">
                    Import history will appear after the first location import.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
    </>
  );
}

function CountCell({ value }: { value: number }) {
  return <span className="text-lg font-black text-[#163B5C]">{value.toLocaleString("en-IN")}</span>;
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] gap-3 px-4 py-4">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <span key={cell} className="h-5 rounded bg-[#EAF1F7]" />
          ))}
        </div>
      ))}
    </>
  );
}

function PanelStatus({
  title,
  message,
  tone,
  status
}: {
  title: string;
  message: string;
  tone: "warning" | "danger";
  status?: number | undefined;
}) {
  return (
    <div className="mb-5 rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone}>{status ? `HTTP ${status}` : title}</StatusBadge>
        <p className="text-sm font-semibold text-[#1F2933]">{message}</p>
      </div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
