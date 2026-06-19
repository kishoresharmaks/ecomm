import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { listB2BEnquiries, type B2BEnquiryStatus } from "../../src/features/seller/seller-api";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  RESPONDED: "info",
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
  "BUYER_CONFIRMED",
  "ADMIN_APPROVED",
  "FINALISED",
  "CLOSED",
  "CANCELLED",
];

export default function B2BEnquiriesScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", auth.authKey, searchQuery, statusFilter],
    queryFn: () =>
      listB2BEnquiries(auth.authHeaders, {
        limit: 30,
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || enquiriesQuery.isLoading) {
    return <LoadingState message="Loading B2B enquiries..." />;
  }

  const filteredEnquiries = enquiriesQuery.data?.items || [];

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Enquiries" subtitle="View and respond to business buyer requests." />
        <Card>
          <Field placeholder="Search enquiries..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
        </Card>
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Status Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {statusFilters.map((status) => (
              <Button
                key={status}
                title={statusLabel(status)}
                tone={statusFilter === status ? "primary" : "secondary"}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ScrollView>
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
