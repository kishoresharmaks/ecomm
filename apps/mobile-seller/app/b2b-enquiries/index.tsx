import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, SelectField, StatusChip } from "../../src/components/screen";
import { listB2BEnquiries, type B2BEnquiryStatus } from "../../src/features/seller/seller-api";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  RESPONDED: "info",
  NEGOTIATING: "info",
  BUYER_CONFIRMED: "info",
  ADMIN_APPROVED: "success",
  FINALISED: "success",
  CLOSED: "danger",
  CANCELLED: "danger",
};

const statusFilters: Array<B2BEnquiryStatus | "ALL"> = [
  "ALL",
  "SUBMITTED",
  "IN_REVIEW",
  "RESPONDED",
  "NEGOTIATING",
  "BUYER_CONFIRMED",
  "ADMIN_APPROVED",
  "FINALISED",
  "CLOSED",
  "CANCELLED",
];

export default function B2BEnquiriesScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", auth.authKey, submittedSearch, statusFilter, page],
    queryFn: () =>
      listB2BEnquiries(auth.authHeaders, {
        page,
        limit: 30,
        ...(submittedSearch ? { search: submittedSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || enquiriesQuery.isLoading) {
    return <LoadingState message="Loading B2B enquiries..." />;
  }

  if (enquiriesQuery.isError) {
    return (
      <Screen>
        <QueryErrorState
          title="B2B enquiries could not be loaded"
          message={enquiriesQuery.error instanceof Error ? enquiriesQuery.error.message : undefined}
          onRetry={() => void enquiriesQuery.refetch()}
          retrying={enquiriesQuery.isFetching}
        />
      </Screen>
    );
  }

  const filteredEnquiries = enquiriesQuery.data?.items || [];
  const totalPages = Math.max(1, Math.ceil((enquiriesQuery.data?.total ?? 0) / (enquiriesQuery.data?.limit ?? 30)));

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Enquiries" subtitle="View and respond to business buyer requests." />
        <Card>
          <Field
            label="Search enquiries"
            placeholder="Buyer, product, or enquiry reference"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              setPage(1);
              setSubmittedSearch(searchQuery.trim());
            }}
          />
          <Button
            title="Apply search"
            tone="secondary"
            onPress={() => {
              setPage(1);
              setSubmittedSearch(searchQuery.trim());
            }}
          />
        </Card>
        <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>
          Showing {filteredEnquiries.length} of {enquiriesQuery.data?.total ?? 0} enquiries
        </Text>
        <Card>
          <SelectField
            label="Status filter"
            selectedValue={statusFilter}
            options={statusFilters.map((status) => ({ label: statusLabel(status), value: status }))}
            onSelect={(status) => {
              setPage(1);
              setStatusFilter(status);
            }}
          />
        </Card>
        {filteredEnquiries.length ? (
          filteredEnquiries.map((enquiry) => (
            <Card key={enquiry.id}>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>
                {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General B2B enquiry"}
              </Text>
              <StatusChip label={statusLabel(enquiry.status)} tone={statusTones[enquiry.status] || "info"} />
              <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600", marginTop: 4 }}>
                {enquiry.businessBuyer?.companyName ?? "Business buyer"}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {enquiry.quantity ?? 0} unit(s) - {new Date(enquiry.createdAt).toLocaleDateString()}
              </Text>
              {(enquiry.responses?.length ?? 0) > 0 ? (
                <Text style={{ color: "#059669", fontSize: 12, fontWeight: "600", marginTop: 4 }}>Responded</Text>
              ) : null}
              <Button title="View details" onPress={() => router.push(`/b2b-enquiries/${encodeURIComponent(enquiry.id)}` as Href)} />
            </Card>
          ))
        ) : (
          <EmptyState title="No Enquiries" message="No B2B enquiries found" />
        )}
        {totalPages > 1 ? (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center", marginBottom: 8 }}>Page {page} of {totalPages}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Previous" tone="secondary" style={{ flex: 1 }} disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
              <Button title="Next" tone="secondary" style={{ flex: 1 }} disabled={page >= totalPages} onPress={() => setPage((current) => Math.min(totalPages, current + 1))} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function statusLabel(status: string) {
  if (status === "ALL") {
    return "All";
  }
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
