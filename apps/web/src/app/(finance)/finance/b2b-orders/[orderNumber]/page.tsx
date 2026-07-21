import { FinanceB2BOrderDetailClient } from "@/components/finance/b2b-receivables-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default async function FinanceB2BOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return (
    <FinanceShell
      title={`B2B finance ${orderNumber}`}
      description="Review credit exposure, schedules, receivables, payment evidence, allocations, and collection activity."
    >
      <FinanceB2BOrderDetailClient orderNumber={orderNumber} />
    </FinanceShell>
  );
}
