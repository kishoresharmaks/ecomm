"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Database, FileText, Search, ShieldCheck } from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  buildIndiaPostalLookupPath,
  indiaLocationImportGuideCards,
  type IndiaPostalLookupMode,
  validateIndiaPostalLookupForm
} from "@/components/admin/admin-location-import-utils";
import { IndihubApiError, indihubFetch } from "@/lib/api";
import type {
  AdminIndiaPincodeImportQuality,
  AdminIndiaPostalLookupPostOffice,
  AdminIndiaPostalLookupResponse,
  AdminIndiaPostalStoredArea,
  AdminLocationCoverage,
  AdminLocationImportRun
} from "@/lib/location-api";

export function AdminLocationImportClient() {
  const auth = useAdminAuth();
  const [lookupMode, setLookupMode] = useState<IndiaPostalLookupMode>("pincode");
  const [lookupValue, setLookupValue] = useState("");
  const validationMessage = validateIndiaPostalLookupForm(lookupMode, lookupValue);

  const coverageQuery = useQuery({
    queryKey: ["admin-location-import-coverage", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<AdminLocationCoverage[]>("/api/admin/locations/coverage", undefined, auth.authHeaders)
  });

  const importRunsQuery = useQuery({
    queryKey: ["admin-location-import-runs", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<AdminLocationImportRun[]>("/api/admin/locations/import-runs", undefined, auth.authHeaders)
  });

  const indiaCoverage = useMemo(
    () => coverageQuery.data?.find((item) => item.country.code === "IN") ?? null,
    [coverageQuery.data]
  );
  const indiaRuns = useMemo(
    () =>
      (importRunsQuery.data ?? []).filter(
        (run) =>
          run.countryCode === "IN" ||
          run.sourceUrl?.includes("data.gov.in") ||
          run.source?.provider.toLowerCase().includes("data.gov.in") ||
          run.source?.provider.toLowerCase().includes("department of posts")
      ),
    [importRunsQuery.data]
  );
  const latestIndiaRun = indiaRuns[0] ?? null;
  const latestQuality = latestIndiaRun?.metadata?.quality ?? null;

  const lookupMutation = useMutation({
    mutationFn: () =>
      indihubFetch<AdminIndiaPostalLookupResponse>(
        buildIndiaPostalLookupPath(lookupMode, lookupValue),
        undefined,
        auth.authHeaders
      )
  });

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationMessage || lookupMutation.isPending) {
      return;
    }

    lookupMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D8E2EA] bg-white p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
            <Database className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-[#1F2933]">India full local data</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">
              Full India data is imported from official Department of Posts bulk data. PostalPin is kept as a single-record verification tool.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/locations">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Coverage
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-[#D8E2EA] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Import sources</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Bulk import writes to the location tables. Lookup does not write.</p>
            </div>
            <StatusBadge tone="info">India only</StatusBadge>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {indiaLocationImportGuideCards.map((card) => (
              <article key={card.title} className="rounded-lg border border-[#E5E7EB] bg-[#FFFCFB] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-[#ED3500]">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <StatusBadge tone={card.source === "api.postalpincode.in" ? "warning" : "success"}>
                    {card.source === "api.postalpincode.in" ? "Verify only" : "Import source"}
                  </StatusBadge>
                </div>
                <h3 className="mt-4 text-base font-black text-[#1F2933]">{card.title}</h3>
                <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#667085]">{card.source}</p>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[#667085]">{card.description}</p>
                <pre className="mt-4 overflow-x-auto rounded-md border border-[#D8E2EA] bg-white p-3 text-xs font-semibold leading-5 text-[#163B5C]">
                  {card.command}
                </pre>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#D8E2EA] bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#ECFDF3] text-[#0F8A5F]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">India status</h2>
              <p className="text-sm font-semibold text-[#667085]">Current database coverage.</p>
            </div>
          </div>
          {coverageQuery.error || importRunsQuery.error ? (
            <PanelStatus
              tone="danger"
              title="Status unavailable"
              message={errorMessage(coverageQuery.error ?? importRunsQuery.error)}
              status={apiStatus(coverageQuery.error ?? importRunsQuery.error)}
            />
          ) : null}
          <div className="grid gap-3">
            <StatusMetric label="States / UTs" value={indiaCoverage?.counts.subdivisions} loading={coverageQuery.isLoading} />
            <StatusMetric label="District city nodes" value={indiaCoverage?.counts.cities} loading={coverageQuery.isLoading} />
            <StatusMetric label="Local areas / pincodes" value={indiaCoverage?.counts.areas} loading={coverageQuery.isLoading} />
          </div>
          <div className="mt-4 rounded-md border border-[#E5E7EB] p-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Latest India run</p>
            <p className="mt-2 text-sm font-black text-[#1F2933]">{latestIndiaRun?.source?.name ?? "No India import run found"}</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">{formatImportRun(latestIndiaRun)}</p>
            {latestIndiaRun?.sourceChecksum ? (
              <p className="mt-2 break-all text-xs font-semibold text-[#163B5C]">Checksum: {latestIndiaRun.sourceChecksum}</p>
            ) : null}
          </div>
          <QualityPanel quality={latestQuality} />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-lg border border-[#D8E2EA] bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Search className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">PostalPin lookup</h2>
              <p className="text-sm font-semibold text-[#667085]">Single pincode or post-office verification.</p>
            </div>
          </div>

          <form onSubmit={submitLookup} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-1">
              <ModeButton active={lookupMode === "pincode"} onClick={() => setLookupMode("pincode")}>
                PIN code
              </ModeButton>
              <ModeButton active={lookupMode === "postOffice"} onClick={() => setLookupMode("postOffice")}>
                Post office
              </ModeButton>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                {lookupMode === "pincode" ? "India pincode" : "Post office name"}
              </span>
              <input
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
                inputMode={lookupMode === "pincode" ? "numeric" : "text"}
                maxLength={lookupMode === "pincode" ? 6 : 80}
                placeholder={lookupMode === "pincode" ? "110001" : "Connaught Place"}
                className="mt-2 h-12 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            {validationMessage ? (
              <p className="rounded-md border border-[#FFC7B8] bg-[#FFF0EC] px-3 py-2 text-sm font-semibold text-[#9B2C10]">
                {validationMessage}
              </p>
            ) : null}
            {lookupMutation.error ? (
              <PanelStatus
                tone="danger"
                title="Lookup failed"
                message={errorMessage(lookupMutation.error)}
                status={apiStatus(lookupMutation.error)}
              />
            ) : null}
            <Button type="submit" className="w-full" disabled={lookupMutation.isPending || Boolean(validationMessage)}>
              <Search className="h-4 w-4" aria-hidden="true" />
              {lookupMutation.isPending ? "Checking..." : "Check PostalPin"}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-[#D8E2EA] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Lookup result</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Returned records are not imported automatically.</p>
            </div>
            {lookupMutation.data ? (
              <StatusBadge tone={comparisonTone(lookupMutation.data)}>
                {lookupMutation.data.comparison?.status.replace("_", " ") ?? lookupMutation.data.status.replace("_", " ")}
              </StatusBadge>
            ) : null}
          </div>

          {lookupMutation.data ? <LookupResult result={lookupMutation.data} /> : <EmptyLookupResult />}
        </section>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-md px-3 text-sm font-black transition",
        active ? "bg-[#ED3500] text-white shadow-sm" : "bg-transparent text-[#163B5C] hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

function LookupResult({ result }: { result: AdminIndiaPostalLookupResponse }) {
  const comparison = result.comparison;

  return (
    <div>
      <div className="mb-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
        <p className="text-sm font-black text-[#1F2933]">
          {result.queryType === "PINCODE" ? "Pincode" : "Post office"}: {result.query}
        </p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">{result.message}</p>
        <p className="mt-2 break-all text-xs font-semibold text-[#163B5C]">{result.sourceUrl}</p>
      </div>
      {comparison ? (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <CompareMetric label="DB areas" value={comparison.storedAreaCount} />
          <CompareMetric label="Matched" value={comparison.matchedPostOfficeCount} />
          <CompareMetric label="Missing in DB" value={comparison.missingPostOfficeCount} />
          <CompareMetric label="DB only" value={comparison.extraStoredAreaCount} />
        </div>
      ) : null}
      {result.postOffices.length ? (
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-3 py-3">Post office</th>
                <th className="px-3 py-3">Pincode</th>
                <th className="px-3 py-3">District</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3">Delivery</th>
                <th className="px-3 py-3">DB match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {result.postOffices.map((office) => (
                <LookupResultRow key={`${office.name}-${office.pincode}-${office.branchType}`} office={office} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[#D8E2EA] p-5 text-sm font-semibold text-[#667085]">
          No matching post-office records were returned for this lookup.
        </div>
      )}
      {comparison?.storedAreas.length ? (
        <div className="mt-4 rounded-lg border border-[#E5E7EB] p-4">
          <p className="text-sm font-black text-[#1F2933]">Stored database areas for this lookup</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {comparison.storedAreas.slice(0, 12).map((area) => (
              <StoredAreaPill key={area.code} area={area} />
            ))}
          </div>
          {comparison.storedAreas.length > 12 ? (
            <p className="mt-3 text-xs font-semibold text-[#667085]">
              Showing 12 of {comparison.storedAreas.length.toLocaleString("en-IN")} stored areas.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LookupResultRow({ office }: { office: AdminIndiaPostalLookupPostOffice }) {
  return (
    <tr>
      <td className="px-3 py-3">
        <p className="font-black text-[#1F2933]">{office.name}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">{office.branchType ?? "Branch type not returned"}</p>
      </td>
      <td className="px-3 py-3 font-semibold text-[#163B5C]">{office.pincode ?? "-"}</td>
      <td className="px-3 py-3 font-semibold text-[#1F2933]">{office.district ?? "-"}</td>
      <td className="px-3 py-3 font-semibold text-[#1F2933]">{office.state ?? "-"}</td>
      <td className="px-3 py-3 font-semibold text-[#1F2933]">{office.deliveryStatus ?? "-"}</td>
      <td className="px-3 py-3">
        {office.databaseMatch ? (
          <StatusBadge tone="success">{office.databaseMatch.name}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Missing</StatusBadge>
        )}
      </td>
    </tr>
  );
}

function QualityPanel({ quality }: { quality: AdminIndiaPincodeImportQuality | null }) {
  if (!quality) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-[#D8E2EA] p-3 text-sm font-semibold text-[#667085]">
        Import quality details will appear after the next India import or dry-run-backed import.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-[#E5E7EB] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Quality summary</p>
        <StatusBadge tone={quality.readyToApply ? "success" : "warning"}>
          {quality.readyToApply ? "Clean source" : "Review warnings"}
        </StatusBadge>
      </div>
      <div className="grid gap-2">
        <StatusMetric label="Accepted rows" value={quality.acceptedRows} loading={false} />
        <StatusMetric label="Skipped rows" value={quality.skippedRows} loading={false} />
        <StatusMetric label="Unique pincodes" value={quality.uniquePincodes} loading={false} />
        <StatusMetric label="Duplicate source rows" value={quality.duplicateSourceRows} loading={false} />
      </div>
    </div>
  );
}

function CompareMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#163B5C]">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function StoredAreaPill({ area }: { area: AdminIndiaPostalStoredArea }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-sm font-black text-[#1F2933]">{area.name}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">
        {[area.cityName, area.stateName, area.postalCode].filter(Boolean).join(" / ")}
      </p>
    </div>
  );
}

function EmptyLookupResult() {
  return (
    <div className="grid min-h-[250px] place-items-center rounded-lg border border-dashed border-[#D8E2EA] bg-[#FFFCFB] p-6 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-white text-[#163B5C]">
          <Search className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-black text-[#1F2933]">Run a lookup to verify a pincode or post office.</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">Use official bulk import for permanent local-area data.</p>
      </div>
    </div>
  );
}

function StatusMetric({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#E5E7EB] p-3">
      <span className="text-sm font-semibold text-[#667085]">{label}</span>
      <span className="text-lg font-black text-[#163B5C]">{loading ? "..." : (value ?? 0).toLocaleString("en-IN")}</span>
    </div>
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
    <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone}>{status ? `HTTP ${status}` : title}</StatusBadge>
        <p className="text-sm font-semibold text-[#1F2933]">{message}</p>
      </div>
    </div>
  );
}

function formatImportRun(run: AdminLocationImportRun | null) {
  if (!run) {
    return "Run the India importer to populate full local-area and pincode coverage.";
  }

  return [
    run.status.replaceAll("_", " "),
    `${run.importedSubdivisions.toLocaleString("en-IN")} states`,
    `${run.importedCities.toLocaleString("en-IN")} city nodes`,
    `${run.importedAreas.toLocaleString("en-IN")} areas`,
    formatDate(run.finishedAt ?? run.startedAt)
  ].join(" / ");
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load location import data.";
}

function apiStatus(error: unknown) {
  return error instanceof IndihubApiError ? error.status : undefined;
}

function comparisonTone(result: AdminIndiaPostalLookupResponse) {
  const status = result.comparison?.status;
  if (status === "MATCHED") {
    return "success";
  }

  if (status === "PARTIAL" || status === "DATABASE_ONLY") {
    return "warning";
  }

  return result.status === "SUCCESS" ? "info" : "warning";
}
