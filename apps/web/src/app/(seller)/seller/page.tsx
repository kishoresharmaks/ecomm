import type { Metadata } from "next";
import { SellerDashboardClient } from "@/components/seller/seller-dashboard-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export const metadata: Metadata = {
  title: { absolute: "Seller operations dashboard | 1HandIndia" },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default function SellerDashboardPage() {
  return (
    <SellerWorkspaceShell title="Operations dashboard" description="Track store readiness, orders, catalogue health, B2B demand, and low-stock tasks.">
      <SellerDashboardClient />
    </SellerWorkspaceShell>
  );
}
