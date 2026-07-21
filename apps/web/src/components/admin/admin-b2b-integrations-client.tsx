"use client";

import { FormEvent, useState } from "react";
import { CircleHelp, Download, PlugZap, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "./admin-auth-context";
import { AdminPanel, AdminStatusNotice } from "./admin-ux";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  b2bAction,
  createB2BErpOrderExport,
  downloadB2BErpExportJob,
  idempotencyKey,
  listB2BErpConnections,
  listB2BErpExportJobs,
  listB2BOutbox,
} from "@/lib/b2b-operations-api";

const eventOptions = [
  "sales-order.confirmed",
  "invoice.issued",
  "shipment.dispatched",
  "shipment.delivered",
  "payment.verified",
  "receipt.issued",
  "credit-note.issued",
  "order.cancelled",
];

export function AdminB2BIntegrationsClient() {
  const auth = useAdminAuth();
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [events, setEvents] = useState<string[]>(eventOptions.slice(0, 5));
  const [outboxPage, setOutboxPage] = useState(1);
  const [exportPage, setExportPage] = useState(1);
  const [outboxStatus, setOutboxStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const connections = useQuery({
    queryKey: ["admin-b2b-erp-connections", auth.authHeaders],
    queryFn: () => listB2BErpConnections(auth.authHeaders),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const outbox = useQuery({
    queryKey: ["admin-b2b-erp-outbox", outboxPage, outboxStatus, auth.authHeaders],
    queryFn: () => listB2BOutbox(auth.authHeaders, { page: outboxPage, limit: 25, status: outboxStatus }),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const exports = useQuery({
    queryKey: ["admin-b2b-erp-exports", exportPage, auth.authHeaders],
    queryFn: () =>
      listB2BErpExportJobs(auth.authHeaders, {
        page: exportPage,
        limit: 10,
      }),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({
      path,
      payload,
      method = "POST",
    }: {
      path: string;
      payload: Record<string, unknown>;
      method?: "POST" | "PATCH";
    }) => b2bAction(auth.authHeaders, path, payload, method, idempotencyKey("admin-erp")),
    onSuccess: () => {
      setNotice({ tone: "success", message: "ERP integration settings saved." });
      void connections.refetch();
      void outbox.refetch();
      void exports.refetch();
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bearerToken = String(form.get("bearerToken") ?? "").trim();
    const headerName = String(form.get("headerName") ?? "").trim();
    const headerValue = String(form.get("headerValue") ?? "").trim();
    action.mutate({
      path: "/api/admin/b2b-integrations/connections",
      payload: {
        name: String(form.get("name") ?? "").trim(),
        baseUrl: String(form.get("baseUrl") ?? "").trim(),
        authConfig: {
          ...(bearerToken ? { bearerToken } : {}),
          ...(headerName && headerValue ? { headers: { [headerName]: headerValue } } : {}),
        },
        signingSecret: String(form.get("signingSecret") ?? ""),
        subscribedEvents: events,
      },
    });
  }

  async function downloadExport(format: "csv" | "json") {
    try {
      setDownloading(true);
      const job = await createB2BErpOrderExport(auth.authHeaders, format);
      await downloadB2BErpExportJob(auth.authHeaders, job);
      await exports.refetch();
      setNotice({
        tone: "success",
        message: `${format.toUpperCase()} export generated, hashed, and added to export history.`,
      });
    } catch (error) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {notice ? <AdminStatusNotice tone={notice.tone} title={notice.tone === "success" ? "Integration saved" : "Integration action failed"} message={notice.message} className="mb-0" /> : null}
      <AdminPanel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="ERP order exports" description="Download the current multi-line order snapshot for reconciliation or controlled ERP import." />
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={downloading} onClick={() => void downloadExport("csv")}><Download className="h-4 w-4" aria-hidden="true" /> CSV</Button>
            <Button type="button" variant="outline" disabled={downloading} onClick={() => void downloadExport("json")}><Download className="h-4 w-4" aria-hidden="true" /> JSON</Button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#D8E2EA] text-xs font-black uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-3 py-3">Export</th>
                <th className="px-3 py-3">Format</th>
                <th className="px-3 py-3">Rows</th>
                <th className="px-3 py-3">Integrity</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {exports.data?.items.map((job) => (
                <tr key={job.id} className="border-b border-[#EEF2F6]">
                  <td className="px-3 py-3">
                    <p className="font-black">{job.exportNumber}</p>
                    <p className="text-xs font-semibold text-[#667085]">
                      {job.fileName ?? humanize(job.status)}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={job.status === "COMPLETED" ? "success" : job.status === "FAILED" ? "danger" : "warning"}>
                      {job.format}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3 font-bold">{job.rowCount}</td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-[#667085]">
                    {job.contentHash ? `${job.contentHash.slice(0, 12)}...` : job.error ?? "Processing"}
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold">
                    {dateTime(job.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    {job.status === "COMPLETED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={downloading}
                        onClick={() =>
                          void downloadB2BErpExportJob(auth.authHeaders, job).catch(
                            (error) =>
                              setNotice({
                                tone: "danger",
                                message: userFacingApiErrorMessage(error),
                              }),
                          )
                        }
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(exports.data?.total ?? 0) > 0 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#667085]">
              Page {exportPage} of {exports.data?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={exportPage <= 1}
                onClick={() => setExportPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exportPage >= (exports.data?.totalPages ?? 1)}
                onClick={() => setExportPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </AdminPanel>
      <AdminPanel>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]"><PlugZap className="h-5 w-5" aria-hidden="true" /></span>
          <SectionHeading title="Generic ERP webhook" description="1HandIndia remains the system of record and sends signed lifecycle events to the configured HTTPS endpoint." />
        </div>
        <form onSubmit={createConnection} className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label="Connection name" name="name" placeholder="Finance ERP webhook" required />
          <Field label="Webhook endpoint URL" name="baseUrl" type="url" placeholder="https://erp.example.com/hooks/1handindia" required />
          <Field label="Bearer token" name="bearerToken" type="password" placeholder="Optional" />
          <Field label="Signing secret" name="signingSecret" type="password" placeholder="At least 16 characters" required minLength={16} />
          <Field label="Custom header name" name="headerName" placeholder="X-ERP-Client" />
          <Field label="Custom header value" name="headerValue" type="password" placeholder="Optional credential" />
          <fieldset className="lg:col-span-2">
            <legend className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#667085]">
              Subscribed events
              <span title="Only selected lifecycle events are queued for this connection."><CircleHelp className="h-4 w-4" aria-hidden="true" /></span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {eventOptions.map((value) => (
                <label key={value} className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-bold">
                  <input type="checkbox" checked={events.includes(value)} onChange={(event) => setEvents((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />
                  {humanize(value)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="lg:col-span-2"><Button type="submit" disabled={action.isPending || events.length === 0}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Save encrypted connection</Button></div>
        </form>
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-wrap items-center justify-between gap-3"><SectionHeading title="Connections" description="Credentials remain encrypted and are never returned to the browser." /><Button type="button" variant="outline" size="sm" onClick={() => void connections.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button></div>
        <div className="mt-4 grid gap-3">
          {connections.data?.map((connection) => (
            <div key={connection.id} className="grid gap-3 border-b border-[#E5E7EB] pb-4 md:grid-cols-[1fr_auto] md:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{connection.name}</p><StatusBadge tone={connection.status === "ACTIVE" ? "success" : connection.status === "ERROR" ? "danger" : "warning"}>{humanize(connection.status)}</StatusBadge></div><p className="mt-1 break-all text-sm font-semibold text-[#667085]">{connection.baseUrl}</p><p className="mt-1 text-xs font-bold text-[#667085]">{connection.subscribedEvents.length} events / Last success {connection.lastVerifiedAt ? dateTime(connection.lastVerifiedAt) : "Not yet"}</p>{connection.lastError ? <p className="mt-1 text-xs font-bold text-[#B42318]">{connection.lastError}</p> : null}</div>
              <Button type="button" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ method: "PATCH", path: `/api/admin/b2b-integrations/connections/${connection.id}`, payload: { status: connection.status === "ACTIVE" ? "PAUSED" : "ACTIVE" } })}>{connection.status === "ACTIVE" ? "Pause" : "Activate"}</Button>
            </div>
          ))}
          {!connections.isLoading && !connections.data?.length ? <p className="text-sm font-semibold text-[#667085]">No ERP connections configured.</p> : null}
        </div>
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading title="Webhook delivery history" description="Review acknowledgements, retries, failures, and dead-letter events." />
          <select value={outboxStatus} onChange={(event) => { setOutboxPage(1); setOutboxStatus(event.target.value); }} className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="DEAD_LETTER">Dead letter</option><option value="DELIVERED">Delivered</option></select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#D8E2EA] text-xs font-black uppercase tracking-wide text-[#667085]"><tr><th className="px-3 py-3">Event</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Attempts</th><th className="px-3 py-3">Response</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">Action</th></tr></thead>
            <tbody>{outbox.data?.items.map((event) => <tr key={event.id} className="border-b border-[#EEF2F6]"><td className="px-3 py-3"><p className="font-black">{humanize(event.eventType)}</p><p className="text-xs font-semibold text-[#667085]">{event.eventId}</p></td><td className="px-3 py-3"><StatusBadge tone={event.status === "DELIVERED" ? "success" : event.status === "DEAD_LETTER" ? "danger" : "warning"}>{humanize(event.status)}</StatusBadge></td><td className="px-3 py-3 font-bold">{event.attemptCount}</td><td className="px-3 py-3 text-xs font-semibold text-[#667085]">{event.responseCode ?? event.lastError ?? "Pending"}</td><td className="px-3 py-3 text-xs font-semibold">{dateTime(event.createdAt)}</td><td className="px-3 py-3">{["FAILED", "DEAD_LETTER"].includes(event.status) ? <Button type="button" variant="outline" size="sm" onClick={() => action.mutate({ path: `/api/admin/b2b-integrations/outbox/${event.id}/replay`, payload: {} })}><RotateCcw className="h-4 w-4" aria-hidden="true" /> Replay</Button> : null}</td></tr>)}</tbody>
          </table>
        </div>
        {(outbox.data?.total ?? 0) > 0 ? <div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#667085]">Page {outboxPage} of {outbox.data?.totalPages ?? 1}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={outboxPage <= 1} onClick={() => setOutboxPage((value) => value - 1)}>Previous</Button><Button type="button" variant="outline" disabled={outboxPage >= (outbox.data?.totalPages ?? 1)} onClick={() => setOutboxPage((value) => value + 1)}>Next</Button></div></div> : null}
      </AdminPanel>
    </div>
  );
}

function Field({ label, name, type = "text", placeholder, required, minLength }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; minLength?: number }) {
  return <label className="space-y-2"><span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span><input name={name} type={type} placeholder={placeholder} required={required} minLength={minLength} autoComplete="off" className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white" /></label>;
}

function humanize(value: string) {
  return value.replace(/[._]/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
