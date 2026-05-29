"use client";

import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "@indihub/ui";
import { DevAuthRole, useDevAuth } from "./dev-auth-context";

const roleLabels: Record<DevAuthRole, string> = {
  admin: "Admin",
  seller: "Seller",
  customer: "Customer",
  businessBuyer: "B2B buyer",
  deliveryPartner: "Delivery partner"
};

export function DevAuthPanel({ role }: { role: DevAuthRole }) {
  const auth = useDevAuth();
  const userId = auth.userIds[role];

  return (
    <div className="mb-5 rounded-lg border border-[#D8E2EA] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-[#1F2933]">{roleLabels[role]} access</p>
              <StatusBadge tone={userId ? "success" : "warning"}>{userId ? "Connected" : "Setup needed"}</StatusBadge>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#667085]">
              Protected {roleLabels[role].toLowerCase()} API requests need a platform user ID in this workspace.
            </p>
          </div>
        </div>
        <label className="flex w-full flex-col gap-1 lg:max-w-xl">
          <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">{roleLabels[role]} user ID</span>
          <input
            value={userId}
            onChange={(event) => {
              auth.setRole(role);
              auth.setUserId(role, event.target.value);
            }}
            placeholder="Paste platform user UUID"
            className="h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
      </div>
    </div>
  );
}
