"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, X } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminActionMenu, AdminPanel, AdminStatusNotice } from "@/components/admin/admin-ux";
import { IndihubApiError, indihubFetch } from "@/lib/api";

type SellerApprovalStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
type SellerStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED";
type SellerType = "MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR";

type PendingSeller = {
  id: string;
  sellerType: SellerType;
  storeName: string;
  status: SellerStatus;
  approvalStatus: SellerApprovalStatus;
  createdAt: string;
  user?: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  } | null;
  profile?: {
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  } | null;
  addresses?: Array<{
    city: string;
    area?: string | null;
    state: string;
    pincode: string;
  }>;
};

export function SellerApprovalsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["admin-pending-sellers", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () => indihubFetch<PendingSeller[]>("/api/admin/sellers/pending", undefined, auth.authHeaders)
  });

  const approvalMutation = useMutation({
    mutationFn: ({ sellerId, decision }: { sellerId: string; decision: "APPROVE" | "REJECT" }) =>
      indihubFetch<PendingSeller>(
        `/api/admin/sellers/${sellerId}/approval`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision,
            note: decision === "APPROVE" ? "Approved from 1HandIndia admin portal." : "Rejected from 1HandIndia admin portal."
          })
        },
        auth.authHeaders
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  });

  const sellers = pendingQuery.data ?? [];

  return (
    <>
      <AdminPanel className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Pending registrations</h2>
              <p className="mt-1 text-sm text-[#667085]">Marketplace seller, hyperlocal store, and wholesale distributor records awaiting moderation.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => pendingQuery.refetch()} disabled={pendingQuery.isFetching}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
      </AdminPanel>

          {pendingQuery.error ? (
            <StatusPanel
              tone="danger"
              message={pendingQuery.error instanceof Error ? pendingQuery.error.message : "Unable to load seller approvals."}
              status={pendingQuery.error instanceof IndihubApiError ? pendingQuery.error.status : undefined}
            />
          ) : null}

          {approvalMutation.error ? (
            <StatusPanel
              tone="danger"
              message={approvalMutation.error instanceof Error ? approvalMutation.error.message : "Approval update failed."}
              status={approvalMutation.error instanceof IndihubApiError ? approvalMutation.error.status : undefined}
            />
          ) : null}

          <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
            <div className="grid grid-cols-[1.4fr_0.9fr_1fr_0.8fr_1fr] gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#163B5C] max-lg:hidden">
              <span>Store</span>
              <span>Type</span>
              <span>Location</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {pendingQuery.isLoading ? (
              <div className="p-5 text-sm font-semibold text-[#667085]">Loading pending sellers...</div>
            ) : null}

            {!pendingQuery.isLoading && sellers.length === 0 ? (
              <div className="p-5 text-sm font-semibold text-[#667085]">No pending seller registrations.</div>
            ) : null}

            {sellers.map((seller) => (
              <SellerRow
                key={seller.id}
                seller={seller}
                busy={approvalMutation.isPending}
                onApprove={() => approvalMutation.mutate({ sellerId: seller.id, decision: "APPROVE" })}
                onReject={() => approvalMutation.mutate({ sellerId: seller.id, decision: "REJECT" })}
              />
            ))}
          </div>
    </>
  );
}

function SellerRow({
  seller,
  busy,
  onApprove,
  onReject
}: {
  seller: PendingSeller;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const address = seller.addresses?.[0];
  const location = [address?.area, address?.city, address?.state].filter(Boolean).join(", ") || "Not provided";

  return (
    <div className="grid gap-3 border-b border-[#E5E7EB] px-5 py-4 text-sm last:border-b-0 lg:grid-cols-[1.4fr_0.9fr_1fr_0.8fr_1fr] lg:items-center">
      <div>
        <p className="font-black text-[#1F2933]">{seller.storeName}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">{seller.profile?.contactEmail ?? seller.user?.email ?? "No email"}</p>
      </div>
      <p className="font-semibold text-[#667085]">{sellerTypeLabel(seller.sellerType)}</p>
      <p className="font-semibold text-[#667085]">{location}</p>
      <div>
        <StatusBadge tone="warning">{seller.approvalStatus.replace(/_/g, " ")}</StatusBadge>
      </div>
      <AdminActionMenu
        label="Review"
        items={[
          {
            label: "Approve seller",
            description: "Allow seller to continue marketplace operations",
            icon: <Check className="h-4 w-4 text-[#0F8A5F]" aria-hidden="true" />,
            onSelect: onApprove,
            disabled: busy
          },
          {
            label: "Reject seller",
            description: "Keep this registration out of live operations",
            icon: <X className="h-4 w-4 text-[#B42318]" aria-hidden="true" />,
            onSelect: onReject,
            disabled: busy,
            destructive: true
          }
        ]}
      />
    </div>
  );
}

function StatusPanel({
  message,
  tone,
  status
}: {
  message: string;
  tone: "warning" | "danger";
  status?: number | undefined;
}) {
  return <AdminStatusNotice title={tone === "warning" ? "Pending" : "Error"} message={message} tone={tone} status={status} />;
}

function sellerTypeLabel(type: SellerType) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
