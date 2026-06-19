import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Card, EmptyState, Header, LoadingState, Screen } from "../../src/components/screen";
import { getSellerSalesReport } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

export default function SellerSalesScreen() {
  const auth = useMobileSellerAuth();
  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", auth.authKey],
    queryFn: () => getSellerSalesReport(auth.authHeaders),
    enabled: auth.enabled,
  });

  if (!auth.enabled || reportQuery.isLoading) {
    return <LoadingState message="Loading sales report..." />;
  }

  const report = reportQuery.data;

  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="Sales Report" subtitle="View your sales performance, order metrics, and low-stock alerts." />

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Sales Summary</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>Total Sales</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{formatMoney(report?.summary.totalSalesPaise)}</Text>
            </View>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>Net Sales</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{formatMoney(report?.summary.netSalesPaise)}</Text>
            </View>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>Commission</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{formatMoney(report?.summary.commissionPaise)}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Order Metrics</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>Total Orders</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{report?.summary.orderCount ?? 0}</Text>
            </View>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>Products</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{report?.summary.products ?? 0}</Text>
            </View>
            <View>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>B2B Enquiries</Text>
              <Text style={{ color: "#111827", fontSize: 20, fontWeight: "900" }}>{report?.summary.b2bEnquiries ?? 0}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Stock Alerts</Text>
          <Text style={{ color: report?.summary.lowStockCount ?? 0 > 0 ? "#D64545" : "#22C55E", fontSize: 20, fontWeight: "900" }}>
            {report?.summary.lowStockCount ?? 0} products low on stock
          </Text>
        </Card>

        {report?.lowStockProducts && report.lowStockProducts.length > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Low Stock Products</Text>
            {report.lowStockProducts.map((item) => (
              <Text key={item.id} style={{ color: "#6B7280", fontWeight: "700" }}>
                {item.product.name}: {item.stockQuantity ?? 0} units
              </Text>
            ))}
          </Card>
        ) : null}

        {report?.recentOrders && report.recentOrders.length > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Recent Orders</Text>
            {report.recentOrders.map((split) => (
              <View key={split.id} style={{ marginTop: 8 }}>
                <Text style={{ color: "#111827", fontWeight: "900" }}>{split.order.orderNumber}</Text>
                <Text style={{ color: "#6B7280" }}>
                  {formatMoney(split.sellerSubtotalPaise, split.order.currency ?? "INR")} - {split.sellerStatus}
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState title="No recent orders" message="Completed orders will appear in your sales report." />
        )}
    </Screen>
  );
}