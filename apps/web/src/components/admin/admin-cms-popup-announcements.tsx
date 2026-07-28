"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminActionMenu, AdminConfirmationDialog, AdminPanel, AdminStatusNotice } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch, userFacingApiErrorMessage } from "@/lib/api";
import { resolveImageSource } from "@/lib/image-url";
import { uploadPublicImage, validateImageDimensions, validatePublicImageFile } from "@/lib/public-image-upload";

type PopupStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export type CmsPopupAnnouncementRecord = {
  id: string;
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  imageAlt: string;
  primaryLinkUrl: string | null;
  primaryCtaLabel: string | null;
  secondaryLinkUrl: string | null;
  secondaryCtaLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: PopupStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type PopupForm = {
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  primaryLinkUrl: string;
  primaryCtaLabel: string;
  secondaryLinkUrl: string;
  secondaryCtaLabel: string;
  startsAt: string;
  endsAt: string;
  status: PopupStatus;
  sortOrder: number;
};

const emptyForm: PopupForm = {
  title: "",
  desktopImageUrl: "",
  mobileImageUrl: "",
  imageAlt: "",
  primaryLinkUrl: "",
  primaryCtaLabel: "",
  secondaryLinkUrl: "",
  secondaryCtaLabel: "",
  startsAt: "",
  endsAt: "",
  status: "DRAFT",
  sortOrder: 0,
};

export function AdminCmsPopupAnnouncementsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-cms-popup-announcements"],
    queryFn: () => indihubFetch<{ items: CmsPopupAnnouncementRecord[] }>(
      "/api/admin/cms/popup-announcements?limit=100",
      undefined,
      auth.authHeaders,
    ),
    enabled: auth.isAuthenticated,
  });
  const remove = useMutation({
    mutationFn: (id: string) => indihubFetch(
      `/api/admin/cms/popup-announcements/${id}`,
      { method: "DELETE" },
      auth.authHeaders,
    ),
    onSuccess: async () => {
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-cms-popup-announcements"] });
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F2933]">Promotional Popups</h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Manage image promotions shown on the customer web and mobile home screens.
          </p>
        </div>
        <Link href="/admin/cms/popup-announcements/new">
          <Button><Plus className="mr-2 h-4 w-4" />New popup</Button>
        </Link>
      </div>

      {query.error ? (
        <AdminStatusNotice title="Unable to load popups" message={userFacingApiErrorMessage(query.error)} tone="danger" />
      ) : null}

      <AdminPanel className="overflow-hidden p-0">
        <div className="divide-y divide-[#EAECF0]">
          {(query.data?.items ?? []).map((item) => {
            const image = resolveImageSource(item.mobileImageUrl || item.desktopImageUrl);
            return (
              <div key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="h-24 w-full overflow-hidden rounded-xl border border-[#EAECF0] bg-[#F8FAFC] sm:w-36">
                  {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-black text-[#1F2933]">{item.title}</p>
                    <StatusBadge tone={statusTone(item.status)}>{statusLabel(item)}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    Sort {item.sortOrder} · {scheduleLabel(item)}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-[#98A2B3]">
                    {item.primaryLinkUrl || "No image destination"}
                  </p>
                </div>
                <AdminActionMenu items={[
                  {
                    label: "Edit popup",
                    icon: <Pencil className="h-4 w-4" />,
                    href: `/admin/cms/popup-announcements/${item.id}`,
                  },
                  {
                    label: "Delete popup",
                    icon: <Trash2 className="h-4 w-4" />,
                    destructive: true,
                    onSelect: () => setDeleteId(item.id),
                  },
                ]} />
              </div>
            );
          })}
          {query.isLoading ? <p className="p-5 text-sm font-semibold text-[#667085]">Loading promotional popups…</p> : null}
          {!query.isLoading && (query.data?.items.length ?? 0) === 0 ? (
            <div className="p-8 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-[#ED3500]" />
              <p className="mt-3 font-black text-[#1F2933]">No promotional popups yet</p>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Create a responsive image campaign for the customer homepage.</p>
            </div>
          ) : null}
        </div>
      </AdminPanel>

      <AdminConfirmationDialog
        open={Boolean(deleteId)}
        title="Delete promotional popup"
        description="This permanently removes the popup and its schedule. Uploaded images remain available for reuse."
        confirmLabel={remove.isPending ? "Deleting…" : "Delete popup"}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </>
  );
}

export function AdminCmsPopupAnnouncementEditClient({ id }: { id: string }) {
  const auth = useAdminAuth();
  const isNew = id === "new";
  const [form, setForm] = useState<PopupForm>(emptyForm);
  const [notice, setNotice] = useState<string | null>(null);
  const [desktopProgress, setDesktopProgress] = useState(0);
  const [mobileProgress, setMobileProgress] = useState(0);
  const query = useQuery({
    queryKey: ["admin-cms-popup-announcement", id],
    queryFn: () => indihubFetch<CmsPopupAnnouncementRecord>(
      `/api/admin/cms/popup-announcements/${id}`,
      undefined,
      auth.authHeaders,
    ),
    enabled: auth.isAuthenticated && !isNew,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm(recordToForm(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => indihubFetch(
      isNew ? "/api/admin/cms/popup-announcements" : `/api/admin/cms/popup-announcements/${id}`,
      { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) },
      auth.authHeaders,
    ),
    onSuccess: () => window.location.assign("/admin/cms/popup-announcements"),
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });

  async function uploadImage(file: File, mobile: boolean) {
    setNotice(null);
    try {
      validatePublicImageFile(file);
      const dimensions = await validateImageDimensions(file);
      assertPopupAspectRatio(dimensions.width, dimensions.height, mobile);
      const setProgress = mobile ? setMobileProgress : setDesktopProgress;
      setProgress(1);
      const uploaded = await uploadPublicImage(auth.authHeaders, file, "ADMIN_BANNER", { onProgress: setProgress });
      setForm((current) => ({
        ...current,
        [mobile ? "mobileImageUrl" : "desktopImageUrl"]: uploaded.assetKey,
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      (mobile ? setMobileProgress : setDesktopProgress)(0);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!form.desktopImageUrl.trim()) {
      setNotice("Upload a desktop popup image before saving.");
      return;
    }
    save.mutate(popupPayload(form));
  }

  if (!isNew && query.isLoading) {
    return <p className="text-sm font-semibold text-[#667085]">Loading promotional popup…</p>;
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        {notice || query.error ? (
          <AdminStatusNotice
            title="Popup could not be saved"
            message={notice ?? userFacingApiErrorMessage(query.error)}
            tone="danger"
          />
        ) : null}

        <AdminPanel>
          <h2 className="text-lg font-black text-[#1F2933]">Campaign details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Admin title" className="md:col-span-2">
              <input required minLength={2} maxLength={120} value={form.title} onChange={(event) => setField(setForm, "title", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Image description" help="Required for customers using screen readers." className="md:col-span-2">
              <input required minLength={2} maxLength={180} value={form.imageAlt} onChange={(event) => setField(setForm, "imageAlt", event.target.value)} className={inputClass} />
            </Field>
            <ImageUploadField
              label="Desktop image"
              help="Required 16:9 image. JPG, PNG, WebP, or GIF up to 5 MB."
              value={form.desktopImageUrl}
              progress={desktopProgress}
              onUpload={(file) => uploadImage(file, false)}
              onClear={() => setField(setForm, "desktopImageUrl", "")}
            />
            <ImageUploadField
              label="Mobile image"
              help="Optional 4:5 portrait image. Desktop image is used when empty."
              value={form.mobileImageUrl}
              progress={mobileProgress}
              onUpload={(file) => uploadImage(file, true)}
              onClear={() => setField(setForm, "mobileImageUrl", "")}
            />
          </div>
        </AdminPanel>

        <AdminPanel>
          <h2 className="text-lg font-black text-[#1F2933]">Actions</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">The image opens the primary destination when one is provided.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Primary destination">
              <input maxLength={500} placeholder="/deals" value={form.primaryLinkUrl} onChange={(event) => setField(setForm, "primaryLinkUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Primary button label">
              <input maxLength={80} placeholder="Shop offers" value={form.primaryCtaLabel} onChange={(event) => setField(setForm, "primaryCtaLabel", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Secondary destination">
              <input maxLength={500} placeholder="/categories" value={form.secondaryLinkUrl} onChange={(event) => setField(setForm, "secondaryLinkUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Secondary button label">
              <input maxLength={80} placeholder="Browse categories" value={form.secondaryCtaLabel} onChange={(event) => setField(setForm, "secondaryCtaLabel", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </AdminPanel>

        <AdminPanel>
          <h2 className="text-lg font-black text-[#1F2933]">Publishing</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Start date" help="Required when status is Scheduled.">
              <input type="datetime-local" value={form.startsAt} onChange={(event) => setField(setForm, "startsAt", event.target.value)} className={inputClass} />
            </Field>
            <Field label="End date">
              <input type="datetime-local" value={form.endsAt} onChange={(event) => setField(setForm, "endsAt", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setField(setForm, "status", event.target.value as PopupStatus)} className={inputClass}>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
            <Field label="Carousel order" help="Lower numbers appear first.">
              <input type="number" min={0} value={form.sortOrder} onChange={(event) => setField(setForm, "sortOrder", Number(event.target.value))} className={inputClass} />
            </Field>
          </div>
        </AdminPanel>

        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/admin/cms/popup-announcements"><Button type="button" variant="ghost">Cancel</Button></Link>
          <Button type="submit" disabled={save.isPending || desktopProgress > 0 || mobileProgress > 0}>
            {save.isPending ? "Saving…" : "Save promotional popup"}
          </Button>
        </div>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <PopupPreview title="Desktop preview" image={form.desktopImageUrl} alt={form.imageAlt} form={form} mobile={false} />
        <PopupPreview title="Mobile preview" image={form.mobileImageUrl || form.desktopImageUrl} alt={form.imageAlt} form={form} mobile />
      </div>
    </form>
  );
}

function ImageUploadField({ label, help, value, progress, onUpload, onClear }: {
  label: string;
  help: string;
  value: string;
  progress: number;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="rounded-xl border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-[#ED3500] px-3 py-2 text-sm font-black text-white">
            <Upload className="mr-2 h-4 w-4" />{progress ? `Uploading ${Math.round(progress)}%` : value ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={progress > 0} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
              event.target.value = "";
            }} />
          </label>
          {value ? <button type="button" onClick={onClear} className="inline-flex items-center text-sm font-black text-[#B42318]"><X className="mr-1 h-4 w-4" />Remove</button> : null}
        </div>
        <p className="mt-2 break-all text-xs font-semibold text-[#667085]">{value || "No image uploaded"}</p>
      </div>
    </Field>
  );
}

function PopupPreview({ title, image, alt, form, mobile }: { title: string; image: string; alt: string; form: PopupForm; mobile: boolean }) {
  const source = resolveImageSource(image);
  return (
    <AdminPanel>
      <p className="mb-4 text-sm font-black text-[#1F2933]">{title}</p>
      <div className={mobile ? "mx-auto max-w-[280px] rounded-[28px] bg-[#101828]/45 p-3" : "rounded-2xl bg-[#101828]/45 p-6"}>
        <div className="overflow-hidden rounded-2xl bg-[#FFFCFB] shadow-xl">
          <div className={mobile ? "aspect-[4/5] bg-[#FFF2EE]" : "aspect-video bg-[#FFF2EE]"}>
            {source ? <img src={source} alt={alt || "Popup preview"} className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center text-center text-sm font-black text-[#ED3500]">Upload an image to preview</div>
            )}
          </div>
          {form.primaryCtaLabel || form.secondaryCtaLabel ? (
            <div className="flex flex-wrap gap-2 p-3">
              {form.primaryCtaLabel ? <span className="rounded-lg bg-[#ED3500] px-3 py-2 text-xs font-black text-white">{form.primaryCtaLabel}</span> : null}
              {form.secondaryCtaLabel ? <span className="rounded-lg border border-[#ED3500] px-3 py-2 text-xs font-black text-[#ED3500]">{form.secondaryCtaLabel}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </AdminPanel>
  );
}

function Field({ label, help, className, children }: { label: string; help?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <div className="mt-2">{children}</div>
      {help ? <span className="mt-1 block text-xs font-semibold text-[#667085]">{help}</span> : null}
    </label>
  );
}

function setField<Key extends keyof PopupForm>(setForm: React.Dispatch<React.SetStateAction<PopupForm>>, key: Key, value: PopupForm[Key]) {
  setForm((current) => ({ ...current, [key]: value }));
}

function popupPayload(form: PopupForm) {
  return {
    title: form.title.trim(),
    desktopImageUrl: form.desktopImageUrl.trim(),
    mobileImageUrl: form.mobileImageUrl.trim(),
    imageAlt: form.imageAlt.trim(),
    primaryLinkUrl: form.primaryLinkUrl.trim(),
    primaryCtaLabel: form.primaryCtaLabel.trim(),
    secondaryLinkUrl: form.secondaryLinkUrl.trim(),
    secondaryCtaLabel: form.secondaryCtaLabel.trim(),
    startsAt: localDateToIso(form.startsAt),
    endsAt: localDateToIso(form.endsAt),
    status: form.status,
    sortOrder: form.sortOrder,
  };
}

function recordToForm(record: CmsPopupAnnouncementRecord): PopupForm {
  return {
    title: record.title,
    desktopImageUrl: record.desktopImageUrl,
    mobileImageUrl: record.mobileImageUrl ?? "",
    imageAlt: record.imageAlt,
    primaryLinkUrl: record.primaryLinkUrl ?? "",
    primaryCtaLabel: record.primaryCtaLabel ?? "",
    secondaryLinkUrl: record.secondaryLinkUrl ?? "",
    secondaryCtaLabel: record.secondaryCtaLabel ?? "",
    startsAt: isoToLocalDate(record.startsAt),
    endsAt: isoToLocalDate(record.endsAt),
    status: record.status,
    sortOrder: record.sortOrder,
  };
}

function localDateToIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function isoToLocalDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function assertPopupAspectRatio(width: number, height: number, mobile: boolean) {
  const expected = mobile ? 4 / 5 : 16 / 9;
  const tolerance = mobile ? 0.06 : 0.08;
  if (height <= 0 || Math.abs(width / height - expected) > tolerance) {
    throw new Error(`${mobile ? "Mobile" : "Desktop"} popup image must use a ${mobile ? "4:5" : "16:9"} aspect ratio.`);
  }
}

function statusLabel(record: CmsPopupAnnouncementRecord) {
  const now = Date.now();
  if ((record.status === "PUBLISHED" || record.status === "SCHEDULED") && record.startsAt && new Date(record.startsAt).getTime() > now) return "Scheduled";
  if ((record.status === "PUBLISHED" || record.status === "SCHEDULED") && record.endsAt && new Date(record.endsAt).getTime() < now) return "Expired";
  return record.status.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function statusTone(status: PopupStatus): "success" | "warning" | "neutral" | "danger" {
  if (status === "PUBLISHED") return "success";
  if (status === "SCHEDULED") return "warning";
  if (status === "ARCHIVED") return "danger";
  return "neutral";
}

function scheduleLabel(record: CmsPopupAnnouncementRecord) {
  if (!record.startsAt && !record.endsAt) return "No schedule limit";
  const start = record.startsAt ? new Date(record.startsAt).toLocaleString("en-IN") : "Immediately";
  const end = record.endsAt ? new Date(record.endsAt).toLocaleString("en-IN") : "No end date";
  return `${start} – ${end}`;
}

const inputClass = "h-11 w-full rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10";
