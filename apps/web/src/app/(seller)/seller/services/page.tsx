import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@indihub/ui";
import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerServicesPage() {
  return (
    <SellerWorkspaceShell
      title="Services"
      description="Create and manage service listings, pricing models, visit modes, coverage radius, and approval status."
      actions={
        <Button asChild>
          <Link href="/seller/services/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add service
          </Link>
        </Button>
      }
    >
      <SellerServicesClient mode="list" />
    </SellerWorkspaceShell>
  );
}
