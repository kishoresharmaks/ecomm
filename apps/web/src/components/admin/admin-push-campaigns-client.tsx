"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  Pencil,
  RefreshCw,
  Send,
  StopCircle,
  Upload,
  UsersRound,
} from "lucide-react";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { userFacingApiErrorMessage } from "@/lib/api";
import { resolveImageSource } from "@/lib/image-url";
import {
  cancelPushCampaign,
  createPushCampaign,
  emptyPushCampaignForm,
  formFromPushCampaign,
  getPushCampaign,
  listPushCampaignAuditLog,
  listPushCampaigns,
  previewPushCampaign,
  pushCampaignHrefExamples,
  pushCampaignPayloadFromForm,
  pushCampaignStatuses,
  schedulePushCampaign,
  sendPushCampaignNow,
  updatePushCampaign,
  validatePushCampaignForm,
  validatePushCampaignImageDimensions,
  validatePushCampaignImageFile,
  type PushCampaign,
  type PushCampaignFormState,
  type PushCampaignStatus,
} from "@/lib/push-campaigns-api";
import { uploadPublicImage } from "@/lib/public-image-upload";

type FormMode = "create" | "edit";

export function AdminPushCampaignsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PushCampaignStatus | "ALL">("ALL");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [mode, setMode] = useState<FormMode>("create");
  const [form, setForm] = useState<PushCampaignFormState>(() => emptyPushCampaignForm());
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [notice, setNotice] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const campaignsQuery = useQuery({
    queryKey: ["admin-push-campaigns", auth.token, status],
    queryFn: () => listPushCampaigns(auth.authHeaders, { status, limit: 50 }),
    enabled: auth.isAuthenticated,
  });

  const selectedCampaign = useMemo(
    () =>
      campaignsQuery.data?.items.find((campaign) => campaign.id === selectedCampaignId) ??
      campaignsQuery.data?.items[0] ??
      null,
    [campaignsQuery.data?.items, selectedCampaignId],
  );

  const detailQuery = useQuery({
    queryKey: ["admin-push-campaign", auth.token, selectedCampaign?.id],
    queryFn: () => getPushCampaign(auth.authHeaders, selectedCampaign?.id ?? ""),
    enabled: auth.isAuthenticated && Boolean(selectedCampaign?.id),
  });

  const auditQuery = useQuery({
    queryKey: ["admin-push-campaign-audit", auth.token, selectedCampaign?.id],
    queryFn: () => listPushCampaignAuditLog(auth.authHeaders, selectedCampaign?.id ?? ""),
    enabled: auth.isAuthenticated && Boolean(selectedCampaign?.id),
  });

  const createMutation = useMutation({
    mutationFn: () => createPushCampaign(auth.authHeaders, pushCampaignPayloadFromForm(form)),
    onSuccess: (campaign) => {
      setNotice({ tone: "success", message: "Push campaign draft created." });
      setSelectedCampaignId(campaign.id);
      setMode("create");
      setForm(emptyPushCampaignForm());
      void invalidateCampaignQueries(queryClient);
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ campaignId }: { campaignId: string }) =>
      updatePushCampaign(auth.authHeaders, campaignId, pushCampaignPayloadFromForm(form)),
    onSuccess: (campaign) => {
      setNotice({ tone: "success", message: "Push campaign draft updated." });
      setSelectedCampaignId(campaign.id);
      void invalidateCampaignQueries(queryClient);
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewPushCampaign(auth.authHeaders, pushCampaignPayloadFromForm(form)),
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      action,
      campaignId,
      scheduledAt,
    }: {
      action: "send" | "schedule" | "cancel";
      campaignId: string;
      scheduledAt?: string;
    }) => {
      if (action === "send") {
        return sendPushCampaignNow(auth.authHeaders, campaignId);
      }
      if (action === "schedule") {
        return schedulePushCampaign(auth.authHeaders, campaignId, scheduledAt ?? "");
      }
      return cancelPushCampaign(auth.authHeaders, campaignId);
    },
    onSuccess: (campaign, variables) => {
      setNotice({
        tone: "success",
        message:
          variables.action === "send"
            ? "Campaign is queued for sending."
            : variables.action === "schedule"
              ? "Campaign schedule is queued."
              : "Campaign cancelled.",
      });
      setSelectedCampaignId(campaign.id);
      void invalidateCampaignQueries(queryClient);
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const fileError = validatePushCampaignImageFile(file);
    if (fileError) {
      setNotice({ tone: "danger", message: fileError });
      return;
    }

    const dimensionError = await validatePushCampaignImageDimensions(file).catch((error: unknown) =>
      error instanceof Error ? error.message : "Campaign image could not be read.",
    );
    if (dimensionError) {
      setNotice({ tone: "danger", message: dimensionError });
      return;
    }

    setUploadProgress(1);
    try {
      const uploaded = await uploadPublicImage(auth.authHeaders, file, "ADMIN_BANNER", {
        onProgress: setUploadProgress,
      });
      setForm((current) => ({ ...current, imageAssetKey: uploaded.assetKey }));
      setNotice({ tone: "success", message: "Campaign image uploaded." });
    } catch (error) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    } finally {
      setUploadProgress(0);
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validatePushCampaignForm(form);
    if (error) {
      setNotice({ tone: "danger", message: error });
      return;
    }
    if (mode === "edit" && selectedCampaign?.id) {
      updateMutation.mutate({ campaignId: selectedCampaign.id });
      return;
    }
    createMutation.mutate();
  }

  function preview() {
    const error = validatePushCampaignForm(form);
    if (error) {
      setNotice({ tone: "danger", message: error });
      return;
    }
    previewMutation.mutate();
  }

  function editCampaign(campaign: PushCampaign) {
    setSelectedCampaignId(campaign.id);
    setMode("edit");
    setForm(formFromPushCampaign(campaign));
    setScheduleAt(campaign.scheduledAt ? toLocalInputValue(new Date(campaign.scheduledAt)) : scheduleAt);
    setNotice(null);
  }

  function scheduleSelected() {
    if (!selectedCampaign?.id) return;
    const date = new Date(scheduleAt);
    if (!scheduleAt || Number.isNaN(date.getTime()) || date <= new Date()) {
      setNotice({ tone: "danger", message: "Schedule time must be in the future." });
      return;
    }
    lifecycleMutation.mutate({
      action: "schedule",
      campaignId: selectedCampaign.id,
      scheduledAt: date.toISOString(),
    });
  }

  const campaigns = campaignsQuery.data?.items ?? [];
  const detail = detailQuery.data ?? selectedCampaign;
  const metrics = campaignMetrics(campaigns, campaignsQuery.data?.total ?? 0);
  const imagePreview = resolveImageSource(form.imageAssetKey || detail?.imageUrl || detail?.imageAssetKey);
  const isEditable = detail?.status === "DRAFT" || detail?.status === "SCHEDULED";
  const busy = createMutation.isPending || updateMutation.isPending || lifecycleMutation.isPending;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total" value={metrics.total} tone="info" />
        <MetricCard label="Draft" value={metrics.draft} tone="neutral" />
        <MetricCard label="Scheduled" value={metrics.scheduled} tone="warning" />
        <MetricCard label="Sending" value={metrics.sending} tone="info" />
        <MetricCard label="Sent" value={metrics.sent} tone="success" />
      </section>

      <div className="grid gap-5 2xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Mobile push</p>
              <h2 className="mt-2 text-xl font-black text-[#1F2933]">
                {mode === "edit" ? "Edit campaign" : "Create campaign"}
              </h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={submitForm}>
            <CampaignField
              label="Title"
              value={form.title}
              maxLength={120}
              onChange={(title) => setForm((current) => ({ ...current, title }))}
              required
            />
            <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
              Body
              <textarea
                value={form.body}
                maxLength={240}
                required
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                className="min-h-24 rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
            </label>

            <div className="grid gap-2 rounded-md border border-[#E5E7EB] bg-[#FCFDFE] p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-black text-[#1F2933]" htmlFor="push-campaign-image">
                  Image asset
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadProgress > 0}
                  onClick={() => document.getElementById("push-campaign-image")?.click()}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {uploadProgress ? `${uploadProgress}%` : "Upload"}
                </Button>
              </div>
              <input id="push-campaign-image" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              <input
                value={form.imageAssetKey}
                onChange={(event) => setForm((current) => ({ ...current, imageAssetKey: event.target.value }))}
                placeholder="indihub/admin/.../push.webp"
                className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
              {imagePreview ? (
                <div className="overflow-hidden rounded-md border border-[#D8E2EA] bg-white">
                  <img src={imagePreview} alt="" className="h-32 w-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="grid h-24 place-items-center rounded-md border border-dashed border-[#D8E2EA] text-[#667085]">
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
              Deep link
              <input
                list="push-campaign-hrefs"
                value={form.href}
                onChange={(event) => setForm((current) => ({ ...current, href: event.target.value }))}
                className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
              <datalist id="push-campaign-hrefs">
                {pushCampaignHrefExamples.map((href) => (
                  <option key={href} value={href} />
                ))}
              </datalist>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <CampaignField label="Country" value={form.countryCode} onChange={(countryCode) => setForm((current) => ({ ...current, countryCode }))} />
              <CampaignField label="State" value={form.stateCode} onChange={(stateCode) => setForm((current) => ({ ...current, stateCode }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CampaignField label="City" value={form.city} onChange={(city) => setForm((current) => ({ ...current, city }))} />
              <CampaignField
                label="Limit"
                type="number"
                min={1}
                max={100000}
                value={form.limit}
                onChange={(limit) => setForm((current) => ({ ...current, limit }))}
              />
            </div>

            {previewMutation.data ? (
              <div className="flex items-center justify-between rounded-md border border-[#C5D8E8] bg-[#EAF1F7] px-3 py-2 text-sm font-bold text-[#163B5C]">
                <span>Preview recipients</span>
                <span>{previewMutation.data.count.toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            {notice ? <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {mode === "edit" ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {mode === "edit" ? "Update draft" : "Create draft"}
              </Button>
              <Button type="button" variant="outline" onClick={preview} disabled={previewMutation.isPending}>
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                {previewMutation.isPending ? "Checking" : "Preview"}
              </Button>
              {mode === "edit" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode("create");
                    setForm(emptyPushCampaignForm());
                  }}
                >
                  New draft
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="grid gap-5">
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#1F2933]">Push campaigns</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Delivery counts are updated by the DB-backed worker.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PushCampaignStatus | "ALL")}
                  className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"
                >
                  {pushCampaignStatuses.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All statuses" : humanize(option)}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => void campaignsQuery.refetch()} disabled={campaignsQuery.isFetching}>
                  <RefreshCw className={cn("h-4 w-4", campaignsQuery.isFetching && "animate-spin")} aria-hidden="true" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  selected={detail?.id === campaign.id}
                  onSelect={() => setSelectedCampaignId(campaign.id)}
                  onEdit={() => editCampaign(campaign)}
                />
              ))}
              {!campaignsQuery.isLoading && !campaigns.length ? (
                <p className="rounded-md border border-dashed border-[#D8E2EA] p-5 text-sm font-semibold text-[#667085]">
                  No push campaigns found.
                </p>
              ) : null}
            </div>
          </div>

          {detail ? (
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CampaignStatusBadge status={detail.status} />
                    <StatusBadge tone="info">{detail.previewCount.toLocaleString("en-IN")} preview</StatusBadge>
                  </div>
                  <h2 className="mt-3 text-xl font-black text-[#1F2933]">{detail.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">{detail.body}</p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {isEditable ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => editCampaign(detail)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  ) : null}
                  {isEditable ? (
                    <Button type="button" size="sm" onClick={() => lifecycleMutation.mutate({ action: "send", campaignId: detail.id })} disabled={busy}>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send now
                    </Button>
                  ) : null}
                  {detail.status !== "SENT" && detail.status !== "CANCELLED" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => lifecycleMutation.mutate({ action: "cancel", campaignId: detail.id })} disabled={busy}>
                      <StopCircle className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>

              {isEditable ? (
                <div className="mt-4 flex flex-col gap-2 rounded-md border border-[#E5E7EB] bg-[#FCFDFE] p-3 sm:flex-row sm:items-end">
                  <CampaignField label="Schedule at" type="datetime-local" value={scheduleAt} onChange={setScheduleAt} />
                  <Button type="button" variant="outline" onClick={scheduleSelected} disabled={busy}>
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Schedule
                  </Button>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Targeted" value={detail.targetedCount} tone="info" compact />
                <MetricCard label="Sent" value={detail.sentCount} tone="success" compact />
                <MetricCard label="Failed" value={detail.failedCount} tone={detail.failedCount ? "danger" : "neutral"} compact />
                <MetricCard label="Revoked" value={detail.revokedCount} tone={detail.revokedCount ? "warning" : "neutral"} compact />
                <MetricCard label="Batches" value={detail.batches?.length ?? 0} tone="info" compact />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border border-[#E5E7EB] p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#667085]">Batch state</h3>
                  <div className="mt-3 grid gap-2">
                    {detail.batches?.map((batch) => (
                      <div key={batch.id} className="flex items-center justify-between gap-2 rounded-md bg-[#F8FAFC] px-3 py-2 text-sm font-bold">
                        <span>{batch.recipientTokenIds.length.toLocaleString("en-IN")} tokens</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={batch.status === "DONE" ? "success" : batch.status === "CLAIMED" ? "info" : "warning"}>
                            {humanize(batch.status)}
                          </StatusBadge>
                          <span className="text-[#667085]">try {batch.attemptCount}</span>
                        </div>
                      </div>
                    ))}
                    {!detail.batches?.length ? <p className="text-sm font-semibold text-[#667085]">No worker batches yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#667085]">Audit trail</h3>
                  <div className="mt-3 grid gap-2">
                    {auditQuery.data?.map((entry) => (
                      <div key={entry.id} className="rounded-md bg-[#F8FAFC] px-3 py-2">
                        <p className="text-sm font-black text-[#1F2933]">{entry.action}</p>
                        <p className="mt-1 text-xs font-semibold text-[#667085]">{formatDate(entry.createdAt)}</p>
                      </div>
                    ))}
                    {!auditQuery.isLoading && !auditQuery.data?.length ? <p className="text-sm font-semibold text-[#667085]">No audit entries yet.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CampaignField({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  return (
    <label className="grid flex-1 gap-1.5 text-sm font-bold text-[#1F2933]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
      />
    </label>
  );
}

function CampaignCard({
  campaign,
  selected,
  onSelect,
  onEdit,
}: {
  campaign: PushCampaign;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <article className={cn("rounded-lg border p-4", selected ? "border-[#ED3500] bg-[#FFF8F5]" : "border-[#E5E7EB] bg-white")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <StatusBadge tone="info">{campaign.previewCount.toLocaleString("en-IN")} preview</StatusBadge>
            {campaign.href ? <StatusBadge tone="neutral">{campaign.href}</StatusBadge> : null}
          </div>
          <h3 className="mt-2 text-lg font-black text-[#1F2933]">{campaign.title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Created {formatDate(campaign.createdAt)}
            {campaign.scheduledAt ? ` | Scheduled ${formatDate(campaign.scheduledAt)}` : ""}
          </p>
        </button>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <MetricPill label="Sent" value={campaign.sentCount} />
          <MetricPill label="Failed" value={campaign.failedCount} />
          {campaign.status === "DRAFT" || campaign.status === "SCHEDULED" ? (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CampaignStatusBadge({ status }: { status: PushCampaignStatus }) {
  return <StatusBadge tone={campaignStatusTone(status)}>{humanize(status)}</StatusBadge>;
}

function MetricCard({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: number;
  tone: StatusTone;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-[#E5E7EB] bg-white shadow-sm", compact ? "p-3" : "p-4")}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={cn("font-black text-[#163B5C]", compact ? "text-xl" : "text-2xl")}>{value.toLocaleString("en-IN")}</p>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-xs font-black text-[#667085]">
      {label} {value.toLocaleString("en-IN")}
    </span>
  );
}

function campaignMetrics(campaigns: PushCampaign[], total: number) {
  return {
    total,
    draft: campaigns.filter((campaign) => campaign.status === "DRAFT").length,
    scheduled: campaigns.filter((campaign) => campaign.status === "SCHEDULED").length,
    sending: campaigns.filter((campaign) => campaign.status === "SENDING").length,
    sent: campaigns.filter((campaign) => campaign.status === "SENT").length,
  };
}

function campaignStatusTone(status: PushCampaignStatus): StatusTone {
  if (status === "SENT") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "SENDING") return "info";
  if (status === "SCHEDULED") return "warning";
  return "neutral";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function invalidateCampaignQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-push-campaigns"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-push-campaign"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-push-campaign-audit"] }),
  ]);
}
