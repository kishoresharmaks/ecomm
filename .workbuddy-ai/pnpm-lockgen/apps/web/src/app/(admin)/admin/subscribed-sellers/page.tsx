import type { Metadata } from "next";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { SubscribedSellersClient } from "@/components/admin/subscribed-sellers-client";

export const metadata: Metadata = {
  title: "Subscribed Sellers | 1HandIndia",
  description: "Manage active seller subscriptions.",
};

export default function SubscribedSellersPage() {
  return (
    <AdminPortalShell title="Subscribed sellers" description="Manage active seller subscriptions.">
      <SubscribedSellersClient />
    </AdminPortalShell>
  );
}
