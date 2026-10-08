"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Layers,
  Megaphone,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { indihubFetch, userFacingApiErrorMessage } from "@/lib/api";
import {
  AdminPanel,
  AdminActionMenu,
  AdminConfirmationDialog,
  AdminStatusNotice,
} from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";

export type AnnouncementAudience = "STOREFRONT" | "SELLER_DASHBOARD" | "ALL";
export type AnnouncementTone = "INFO" | "WARNING" | "SUCCESS" | "BRAND" | "CUSTOM";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type CmsAnnouncementRecord = {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
  primaryCtaLabel: string | null;
  secondaryLinkUrl: string | null;
  secondaryCtaLabel: string | null;
  targetAudience: AnnouncementAudience | string;
  tone: AnnouncementTone | string;
  isDismissible: boolean;
  backgroundColor: string | null;
  textColor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: AnnouncementStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementFormData = {
  title: string;
  description: string;
  linkUrl: string;
  primaryCtaLabel: string;
  secondaryLinkUrl: string;
  secondaryCtaLabel: string;
  targetAudience: AnnouncementAudience;
  tone: AnnouncementTone;
  isDismissible: boolean;
  backgroundColor: string;
  textColor: string;
  startsAt: string;
  endsAt: string;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

const emptyFormData: AnnouncementFormData = {
  title: "",
  description: "",
  linkUrl: "",
  primaryCtaLabel: "",
  secondaryLinkUrl: "",
  secondaryCtaLabel: "",
  targetAudience: "SELLER_DASHBOARD",
  tone: "INFO",
  isDismissible: true,
  backgroundColor: "#163B5C",
  textColor: "#FFFFFF",
  startsAt: "",
  endsAt: "",
  status: "PUBLISHED",
  sortOrder: 1,
};

const PRESET_TEMPLATES = [
  {
    name: "Financial Transparency (Net Sales Breakdown)",
    audience: "SELLER_DASHBOARD" as const,
    tone: "INFO" as const,
    title: "Financial Transparency: How your Net Sales are calculated",
    description:
      "Net Sales reflects your gross product sales after mandatory statutory compliance (1% TDS u/s 194-O + 1% TCS under GST) and marketplace commission. Buyer Checkout Platform Fee (e.g. ₹15) is charged directly to the buyer for marketplace services and is never deducted from your payout.",
    primaryCtaLabel: "View Tax & Fee Breakdown",
    linkUrl: "#tax-breakdown",
    secondaryCtaLabel: "Open Finance Wallet & Ledger",
    secondaryLinkUrl: "/seller/finance/wallet",
    isDismissible: true,
  },
  {
    name: "GSTR-1 Monthly Tax Filing Notice",
    audience: "SELLER_DASHBOARD" as const,
    tone: "WARNING" as const,
    title: "Monthly Compliance: GSTR-1 Sales Register Verification",
    description:
      "Please review your monthly e-commerce sales register and confirm invoice reconciliations before the 10th of this month to ensure smooth processing of automated payouts and credit notes.",
    primaryCtaLabel: "Review Tax Register",
    linkUrl: "/seller/finance/tax",
    secondaryCtaLabel: "Contact Finance Support",
    secondaryLinkUrl: "/seller/support",
    isDismissible: true,
  },
  {
    name: "Peak Season Fast Dispatch Advisory",
    audience: "SELLER_DASHBOARD" as const,
    tone: "BRAND" as const,
    title: "Festival Order Surge: Extended Same-Day Pickup Window Active",
    description:
      "All integrated courier partners are operating with extended evening pickup windows. Package all pending orders within 12 hours of booking to maintain your verified 5-star seller performance badge.",
    primaryCtaLabel: "View Pending Orders",
    linkUrl: "/seller/orders",
    secondaryCtaLabel: "Shipping Guidelines",
    secondaryLinkUrl: "/seller/support",
    isDismissible: true,
  },
  {
    name: "Storefront Free Express Delivery Bar",
    audience: "STOREFRONT" as const,
    tone: "BRAND" as const,
    title: "Free express delivery on all verified local artisan orders above ₹499",
    description: "",
    primaryCtaLabel: "Shop Featured",
    linkUrl: "/categories",
    secondaryCtaLabel: "",
    secondaryLinkUrl: "",
    isDismissible: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. List View: AdminCmsAnnouncementsClient
// ─────────────────────────────────────────────────────────────────────────────

export function AdminCmsAnnouncementsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<"ALL" | AnnouncementAudience>("ALL");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AnnouncementStatus>("ALL");

  const announcementsQuery = useQuery({
    queryKey: ["admin-cms-announcements"],
    queryFn: () =>
      indihubFetch<{ items: CmsAnnouncementRecord[]; total: number }>(
        "/api/admin/cms/announcements?limit=100",
        undefined,
        auth.authHeaders,
      ),
    enabled: auth.isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      indihubFetch(`/api/admin/cms/announcements/${id}`, { method: "DELETE" }, auth.authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-announcements"] });
      setDeleteConfirmId(null);
    },
  });

  const items = announcementsQuery.data?.items ?? [];

  const filteredItems = items.filter((item) => {
    if (selectedAudience !== "ALL" && item.targetAudience !== selectedAudience && item.targetAudience !== "ALL") {
      return false;
    }
    if (statusFilter !== "ALL" && item.status !== statusFilter) {
      return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const sellerCount = items.filter((i) => i.targetAudience === "SELLER_DASHBOARD" || i.targetAudience === "ALL").length;
  const storefrontCount = items.filter((i) => i.targetAudience === "STOREFRONT" || i.targetAudience === "ALL").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F2933]">Announcements & Operational Notices</h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Manage merchant dashboard operational notices, financial transparency explainers, and customer storefront ticker bars.
          </p>
        </div>
        <Link href="/admin/cms/announcements/new">
          <Button variant="primary">
            <Plus className="mr-1.5 h-4 w-4" />
            New Announcement
          </Button>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedAudience("ALL")}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              selectedAudience === "ALL"
                ? "bg-[#1F2933] text-white shadow-sm"
                : "bg-white text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F2933] border border-[#E2E8F0]"
            }`}
          >
            All Notices ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAudience("SELLER_DASHBOARD")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              selectedAudience === "SELLER_DASHBOARD"
                ? "bg-[#1E40AF] text-white shadow-sm"
                : "bg-white text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F2933] border border-[#E2E8F0]"
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            Seller Hub Notices ({sellerCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAudience("STOREFRONT")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              selectedAudience === "STOREFRONT"
                ? "bg-[#ED3500] text-white shadow-sm"
                : "bg-white text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F2933] border border-[#E2E8F0]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Storefront Ticker ({storefrontCount})
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="text"
              placeholder="Filter announcements…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | AnnouncementStatus)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-semibold text-[#475467] outline-none transition focus:border-[#ED3500]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {announcementsQuery.error ? (
        <AdminStatusNotice
          title="Unable to load announcements"
          message={userFacingApiErrorMessage(announcementsQuery.error)}
          tone="danger"
        />
      ) : null}

      {/* Announcements List */}
      <AdminPanel className="overflow-hidden p-0">
        <div className="divide-y divide-[#EAECF0]">
          {filteredItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 p-5 transition hover:bg-[#FAFAFA] sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 items-start gap-3.5 min-w-0">
                {/* Tone Icon Pill */}
                <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${getTonePillClasses(item.tone)}`}>
                  {getToneIcon(item.tone, item.targetAudience)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-[#1F2933]">{item.title}</h3>
                    <AudienceBadge audience={item.targetAudience} />
                    <ToneBadge tone={item.tone} />
                    <StatusBadge tone={item.status === "PUBLISHED" ? "success" : "neutral"}>
                      {item.status}
                    </StatusBadge>
                    {item.isDismissible ? (
                      <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-bold text-[#475467]">
                        Dismissible
                      </span>
                    ) : null}
                  </div>

                  {item.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#667085]">
                      {item.description}
                    </p>
                  ) : null}

                  {/* Actions & Schedule Info */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-[#667085]">
                    {item.primaryCtaLabel ? (
                      <span className="flex items-center gap-1 text-[#1E40AF]">
                        <span className="font-bold">Primary:</span> {item.primaryCtaLabel}
                        {item.linkUrl ? <span className="text-[#98A2B3]">({item.linkUrl})</span> : null}
                      </span>
                    ) : null}

                    {item.secondaryCtaLabel ? (
                      <span className="flex items-center gap-1 text-[#475467]">
                        <span className="font-bold">Secondary:</span> {item.secondaryCtaLabel}
                      </span>
                    ) : null}

                    {item.startsAt ? (
                      <span>Starts: {new Date(item.startsAt).toLocaleDateString()}</span>
                    ) : null}

                    {item.endsAt ? (
                      <span>Ends: {new Date(item.endsAt).toLocaleDateString()}</span>
                    ) : null}

                    <span>Sort: {item.sortOrder}</span>
                  </div>
                </div>
              </div>

              {/* Action Menu */}
              <div className="shrink-0 self-end sm:self-center">
                <AdminActionMenu
                  label="Actions"
                  items={[
                    {
                      label: "Edit announcement",
                      icon: <Pencil className="h-4 w-4" />,
                      href: `/admin/cms/announcements/${item.id}`,
                    },
                    {
                      label: "Delete announcement",
                      icon: <Trash2 className="h-4 w-4" />,
                      destructive: true,
                      onSelect: () => setDeleteConfirmId(item.id),
                    },
                  ]}
                />
              </div>
            </div>
          ))}

          {announcementsQuery.isLoading ? (
            <p className="p-8 text-center text-sm font-semibold text-[#667085]">
              Loading announcements…
            </p>
          ) : null}

          {!announcementsQuery.isLoading && filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="mx-auto h-9 w-9 text-[#ED3500]" />
              <p className="mt-3 font-black text-[#1F2933]">No announcements match your filter</p>
              <p className="mt-1 text-sm font-semibold text-[#667085]">
                Create a new banner for your sellers or a promotional ticker for your customers.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/admin/cms/announcements/new">
                  <Button variant="primary">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create Announcement
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </AdminPanel>

      {/* Delete Confirmation Dialog */}
      <AdminConfirmationDialog
        open={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete announcement"
        description="Are you sure you want to delete this announcement? This action is permanent and will remove it from the active marketplace immediately."
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete announcement"}
        onConfirm={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Editor View: AdminCmsAnnouncementEditClient
// ─────────────────────────────────────────────────────────────────────────────

export function AdminCmsAnnouncementEditClient({ id }: { id: string }) {
  const auth = useAdminAuth();
  const isNew = id === "new";
  const [form, setForm] = useState<AnnouncementFormData>(emptyFormData);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"SELLER" | "STOREFRONT_DESKTOP" | "STOREFRONT_MOBILE">("SELLER");

  const query = useQuery({
    queryKey: ["admin-cms-announcement", id],
    queryFn: () =>
      indihubFetch<CmsAnnouncementRecord>(
        `/api/admin/cms/announcements/${id}`,
        undefined,
        auth.authHeaders,
      ),
    enabled: auth.isAuthenticated && !isNew,
  });

  useEffect(() => {
    if (!query.data) return;
    const r = query.data;
    setForm({
      title: r.title || "",
      description: r.description || "",
      linkUrl: r.linkUrl || "",
      primaryCtaLabel: r.primaryCtaLabel || "",
      secondaryLinkUrl: r.secondaryLinkUrl || "",
      secondaryCtaLabel: r.secondaryCtaLabel || "",
      targetAudience: (r.targetAudience as AnnouncementAudience) || "SELLER_DASHBOARD",
      tone: (r.tone as AnnouncementTone) || "INFO",
      isDismissible: r.isDismissible ?? true,
      backgroundColor: r.backgroundColor || "#163B5C",
      textColor: r.textColor || "#FFFFFF",
      startsAt: r.startsAt ? new Date(r.startsAt).toISOString().slice(0, 16) : "",
      endsAt: r.endsAt ? new Date(r.endsAt).toISOString().slice(0, 16) : "",
      status: r.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      sortOrder: r.sortOrder ?? 0,
    });
    if (r.targetAudience === "STOREFRONT") {
      setPreviewTab("STOREFRONT_DESKTOP");
    } else {
      setPreviewTab("SELLER");
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      indihubFetch(
        isNew ? "/api/admin/cms/announcements" : `/api/admin/cms/announcements/${id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
        auth.authHeaders,
      ),
    onSuccess: () => {
      window.location.assign("/admin/cms/announcements");
    },
    onError: (err) => {
      setNotice(userFacingApiErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!form.title.trim()) {
      setNotice("Headline / Title is required.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      linkUrl: form.linkUrl.trim() || undefined,
      primaryCtaLabel: form.primaryCtaLabel.trim() || undefined,
      secondaryLinkUrl: form.secondaryLinkUrl.trim() || undefined,
      secondaryCtaLabel: form.secondaryCtaLabel.trim() || undefined,
      targetAudience: form.targetAudience,
      tone: form.tone,
      isDismissible: form.isDismissible,
      backgroundColor: form.tone === "CUSTOM" ? form.backgroundColor : undefined,
      textColor: form.tone === "CUSTOM" ? form.textColor : undefined,
      status: form.status,
      sortOrder: Number(form.sortOrder) || 0,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    };

    saveMutation.mutate(payload);
  };

  const applyTemplate = (template: (typeof PRESET_TEMPLATES)[number]) => {
    setForm((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
      primaryCtaLabel: template.primaryCtaLabel,
      linkUrl: template.linkUrl,
      secondaryCtaLabel: template.secondaryCtaLabel,
      secondaryLinkUrl: template.secondaryLinkUrl,
      targetAudience: template.audience,
      tone: template.tone,
      isDismissible: template.isDismissible,
    }));
    if (template.audience === "STOREFRONT") {
      setPreviewTab("STOREFRONT_DESKTOP");
    } else {
      setPreviewTab("SELLER");
    }
  };

  if (!isNew && query.isLoading) {
    return (
      <AdminPanel>
        <p className="p-8 text-center text-sm font-semibold text-[#667085]">Loading announcement details…</p>
      </AdminPanel>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {notice || query.error ? (
        <AdminStatusNotice
          title="Notice could not be saved"
          message={notice ?? userFacingApiErrorMessage(query.error)}
          tone="danger"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* Left Column: Form Controls */}
        <div className="space-y-6">
          {/* 1. Placement & Audience */}
          <AdminPanel>
            <h2 className="text-base font-black text-[#1F2933]">Placement & Audience</h2>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              Choose where this message will be rendered and how it interacts with the recipient.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* Card 1: Seller Dashboard */}
              <label
                onClick={() => {
                  setForm((f) => ({ ...f, targetAudience: "SELLER_DASHBOARD" }));
                  setPreviewTab("SELLER");
                }}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition ${
                  form.targetAudience === "SELLER_DASHBOARD"
                    ? "border-[#1E40AF] bg-[#EFF4FF] ring-2 ring-[#1E40AF]/20"
                    : "border-[#E2E8F0] bg-white hover:bg-[#FAFAFA]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#DBEAFE] text-[#1E40AF]">
                    <Store className="h-4 w-4" />
                  </div>
                  <input
                    type="radio"
                    name="targetAudience"
                    checked={form.targetAudience === "SELLER_DASHBOARD"}
                    onChange={() => {}}
                    className="accent-[#1E40AF]"
                  />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-black text-[#1F2933]">Seller Dashboard</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-[#667085]">
                    Operational notices & financial transparent card on /seller.
                  </p>
                </div>
              </label>

              {/* Card 2: Storefront Top Bar */}
              <label
                onClick={() => {
                  setForm((f) => ({ ...f, targetAudience: "STOREFRONT" }));
                  setPreviewTab("STOREFRONT_DESKTOP");
                }}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition ${
                  form.targetAudience === "STOREFRONT"
                    ? "border-[#ED3500] bg-[#FFF4F0] ring-2 ring-[#ED3500]/20"
                    : "border-[#E2E8F0] bg-white hover:bg-[#FAFAFA]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#FFE6E0] text-[#ED3500]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <input
                    type="radio"
                    name="targetAudience"
                    checked={form.targetAudience === "STOREFRONT"}
                    onChange={() => {}}
                    className="accent-[#ED3500]"
                  />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-black text-[#1F2933]">Storefront Bar</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-[#667085]">
                    Sliding top announcement ticker for buyer storefront.
                  </p>
                </div>
              </label>

              {/* Card 3: All Portals */}
              <label
                onClick={() => {
                  setForm((f) => ({ ...f, targetAudience: "ALL" }));
                }}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition ${
                  form.targetAudience === "ALL"
                    ? "border-[#475467] bg-[#F2F4F7] ring-2 ring-[#475467]/20"
                    : "border-[#E2E8F0] bg-white hover:bg-[#FAFAFA]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#EAECF0] text-[#344054]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <input
                    type="radio"
                    name="targetAudience"
                    checked={form.targetAudience === "ALL"}
                    onChange={() => {}}
                    className="accent-[#344054]"
                  />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-black text-[#1F2933]">All Portals</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-[#667085]">
                    Universal broadcast visible on both seller hub & storefront.
                  </p>
                </div>
              </label>
            </div>

            {/* Notice Tone / Style Presets */}
            <div className="mt-5 border-t border-[#EAECF0] pt-4">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                Tone & Visual Style
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[
                  { id: "INFO", label: "Info (Blue)", toneClass: "bg-[#EFF4FF] text-[#1D4ED8] border-[#BFDBFE]" },
                  { id: "WARNING", label: "Warning (Amber)", toneClass: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]" },
                  { id: "SUCCESS", label: "Success (Green)", toneClass: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]" },
                  { id: "BRAND", label: "Brand Coral", toneClass: "bg-[#FFF4F0] text-[#ED3500] border-[#FFD5CC]" },
                  { id: "CUSTOM", label: "Custom Hex", toneClass: "bg-gray-100 text-gray-700 border-gray-300" },
                ].map((toneOpt) => (
                  <button
                    key={toneOpt.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tone: toneOpt.id as AnnouncementTone }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${toneOpt.toneClass} ${
                      form.tone === toneOpt.id ? "ring-2 ring-offset-1 ring-[#1F2933]" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {toneOpt.label}
                  </button>
                ))}
              </div>

              {/* Custom Color Pickers if tone === CUSTOM */}
              {form.tone === "CUSTOM" ? (
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-[#EAECF0] bg-[#F8FAFC] p-3.5">
                  <label className="block">
                    <span className="text-xs font-bold text-[#475467]">Background Color</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={form.backgroundColor}
                        onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                        className="h-9 w-9 cursor-pointer rounded border border-[#E2E8F0]"
                      />
                      <input
                        value={form.backgroundColor}
                        onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                        className="h-9 flex-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-xs font-semibold text-[#1F2933]"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-[#475467]">Text Color</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={form.textColor}
                        onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                        className="h-9 w-9 cursor-pointer rounded border border-[#E2E8F0]"
                      />
                      <input
                        value={form.textColor}
                        onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                        className="h-9 flex-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 text-xs font-semibold text-[#1F2933]"
                      />
                    </div>
                  </label>
                </div>
              ) : null}

              {/* Dismissible Switch */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#EAECF0] bg-[#F8FAFC] p-3.5">
                <div>
                  <p className="text-xs font-black text-[#1F2933]">Allow Persistent Dismissal</p>
                  <p className="text-[11px] font-semibold text-[#667085]">
                    When enabled, closing the notice (X button) hides it permanently on their browser until you edit it.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={form.isDismissible}
                    onChange={(e) => setForm((f) => ({ ...f, isDismissible: e.target.checked }))}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#ED3500] focus:ring-[#ED3500]"
                  />
                </label>
              </div>
            </div>
          </AdminPanel>

          {/* 2. Content & Copy with Quick Templates */}
          <AdminPanel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-black text-[#1F2933]">Content & Message</h2>
              <span className="text-[11px] font-bold text-[#667085]">Quick Templates:</span>
            </div>

            {/* Quick Template Buttons */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-bold text-[#475467] transition hover:border-[#1E40AF] hover:bg-[#EFF4FF] hover:text-[#1E40AF]"
                >
                  ⚡ {tmpl.name}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Headline / Title <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={180}
                  className="mt-1.5 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3.5 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  placeholder="e.g. Financial Transparency: How your Net Sales are calculated"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Detailed Message / Explanation
                </span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={5000}
                  className="mt-1.5 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-xs font-semibold leading-relaxed text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  placeholder="e.g. Net Sales reflects your gross product sales after mandatory statutory compliance (1% TDS u/s 194-O + 1% TCS under GST) and marketplace commission. Buyer Platform Fee is never deducted from your payout."
                />
                <span className="mt-1 block text-right text-[11px] text-[#98A2B3]">
                  {form.description.length}/5000 characters
                </span>
              </label>
            </div>
          </AdminPanel>

          {/* 3. Action Buttons & CTAs */}
          <AdminPanel>
            <h2 className="text-base font-black text-[#1F2933]">Interactive Action Buttons (CTAs)</h2>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              Add clickable links for the merchant or buyer. Tip: Use <code className="rounded bg-gray-100 px-1 py-0.5 text-[#1E40AF]">#tax-breakdown</code> to open the interactive fee breakdown modal on the seller dashboard.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Primary Button Label</span>
                <input
                  value={form.primaryCtaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, primaryCtaLabel: e.target.value }))}
                  maxLength={100}
                  placeholder="e.g. View Tax & Fee Breakdown"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Primary Link / Destination</span>
                <input
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  maxLength={500}
                  placeholder="e.g. #tax-breakdown or /deals"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Secondary Button Label</span>
                <input
                  value={form.secondaryCtaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryCtaLabel: e.target.value }))}
                  maxLength={100}
                  placeholder="e.g. Open Finance Wallet & Ledger"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Secondary Link / Destination</span>
                <input
                  value={form.secondaryLinkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryLinkUrl: e.target.value }))}
                  maxLength={500}
                  placeholder="e.g. /seller/finance/wallet"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
            </div>
          </AdminPanel>

          {/* 4. Publishing & Schedule */}
          <AdminPanel>
            <h2 className="text-base font-black text-[#1F2933]">Publishing & Schedule</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Publication Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "DRAFT" | "PUBLISHED" }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                >
                  <option value="PUBLISHED">Published (Active)</option>
                  <option value="DRAFT">Draft (Hidden)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Sort Order</span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Start Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">End Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
            </div>
          </AdminPanel>

          {/* Form Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/admin/cms/announcements">
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Announcement"}
            </Button>
          </div>
        </div>

        {/* Right Column: Live Interactive Responsive Preview */}
        <div className="space-y-4">
          <div className="sticky top-6">
            <AdminPanel className="p-4">
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-[#ED3500]" />
                  <span className="text-xs font-black uppercase tracking-wide text-[#1F2933]">
                    Live Dynamic Preview
                  </span>
                </div>
                <div className="flex rounded-lg border border-[#E2E8F0] p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("SELLER")}
                    className={`rounded px-2.5 py-1 transition ${
                      previewTab === "SELLER" ? "bg-[#1E40AF] text-white shadow-xs" : "text-[#667085] hover:text-[#1F2933]"
                    }`}
                  >
                    Seller Banner
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("STOREFRONT_DESKTOP")}
                    className={`rounded px-2.5 py-1 transition ${
                      previewTab === "STOREFRONT_DESKTOP" ? "bg-[#ED3500] text-white shadow-xs" : "text-[#667085] hover:text-[#1F2933]"
                    }`}
                  >
                    Storefront
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("STOREFRONT_MOBILE")}
                    className={`rounded px-2.5 py-1 transition ${
                      previewTab === "STOREFRONT_MOBILE" ? "bg-[#1F2933] text-white shadow-xs" : "text-[#667085] hover:text-[#1F2933]"
                    }`}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              {/* Preview Content Area */}
              <div className="mt-4">
                {previewTab === "SELLER" ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-[#667085]">
                      How it renders on the Seller Dashboard (<code className="text-[#1E40AF]">/seller</code>):
                    </p>
                    <LiveSellerBannerPreview form={form} />
                    <p className="text-[11px] text-[#98A2B3]">
                      • The dismiss button (X) stores state in localStorage so closed notices do not reappear on reload.
                    </p>
                  </div>
                ) : null}

                {previewTab === "STOREFRONT_DESKTOP" ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-[#667085]">
                      How it renders at the top of the customer storefront (Desktop):
                    </p>
                    <div className="overflow-hidden rounded-xl border border-[#D0D5DD] shadow-sm">
                      {/* Browser Chrome */}
                      <div className="flex h-6 items-center gap-1.5 border-b border-[#EAECF0] bg-[#F2F4F7] px-3">
                        <div className="h-2 w-2 rounded-full bg-[#FDA29B]" />
                        <div className="h-2 w-2 rounded-full bg-[#FEC84B]" />
                        <div className="h-2 w-2 rounded-full bg-[#73E2A3]" />
                        <span className="ml-2 text-[10px] font-semibold text-[#667085]">1handindia.com</span>
                      </div>
                      <LiveStorefrontBarPreview form={form} />
                      <div className="flex h-10 items-center justify-between border-t border-[#EAECF0] bg-white px-4">
                        <span className="text-xs font-black text-[#ED3500]">1HandIndia</span>
                        <div className="flex gap-2">
                          <div className="h-3 w-12 rounded bg-gray-100" />
                          <div className="h-3 w-12 rounded bg-gray-100" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {previewTab === "STOREFRONT_MOBILE" ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-[#667085]">
                      Customer mobile view:
                    </p>
                    <div className="mx-auto w-[240px] overflow-hidden rounded-2xl border-4 border-[#1F2933] bg-white shadow-lg">
                      <div className="flex h-5 items-center justify-between bg-black px-3 text-[9px] font-bold text-white">
                        <span>9:41</span>
                        <span>5G</span>
                      </div>
                      <LiveStorefrontBarPreview form={form} isMobile />
                      <div className="flex h-9 items-center justify-between border-b border-[#EAECF0] px-3">
                        <span className="text-[11px] font-black text-[#ED3500]">1HandIndia</span>
                        <div className="h-3 w-8 rounded bg-gray-200" />
                      </div>
                      <div className="h-24 bg-gray-50 p-2 text-center text-[10px] text-gray-400">
                        Storefront Hero Banner Area
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </AdminPanel>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Live Preview Components & Styling Helpers
// ─────────────────────────────────────────────────────────────────────────────

function LiveSellerBannerPreview({ form }: { form: AnnouncementFormData }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-center">
        <p className="text-xs font-bold text-[#64748B]">Notice was dismissed by the seller.</p>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="mt-2 text-xs font-bold text-[#1E40AF] hover:underline"
        >
          Reset Preview (Show again)
        </button>
      </div>
    );
  }

  const { containerClasses, iconClasses, titleColor, bodyColor, linkColor, customStyle } =
    resolveBannerTheme(form.tone, form.backgroundColor, form.textColor);

  return (
    <div
      style={customStyle}
      className={`relative overflow-hidden rounded-xl border p-4 text-xs transition sm:p-5 ${containerClasses}`}
    >
      <div className="flex items-start gap-3.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconClasses}`}>
          {getToneIcon(form.tone, form.targetAudience)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${titleColor}`}>
            {form.title || "Your Announcement Headline"}
          </p>
          {form.description ? (
            <p className={`mt-1 leading-relaxed ${bodyColor}`}>
              {form.description}
            </p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {form.primaryCtaLabel ? (
              <span className={`font-bold underline underline-offset-4 cursor-pointer ${linkColor}`}>
                {form.primaryCtaLabel}
              </span>
            ) : null}
            {form.primaryCtaLabel && form.secondaryCtaLabel ? (
              <span className="text-[#94A3B8]">•</span>
            ) : null}
            {form.secondaryCtaLabel ? (
              <span className={`font-bold hover:underline cursor-pointer ${linkColor}`}>
                {form.secondaryCtaLabel}
              </span>
            ) : null}
          </div>
        </div>
        {form.isDismissible ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[#64748B] transition hover:text-[#1E293B]"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LiveStorefrontBarPreview({
  form,
  isMobile,
}: {
  form: AnnouncementFormData;
  isMobile?: boolean;
}) {
  const bg = form.tone === "CUSTOM" && form.backgroundColor ? form.backgroundColor : "#163B5C";
  const fg = form.tone === "CUSTOM" && form.textColor ? form.textColor : "#FFFFFF";

  return (
    <div
      style={{ backgroundColor: bg, color: fg }}
      className={`flex items-center justify-center text-center font-semibold transition ${
        isMobile ? "min-h-[28px] p-1.5 text-[9px] leading-tight" : "min-h-[32px] px-4 text-xs"
      }`}
    >
      <span>{form.title || "Storefront announcement ticker message..."}</span>
      {form.primaryCtaLabel ? (
        <span className="ml-2 underline font-bold">{form.primaryCtaLabel}</span>
      ) : null}
    </div>
  );
}

function resolveBannerTheme(tone: AnnouncementTone, customBg?: string, customFg?: string) {
  if (tone === "WARNING") {
    return {
      containerClasses: "border-[#FDE68A] bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7]/40 to-[#FFFBEB]",
      iconClasses: "bg-[#FEF3C7] text-[#D97706]",
      titleColor: "text-[#92400E]",
      bodyColor: "text-[#B45309]",
      linkColor: "text-[#D97706]",
      customStyle: {},
    };
  }
  if (tone === "SUCCESS") {
    return {
      containerClasses: "border-[#A7F3D0] bg-gradient-to-r from-[#ECFDF5] via-[#D1FAE5]/40 to-[#ECFDF5]",
      iconClasses: "bg-[#D1FAE5] text-[#059669]",
      titleColor: "text-[#065F46]",
      bodyColor: "text-[#047857]",
      linkColor: "text-[#059669]",
      customStyle: {},
    };
  }
  if (tone === "BRAND") {
    return {
      containerClasses: "border-[#FFD5CC] bg-gradient-to-r from-[#FFF4F0] via-[#FFEBE5]/60 to-[#FFF4F0]",
      iconClasses: "bg-[#FFE6E0] text-[#ED3500]",
      titleColor: "text-[#992300]",
      bodyColor: "text-[#C22C00]",
      linkColor: "text-[#ED3500]",
      customStyle: {},
    };
  }
  if (tone === "CUSTOM" && customBg) {
    return {
      containerClasses: "border-black/10",
      iconClasses: "bg-black/10 text-current",
      titleColor: "text-current font-black",
      bodyColor: "text-current opacity-90",
      linkColor: "text-current underline",
      customStyle: { backgroundColor: customBg, color: customFg || "#FFFFFF" },
    };
  }
  // INFO default
  return {
    containerClasses: "border-[#E0EAFF] bg-gradient-to-r from-[#EFF4FF] via-[#F5F8FF] to-[#EFF8FF]",
    iconClasses: "bg-[#DBEAFE] text-[#1D4ED8]",
    titleColor: "text-[#1E3A8A]",
    bodyColor: "text-[#1E40AF]",
    linkColor: "text-[#1D4ED8]",
    customStyle: {},
  };
}

function getTonePillClasses(tone: AnnouncementTone | string) {
  if (tone === "WARNING") return "bg-[#FEF3C7] text-[#D97706]";
  if (tone === "SUCCESS") return "bg-[#D1FAE5] text-[#059669]";
  if (tone === "BRAND") return "bg-[#FFE6E0] text-[#ED3500]";
  if (tone === "CUSTOM") return "bg-gray-100 text-gray-700";
  return "bg-[#DBEAFE] text-[#1D4ED8]";
}

function getToneIcon(tone: AnnouncementTone | string, audience?: AnnouncementAudience | string) {
  if (tone === "WARNING") return <AlertTriangle className="h-4 w-4" />;
  if (tone === "SUCCESS") return <CheckCircle2 className="h-4 w-4" />;
  if (tone === "BRAND") return <Megaphone className="h-4 w-4" />;
  if (audience === "STOREFRONT") return <Sparkles className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

function AudienceBadge({ audience }: { audience: string }) {
  if (audience === "SELLER_DASHBOARD") {
    return (
      <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-bold text-[#3538CD]">
        Seller Hub
      </span>
    );
  }
  if (audience === "STOREFRONT") {
    return (
      <span className="rounded-full bg-[#FFF4F0] px-2 py-0.5 text-[10px] font-bold text-[#ED3500]">
        Storefront Bar
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[10px] font-bold text-[#344054]">
      All Portals
    </span>
  );
}

function ToneBadge({ tone }: { tone: string }) {
  if (tone === "WARNING") {
    return <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B54708]">Warning</span>;
  }
  if (tone === "SUCCESS") {
    return <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#027A48]">Success</span>;
  }
  if (tone === "BRAND") {
    return <span className="rounded-full bg-[#FFF4F0] px-2 py-0.5 text-[10px] font-bold text-[#ED3500]">Brand</span>;
  }
  if (tone === "CUSTOM") {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">Custom</span>;
  }
  return <span className="rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[10px] font-bold text-[#175CD3]">Info</span>;
}
