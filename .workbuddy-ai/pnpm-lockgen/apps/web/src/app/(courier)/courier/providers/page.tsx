import { CourierProvidersClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierProvidersPage() {
  return (
    <CourierShell
      title="Courier providers"
      description="Manage Shiprocket and courier provider setup, credentials status, webhook readiness, fallback package dimensions, and provider active state."
    >
      <CourierProvidersClient />
    </CourierShell>
  );
}
