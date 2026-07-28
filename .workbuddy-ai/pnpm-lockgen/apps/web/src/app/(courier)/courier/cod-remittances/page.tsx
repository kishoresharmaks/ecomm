import { CourierCodRemittancesClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierCodRemittancesPage() {
  return (
    <CourierShell
      title="Courier COD remittances"
      description="Record courier COD remittance details for finance handoff. Final payment verification remains with Finance/Admin."
    >
      <CourierCodRemittancesClient />
    </CourierShell>
  );
}
