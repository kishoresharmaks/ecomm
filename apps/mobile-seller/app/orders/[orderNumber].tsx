import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  availableSellerOrderActions,
  buildSellerTimeline,
  createDeliveryForm,
  openSellerPackageLabel,
  packageUpdatePayload,
  type DeliveryFormErrors,
  type DeliveryFormValues,
  type PackageFormValues,
  type SellerOrderAction,
  sellerPayablePaise,
  validateDeliveryForm,
} from "../../src/features/seller/order-fulfilment";
import {
  getSellerOrder,
  updateSellerDelivery,
  updateSellerOrderStatus,
  updateSellerPackage,
  type SellerOrder,
  type SellerOrderPackage,
} from "../../src/features/seller/seller-api";
import { formatMoney, paiseToRupees } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };

const deliveryModeOptions = [
  { label: "Courier", value: "THIRD_PARTY_COURIER" },
  { label: "Store pickup", value: "STORE_PICKUP" },
  { label: "Manual transport", value: "MANUAL_TRANSPORT" },
  { label: "Local delivery partner", value: "LOCAL_DELIVERY_PARTNER" },
] as const;

export default function SellerOrderDetailScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const decodedOrderNumber = decodeURIComponent(orderNumber ?? "");
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormValues | null>(null);
  const [deliveryErrors, setDeliveryErrors] = useState<DeliveryFormErrors>({});
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [activeAction, setActiveAction] = useState<SellerOrderAction | null>(null);
  const [labelLoadingId, setLabelLoadingId] = useState<string | null>(null);
  const [packageForms, setPackageForms] = useState<Record<string, PackageFormValues>>({});
  const [packageBusyId, setPackageBusyId] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["seller-order", auth.authKey, decodedOrderNumber],
    queryFn: () => getSellerOrder(auth.authHeaders, decodedOrderNumber),
    enabled: auth.enabled && Boolean(decodedOrderNumber),
  });

  const order = orderQuery.data;

  const actions = useMemo(() => (order ? availableSellerOrderActions(order) : []), [order]);
  const timeline = useMemo(() => (order ? buildSellerTimeline(order) : []), [order]);
  const sellerTotalPaise = order ? sellerPayablePaise(order) : 0;
  const packages = useMemo(() => collectPackages(order), [order]);

  useEffect(() => {
    if (order) {
      setDeliveryForm(createDeliveryForm(order));
      setDeliveryErrors({});
      setPackageForms(Object.fromEntries(collectPackages(order).map((shipmentPackage) => [shipmentPackage.id, createPackageForm(shipmentPackage)])));
    }
  }, [order]);

  const invalidateOrderQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["seller-order", auth.authKey, decodedOrderNumber] }),
      queryClient.invalidateQueries({ queryKey: ["seller-orders", auth.authKey] }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: async (sellerStatus: "ACCEPTED" | "PROCESSING") =>
      updateSellerOrderStatus(auth.authHeaders, decodedOrderNumber, {
        sellerStatus,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async (_, sellerStatus) => {
      await invalidateOrderQueries();
      setToast({
        visible: true,
        message: sellerStatus === "ACCEPTED" ? "Order accepted." : "Order moved to processing.",
        type: "success",
      });
    },
    onError: (error) => {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Order update failed.", type: "error" });
    },
    onSettled: () => setActiveAction(null),
  });

  const deliveryMutation = useMutation({
    mutationFn: async ({ payload }: { action: SellerOrderAction; payload: Parameters<typeof updateSellerDelivery>[2] }) =>
      updateSellerDelivery(auth.authHeaders, decodedOrderNumber, payload),
    onSuccess: async (_, variables) => {
      await invalidateOrderQueries();
      setDeliveryErrors({});
      setToast({
        visible: true,
        message: actionSuccessMessage(variables.action),
        type: "success",
      });
    },
    onError: (error) => {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Delivery update failed.", type: "error" });
    },
    onSettled: () => setActiveAction(null),
  });

  if (!auth.enabled || orderQuery.isLoading) {
    return <LoadingState message="Loading order..." />;
  }

  if (orderQuery.isError || !order) {
    return (
      <Screen>
        <Header title={decodedOrderNumber || "Order detail"} subtitle="Seller fulfilment workspace" />
        <QueryErrorState
          title="Could not load order"
          message={orderQuery.error instanceof Error ? orderQuery.error.message : undefined}
          onRetry={() => void orderQuery.refetch()}
          retrying={orderQuery.isFetching}
        />
      </Screen>
    );
  }

  const currentDeliveryForm = deliveryForm ?? createDeliveryForm(order);

  return (
    <Screen>
      <Header title={decodedOrderNumber} subtitle="Manage status, delivery, labels, and package readiness from one place." />

      <Card>
        <View style={styles.summaryRow}>
          <StatusChip label={labelValue(order.status ?? "ORDER")} />
          <StatusChip label={labelValue(order.deliveryStatus ?? "DELIVERY")} tone="warning" />
          <StatusChip label={labelValue(order.paymentStatus ?? "PAYMENT")} tone="success" />
        </View>
        <Text style={styles.summaryValue}>Seller total: {formatMoney(sellerTotalPaise, order.currency ?? "INR")}</Text>
        {(order.items ?? []).map((item) => (
          <Text key={item.id} style={styles.itemText}>
            {item.productNameSnapshot ?? item.id} x {item.quantity ?? 1}
          </Text>
        ))}
      </Card>

      <Card>
        <Field label="Operation note" value={note} onChangeText={setNote} placeholder="Add context for this fulfilment update" multiline />
        <View style={styles.buttonGrid}>
          {actions.includes("ACCEPT") ? (
            <Button
              title="Accept"
              onPress={() => {
                setActiveAction("ACCEPT");
                statusMutation.mutate("ACCEPTED");
              }}
              loading={activeAction === "ACCEPT" && statusMutation.isPending}
            />
          ) : null}
          {actions.includes("PROCESSING") ? (
            <Button
              title="Processing"
              tone="secondary"
              onPress={() => {
                setActiveAction("PROCESSING");
                statusMutation.mutate("PROCESSING");
              }}
              loading={activeAction === "PROCESSING" && statusMutation.isPending}
            />
          ) : null}
          {actions.includes("PACKED") ? (
            <Button
              title="Packed"
              tone="secondary"
              onPress={() => void submitDeliveryAction(order, "PACKED", currentDeliveryForm)}
              loading={activeAction === "PACKED" && deliveryMutation.isPending}
            />
          ) : null}
          {actions.includes("DISPATCHED") ? (
            <Button
              title="Dispatch"
              onPress={() => void submitDeliveryAction(order, "DISPATCHED", currentDeliveryForm)}
              loading={activeAction === "DISPATCHED" && deliveryMutation.isPending}
            />
          ) : null}
          {actions.includes("DELIVERED") ? (
            <Button
              title="Delivered"
              onPress={() => void submitDeliveryAction(order, "DELIVERED", currentDeliveryForm)}
              loading={activeAction === "DELIVERED" && deliveryMutation.isPending}
            />
          ) : null}
          {actions.includes("CANCELLED") ? (
            <Button title="Cancel order" tone="danger" onPress={() => setConfirmCancelVisible(true)} />
          ) : null}
        </View>
      </Card>

      <Card>
        <SelectField
          label="Delivery mode"
          options={deliveryModeOptions.map((option) => ({ label: option.label, value: option.value }))}
          selectedValue={currentDeliveryForm.deliveryMode}
          onSelect={(value) => updateDeliveryField("deliveryMode", value as DeliveryFormValues["deliveryMode"])}
        />
        <Field
          label="Courier or partner name"
          value={currentDeliveryForm.partnerName}
          onChangeText={(value) => updateDeliveryField("partnerName", value)}
          placeholder="Blue Dart, in-house rider, pickup desk"
        />
        <Field
          label="Partner phone"
          value={currentDeliveryForm.partnerPhone}
          onChangeText={(value) => updateDeliveryField("partnerPhone", value)}
          keyboardType="phone-pad"
          placeholder="Contact number"
        />
        <Field
          label="Tracking reference"
          value={currentDeliveryForm.trackingReference}
          onChangeText={(value) => updateDeliveryField("trackingReference", value)}
          autoCapitalize="characters"
          placeholder="Required for courier dispatch"
          error={deliveryErrors.trackingReference}
        />
        <Field
          label="Estimated delivery date"
          value={currentDeliveryForm.estimatedDeliveryDate}
          onChangeText={(value) => updateDeliveryField("estimatedDeliveryDate", value)}
          placeholder="YYYY-MM-DD"
          error={deliveryErrors.estimatedDeliveryDate}
        />
        <Field
          label="Receiver name"
          value={currentDeliveryForm.receiverName}
          onChangeText={(value) => updateDeliveryField("receiverName", value)}
          placeholder="Who received the package"
          error={deliveryErrors.receiverName}
        />
        <Field
          label="Delivery note"
          value={currentDeliveryForm.deliveryNote}
          onChangeText={(value) => updateDeliveryField("deliveryNote", value)}
          placeholder="Dispatch note, pickup note, or handoff note"
          multiline
        />
        <Field
          label="Proof note"
          value={currentDeliveryForm.proofNote}
          onChangeText={(value) => updateDeliveryField("proofNote", value)}
          placeholder="Short proof summary"
        />
        <Field
          label="Proof reference"
          value={currentDeliveryForm.proofReference}
          onChangeText={(value) => updateDeliveryField("proofReference", value)}
          placeholder="Photo id, slip id, or receiver reference"
        />
        {isCodVisible(order, currentDeliveryForm.deliveryMode) ? (
          <>
            <SelectField
              label="COD collected"
              options={[
                { label: "Yes", value: "true" },
                { label: "No", value: "false" },
              ]}
              selectedValue={String(currentDeliveryForm.codCollected)}
              onSelect={(value) => updateDeliveryField("codCollected", value === "true")}
            />
            {currentDeliveryForm.codCollected ? (
              <>
                <Field
                  label={`Collected amount (max ${formatMoney(sellerTotalPaise, order.currency ?? "INR")})`}
                  value={currentDeliveryForm.codCollectedAmountRupees}
                  onChangeText={(value) => updateDeliveryField("codCollectedAmountRupees", value)}
                  keyboardType="decimal-pad"
                  placeholder={paiseToRupees(sellerTotalPaise)}
                  error={deliveryErrors.codCollectedAmountRupees}
                />
                <Field
                  label="Collection note"
                  value={currentDeliveryForm.codCollectionNote}
                  onChangeText={(value) => updateDeliveryField("codCollectionNote", value)}
                  placeholder="Cash received, receipt number, or handoff note"
                  multiline
                />
              </>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Packages</Text>
        {packages.length === 0 ? (
          <Text style={styles.mutedText}>No seller package data is available yet.</Text>
        ) : (
          packages.map((shipmentPackage) => {
            const form = packageForms[shipmentPackage.id] ?? createPackageForm(shipmentPackage);
            return (
              <View key={shipmentPackage.id} style={styles.packageCard}>
                <Text style={styles.packageTitle}>{shipmentPackage.packageNumber ?? "Package"}</Text>
                <Text style={styles.packageMeta}>
                  {labelValue(shipmentPackage.status ?? "PENDING")}
                  {shipmentPackage.awbNumber ? ` - AWB ${shipmentPackage.awbNumber}` : ""}
                </Text>
                {shipmentPackage.courierName ? <Text style={styles.packageMeta}>Courier: {shipmentPackage.courierName}</Text> : null}
                {shipmentPackage.courierTrackingStatusLabel ? (
                  <Text style={styles.packageMeta}>Tracking: {shipmentPackage.courierTrackingStatusLabel}</Text>
                ) : null}
                {shipmentPackage.trackingUrl ? (
                  <Button title="Open tracking" tone="secondary" onPress={() => void Linking.openURL(shipmentPackage.trackingUrl!)} />
                ) : null}
                <Field
                  label="Weight (g)"
                  keyboardType="number-pad"
                  value={form.weightGrams}
                  onChangeText={(value) => updatePackageField(shipmentPackage.id, "weightGrams", value)}
                />
                <View style={styles.dimensionRow}>
                  <View style={styles.dimensionCell}>
                    <Field
                      label="L"
                      keyboardType="number-pad"
                      value={form.lengthCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "lengthCm", value)}
                    />
                  </View>
                  <View style={styles.dimensionCell}>
                    <Field
                      label="B"
                      keyboardType="number-pad"
                      value={form.breadthCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "breadthCm", value)}
                    />
                  </View>
                  <View style={styles.dimensionCell}>
                    <Field
                      label="H"
                      keyboardType="number-pad"
                      value={form.heightCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "heightCm", value)}
                    />
                  </View>
                </View>
                <View style={styles.buttonGrid}>
                  <Button
                    title="Save package"
                    tone="secondary"
                    onPress={() => void savePackage(shipmentPackage, false)}
                    loading={packageBusyId === shipmentPackage.id}
                    disabled={Boolean(packageBusyId)}
                  />
                  <Button
                    title="Ready for booking"
                    onPress={() => void savePackage(shipmentPackage, true)}
                    loading={packageBusyId === `${shipmentPackage.id}:ready`}
                    disabled={Boolean(packageBusyId)}
                  />
                  {shipmentPackage.canDownloadLabel && shipmentPackage.labelDownloadUrl ? (
                    <Button
                      title="Open label"
                      tone="secondary"
                      onPress={() => void openLabel(shipmentPackage)}
                      loading={labelLoadingId === shipmentPackage.id}
                      disabled={Boolean(labelLoadingId)}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Shipment timeline</Text>
        {timeline.length === 0 ? (
          <Text style={styles.mutedText}>No shipment activity has been recorded yet.</Text>
        ) : (
          timeline.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <Text style={styles.timelineStatus}>{labelValue(entry.status)}</Text>
              <Text style={styles.timelineNote}>{entry.note}</Text>
              <Text style={styles.timelineAt}>{formatTimelineDate(entry.at)}</Text>
            </View>
          ))
        )}
      </Card>

      <ConfirmDialog
        visible={confirmCancelVisible}
        title="Cancel this order?"
        message="This will request seller-side cancellation before dispatch. The backend will still enforce the final rule."
        onCancel={() => setConfirmCancelVisible(false)}
        onConfirm={() => {
          setConfirmCancelVisible(false);
          void submitDeliveryAction(order, "CANCELLED", currentDeliveryForm);
        }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );

  function updateDeliveryField<Key extends keyof DeliveryFormValues>(key: Key, value: DeliveryFormValues[Key]) {
    setDeliveryForm((current) => ({ ...(current ?? currentDeliveryForm), [key]: value }));
    setDeliveryErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updatePackageField(packageId: string, key: keyof PackageFormValues, value: string) {
    setPackageForms((current) => ({
      ...current,
      [packageId]: {
        ...(current[packageId] ?? createPackageForm(packages.find((entry) => entry.id === packageId))),
        [key]: value,
      },
    }));
  }

  async function submitDeliveryAction(currentOrder: SellerOrder, action: SellerOrderAction, values: DeliveryFormValues) {
    setActiveAction(action);
    const result = validateDeliveryForm(currentOrder, action, values);
    if (!result.valid) {
      setDeliveryErrors(result.errors);
      setActiveAction(null);
      return;
    }
    await deliveryMutation.mutateAsync({ action, payload: result.payload });
  }

  async function savePackage(shipmentPackage: SellerOrderPackage, markReadyForBooking: boolean) {
    const form = packageForms[shipmentPackage.id] ?? createPackageForm(shipmentPackage);
    const payload = packageUpdatePayload(form, markReadyForBooking);
    if (Object.keys(payload).length === 0) {
      setToast({ visible: true, message: "Add valid positive package dimensions before saving.", type: "error" });
      return;
    }
    const busyKey = markReadyForBooking ? `${shipmentPackage.id}:ready` : shipmentPackage.id;
    setPackageBusyId(busyKey);
    try {
      await updateSellerPackage(auth.authHeaders, shipmentPackage.id, payload);
      await invalidateOrderQueries();
      setToast({
        visible: true,
        message: markReadyForBooking ? "Package marked ready for booking." : "Package dimensions saved.",
        type: "success",
      });
    } catch (error) {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Package update failed.", type: "error" });
    } finally {
      setPackageBusyId(null);
    }
  }

  async function openLabel(shipmentPackage: SellerOrderPackage) {
    if (!shipmentPackage.labelDownloadUrl || labelLoadingId !== null) {
      return;
    }
    setLabelLoadingId(shipmentPackage.id);
    try {
      await openSellerPackageLabel(auth.authHeaders, shipmentPackage.labelDownloadUrl);
    } catch (error) {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Courier label could not be opened right now.", type: "error" });
    } finally {
      setLabelLoadingId(null);
    }
  }
}

function actionSuccessMessage(action: SellerOrderAction) {
  switch (action) {
    case "PACKED":
      return "Package marked packed.";
    case "DISPATCHED":
      return "Order marked dispatched.";
    case "DELIVERED":
      return "Order marked delivered.";
    case "CANCELLED":
      return "Order cancelled.";
    default:
      return "Order updated.";
  }
}

function collectPackages(order?: SellerOrder) {
  return (order?.shipments ?? []).flatMap((shipment) => shipment.packages ?? []);
}

function createPackageForm(shipmentPackage?: SellerOrderPackage): PackageFormValues {
  return {
    weightGrams: shipmentPackage?.weightGrams ? String(shipmentPackage.weightGrams) : "",
    lengthCm: shipmentPackage?.lengthCm ? String(shipmentPackage.lengthCm) : "",
    breadthCm: shipmentPackage?.breadthCm ? String(shipmentPackage.breadthCm) : "",
    heightCm: shipmentPackage?.heightCm ? String(shipmentPackage.heightCm) : "",
  };
}

function isCodVisible(order: SellerOrder, deliveryMode: DeliveryFormValues["deliveryMode"]) {
  const codOrder = (order.payments ?? []).some((payment) => payment.method === "COD");
  return codOrder && ["STORE_PICKUP", "MANUAL_TRANSPORT", "THIRD_PARTY_COURIER"].includes(deliveryMode);
}

function labelValue(value: string) {
  return value.replace(/_/g, " ");
}

function formatTimelineDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  itemText: {
    color: colors.muted,
    fontWeight: "700",
  },
  buttonGrid: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  mutedText: {
    color: colors.muted,
  },
  packageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  packageTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  packageMeta: {
    color: colors.muted,
  },
  dimensionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dimensionCell: {
    flex: 1,
  },
  timelineRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  timelineStatus: {
    color: colors.ink,
    fontWeight: "800",
  },
  timelineNote: {
    color: colors.muted,
  },
  timelineAt: {
    color: colors.muted,
    fontSize: 12,
  },
});
