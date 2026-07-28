"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@indihub/ui";
import type { IndihubAuthHeaders } from "@/lib/api";
import {
  createReportExport,
  downloadReportExport,
  type ReportExportAudience,
  type ReportExportType,
  type ReportFilters,
} from "@/lib/report-exports-api";

export function ReportExportButton({
  auth,
  audience,
  exportType,
  filters,
  onCreated,
}: {
  auth: IndihubAuthHeaders;
  audience: ReportExportAudience;
  exportType: ReportExportType;
  filters?: ReportFilters;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const job = await createReportExport(auth, audience, exportType, filters);
      onCreated?.();
      if (job.status === "COMPLETED") {
        await downloadReportExport(auth, audience, job);
        setMessage("Download started.");
      } else {
        setMessage("Export queued. You can monitor it in export history.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the export.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Button type="button" variant="outline" onClick={() => void create()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Preparing" : "Export CSV"}
      </Button>
      {error ? <p className="max-w-56 text-xs font-semibold text-[#B42318]">{error}</p> : null}
      {message ? (
        <p className="max-w-64 text-xs font-semibold text-[#0F8A5F]">
          {message} <Link href={historyHref[audience]} className="underline">Open history</Link>
        </p>
      ) : null}
    </div>
  );
}

const historyHref: Record<ReportExportAudience, string> = {
  admin: "/admin/reports/exports",
  finance: "/finance/exports",
  seller: "/seller/reports/exports",
};
