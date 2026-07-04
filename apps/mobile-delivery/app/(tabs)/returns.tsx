import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Field, Header, QueryState, Screen, SelectField, StatusChip, formatPaise, humanize } from "../../src/components/screen";
import { addressLine } from "../../src/features/delivery/delivery-api";
import { listDeliveryReturns, type ReturnDetail } from "../../src/features/delivery/returns-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

const assignmentStatuses = ["", "ASSIGNED", "ACCEPTED"];

export default function DeliveryReturnsScreen() {
  const auth = useMobileDeliveryAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const returnsQuery = useQuery({
    queryKey: ["delivery-returns", auth.authKey, submittedSearch, assignmentStatus],
    queryFn: () => listDeliveryReturns(auth.authHeaders, { search: submittedSearch, assignmentStatus, limit: 40 }),
    enabled: auth.enabled,
  });
  const pickups = returnsQuery.data?.items ?? [];

  return (
    <Screen>
      <Header title="Return pickups" subtitle="Accept customer pickups and close seller-store receipt proof references." />
      <View style={{ gap: 12 }}>
        <Field label="Search return" value={search} onChangeText={setSearch} placeholder="Return or order number" />
        <Button title="Search" onPress={() => setSubmittedSearch(search.trim())} />
        <SelectField
          label="Assignment"
          selectedValue={assignmentStatus}
          onSelect={setAssignmentStatus}
          options={assignmentStatuses.map((status) => ({ value: status, label: status ? humanize(status) : "All assignments" }))}
        />
      </View>
      <QueryState loading={returnsQuery.isLoading} error={returnsQuery.error} onRetry={() => void returnsQuery.refetch()} />
      {!returnsQuery.isLoading && pickups.length === 0 ? (
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>Assigned return pickups will appear here.</Text>
      ) : null}
      {pickups.map((pickup) => (
        <ReturnCard key={pickup.id} pickup={pickup} />
      ))}
    </Screen>
  );
}

function ReturnCard({ pickup }: { pickup: ReturnDetail }) {
  const firstShipment = pickup.reverseShipments[0];
  const allAccepted = pickup.reverseShipments.every((shipment) => shipment.assignmentStatus === "ACCEPTED");
  const sellerCount = new Set(pickup.reverseShipments.map((shipment) => shipment.sellerId)).size;

  return (
    <Link href={`/returns/${encodeURIComponent(pickup.requestNumber)}` as never} asChild>
      <Pressable style={{ backgroundColor: "#FFFFFF", borderColor: "#F3E7E2", borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>{pickup.requestNumber}</Text>
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>
          Order {pickup.order.orderNumber} / {pickup.totalQuantity} item{pickup.totalQuantity === 1 ? "" : "s"}
        </Text>
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>
          Pickup: {addressLine(pickup.pickupAddress) || pickup.customer?.name || "Customer address"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusChip label={allAccepted ? "Accepted" : humanize(firstShipment?.assignmentStatus ?? "ASSIGNED")} tone={allAccepted ? "success" : "warning"} />
          <StatusChip label={humanize(firstShipment?.status ?? "REQUESTED")} tone={firstShipment?.status === "RECEIVED" ? "success" : "warning"} />
          <StatusChip label={`${sellerCount} seller package${sellerCount === 1 ? "" : "s"}`} tone="info" />
        </View>
        <Text style={{ color: "#123A5A", fontWeight: "900" }}>{formatPaise(pickup.requestedAmountPaise, pickup.currency)}</Text>
      </Pressable>
    </Link>
  );
}
