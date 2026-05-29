"use client";

import { Download, FileText } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { downloadAdminStatement, listStatements, saveDownload } from "@/lib/admin-finance-api";
import { formatMoney } from "@/lib/storefront-api";
import { FinanceMetric, FinancePageHeader, FinancePanel, FinanceState, FinanceStatus } from "./finance-ui";

export function AdminStatementsClient() {
  const auth = useAdminAuth();
  const statementsQuery = useQuery({
    queryKey: ["admin-finance-statements", auth.authHeaders],
    queryFn: () => listStatements(auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const download = useMutation({
    mutationFn: ({ statementId, format }: { statementId: string; format: "csv" | "pdf" }) => downloadAdminStatement(auth.authHeaders, statementId, format),
    onSuccess: saveDownload
  });
  const statements = statementsQuery.data?.items ?? [];
  const totalNet = statements.reduce((total, statement) => total + statement.netPayablePaise, 0);

  return (
    <div className="grid gap-5">
      <FinancePageHeader title="Seller statements" description="Download payout-linked seller statements as CSV or PDF for accounting and seller communication." />
      <div className="grid gap-4 md:grid-cols-3">
        <FinanceMetric label="Statements" value={statements.length} note="Current result set" />
        <FinanceMetric label="Statement value" value={formatMoney(totalNet)} note="Net payable represented" />
        <FinanceMetric label="Formats" value="CSV + PDF" note="Generated from finance ledger data" />
      </div>
      <FinanceState loading={statementsQuery.isLoading} error={statementsQuery.error} onRetry={() => void statementsQuery.refetch()} />
      <div className="grid gap-4">
        {statements.map((statement) => (
          <FinancePanel key={statement.id}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-[#1F2933]">{statement.statementNumber}</h3>
                    <FinanceStatus status={statement.status} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {statement.seller?.storeName ?? statement.sellerId} / {statement.payout?.payoutNumber ?? "No payout"}
                  </p>
                  <p className="mt-2 text-xl font-black text-[#163B5C]">{formatMoney(statement.netPayablePaise)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => download.mutate({ statementId: statement.id, format: "csv" })}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
                <Button type="button" size="sm" onClick={() => download.mutate({ statementId: statement.id, format: "pdf" })}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  PDF
                </Button>
              </div>
            </div>
          </FinancePanel>
        ))}
      </div>
      {!statementsQuery.isLoading && statements.length === 0 ? <FinanceState empty="No seller statements generated yet" /> : null}
    </div>
  );
}

