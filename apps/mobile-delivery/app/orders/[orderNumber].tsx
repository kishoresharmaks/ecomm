import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
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
  createDeliveryAttempt,
  findCodPayment,
  getDeliveryOrder,
  respondDeliveryAssignment,
  updateDeliveryOrder,
  type DeliveryAttemptReason,
  type DeliveryOrder,
  type DeliveryOrderShipment,
  type DeliveryPickupAddress,
  type DeliveryStatus,
} from "../../src/features/delivery/delivery-api";
import { pickDeliveryProofImage, uploadDeliveryProofImage } from "../../src/features/delivery/proof-upload";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

const deliveryProgressionStatuses: DeliveryStatus[] = ["PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"];
const deliveryStatuses: DeliveryStatus[] = [...deliveryProgressionStatuses, "CANCELLED"];
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
  const [assignmentNote, setAssignmentNote] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatus>("PENDING");
  const [trackingReference, setTrackingReference] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [proofUploadStatus, setProofUploadStatus] = useState("");
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
  const currentDeliveryStatus = deliveryStatusValue(order?.deliveryDetail?.status ?? order?.deliveryStatus);
  const progressStatuses = nextDeliveryStatusOptions(currentDeliveryStatus);
  const progressLocked = currentDeliveryStatus === "DELIVERED" || currentDeliveryStatus === "CANCELLED";

  useEffect(() => {
    if (!order) return;
    const nextCodPayment = findCodPayment(order);
    setTrackingReference(order.deliveryDetail?.trackingReference ?? "");
    setEstimatedDeliveryDate(toDateInput(order.deliveryDetail?.estimatedDeliveryDate));
    setDeliveryNote(order.deliveryDetail?.deliveryNote ?? "");
    setSelectedDeliveryStatus(deliveryStatusValue(order.deliveryDetail?.status ?? order.deliveryStatus));
    setReceiverName(order.deliveryDetail?.receiverName ?? order.shippingAddressSnapshot?.fullName ?? "");
    setProofReference(order.deliveryDetail?.proofReference ?? "");
    setProofNote(order.deliveryDetail?.proofNote ?? "");
    setCodAmount(nextCodPayment ? formatAmountText(nextCodPayment.amountPaise) : "");
  }, [order]);

  const assignmentMutation = useMutation({
    mutationFn: (decision: "ACCEPT" | "REJECT") => respondDeliveryAssignment(auth.authHeaders, orderNumber, decision, assignmentNote.trim() || undefined),
    onSuccess: async (_, decision) => {
      setNotice({ message: decision === "ACCEPT" ? "Assignment accepted." : "Assignment rejected.", tone: "success" });
      setAssignmentNote("");
      await refresh(queryClient, auth.authKey, orderNumber);
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Assignment update failed.", tone: "danger" }),
  });
  const progressMutation = useMutation({
    mutationFn: (status: DeliveryStatus) =>
      updateDeliveryOrder(auth.authHeaders, orderNumber, {
        status,
        estimatedDeliveryDate: estimatedDeliveryDate.trim() || undefined,
        deliveryNote: deliveryNote.trim() || undefined,
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

  async function uploadProof() {
    setProofUploadStatus("");
    try {
      const asset = await pickDeliveryProofImage();
      if (!asset) return;
      setProofUploadStatus("Uploading proof...");
      const uploaded = await uploadDeliveryProofImage(auth.authHeaders, asset.uri, asset.fileName);
      setProofReference(uploaded.assetKey);
      setProofUploadStatus("Delivery proof uploaded.");
    } catch (error) {
      setProofUploadStatus("");
      setNotice({ message: error instanceof Error ? error.message : "Proof upload failed.", tone: "danger" });
    }
  }

  return (
    <Screen>
      <Button title="Back to orders" tone="secondary" onPress={() => router.back()} />
      <Header title={orderNumber || "Order detail"} subtitle="Accept, progress, record COD, and close proof." />
      <QueryState loading={orderQuery.isLoading} error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />
      {notice ? <NoticeCard notice={notice} /> : null}
      {order ? (
        <>
          <OrderSummary order={order} />
          <QuickActionsPanel order={order} />
          <DeliveryWorkflowGuide order={order} />
          <SellerPickupStops order={order} />
          <CustomerDropAddressPanel order={order} />
          <Card>
            <Text style={sectionTitle}>Assignment</Text>
            <Text style={mutedText}>Accept before updating delivery progress or recording failed attempts.</Text>
            <Field label="Assignment note" value={assignmentNote} onChangeText={setAssignmentNote} placeholder="Optional note for operations" multiline />
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
            <Text style={mutedText}>Tracking: {trackingReference || "Generated after assignment"}</Text>
            <Field label="Estimated delivery date" value={estimatedDeliveryDate} onChangeText={setEstimatedDeliveryDate} placeholder="YYYY-MM-DD" />
            <Field label="Delivery note" value={deliveryNote} onChangeText={setDeliveryNote} placeholder="Pickup, route, or handover note" multiline />
            <Field label="Receiver name" value={receiverName} onChangeText={setReceiverName} placeholder="Required before delivered" />
            <Button title={proofReference ? "Replace proof file" : "Upload proof file"} tone="secondary" onPress={() => void uploadProof()} />
            {proofReference ? <Text style={successText}>{proofReference}</Text> : null}
            {proofUploadStatus ? <Text style={mutedText}>{proofUploadStatus}</Text> : null}
            <Field label="Proof note" value={proofNote} onChangeText={setProofNote} placeholder="Handover note" multiline />
            {progressLocked ? (
              <StatusChip label={humanize(currentDeliveryStatus)} tone={currentDeliveryStatus === "DELIVERED" ? "success" : "danger"} />
            ) : (
              <SelectField
                label="Delivery status"
                selectedValue={selectedDeliveryStatus}
                onSelect={(value) => setSelectedDeliveryStatus(value as DeliveryStatus)}
                options={progressStatuses.map((status) => ({ value: status, label: humanize(status) }))}
              />
            )}
            <Button
              title="Save delivery update"
              disabled={
                !assignmentAccepted ||
                progressLocked ||
                progressMutation.isPending ||
                selectedDeliveryStatus === currentDeliveryStatus ||
                (selectedDeliveryStatus === "DELIVERED" && (!receiverName.trim() || !proofReference.trim()))
              }
              loading={progressMutation.isPending}
              onPress={() => progressMutation.mutate(selectedDeliveryStatus)}
            />
            {!assignmentAccepted ? <Text style={dangerText}>Accept this assignment before progress updates.</Text> : null}
            {selectedDeliveryStatus === "DELIVERED" && (!receiverName.trim() || !proofReference.trim()) ? <Text style={dangerText}>Receiver name and proof file are required before marking delivered.</Text> : null}
            {!progressLocked ? <Text style={mutedText}>Status can move only to the next workflow step or Cancelled.</Text> : null}
            {progressLocked ? <Text style={mutedText}>This delivery is {humanize(currentDeliveryStatus).toLowerCase()} and progress updates are locked.</Text> : null}
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
          <PaymentCheckPanel order={order} />
          <StatusTimelineSection order={order} />
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
  const assignmentStatus = order.deliveryDetail?.assignmentStatus ?? "ASSIGNED";
  const collectionStatus = order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";
  const nextAction = nextActionCopy(order);
  return (
    <Card style={missionCard}>
      <View style={{ gap: 6 }}>
        <Text style={smallLabel}>Delivery task</Text>
        <Text style={missionTitle}>{order.orderNumber}</Text>
        <Text style={missionAmount}>{formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatusChip label={humanize(order.deliveryStatus)} tone={order.deliveryStatus === "DELIVERED" ? "success" : order.deliveryStatus === "CANCELLED" ? "danger" : "warning"} />
        {order.orderKind === "REPLACEMENT" ? <StatusChip label="Replacement delivery" tone="info" /> : null}
        <StatusChip label={humanize(assignmentStatus)} tone={assignmentStatus === "ACCEPTED" ? "success" : assignmentStatus === "REJECTED" ? "danger" : "warning"} />
        <StatusChip label={humanize(order.paymentStatus)} tone={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "FAILED" ? "danger" : "warning"} />
        {cod ? <StatusChip label={`COD ${humanize(collectionStatus)}`} tone={collectionStatus === "VERIFIED" ? "success" : collectionStatus === "COLLECTED" ? "warning" : "info"} /> : null}
      </View>
      <View style={nextActionPanel}>
        <Text style={nextActionTitle}>{nextAction.title}</Text>
        <Text style={nextActionBody}>{nextAction.body}</Text>
      </View>
      <View style={summaryGrid}>
        <SummaryTile
          label="Customer"
          value={order.customer?.fullName ?? order.customer?.email ?? "Customer"}
          note={order.customer?.phone ?? order.shippingAddressSnapshot?.phone ?? "Phone not available"}
        />
        <SummaryTile
          label="Items"
          value={`${order.items?.length ?? 0}`}
          note={(order.items ?? []).map((item) => `${item.productNameSnapshot} x${item.quantity}`).join(", ") || "Items not available"}
        />
      </View>
    </Card>
  );
}

function DeliveryWorkflowGuide({ order }: { order: DeliveryOrder }) {
  const steps = deliveryWorkflowSteps(order);
  return (
    <Card>
      <Text style={sectionTitle}>Delivery workflow</Text>
      <View style={{ gap: 10 }}>
        {steps.map((step) => (
          <View key={step.number} style={[workflowRow, step.state === "current" ? workflowRowCurrent : null]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[stepBadge, step.state === "done" ? stepBadgeDone : step.state === "current" ? stepBadgeCurrent : step.state === "blocked" ? stepBadgeBlocked : null]}>
                <Text style={[stepBadgeText, step.state === "current" ? stepBadgeTextCurrent : null]}>{step.state === "done" ? "OK" : step.number}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={compactTitle}>{step.title}</Text>
                <Text style={mutedSmallText}>{step.description}</Text>
              </View>
              <StatusChip label={workflowLabel(step.state)} tone={workflowTone(step.state)} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function SummaryTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={summaryTile}>
      <Text style={smallLabel}>{label}</Text>
      <Text style={summaryTileValue} numberOfLines={1}>{value}</Text>
      {note ? <Text style={mutedSmallText} numberOfLines={2}>{note}</Text> : null}
    </View>
  );
}

function QuickActionsPanel({ order }: { order: DeliveryOrder }) {
  const firstPickup = order.shipments?.[0] ?? null;
  const pickupAddress = firstPickup?.seller?.pickupAddress ?? null;
  const pickupAddressText = pickupAddressLines(pickupAddress).join(", ");
  const pickupCoordinates = coordinatesFromSnapshot(pickupAddress);
  const pickupRouteUrl = pickupCoordinates
    ? googleMapsDirectionsUrl(pickupCoordinates)
    : pickupAddressText
      ? googleMapsAddressSearchUrl(pickupAddressText)
      : null;
  const dropAddress = order.shippingAddressSnapshot;
  const dropAddressText = customerAddressLines(order).join(", ");
  const dropCoordinates = coordinatesFromSnapshot(dropAddress);
  const dropRouteUrl = dropCoordinates
    ? googleMapsDirectionsUrl(dropCoordinates)
    : dropAddressText
      ? googleMapsAddressSearchUrl(dropAddressText)
      : null;
  const customerPhoneUrl = phoneLink(order.customer?.phone ?? dropAddress?.phone);
  const codPayment = findCodPayment(order);

  return (
    <Card style={quickActionsCard}>
      <View style={{ gap: 4 }}>
        <Text style={sectionTitle}>Quick actions</Text>
        <Text style={mutedSmallText}>
          {codPayment ? `Collect exact COD: ${formatPaise(codPayment.amountPaise, codPayment.currency)}` : "No COD collection is attached to this order."}
        </Text>
      </View>
      <View style={quickActionsGrid}>
        <Button title="Route pickup" tone="secondary" disabled={!pickupRouteUrl} style={quickActionButton} onPress={() => pickupRouteUrl && void Linking.openURL(pickupRouteUrl)} />
        <Button title="Route drop" tone="secondary" disabled={!dropRouteUrl} style={quickActionButton} onPress={() => dropRouteUrl && void Linking.openURL(dropRouteUrl)} />
        <Button title="Call customer" tone="secondary" disabled={!customerPhoneUrl} style={quickActionButton} onPress={() => customerPhoneUrl && void Linking.openURL(customerPhoneUrl)} />
      </View>
    </Card>
  );
}

function SellerPickupStops({ order }: { order: DeliveryOrder }) {
  const shipments = order.shipments ?? [];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={sectionTitle}>Pickup from seller</Text>
        <StatusChip label={`${shipments.length} ${shipments.length === 1 ? "stop" : "stops"}`} tone={shipments.length > 1 ? "info" : "neutral"} />
      </View>
      {shipments.length === 0 ? <Text style={warningBox}>Pickup details not available. Contact admin.</Text> : null}
      {shipments.map((shipment, index) => (
        <SellerPickupStop key={shipment.id} shipment={shipment} sequence={index + 1} />
      ))}
    </Card>
  );
}

function SellerPickupStop({ shipment, sequence }: { shipment: DeliveryOrderShipment; sequence: number }) {
  const seller = shipment.seller;
  const address = seller?.pickupAddress ?? null;
  const addressLines = pickupAddressLines(address);
  const addressText = addressLines.join(", ");
  const coordinates = coordinatesFromSnapshot(address);
  const routeUrl = coordinates ? googleMapsDirectionsUrl(coordinates) : addressText ? googleMapsAddressSearchUrl(addressText) : null;
  const searchUrl = coordinates ? googleMapsSearchUrl(coordinates) : addressText ? googleMapsAddressSearchUrl(addressText) : null;
  const phoneUrl = seller?.contactPhone ? phoneLink(seller.contactPhone) : null;
  return (
    <View style={innerCard}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatusChip label={`Stop ${sequence}`} tone="info" />
        <StatusChip label={humanize(shipment.status)} tone={shipment.status === "DELIVERED" ? "success" : shipment.status === "CANCELLED" ? "danger" : "warning"} />
        {shipment.assignmentStatus ? <StatusChip label={`Assignment ${humanize(shipment.assignmentStatus)}`} tone={shipment.assignmentStatus === "ACCEPTED" ? "success" : "neutral"} /> : null}
      </View>
      <Text style={compactTitle}>{seller?.storeName ?? "Seller pickup"}</Text>
      <Text style={mutedText}>{shipment.shipmentNumber}</Text>
      {seller?.contactName ? <Text style={mutedText}>Contact: {seller.contactName}</Text> : null}
      {seller?.contactPhone ? <Text style={mutedText}>Phone: {seller.contactPhone}</Text> : null}
      {addressLines.length ? addressLines.map((line) => <Text key={line} style={mutedText}>{line}</Text>) : <Text style={warningBox}>Seller pickup address unavailable. Contact admin.</Text>}
      {coordinates ? (
        <View style={{ gap: 4 }}>
          <StatusChip label="Pickup pin saved" tone="success" />
          <Text style={mutedSmallText}>{formatCoordinates(coordinates)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button title="Open route" tone="secondary" disabled={!routeUrl} style={{ flexGrow: 1 }} onPress={() => routeUrl && void Linking.openURL(routeUrl)} />
        <Button title="View address" tone="secondary" disabled={!searchUrl} style={{ flexGrow: 1 }} onPress={() => searchUrl && void Linking.openURL(searchUrl)} />
        <Button title="Call seller" tone="secondary" disabled={!phoneUrl} style={{ flexGrow: 1 }} onPress={() => phoneUrl && void Linking.openURL(phoneUrl)} />
      </View>
    </View>
  );
}

function CustomerDropAddressPanel({ order }: { order: DeliveryOrder }) {
  const address = order.shippingAddressSnapshot;
  const coordinates = coordinatesFromSnapshot(address);
  const addressLines = customerAddressLines(order);
  const addressText = addressLines.join(", ");
  const routeUrl = coordinates ? googleMapsDirectionsUrl(coordinates) : null;
  const searchUrl = coordinates ? googleMapsSearchUrl(coordinates) : addressText ? googleMapsAddressSearchUrl(addressText) : null;
  const phoneUrl = phoneLink(order.customer?.phone ?? address?.phone);
  return (
    <Card>
      <Text style={sectionTitle}>Customer drop address</Text>
      <Text style={compactTitle}>{address?.fullName ?? order.customer?.fullName ?? "Customer"}</Text>
      {address?.phone || order.customer?.phone ? <Text style={mutedText}>{address?.phone ?? order.customer?.phone}</Text> : null}
      {addressLines.length ? addressLines.map((line) => <Text key={line} style={mutedText}>{line}</Text>) : <Text style={warningBox}>Address not available. Contact admin.</Text>}
      {coordinates ? (
        <View style={innerCard}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatusChip label="Coordinates available" tone="success" />
            {address?.locationSource ? <StatusChip label={humanize(address.locationSource)} tone="info" /> : null}
            {address?.accuracyMeters ? <StatusChip label={`Accuracy ${address.accuracyMeters} m`} tone="info" /> : null}
          </View>
          <Text style={mutedSmallText}>{formatCoordinates(coordinates)}</Text>
        </View>
      ) : (
        <Text style={warningBox}>No coordinate pin was saved for this order; use the written address.</Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button title="Open route" tone="secondary" disabled={!routeUrl} style={{ flexGrow: 1 }} onPress={() => routeUrl && void Linking.openURL(routeUrl)} />
        <Button title="View address" tone="secondary" disabled={!searchUrl} style={{ flexGrow: 1 }} onPress={() => searchUrl && void Linking.openURL(searchUrl)} />
        <Button title="Call customer" tone="secondary" disabled={!phoneUrl} style={{ flexGrow: 1 }} onPress={() => phoneUrl && void Linking.openURL(phoneUrl)} />
      </View>
    </Card>
  );
}

function PaymentCheckPanel({ order }: { order: DeliveryOrder }) {
  const payments = order.payments ?? [];
  return (
    <Card>
      <Text style={sectionTitle}>Payment check</Text>
      {payments.length === 0 ? <Text style={mutedText}>No payment records are attached yet.</Text> : null}
      {payments.map((payment) => (
        <View key={payment.id} style={innerCard}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <StatusChip label={humanize(payment.provider)} tone="info" />
            {payment.method ? <StatusChip label={humanize(payment.method)} tone="neutral" /> : null}
            <StatusChip label={humanize(payment.status)} tone={paymentStatusTone(payment.status)} />
          </View>
          <Text style={compactTitle}>{formatPaise(payment.amountPaise, payment.currency)}</Text>
        </View>
      ))}
      {isCodPending(order) ? <Text style={warningBox}>COD cash can be recorded from the delivery form. Admin verification marks the payment paid.</Text> : null}
    </Card>
  );
}

function StatusTimelineSection({ order }: { order: DeliveryOrder }) {
  const [expanded, setExpanded] = useState(false);
  const events = buildTimeline(order);
  return (
    <Card>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={sectionTitle}>Status timeline ({events.length} events)</Text>
        <Text style={smallLabel}>{expanded ? "Hide" : "Show"}</Text>
      </Pressable>
      {expanded ? (
        <View style={{ gap: 12 }}>
          {events.length === 0 ? <Text style={mutedText}>No timeline events yet.</Text> : null}
          {events.map((event) => (
            <View key={event.id} style={timelineItem}>
              <StatusChip label={event.kind} tone={event.kind === "Delivery" ? "info" : "neutral"} />
              <Text style={compactTitle}>{event.oldStatus ? `${humanize(event.oldStatus)} to ${humanize(event.newStatus)}` : humanize(event.newStatus)}</Text>
              {event.note ? <Text style={mutedText}>{event.note}</Text> : null}
              <Text style={mutedSmallText}>{formatDateTime(event.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
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
  await queryClient.invalidateQueries({ queryKey: ["delivery-returns"] });
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

type Coordinates = { latitude: number; longitude: number };
type CoordinateSnapshot = {
  latitude?: number | string | null;
  longitude?: number | string | null;
};
type WorkflowState = "done" | "current" | "pending" | "blocked";
type TimelineEvent = { id: string; kind: string; oldStatus?: string | null; newStatus: string; note?: string | null; createdAt?: string | null };

function coordinatesFromSnapshot(address?: CoordinateSnapshot | null): Coordinates | null {
  const latitude = Number(address?.latitude);
  const longitude = Number(address?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function formatCoordinates(coordinates: Coordinates) {
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

function googleMapsDirectionsUrl(coordinates: Coordinates) {
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`;
}

function googleMapsSearchUrl(coordinates: Coordinates) {
  return `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
}

function googleMapsAddressSearchUrl(addressText: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
}

function phoneLink(value?: string | null) {
  const normalized = value?.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function pickupAddressLines(address?: DeliveryPickupAddress | null) {
  return [
    address?.line1,
    address?.line2,
    address?.area,
    [address?.city, address?.state, address?.pincode].filter(Boolean).join(", "),
    address?.country ?? address?.countryCode,
  ].filter((line): line is string => Boolean(line?.trim()));
}

function customerAddressLines(order: DeliveryOrder) {
  const address = order.shippingAddressSnapshot;
  return [
    address?.line1,
    address?.line2,
    address?.area,
    [address?.city, address?.state, address?.pincode].filter(Boolean).join(", "),
    address?.country ?? address?.countryCode,
  ].filter((line): line is string => Boolean(line?.trim()));
}

function buildTimeline(order: DeliveryOrder): TimelineEvent[] {
  return [
    ...(order.deliveryDetail?.events ?? []).map((event) => ({
      id: `delivery-${event.id}`,
      kind: "Delivery",
      oldStatus: event.oldStatus ?? null,
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
    ...(order.statusEvents ?? []).map((event) => ({
      id: `status-${event.id}`,
      kind: humanize(event.statusType),
      oldStatus: event.oldStatus ?? null,
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
  ].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime());
}

function isCodPending(order: DeliveryOrder) {
  return order.paymentStatus === "PENDING" && Boolean(findCodPayment(order));
}

function nextActionCopy(order: DeliveryOrder) {
  const assignmentStatus = order.deliveryDetail?.assignmentStatus ?? "UNASSIGNED";
  const deliveryStatus = order.deliveryDetail?.status ?? order.deliveryStatus ?? "PENDING";
  const codPayment = findCodPayment(order);
  const codStatus = order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";

  if (assignmentStatus === "ASSIGNED") {
    return {
      title: "Accept the assignment",
      body: "Confirm the task before pickup, route updates, or attempt recording.",
    };
  }
  if (assignmentStatus === "REJECTED" || deliveryStatus === "CANCELLED") {
    return {
      title: "Task is closed",
      body: "No delivery progress action is available for this assignment.",
    };
  }
  if (deliveryStatus === "DELIVERED") {
    if (codPayment && codStatus !== "VERIFIED") {
      return {
        title: codStatus === "COLLECTED" ? "COD waiting for verification" : "Record COD if collected",
        body: codStatus === "COLLECTED"
          ? "Admin or finance will verify the collection."
          : "Submit the exact COD amount collected from the customer.",
      };
    }
    return {
      title: "Delivery completed",
      body: "Proof and delivery status are recorded for this order.",
    };
  }
  if (deliveryStatus === "PENDING" || deliveryStatus === "PACKED") {
    return {
      title: "Go to seller pickup",
      body: "Use the pickup stop details, collect the package, then update progress.",
    };
  }
  return {
    title: "Deliver to customer",
    body: "Use the drop address, collect COD if needed, and upload proof before closing.",
  };
}

function deliveryWorkflowSteps(order: DeliveryOrder) {
  const assignmentStatus = order.deliveryDetail?.assignmentStatus ?? "UNASSIGNED";
  const deliveryStatus = order.deliveryDetail?.status ?? order.deliveryStatus ?? "PENDING";
  const accepted = assignmentStatus === "ACCEPTED";
  const assigned = assignmentStatus === "ASSIGNED";
  const rejected = assignmentStatus === "REJECTED";
  const cancelled = deliveryStatus === "CANCELLED" || order.orderStatus === "CANCELLED";
  const delivered = hasDeliveryReached(deliveryStatus, "DELIVERED");
  const inTransit = hasDeliveryReached(deliveryStatus, "IN_TRANSIT");
  const dispatched = hasDeliveryReached(deliveryStatus, "DISPATCHED");
  const codPayment = findCodPayment(order);
  return [
    {
      number: 1,
      title: "Accept assignment",
      description: assigned ? "Confirm before visiting the seller." : accepted ? "Assignment accepted. Continue pickup." : rejected ? "Assignment was rejected." : "Waiting for confirmation.",
      state: rejected || cancelled ? "blocked" : assigned ? "current" : accepted || dispatched || delivered ? "done" : "pending",
    },
    {
      number: 2,
      title: "Collect from seller",
      description: "Verify and collect packages from seller pickup stops.",
      state: rejected || cancelled ? "blocked" : !accepted ? "pending" : dispatched || delivered ? "done" : "current",
    },
    {
      number: 3,
      title: "Update pickup",
      description: "After handover, mark dispatched or in transit.",
      state: rejected || cancelled ? "blocked" : !accepted ? "pending" : inTransit || delivered ? "done" : dispatched ? "current" : "pending",
    },
    {
      number: 4,
      title: "Deliver to customer",
      description: "Use the drop address and keep the order moving.",
      state: rejected || cancelled ? "blocked" : delivered ? "done" : inTransit || dispatched ? "current" : "pending",
    },
    {
      number: 5,
      title: codPayment ? "Record COD and proof" : "Record proof",
      description: codPayment ? "Record receiver, proof, and COD collection." : "Record receiver and delivery proof.",
      state: rejected || cancelled ? "blocked" : delivered ? "done" : "pending",
    },
  ] satisfies Array<{ number: number; title: string; description: string; state: WorkflowState }>;
}

const deliveryStatusRank: Record<string, number> = {
  PENDING: 0,
  PACKED: 1,
  DISPATCHED: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  CANCELLED: -1,
};

function hasDeliveryReached(currentStatus: string, targetStatus: DeliveryStatus) {
  return (deliveryStatusRank[currentStatus] ?? 0) >= (deliveryStatusRank[targetStatus] ?? 0);
}

function deliveryStatusValue(value?: string | null): DeliveryStatus {
  return value && isDeliveryStatus(value) ? value : "PENDING";
}

function nextDeliveryWorkflowStatus(current: DeliveryStatus): DeliveryStatus | null {
  const index = deliveryProgressionStatuses.indexOf(current);
  return index >= 0 && index < deliveryProgressionStatuses.length - 1 ? deliveryProgressionStatuses[index + 1] ?? null : null;
}

function nextDeliveryStatusOptions(current: DeliveryStatus) {
  if (current === "DELIVERED" || current === "CANCELLED") return [current];
  const options: DeliveryStatus[] = [current];
  const nextStatus = nextDeliveryWorkflowStatus(current);
  if (nextStatus) options.push(nextStatus);
  if (!options.includes("CANCELLED")) options.push("CANCELLED");
  return options;
}

function isDeliveryStatus(value: string): value is DeliveryStatus {
  return deliveryStatuses.includes(value as DeliveryStatus);
}

function workflowTone(state: WorkflowState) {
  if (state === "done") return "success";
  if (state === "current") return "warning";
  if (state === "blocked") return "danger";
  return "neutral";
}

function workflowLabel(state: WorkflowState) {
  if (state === "done") return "Done";
  if (state === "current") return "Now";
  if (state === "blocked") return "Blocked";
  return "Pending";
}

function paymentStatusTone(status?: string | null) {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PENDING") return "warning";
  return "neutral";
}

const sectionTitle = { color: "#123A5A", fontSize: 18, fontWeight: "900" } as const;
const missionTitle = { color: "#123A5A", fontSize: 28, fontWeight: "900", lineHeight: 34 } as const;
const missionAmount = { color: "#ED3500", fontSize: 24, fontWeight: "900", lineHeight: 30 } as const;
const compactTitle = { color: "#123A5A", fontSize: 15, fontWeight: "900", lineHeight: 20 } as const;
const smallLabel = { color: "#ED3500", fontSize: 11, fontWeight: "900", textTransform: "uppercase" } as const;
const mutedText = { color: "#6B7280", fontWeight: "700", lineHeight: 20 } as const;
const mutedSmallText = { color: "#6B7280", fontSize: 12, fontWeight: "700", lineHeight: 18 } as const;
const dangerText = { color: "#B42318", fontWeight: "800" } as const;
const successText = { color: "#0F8A5F", fontWeight: "800" } as const;
const warningBox = { backgroundColor: "#FFFCFB", borderColor: "#FFE0D6", borderRadius: 12, borderWidth: 1, color: "#8A4B32", fontSize: 12, fontWeight: "800", lineHeight: 18, padding: 10 } as const;
const missionCard = { borderColor: "#FFD7CA", gap: 14 } as const;
const nextActionPanel = { backgroundColor: "#FFF4EF", borderColor: "#FFD7CA", borderRadius: 14, borderWidth: 1, gap: 4, padding: 12 } as const;
const nextActionTitle = { color: "#9F2600", fontSize: 16, fontWeight: "900" } as const;
const nextActionBody = { color: "#8A4B32", fontSize: 13, fontWeight: "800", lineHeight: 19 } as const;
const summaryGrid = { flexDirection: "row", flexWrap: "wrap", gap: 10 } as const;
const summaryTile = { backgroundColor: "#F8FAFC", borderColor: "#E5E7EB", borderRadius: 12, borderWidth: 1, flexBasis: "45%", flexGrow: 1, gap: 4, minWidth: 136, padding: 12 } as const;
const summaryTileValue = { color: "#123A5A", fontSize: 16, fontWeight: "900" } as const;
const quickActionsCard = { gap: 12 } as const;
const quickActionsGrid = { flexDirection: "row", flexWrap: "wrap", gap: 10 } as const;
const quickActionButton = { flexBasis: "30%", flexGrow: 1, minWidth: 132 } as const;
const innerCard = { backgroundColor: "#F8FAFC", borderColor: "#E5E7EB", borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 } as const;
const timelineItem = { borderLeftColor: "#ED3500", borderLeftWidth: 3, gap: 6, paddingLeft: 12 } as const;
const workflowRow = { backgroundColor: "#F8FAFC", borderColor: "#E5E7EB", borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 } as const;
const workflowRowCurrent = { backgroundColor: "#FFF4EF", borderColor: "#FFD7CA" } as const;
const stepBadge = { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D8E2EA", borderRadius: 999, borderWidth: 1, height: 32, justifyContent: "center", width: 32 } as const;
const stepBadgeDone = { backgroundColor: "#E9F7F1", borderColor: "#BFEAD9" } as const;
const stepBadgeCurrent = { backgroundColor: "#ED3500", borderColor: "#FFC7B8" } as const;
const stepBadgeBlocked = { backgroundColor: "#FDECEC", borderColor: "#F5B7B7" } as const;
const stepBadgeText = { color: "#123A5A", fontSize: 13, fontWeight: "900" } as const;
const stepBadgeTextCurrent = { color: "#FFFFFF" } as const;
