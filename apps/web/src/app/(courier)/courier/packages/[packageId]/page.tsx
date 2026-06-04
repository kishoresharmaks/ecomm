import { CourierPackageDetailClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default async function CourierPackageDetailPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;

  return (
    <CourierShell
      title="Package detail"
      description="Inspect package dimensions, booking snapshots, seller pickup, buyer destination, labels, tracking history, and provider notes."
    >
      <CourierPackageDetailClient packageId={packageId} />
    </CourierShell>
  );
}
