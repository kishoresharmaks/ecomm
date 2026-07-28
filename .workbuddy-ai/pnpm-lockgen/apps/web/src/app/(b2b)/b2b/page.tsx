import type { Metadata } from "next";
import { B2BDashboardClient } from "@/components/b2b/b2b-dashboard-client";

export const metadata: Metadata = {
  title: { absolute: "Business buying workspace | 1HandIndia" },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default function B2BDashboardPage() {
  return <B2BDashboardClient />;
}
