import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  Toast,
} from "../../src/components/screen";
import {
  getSellerFinanceReport,
  getSellerInventoryReport,
  getSellerReturnsReport,
  getSellerSalesReport,
  type SellerFinanceReport,
  type SellerInventoryReport,
  type SellerReturnsReport,
  type SellerSalesReport,
} from "../../src/features/seller/seller-api";
import {
  sellerPortalReportUrl,
  sellerReportDateQuery,
  type SellerReportPeriod,
  type SellerReportType,
} from "../../src/features/seller/report-navigation";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

const REPORT_OPTIONS = [
  { label: "Sales", value: "sales" },
  { label: "Inventory", value: "inventory" },
  { label: "Finance", value: "finance" },
  { label: "Returns", value: "returns" },
  { label: "GST reports", value: "tax" },
];

const PERIOD_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "This month", value: "month" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
];

export default function SellerReportsScreen() {
  const auth = useMobileSellerAuth();
  const [reportType, setReportType] = useState<SellerReportType>("sales");
  const [period, setPeriod] = useState<SellerReportPeriod>("month");
  const [portalTarget, setPortalTarget] = useState<SellerReportType | "tax" | null>(null);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const dateQuery = useMemo(() => sellerReportDateQuery(period), [period]);

  const salesQuery = useQuery({
    queryKey: ["seller-report", "sales", auth.authKey, dateQuery],
    queryFn: () => getSellerSalesReport(auth.authHeaders, dateQuery),
    enabled: auth.enabled && reportType === "sales",
    placeholderData: keepPreviousData,
  });
  const inventoryQuery = useQuery({
    queryKey: ["seller-report", "inventory", auth.authKey, dateQuery],
    queryFn: () => getSellerInventoryReport(auth.authHeaders, dateQuery),
    enabled: auth.enabled && reportType === "inventory",
    placeholderData: keepPreviousData,
  });
  const financeQuery = useQuery({
    queryKey: ["seller-report", "finance", auth.authKey, dateQuery],
    queryFn: () => getSellerFinanceReport(auth.authHeaders, dateQuery),
    enabled: auth.enabled && reportType === "finance",
    placeholderData: keepPreviousData,
  });
  const returnsQuery = useQuery({
    queryKey: ["seller-report", "returns", auth.authKey, dateQuery],
    queryFn: () => getSellerReturnsReport(auth.authHeaders, dateQuery),
    enabled: auth.enabled && reportType === "returns",
    placeholderData: keepPreviousData,
  });

  const activeQuery = {
    sales: salesQuery,
    inventory: inventoryQuery,
    finance: financeQuery,
    returns: returnsQuery,
  }[reportType];

  if (!auth.enabled) {
    return <LoadingState message="Preparing reports..." />;
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshing={activeQuery.isRefetching}
      onRefresh={() => void activeQuery.refetch()}
    >
      <Header title="Reports" subtitle="Review seller performance here. Downloads and GST compliance remain in 1HandIndia Seller Hub." />
      <Card>
        <SelectField
          label="Report"
          options={REPORT_OPTIONS}
          selectedValue={reportType}
          onSelect={(value) => {
            if (value === "tax") {
              setPortalTarget("tax");
            } else {
              setReportType(value as SellerReportType);
            }
          }}
        />
        <SelectField
          label="Period"
          options={PERIOD_OPTIONS}
          selectedValue={period}
          onSelect={(value) => setPeriod(value as SellerReportPeriod)}
        />
        <Button title="Open export in Seller Hub" tone="secondary" onPress={() => setPortalTarget(reportType)} />
      </Card>

      {activeQuery.isLoading ? <LoadingState message={`Loading ${reportType} report...`} /> : null}
      {activeQuery.isFetching && !activeQuery.isLoading ? (
        <Text style={styles.updating}>Updating {reportLabel(reportType).toLowerCase()} report...</Text>
      ) : null}
      {activeQuery.isError ? (
        <QueryErrorState
          title={`${reportLabel(reportType)} report could not be loaded`}
          message={activeQuery.error instanceof Error ? activeQuery.error.message : undefined}
          onRetry={() => void activeQuery.refetch()}
          retrying={activeQuery.isFetching}
        />
      ) : null}
      {!activeQuery.isLoading && !activeQuery.isError ? (
        <>
          {reportType === "sales" ? <SalesReport report={salesQuery.data} /> : null}
          {reportType === "inventory" ? <InventoryReport report={inventoryQuery.data} /> : null}
          {reportType === "finance" ? <FinanceReport report={financeQuery.data} /> : null}
          {reportType === "returns" ? <ReturnsReport report={returnsQuery.data} /> : null}
        </>
      ) : null}

      <ConfirmDialog
        visible={portalTarget !== null}
        title={portalTarget === "tax" ? "Open GST reports in Seller Hub?" : "Open report export in Seller Hub?"}
        message={
          portalTarget === "tax"
            ? "GST documents, GSTR exports and filing controls are available on the web. Sign in with the same seller account and use Reports > Tax & GST."
            : "Report downloads are available in the web Seller Hub. Sign in with the same seller account to continue."
        }
        cancelLabel="Not now"
        confirmLabel="Open Seller Hub"
        onCancel={() => setPortalTarget(null)}
        onConfirm={() => void openSellerHub()}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type="error"
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );

  async function openSellerHub() {
    const target = portalTarget;
    setPortalTarget(null);
    if (!target) return;
    try {
      await WebBrowser.openBrowserAsync(sellerPortalReportUrl(target));
    } catch {
      setToast({
        visible: true,
        message: "Seller Hub could not be opened. Tap the Seller Hub action to retry.",
      });
    }
  }
}

function SalesReport({ report }: { report: SellerSalesReport | undefined }) {
  if (!report?.summary.orderCount && !report?.recentOrders.length) {
    return <EmptyState title="No sales in this period" message="Orders and sales totals will appear here." />;
  }
  const currency = report.currency ?? "INR";
  return (
    <>
      <MetricGrid
        items={[
          ["Gross sales", formatMoney(report.summary.totalSalesPaise, currency)],
          ["Net sales", formatMoney(report.summary.netSalesPaise, currency)],
          ["Commission", formatMoney(report.summary.commissionPaise, currency)],
          ["Platform fee", formatMoney(report.summary.platformFeePaise, currency)],
          ["Orders", String(report.summary.orderCount)],
          ["Low stock", String(report.summary.lowStockCount)],
        ]}
      />
      <ListCard
        title="Recent orders"
        rows={report.recentOrders.map((item) => ({
          id: item.id,
          title: item.order.orderNumber,
          detail: `${formatMoney(item.sellerSubtotalPaise, item.order.currency ?? "INR")} - ${displayStatus(item.sellerStatus)}`,
        }))}
      />
      <ListCard
        title="Low-stock products"
        rows={report.lowStockProducts.map((item) => ({
          id: item.id,
          title: item.product.name,
          detail: `${item.stockQuantity ?? 0} units remaining`,
        }))}
      />
    </>
  );
}

function InventoryReport({ report }: { report: SellerInventoryReport | undefined }) {
  if (!report?.summary.productCount && !report?.variants.length) {
    return <EmptyState title="No inventory data" message="Product and stock information will appear here." />;
  }
  const currency = report.currency ?? "INR";
  return (
    <>
      <MetricGrid
        items={[
          ["Products", String(report.summary.productCount)],
          ["Active products", String(report.summary.activeProductCount)],
          ["Variants", String(report.summary.variantCount)],
          ["Low stock", String(report.summary.lowStockCount)],
        ]}
      />
      <ListCard
        title="Low-stock variants"
        rows={report.lowStockVariants.map((item) => ({
          id: item.id,
          title: `${item.product.name}${item.variantName ? ` - ${item.variantName}` : ""}`,
          detail: `${item.stockQuantity} units${item.sku ? ` - SKU ${item.sku}` : ""}`,
        }))}
      />
      <ListCard
        title="Top-selling products"
        rows={report.topSoldItems.map((item) => ({
          id: item.productId,
          title: item.productName,
          detail: `${item.quantitySold} sold - ${formatMoney(item.revenuePaise, currency)}`,
        }))}
      />
    </>
  );
}

function FinanceReport({ report }: { report: SellerFinanceReport | undefined }) {
  if (!report?.summary.orderCount && !report?.recentPayouts.length && !report?.ledgerEntries.length) {
    return <EmptyState title="No finance activity" message="Fees, payout eligibility and ledger activity will appear here." />;
  }
  const currency = report.currency ?? "INR";
  return (
    <>
      <MetricGrid
        items={[
          ["Gross sales", formatMoney(report.summary.grossSalesPaise, currency)],
          ["Net payable", formatMoney(report.summary.netPayablePaise, currency)],
          ["Eligible payout", formatMoney(report.summary.eligiblePaise, currency)],
          ["Commission", formatMoney(report.summary.commissionPaise, currency)],
          ["Pending payouts", formatMoney(report.summary.pendingPayoutsPaise, currency)],
          ["Paid payouts", formatMoney(report.summary.paidPayoutsPaise, currency)],
        ]}
      />
      <ListCard
        title="Recent payouts"
        rows={report.recentPayouts.map((item) => ({
          id: item.id,
          title: item.payoutNumber,
          detail: `${formatMoney(item.netPayablePaise, item.currency)} - ${displayStatus(item.status)}`,
        }))}
      />
      <ListCard
        title="Ledger activity"
        rows={report.ledgerEntries.map((item) => ({
          id: item.id,
          title: item.description || displayStatus(item.entryType),
          detail: `Credit ${formatMoney(item.creditPaise, item.currency)} - Debit ${formatMoney(item.debitPaise, item.currency)}`,
        }))}
      />
    </>
  );
}

function ReturnsReport({ report }: { report: SellerReturnsReport | undefined }) {
  if (!report?.summary.totalCount && !report?.recentReturns.length) {
    return <EmptyState title="No returns in this period" message="Return requests and refund values will appear here." />;
  }
  const currency = report.currency ?? "INR";
  return (
    <>
      <MetricGrid
        items={[
          ["Requests", String(report.summary.totalCount)],
          ["Items", String(report.summary.itemCount)],
          ["Pending", String(report.summary.pendingCount)],
          ["Approved", String(report.summary.approvedCount)],
          ["Requested value", formatMoney(report.summary.requestedAmountPaise, currency)],
          ["Approved value", formatMoney(report.summary.approvedAmountPaise, currency)],
        ]}
      />
      <ListCard
        title="Status breakdown"
        rows={report.byStatus.map((item) => ({
          id: item.status,
          title: displayStatus(item.status),
          detail: `${item.count} requests - ${formatMoney(item.approvedAmountPaise, currency)} approved`,
        }))}
      />
      <ListCard
        title="Recent requests"
        rows={report.recentReturns.map((item) => ({
          id: item.id,
          title: `${item.requestNumber} - ${item.order.orderNumber}`,
          detail: `${displayStatus(item.status)} - ${formatMoney(item.requestedAmountPaise, currency)}`,
        }))}
      />
    </>
  );
}

function MetricGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <Card>
      <View style={styles.metricGrid}>
        {items.map(([label, value]) => (
          <View key={label} style={styles.metric}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ListCard({ title, rows }: { title: string; rows: Array<{ id: string; title: string; detail: string }> }) {
  if (!rows.length) return null;
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.slice(0, 8).map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.rowTitle}>{row.title}</Text>
          <Text style={styles.rowDetail}>{row.detail}</Text>
        </View>
      ))}
    </Card>
  );
}

function reportLabel(type: SellerReportType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function displayStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 78,
    padding: spacing.md,
  },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  metricValue: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  row: { borderTopColor: colors.border, borderTopWidth: 1, gap: 3, paddingTop: spacing.sm },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  rowDetail: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  updating: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
