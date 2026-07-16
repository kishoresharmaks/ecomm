"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { indihubFetch } from "@/lib/api";
import { AdminPanel, AdminActionMenu, AdminConfirmationDialog } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";

export type CmsAnnouncementRecord = {
  id: string;
  title: string;
  linkUrl: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function AdminCmsAnnouncementsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const announcementsQuery = useQuery({
    queryKey: ["admin-cms-announcements"],
    queryFn: () => indihubFetch<{ items: CmsAnnouncementRecord[] }>("/api/admin/cms/announcements", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => indihubFetch(`/api/admin/cms/announcements/${id}`, { method: "DELETE" }, auth.authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-announcements"] });
      setDeleteConfirmId(null);
    }
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F2933]">Storefront Announcements</h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Manage the sliding announcement bar at the top of the storefront.</p>
        </div>
        <Link href="/admin/cms/announcements/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        </Link>
      </div>

      <AdminPanel>
        <div className="divide-y divide-[#E5E7EB]">
          {announcementsQuery.data?.items.map((item: CmsAnnouncementRecord) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-[#1F2933]">{item.title}</h3>
                  <StatusBadge tone={item.status === "PUBLISHED" ? "success" : "neutral"}>
                    {item.status}
                  </StatusBadge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#667085]">
                  <span>Link: {item.linkUrl || "None"}</span>
                  {item.startsAt && <span>Starts: {new Date(item.startsAt).toLocaleDateString()}</span>}
                  {item.endsAt && <span>Ends: {new Date(item.endsAt).toLocaleDateString()}</span>}
                  <span className="flex items-center gap-1">
                    Colors: 
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.backgroundColor || "#163B5C" }}></span>
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.textColor || "#FFFFFF" }}></span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AdminActionMenu
                  label="Actions"
                  items={[
                    {
                      label: "Edit",
                      icon: <Settings2 className="h-4 w-4 text-[#163B5C]" />,
                      onSelect: () => window.location.assign(`/admin/cms/announcements/${item.id}`)
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4 text-[#D64545]" />,
                      destructive: true,
                      onSelect: () => setDeleteConfirmId(item.id)
                    }
                  ]}
                />
              </div>
            </div>
          ))}
          {announcementsQuery.isLoading && (
            <p className="py-4 text-sm font-semibold text-[#667085]">Loading announcements...</p>
          )}
          {!announcementsQuery.isLoading && announcementsQuery.data?.items.length === 0 && (
            <p className="py-4 text-sm font-semibold text-[#667085]">No announcements found.</p>
          )}
        </div>
      </AdminPanel>

      {deleteConfirmId && (
        <AdminConfirmationDialog
          open={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete announcement"
          description="Are you sure you want to delete this announcement? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => deleteMutation.mutate(deleteConfirmId)}
        />
      )}
    </>
  );
}

export function AdminCmsAnnouncementEditClient({ id }: { id: string }) {
  const auth = useAdminAuth();
  const isNew = id === "new";

  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin-cms-announcements"],
    queryFn: () => indihubFetch<{ items: CmsAnnouncementRecord[] }>(`/api/admin/cms/announcements`, undefined, auth.authHeaders),
    enabled: auth.isAuthenticated && !isNew
  });

  const item = isNew ? null : existing?.items.find((i: CmsAnnouncementRecord) => i.id === id);

  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#163B5C");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Initialize form
  if (!isNew && item && !initialized) {
    setTitle(item.title);
    setLinkUrl(item.linkUrl || "");
    setBackgroundColor(item.backgroundColor || "#163B5C");
    setTextColor(item.textColor || "#FFFFFF");
    setStatus(item.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
    setStartsAt(item.startsAt ? new Date(item.startsAt).toISOString().slice(0,16) : "");
    setEndsAt(item.endsAt ? new Date(item.endsAt).toISOString().slice(0,16) : "");
    setSortOrder(item.sortOrder);
    setInitialized(true);
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => indihubFetch("/api/admin/cms/announcements", {
      method: "POST",
      body: JSON.stringify(payload)
    }, auth.authHeaders),
    onSuccess: () => window.location.assign("/admin/cms/announcements")
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => indihubFetch(`/api/admin/cms/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, auth.authHeaders),
    onSuccess: () => window.location.assign("/admin/cms/announcements")
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      linkUrl: linkUrl || undefined,
      backgroundColor,
      textColor,
      status,
      sortOrder,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
    };
    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminPanel>
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Message / Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                placeholder="e.g. Free delivery on selected local orders above ₹499"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Link URL (Optional)</span>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                placeholder="e.g. /deals or https://..."
              />
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Background Color</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-11 w-11 rounded-md border border-[#D8E2EA] cursor-pointer"
                  />
                  <input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Text Color</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-11 w-11 rounded-md border border-[#D8E2EA] cursor-pointer"
                  />
                  <input
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Start Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">End Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Sort Order</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
            </div>
          </div>
        </AdminPanel>
        
        <div className="flex justify-end gap-3">
          <Link href="/admin/cms/announcements">
            <Button variant="ghost" type="button">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Announcement"}
          </Button>
        </div>
      </form>

      {/* Live Preview Panel */}
      <div className="space-y-6">
        <AdminPanel>
          <div className="mb-4 text-sm font-black text-[#1F2933]">Live Preview (Desktop)</div>
          <div className="w-full h-32 bg-gray-100 rounded-md border border-gray-300 overflow-hidden relative flex flex-col">
            <div className="w-full flex-1 bg-white relative">
               {/* Desktop Browser Chrome Mock */}
               <div className="h-4 bg-gray-200 border-b border-gray-300 flex items-center px-2 gap-1">
                 <div className="w-2 h-2 rounded-full bg-red-400"></div>
                 <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                 <div className="w-2 h-2 rounded-full bg-green-400"></div>
               </div>
               
               {/* Storefront Top Announcement Bar Mock */}
               <div 
                 className="w-full flex items-center justify-center h-8 text-xs font-semibold"
                 style={{ backgroundColor: backgroundColor || "#163B5C", color: textColor || "#FFFFFF" }}
               >
                 {linkUrl ? <span className="hover:underline cursor-pointer">{title || "Your announcement message here..."}</span> : <span>{title || "Your announcement message here..."}</span>}
               </div>
               
               {/* Storefront Header Mock */}
               <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between">
                 <div className="font-bold text-[#ED3500] text-sm">1HandIndia</div>
                 <div className="flex gap-2">
                   <div className="w-16 h-4 bg-gray-100 rounded"></div>
                   <div className="w-16 h-4 bg-gray-100 rounded"></div>
                 </div>
               </div>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel>
          <div className="mb-4 text-sm font-black text-[#1F2933]">Live Preview (Mobile)</div>
          <div className="flex justify-center">
            <div className="w-[280px] h-[500px] bg-white rounded-3xl border-8 border-gray-900 overflow-hidden relative shadow-xl">
               {/* Mobile Status Bar Mock */}
               <div className="h-6 bg-black text-white text-[10px] flex justify-between items-center px-4">
                 <span>9:41</span>
                 <span className="flex gap-1">
                   <div className="w-3 h-2 bg-white rounded-sm"></div>
                 </span>
               </div>
               
               {/* Storefront Top Announcement Bar Mock (Mobile) */}
               <div 
                 className="w-full flex items-center justify-center p-2 text-xs font-semibold text-center leading-tight min-h-[32px]"
                 style={{ backgroundColor: backgroundColor || "#163B5C", color: textColor || "#FFFFFF" }}
               >
                 {linkUrl ? <span className="hover:underline cursor-pointer">{title || "Your announcement message here..."}</span> : <span>{title || "Your announcement message here..."}</span>}
               </div>

               {/* Storefront Header Mock */}
               <div className="h-12 border-b border-gray-200 px-4 flex items-center justify-between">
                 <div className="w-6 h-6 bg-gray-200 rounded"></div>
                 <div className="font-bold text-[#ED3500] text-lg">1HandIndia</div>
                 <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
               </div>
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
