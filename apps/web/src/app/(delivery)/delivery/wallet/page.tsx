import { DeliveryWalletClient } from "@/components/delivery/delivery-wallet-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryWalletPage() {
  return (
    <DeliveryShell
      title="Delivery wallet"
      description="Track local delivery partner earnings, wallet balance, and manual payout adjustments."
    >
      <DeliveryWalletClient />
    </DeliveryShell>
  );
}
