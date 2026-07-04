import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Header, QueryState, Screen, StatusChip, formatPaise, humanize } from "../../src/components/screen";
import { addressLine, type AddressSnapshot } from "../../src/features/delivery/delivery-api";
import {
  acceptDeliveryReturnPickup,
  getDeliveryReturn,
  recordDeliveryReturnShipmentReceipt,
  rejectDeliveryReturnPickup,
  updateDeliveryReturnPickup,
  type ReturnDetail,
  type ReverseShipmentStatus,
} from "../../src/features/delivery/returns-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

export default function DeliveryReturnDetailScreen() {
  const auth = useMobileDeliveryAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ requestNumber?: string }>();
  const requestNumber = String(params.requestNumber ?? "");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [note, setNote] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [pickupProofReference, setPickupProofReference] = useState("");
  const [receiptProofByShipment, setReceiptProofByShipment] = useState<Record<string, string>>({});
  const [receiverByShipment, setReceiverByShipment] = useState<Record<string, string>>({});

  const returnQuery = useQuery({
    queryKey: ["delivery-return", auth.authKey, requestNumber],
    queryFn: () => getDeliveryReturn(auth.authHeaders, requestNumber),
    enabled: auth.enabled && Boolean(requestNumber),
  });
  const detail = returnQuery.data;

  useEffect(() => {
    if (!detail) return;
    setTrackingReference(detail.reverseShipments[0]?.trackingReference ?? "");
    setPickupProofReference(detail.reverseShipments[0]?.pickupProofReference ?? detail.reverseShipments[0]?.proofReference ?? "");
  }, [detail]);

  const acceptMutation = useMutation({
    mutationFn: () => acceptDeliveryReturnPickup(auth.authHeaders, requestNumber, note.trim() || undefined),
    onSuccess: async () => afterMutation(queryClient, auth.authKey, requestNumber, "Return pickup accepted.", setNotice, setNote),
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Could not accept pickup.", tone: "danger" }),
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectDeliveryReturnPickup(auth.authHeaders, requestNumber, note.trim() || undefined),
    onSuccess: async () => afterMutation(queryClient, auth.authKey, requestNumber, "Return pickup rejected.", setNotice, setNote),
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Could not reject pickup.", tone: "danger" }),
  });
  const pickupMutation = useMutation({
    mutationFn: (status: ReverseShipmentStatus) =>
      updateDeliveryReturnPickup(auth.authHeaders, requestNumber, {
        status,
        trackingReference: trackingReference.trim() || undefined,
        pickupProofReference: pickupProofReference.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: async (_, status) => afterMutation(queryClient, auth.authKey, requestNumber, `${humanize(status)} saved.`, setNotice, setNote),
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Could not update pickup.", tone: "danger" }),
  });
  const receiptMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      recordDeliveryReturnShipmentReceipt(auth.authHeaders, requestNumber, shipmentId, {
        receivedByName: receiverByShipment[shipmentId]?.trim() ?? "",
        receiptProofReference: receiptProofByShipment[shipmentId]?.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => afterMutation(queryClient, auth.authKey, requestNumber, "Seller receipt recorded.", setNotice, setNote),
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Could not record seller receipt.", tone: "danger" }),
  });

  const allAccepted = detail?.reverseShipments.every((shipment) => shipment.assignmentStatus === "ACCEPTED") ?? false;
  const anyPickedOrLater = detail?.reverseShipments.some((shipment) => ["PICKED_UP", "IN_TRANSIT", "RECEIVED"].includes(shipment.status)) ?? false;
  const anyPickedUp = detail?.reverseShipments.some((shipment) => shipment.status === "PICKED_UP") ?? false;
  const allReceived = detail?.reverseShipments.every((shipment) => shipment.status === "RECEIVED") ?? false;

  return (
    <Screen>
      <Button title="Back to returns" tone="secondary" onPress={() => router.back()} />
      <Header title={requestNumber || "Return pickup"} subtitle="Pickup from customer, move package, record seller receipt." />
      <QueryState loading={returnQuery.isLoading} error={returnQuery.error} onRetry={() => void returnQuery.refetch()} />
      {notice ? <NoticeCard notice={notice} /> : null}
      {detail ? (
        <>
          <ReturnSummary detail={detail} allAccepted={allAccepted} allReceived={allReceived} />
          <RouteActions detail={detail} />
          <Card>
            <Text style={sectionTitle}>Pickup actions</Text>
            <Field label="Tracking reference" value={trackingReference} onChangeText={setTrackingReference} placeholder="Return tracking reference" />
            <Field label="Pickup proof reference" value={pickupProofReference} onChangeText={setPickupProofReference} placeholder="Required before picked up" />
            <Field label="Note" value={note} onChangeText={setNote} placeholder="Pickup or handover note" multiline />
            {!allAccepted ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button title="Accept" loading={acceptMutation.isPending} style={{ flex: 1 }} onPress={() => acceptMutation.mutate()} />
                <Button title="Reject" tone="danger" loading={rejectMutation.isPending} style={{ flex: 1 }} onPress={() => rejectMutation.mutate()} />
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  title="Picked up"
                  disabled={anyPickedOrLater || !pickupProofReference.trim()}
                  loading={pickupMutation.isPending && pickupMutation.variables === "PICKED_UP"}
                  style={{ flex: 1 }}
                  onPress={() => pickupMutation.mutate("PICKED_UP")}
                />
                <Button
                  title="In transit"
                  tone="secondary"
                  disabled={!anyPickedUp || allReceived}
                  loading={pickupMutation.isPending && pickupMutation.variables === "IN_TRANSIT"}
                  style={{ flex: 1 }}
                  onPress={() => pickupMutation.mutate("IN_TRANSIT")}
                />
              </View>
            )}
            {allAccepted && !pickupProofReference.trim() && !anyPickedOrLater ? (
              <Text style={dangerText}>Pickup proof reference is required before marking picked up.</Text>
            ) : null}
          </Card>
          <Text style={sectionTitle}>Seller packages</Text>
          {detail.reverseShipments.map((shipment) => {
            const receiver = receiverByShipment[shipment.id]?.trim() ?? "";
            const receiptProof = receiptProofByShipment[shipment.id]?.trim() ?? "";
            const canReceive = shipment.assignmentStatus === "ACCEPTED" && ["PICKED_UP", "IN_TRANSIT"].includes(shipment.status);
            return (
              <Card key={shipment.id}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <StatusChip label={humanize(shipment.status)} tone={shipment.status === "RECEIVED" ? "success" : "warning"} />
                  <StatusChip label={humanize(shipment.assignmentStatus ?? "ASSIGNED")} tone={shipment.assignmentStatus === "ACCEPTED" ? "success" : "warning"} />
                </View>
                <Text style={{ color: "#123A5A", fontSize: 17, fontWeight: "900" }}>{shipment.seller?.storeName ?? "Seller store"}</Text>
                <Text style={mutedText}>{addressBlock(shipment.seller?.destinationAddress)}</Text>
                <Field
                  label="Receiver name"
                  value={receiverByShipment[shipment.id] ?? ""}
                  onChangeText={(value) => setReceiverByShipment((current) => ({ ...current, [shipment.id]: value }))}
                  placeholder="Person receiving at seller store"
                />
                <Field
                  label="Receipt proof reference"
                  value={receiptProofByShipment[shipment.id] ?? ""}
                  onChangeText={(value) => setReceiptProofByShipment((current) => ({ ...current, [shipment.id]: value }))}
                  placeholder="Receipt proof reference"
                />
                {canReceive && (!receiver || !receiptProof) ? <Text style={dangerText}>Receiver name and receipt proof reference are required.</Text> : null}
                <Button
                  title={shipment.status === "RECEIVED" ? "Received" : "Record seller receipt"}
                  disabled={shipment.status === "RECEIVED" || !canReceive || !receiver || !receiptProof}
                  loading={receiptMutation.isPending && receiptMutation.variables === shipment.id}
                  onPress={() => receiptMutation.mutate(shipment.id)}
                />
              </Card>
            );
          })}
          <Card>
            <Text style={sectionTitle}>Return items</Text>
            {detail.items.map((item) => (
              <Text key={item.id} style={mutedText}>
                {item.productName} x{item.quantity} / {item.sellerName ?? "Seller"}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ReturnSummary({ detail, allAccepted, allReceived }: { detail: ReturnDetail; allAccepted: boolean; allReceived: boolean }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatusChip label={allAccepted ? "Accepted" : "Awaiting acceptance"} tone={allAccepted ? "success" : "warning"} />
        <StatusChip label={humanize(detail.status)} tone={allReceived ? "success" : "warning"} />
      </View>
      <Text style={{ color: "#123A5A", fontSize: 22, fontWeight: "900" }}>{formatPaise(detail.requestedAmountPaise, detail.currency)}</Text>
      <Text style={mutedText}>
        Order {detail.order.orderNumber} / {detail.totalQuantity} return item{detail.totalQuantity === 1 ? "" : "s"}
      </Text>
      <Text style={mutedText}>{detail.customer?.name ?? "Customer"} / {detail.customer?.phone ?? detail.pickupAddress?.phone ?? "Phone not available"}</Text>
      <Text style={mutedText}>{addressBlock(detail.pickupAddress)}</Text>
    </Card>
  );
}

function RouteActions({ detail }: { detail: ReturnDetail }) {
  const pickupAddress = addressLine(detail.pickupAddress);
  const pickupPhone = detail.customer?.phone ?? detail.pickupAddress?.phone;
  const sellerAddress = addressLine(detail.reverseShipments[0]?.seller?.destinationAddress);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <Button
        title="Pickup map"
        tone="secondary"
        disabled={!pickupAddress}
        style={{ flex: 1, minWidth: 130 }}
        onPress={() => pickupAddress && void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`)}
      />
      <Button
        title="Call customer"
        tone="secondary"
        disabled={!pickupPhone}
        style={{ flex: 1, minWidth: 130 }}
        onPress={() => pickupPhone && void Linking.openURL(`tel:${pickupPhone.replace(/[^\d+]/g, "")}`)}
      />
      <Button
        title="Seller map"
        tone="secondary"
        disabled={!sellerAddress}
        style={{ flex: 1, minWidth: 130 }}
        onPress={() => sellerAddress && void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sellerAddress)}`)}
      />
    </View>
  );
}

function NoticeCard({ notice }: { notice: { message: string; tone: "success" | "danger" } }) {
  return (
    <Card style={{ borderColor: notice.tone === "success" ? "#B7E4CE" : "#F5B7B7" }}>
      <Text style={{ color: notice.tone === "success" ? "#0F8A5F" : "#B42318", fontWeight: "900" }}>{notice.message}</Text>
    </Card>
  );
}

async function afterMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  authKey: string,
  requestNumber: string,
  message: string,
  setNotice: (notice: { message: string; tone: "success" | "danger" }) => void,
  setNote: (note: string) => void,
) {
  setNotice({ message, tone: "success" });
  setNote("");
  await queryClient.invalidateQueries({ queryKey: ["delivery-return", authKey, requestNumber] });
  await queryClient.invalidateQueries({ queryKey: ["delivery-returns"] });
}

function addressBlock(address?: AddressSnapshot | null) {
  if (!address) return "Address not available.";
  return [address.fullName, address.phone, address.line1, address.line2, address.area, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join("\n");
}

const sectionTitle = { color: "#123A5A", fontSize: 18, fontWeight: "900" } as const;
const mutedText = { color: "#6B7280", fontWeight: "700", lineHeight: 20 } as const;
const dangerText = { color: "#B42318", fontWeight: "800" } as const;
