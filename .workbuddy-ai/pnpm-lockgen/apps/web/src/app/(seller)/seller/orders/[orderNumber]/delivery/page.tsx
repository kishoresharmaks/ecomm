import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";
import { SellerOrderDetailClient } from "@/components/seller/seller-order-detail-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { Button } from "@indihub/ui";

export default async function SellerOrderDeliveryPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <SellerWorkspaceShell
      title={`Logistics view ${orderNumber}`}
      description="Review route, assignment, tracking, package readiness, and courier label status for this seller package."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={`/seller/orders/${encodeURIComponent(orderNumber)}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Order detail
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-lg border border-[#D8E2EA] bg-[#FFF8F5] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#ED3500] text-white">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">
                Delivery workflow
              </p>
              <h2 className="mt-1 text-xl font-black text-[#1F2933]">Automation-first logistics</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                Sellers prepare the package and download labels. Dispatch, tracking, proof, COD,
                and delivery completion are handled by courier, delivery partner, or admin
                operations.
              </p>
            </div>
          </div>
        </div>

        <SellerOrderDetailClient orderNumber={orderNumber} initialSection="delivery" />
      </div>
    </SellerWorkspaceShell>
  );
}
