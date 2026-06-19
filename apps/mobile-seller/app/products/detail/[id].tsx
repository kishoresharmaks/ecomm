import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useMobileSellerAuth } from "../../../src/auth/mobile-seller-auth-context";
import { Card, Header, LoadingState, Screen, StatusChip } from "../../../src/components/screen";
import { getSellerProduct } from "../../../src/features/seller/seller-api";
import { formatMoney } from "../../../src/lib/money";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const decodedId = decodeURIComponent(id ?? "");
  const auth = useMobileSellerAuth();

  const productQuery = useQuery({
    queryKey: ["seller-product", auth.authKey, decodedId],
    queryFn: () => getSellerProduct(auth.authHeaders, decodedId),
    enabled: auth.enabled && Boolean(decodedId),
  });

  if (!auth.enabled || productQuery.isLoading) {
    return <LoadingState message="Loading product..." />;
  }

  const product = productQuery.data;
  const variant = product?.variants?.[0];

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title={product?.name ?? "Product"} subtitle="View product details, pricing, and stock information." />
        <Card>
          <StatusChip label={`${product?.status ?? "DRAFT"} / ${product?.approvalStatus ?? "PENDING"}`} />
          <Text style={{ color: "#6B7280" }}>Category: {product?.category?.name ?? "Uncategorized"}</Text>
          <Text style={{ color: "#6B7280" }}>SKU: {variant?.sku ?? "Not set"}</Text>
        </Card>

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Description</Text>
          <Text style={{ color: "#6B7280", lineHeight: 20 }}>{product?.description ?? "No description"}</Text>
        </Card>

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Pricing & Stock</Text>
          <Text style={{ color: "#111827", fontSize: 22, fontWeight: "900" }}>Price: {formatMoney(variant?.pricePaise)}</Text>
          {variant?.mrpPaise ? <Text style={{ color: "#6B7280" }}>MRP: {formatMoney(variant.mrpPaise)}</Text> : null}
          <Text style={{ color: "#6B7280" }}>Stock: {variant?.stockQuantity ?? 0}</Text>
          <Text style={{ color: "#6B7280" }}>Variant: {variant?.variantName ?? "Default"}</Text>
        </Card>

        {variant && (variant.packageWeightGrams || variant.packageLengthCm || variant.packageBreadthCm || variant.packageHeightCm) ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Package Dimensions</Text>
            {variant.packageWeightGrams ? <Text style={{ color: "#6B7280" }}>Weight: {variant.packageWeightGrams}g</Text> : null}
            {variant.packageLengthCm ? <Text style={{ color: "#6B7280" }}>Length: {variant.packageLengthCm}cm</Text> : null}
            {variant.packageBreadthCm ? <Text style={{ color: "#6B7280" }}>Breadth: {variant.packageBreadthCm}cm</Text> : null}
            {variant.packageHeightCm ? <Text style={{ color: "#6B7280" }}>Height: {variant.packageHeightCm}cm</Text> : null}
          </Card>
        ) : null}

        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Image Asset</Text>
          <Text style={{ color: "#6B7280" }}>{product?.imageUrl ?? "No image uploaded"}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}