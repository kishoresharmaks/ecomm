import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Field,
  Header,
  QueryState,
  Screen,
  SelectField,
  StatusChip,
  formatDateTime,
  formatPaise,
  humanize,
} from "../../src/components/screen";
import {
  addressLine,
  createDeliveryAttempt,
  findCodPayment,
  getDeliveryOrder,
  respondDeliveryAssignment,
  updateDeliveryOrder,
  type DeliveryAttemptReason,
  type DeliveryOrder,
  type DeliveryStatus,
} from "../../src/features/delivery/delivery-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

const progressStatuses: DeliveryStatus[] = ["PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"];
const attemptReasons: DeliveryAttemptReason[] = [
  "CUSTOMER_NOT_REACHABLE",
  "ADDRESS_ISSUE",
  "RESCHEDULED",
  "REFUSED_DELIVERY",
  "FAILED_ATTEMPT",
  "OTHER",
];

export default function DeliveryOrderDetailScreen() {
  const auth = useMobileDeliveryAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderNumber?: string }>();
  const orderNumber = String(params.orderNumber ?? "");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [note, setNote] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [codAmount, setCodAmount] = useState("");
  const [codNote, setCodNote] = useState("");
  const [attemptReason, setAttemptReason] = useState<DeliveryAttemptReason>("CUSTOMER_NOT_REACHABLE");
  const [attemptNote, setAttemptNote] = useState("");
  const [nextAttemptDate, setNextAttemptDate] = useState("");

  const orderQuery = useQuery({
    queryKey: ["delivery-order", auth.authKey, orderNumber],
    queryFn: () => getDeliveryOrder(auth.authHeaders, orderNumber),
    enabled: auth.enabled && Boolean(orderNumber),
  });
  const order = orderQuery.data;
  const codPayment = findCodPayment(order);
  const codAmountPaise = amountTextToPaise(codAmount);
  const expectedCodPaise = codPayment?.amountPaise ?? null;
  const codMatches = expectedCodPaise !== null && codAmountPaise === expectedCodPaise;
  const assignmentAccepted = order?.deliveryDetail?.assignmentStatus === "ACCEPTED";

  useEffect(() => {
    if (!order) return;
    const nextCodPayment = findCodPayment(order);
    setTrackingReference(order.deliveryDetail?.trackingReference ?? "");
    setEstimatedDeliveryDate(toDateInput(order.deliveryDetail?.estimatedDeliveryDate));
    setReceiverName(order.deliveryDetail?.receiverName ?? order.shippingAddressSnapshot?.fullName ?? "");
    setProofReference(order.deliveryDetail?.proofReference ?? "");
    setProofNote(order.deliveryDetail?.proofNote ?? "");
    setCodAmount(nextCodPayment ? formatAmountText(nextCodPayment.amountPaise) : "");
  }, [order]);

  const assignmentMutation = useMutation({
    mutationFn: (decision: "ACCEPT" | "REJECT") => respondDeliveryAssignment(auth.authHeaders, orderNumber, decision, note.trim() || undefined),
    onSuccess: async (_, decision) => {
      setNotice({ message: decision === "ACCEPT" ? "Assignment accepted." : "Assignment rejected.", tone: "success" });
      setNote("");
      await refresh(queryClient, auth.authKey, orderNumber);
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Assignment update failed.", tone: "danger" }),
  });
  const progressMutation = useMutation({
    mutationFn: (status: DeliveryStatus) =>
      updateDeliveryOrder(auth.authHeaders, orderNumber, {
        status,
        trackingReference: trackingReference.trim() || undefined,
        estimatedDeliveryDate: estimatedDeliveryDate.trim() || undefined,
        deliveryNote: note.trim() || undefined,
        receiverName: status === "DELIVERED" ? receiverName.trim() : undefined,
        proofReference: status === "DELIVERED" ? proofReference.trim() : undefined,
        proofNote: status === "DELIVERED" ? proofNote.trim() || undefined : undefined,
      }),
    onSuccess: async (_, status) => {
      setNotice({ message: `${humanize(status)} update saved.`, tone: "success" });
      await refresh(queryClient, auth.authKey, orderNumber);
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Delivery update failed.", tone: "danger" }),
  });
  const codMutation = useMutation({
    mutationFn: () =>
      updateDeliveryOrder(auth.authHeaders, orderNumber, {
        codCollected: true,
        codCollectedAmountPaise: codAmountPaise ?? undefined,
        codCollectionNote: codNote.trim() || "Collected exact COD amount from customer.",
      }),
    onSuccess: async () => {
      setNotice({ message: "COD collection recorded for admin verification.", tone: "success" });
      await refresh(queryClient, auth.authKey, orderNumber);
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "COD collection failed.", tone: "danger" }),
  });
  const attemptMutation = useMutation({
    mutationFn: () =>
      createDeliveryAttempt(auth.authHeaders, orderNumber, {
        reason: attemptReason,
        note: attemptNote.trim() || undefined,
        nextAttemptDate: nextAttemptDate.trim() || undefined,
      }),
    onSuccess: async () => {
      setNotice({ message: "Delivery attempt recorded.", tone: "success" });
      setAttemptNote("");
      setNextAttemptDate("");
      await refresh(queryClient, auth.authKey, orderNumber);
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Attempt recording failed.", tone: "danger" }),
  });

  return (
    <Screen>
      <Button title="Back to orders" tone="secondary" onPress={() => router.back()} />
      <Header title={orderNumber || "Order detail"} subtitle="Accept, progress, record COD, and close proof." />
      <QueryState loading={orderQuery.isLoading} error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />
      {notice ? <NoticeCard notice={notice} /> : null}
      {order ? (
        <>
          <OrderSummary order={order} />
          <RouteActions order={order} />
          <Card>
            <Text style={sectionTitle}>Assignment</Text>
            <Text style={mutedText}>Accept before updating delivery progress or recording failed attempts.</Text>
            <Field label="Assignment note" value={note} onChangeText={setNote} placeholder="Optional note for operations" multiline />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Accept"
                disabled={assignmentAccepted}
                loading={assignmentMutation.isPending && assignmentMutation.variables === "ACCEPT"}
                style={{ flex: 1 }}
                onPress={() => assignmentMutation.mutate("ACCEPT")}
              />
              <Button
                title="Reject"
                tone="danger"
                disabled={assignmentMutation.isPending || assignmentAccepted}
                style={{ flex: 1 }}
                onPress={() => assignmentMutation.mutate("REJECT")}
              />
            </View>
          </Card>
          <Card>
            <Text style={sectionTitle}>Delivery progress</Text>
            <Field label="Tracking reference" value={trackingReference} onChangeText={setTrackingReference} placeholder="Tracking or route reference" />
            <Field label="Estimated delivery date" value={estimatedDeliveryDate} onChangeText={setEstimatedDeliveryDate} placeholder="YYYY-MM-DD" />
            <Field label="Receiver name" value={receiverName} onChangeText={setReceiverName} placeholder="Required before delivered" />
            <Field label="Proof reference" value={proofReference} onChangeText={setProofReference} placeholder="Photo/file/signature reference" />
            <Field label="Proof note" value={proofNote} onChangeText={setProofNote} placeholder="Handover note" multiline />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {progressStatuses.map((status) => {
                const deliveredNeedsProof = status === "DELIVERED" && (!receiverName.trim() || !proofReference.trim());
                return (
                  <Button
                    key={status}
                    title={humanize(status)}
                    tone={status === "DELIVERED" ? "primary" : "secondary"}
                    disabled={!assignmentAccepted || progressMutation.isPending || deliveredNeedsProof || order.deliveryStatus === status}
                    loading={progressMutation.isPending && progressMutation.variables === status}
                    onPress={() => progressMutation.mutate(status)}
                  />
                );
              })}
            </View>
            {!assignmentAccepted ? <Text style={dangerText}>Accept this assignment before progress updates.</Text> : null}
          </Card>
          {codPayment ? (
            <Card>
              <Text style={sectionTitle}>COD collection</Text>
              <Text style={mutedText}>Expected collection: {formatPaise(expectedCodPaise, codPayment.currency)}</Text>
              <Field label="Collected amount" value={codAmount} onChangeText={setCodAmount} keyboardType="decimal-pad" placeholder="Exact COD amount" />
              <Field label="COD note" value={codNote} onChangeText={setCodNote} placeholder="Collection note" multiline />
              {!codMatches ? <Text style={dangerText}>Amount must match {formatPaise(expectedCodPaise, codPayment.currency)} before recording COD.</Text> : null}
              <Button
                title="Record COD collected"
                disabled={!assignmentAccepted || !codMatches || order.deliveryDetail?.codCollectionStatus === "COLLECTED" || order.deliveryDetail?.codCollectionStatus === "VERIFIED"}
                loading={codMutation.isPending}
                onPress={() => codMutation.mutate()}
              />
            </Card>
          ) : null}
          <Card>
            <Text style={sectionTitle}>Failed or rescheduled attempt</Text>
            <SelectField
              label="Reason"
              selectedValue={attemptReason}
              onSelect={(value) => setAttemptReason(value as DeliveryAttemptReason)}
              options={attemptReasons.map((reason) => ({ value: reason, label: humanize(reason) }))}
            />
            <Field label="Attempt note" value={attemptNote} onChangeText={setAttemptNote} placeholder="What happened?" multiline />
            <Field label="Next attempt date" value={nextAttemptDate} onChangeText={setNextAttemptDate} placeholder="YYYY-MM-DD" />
            <Button title="Record attempt" disabled={!assignmentAccepted} loading={attemptMutation.isPending} onPress={() => attemptMutation.mutate()} />
            {(order.deliveryDetail?.attempts ?? []).map((attempt) => (
              <View key={attempt.id} style={{ borderTopColor: "#EEF2F6", borderTopWidth: 1, gap: 4, paddingTop: 10 }}>
                <StatusChip label={humanize(attempt.reason)} tone="warning" />
                <Text style={mutedText}>{formatDateTime(attempt.attemptedAt ?? attempt.createdAt)}</Text>
                {attempt.note ? <Text style={mutedText}>{attempt.note}</Text> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function OrderSummary({ order }: { order: DeliveryOrder }) {
  const cod = findCodPayment(order);
  return (
    <Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatusChip label={humanize(order.deliveryStatus)} tone={order.deliveryStatus === "DELIVERED" ? "success" : "warning"} />
        <StatusChip label={humanize(order.deliveryDetail?.assignmentStatus ?? "ASSIGNED")} tone={order.deliveryDetail?.assignmentStatus === "ACCEPTED" ? "success" : "warning"} />
        <StatusChip label={humanize(order.paymentStatus)} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
        {cod ? <StatusChip label={`COD ${humanize(order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED")}`} tone="info" /> : null}
      </View>
      <Text style={{ color: "#123A5A", fontSize: 22, fontWeight: "900" }}>{formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}</Text>
      <Text style={mutedText}>{order.customer?.fullName ?? order.customer?.email ?? "Customer"} / {order.customer?.phone ?? order.shippingAddressSnapshot?.phone ?? "Phone not available"}</Text>
      <Text style={mutedText}>{(order.items ?? []).map((item) => `${item.productNameSnapshot} x${item.quantity}`).join(", ")}</Text>
      <Text style={mutedText}>{addressBlock(order.shippingAddressSnapshot)}</Text>
    </Card>
  );
}

function RouteActions({ order }: { order: DeliveryOrder }) {
  const address = addressLine(order.shippingAddressSnapshot);
  const phone = order.customer?.phone ?? order.shippingAddressSnapshot?.phone;
  const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const telUrl = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Button title="Open map" tone="secondary" disabled={!mapUrl} style={{ flex: 1 }} onPress={() => mapUrl && void Linking.openURL(mapUrl)} />
      <Button title="Call customer" tone="secondary" disabled={!telUrl} style={{ flex: 1 }} onPress={() => telUrl && void Linking.openURL(telUrl)} />
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

async function refresh(queryClient: ReturnType<typeof useQueryClient>, authKey: string, orderNumber: string) {
  await queryClient.invalidateQueries({ queryKey: ["delivery-order", authKey, orderNumber] });
  await queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
  await queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] });
}

function amountTextToPaise(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function formatAmountText(value: number) {
  return (value / 100).toFixed(2).replace(/\.00$/, "");
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function addressBlock(address: DeliveryOrder["shippingAddressSnapshot"]) {
  if (!address) return "Address not available.";
  return [address.fullName, address.phone, address.line1, address.line2, address.area, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join("\n");
}

const sectionTitle = { color: "#123A5A", fontSize: 18, fontWeight: "900" } as const;
const mutedText = { color: "#6B7280", fontWeight: "700", lineHeight: 20 } as const;
const dangerText = { color: "#B42318", fontWeight: "800" } as const;
