"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, RotateCcw } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import {
  downloadReportExport,
  listReportExports,
  retryReportExport,
  type ReportExportAudience,
  type ReportExportJob,
  type ReportExportStatus,
  type ReportExportType,
} from "@/lib/report-exports-api";

export function ReportExportCenter({
  auth,
  audience,
  reportTypes,
}: {
  auth: IndihubAuthHeaders;
  audience: ReportExportAudience;
  reportTypes: Array<{ value: ReportExportType; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportExportStatus | "">("");
  const [exportType, setExportType] = useState<ReportExportType | "">("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["report-exports", audience, status, exportType, page],
    queryFn: () => listReportExports(auth, audience, { status, exportType, page, limit: 20 }),
    refetchInterval: (current) =>
      current.state.data?.items.some((job) => job.status === "PENDING" || job.status === "PROCESSING")
        ? 5000
        : false,
  });
  const retry = useMutation({
    mutationFn: (jobId: string) => retryReportExport(auth, audience, jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-exports", audience] }),
  });
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => setPage(1), [exportType, status]);

  async function download(job: ReportExportJob) {
    setDownloadError("");
    try {
      await downloadReportExport(auth, audience, job);
    } catch (cause) {
      setDownloadError(userFacingApiErrorMessage(cause));
    }
  }

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 border-y border-[#E5E7EB] bg-white px-4 py-4 md:flex-row md:items-end">
        <label className="grid gap-1 text-xs font-bold text-[#475467]">
          Report
          <select value={exportType} onChange={(event) => setExportType(event.target.value as ReportExportType | "")} className="h-11 min-w-64 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold">
            <option value="">All reports</option>
            {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#475467]">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as ReportExportStatus | "")} className="h-11 min-w-48 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold">
            <option value="">All statuses</option>
            {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </section>

      {query.isError || retry.isError || downloadError ? (
        <p className="rounded-md border border-[#F5B7B7] bg-white p-3 text-sm font-bold text-[#B42318]">
          {downloadError || userFacingApiErrorMessage(retry.error || query.error)}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-[#163B5C] text-xs text-white">
              <tr>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right">File size</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {query.data?.items.map((job) => (
                <tr key={job.id} className="hover:bg-[#FFFCFB]">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#1F2933]">{reportTypes.find((type) => type.value === job.exportType)?.label ?? humanize(job.exportType)}</p>
                    <p className="mt-0.5 max-w-72 truncate text-xs font-semibold text-[#667085]">{job.fileName}</p>
                    {job.errorMessage ? <p className="mt-1 max-w-96 text-xs font-semibold text-[#B42318]">{job.errorMessage}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#475467]">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge tone={exportTone(job.status)}>{humanize(job.status)}</StatusBadge></td>
                  <td className="px-4 py-3 text-right font-bold">{job.rowCount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#475467]">{formatBytes(job.byteSize)}</td>
                  <td className="px-4 py-3 font-semibold text-[#475467]">{job.expiresAt ? formatDate(job.expiresAt) : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {job.status === "COMPLETED" ? (
                      <Button size="sm" onClick={() => void download(job)}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download
                      </Button>
                    ) : job.status === "FAILED" || job.status === "EXPIRED" ? (
                      <Button size="sm" variant="outline" onClick={() => retry.mutate(job.id)} disabled={retry.isPending}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-[#667085]">Processing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.isLoading ? <div className="p-10 text-center text-sm font-semibold text-[#667085]">Loading export history...</div> : null}
        {!query.isLoading && !query.data?.items.length ? <div className="p-10 text-center text-sm font-semibold text-[#667085]">No report exports found.</div> : null}
        {query.data ? (
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
            <span className="text-xs font-semibold text-[#667085]">Page {query.data.pageInfo.page} of {query.data.pageInfo.totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= query.data.pageInfo.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function exportTone(status: ReportExportStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "EXPIRED") return "danger";
  if (status === "PROCESSING") return "info";
  return "warning";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

