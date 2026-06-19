import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, ConfirmDialog, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip } from "../../src/components/screen";
import { archiveSellerProduct, listSellerProducts } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

export default function SellerProductsScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [_statusFilter, _setStatusFilter] = useState<string>("ALL");
  const [archiveProductId, setArchiveProductId] = useState<string | null>(null);
  
  const productsQuery = useQuery({
    queryKey: ["seller-products", auth.authKey, searchQuery, _statusFilter],
    queryFn: () => listSellerProducts(auth.authHeaders, { 
      limit: 30, 
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(_statusFilter !== "ALL" ? { status: _statusFilter } : {}),
    }),
    enabled: auth.enabled,
  });
  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveSellerProduct(auth.authHeaders, productId),
    onSuccess: async () => {
      setArchiveProductId(null);
      await queryClient.invalidateQueries({ queryKey: ["seller-products", auth.authKey] });
    },
  });

  if (!auth.enabled || productsQuery.isLoading) {
    return <LoadingState message="Loading products..." />;
  }

  if (productsQuery.isError) {
    return (
      <Screen contentContainerStyle={{ gap: 16 }}>
        <Header title="Products" subtitle="Manage seller catalogue, approval status, price, and stock." />
        <QueryErrorState
          title="Products could not be loaded"
          message={productsQuery.error instanceof Error ? productsQuery.error.message : undefined}
          onRetry={() => {
            void productsQuery.refetch();
          }}
          retrying={productsQuery.isFetching}
        />
      </Screen>
    );
  }

  const filteredProducts = productsQuery.data?.items || [];

  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="Products" subtitle="Manage seller catalogue, approval status, price, and stock." />
        <Card>
          <Field 
            placeholder="Search products..." 
            value={searchQuery} 
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </Card>
        <Button title="Add product" onPress={() => router.push("/products/new")} />
        {filteredProducts.length ? (
          filteredProducts.map((product) => {
            const variant = product.variants?.[0];
            return (
              <Card key={product.id}>
                <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{product.name}</Text>
                <StatusChip label={`${product.status ?? "DRAFT"} / ${product.approvalStatus ?? "PENDING"}`} />
                <Text style={{ color: "#6B7280" }}>{variant ? `${formatMoney(variant.pricePaise)} - Stock ${variant.stockQuantity ?? 0}` : "No variant summary"}</Text>
                <Button title="View product" tone="secondary" onPress={() => router.push(`/products/detail/${encodeURIComponent(product.id)}`)} />
                <Button title="Edit product" onPress={() => router.push(`/products/${encodeURIComponent(product.id)}`)} />
                <Button title="Archive product" tone="danger" disabled={archiveMutation.isPending} onPress={() => setArchiveProductId(product.id)} />
              </Card>
            );
          })
        ) : (
          <EmptyState title="No products found" message={searchQuery ? "Try a different search term." : "Create your first product with price, stock, category, and uploaded image asset keys."} />
        )}
        <ConfirmDialog
          visible={Boolean(archiveProductId)}
          title="Archive product"
          message="Archive this product? It will leave the active seller catalogue."
          onConfirm={() => {
            if (archiveProductId) {
              archiveMutation.mutate(archiveProductId);
            }
          }}
          onCancel={() => setArchiveProductId(null)}
        />
    </Screen>
  );
}
