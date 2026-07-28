import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  OperationsHeader,
  OperationsSection,
} from "../../src/components/operations-ui";
import {
  Button,
  CollapsibleSection,
  ConfirmDialog,
  Field,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  formatOperationDateTime,
  operationStatus,
} from "../../src/features/seller/operations-presentation";
import {
  availableSellerOrderActions,
  buildSellerTimeline,
  createDeliveryForm,
  isManualTransportCodCollection,
  openSellerPackageLabel,
  packageUpdatePayload,
  sellerCollectedCodExpectedPaise,
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
  const { width } = useWindowDimensions();
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
  const sellerCodExpectedPaise = order ? sellerCollectedCodExpectedPaise(order) : 0;
  const packages = useMemo(() => collectPackages(order), [order]);
  const isTablet = width >= 700;

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
        <OperationsHeader
          onBack={() => router.back()}
          title={decodedOrderNumber || "Order detail"}
          subtitle="Seller fulfilment workspace"
        />
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
    <Screen
      refreshing={orderQuery.isFetching}
      onRefresh={() => {
        void orderQuery.refetch();
      }}
    >
      <OperationsHeader
        onBack={() => router.back()}
        title={decodedOrderNumber}
        subtitle="Manage the next fulfilment step, package readiness, handoff, labels, and tracking."
      />

      <View style={styles.summarySurface}>
        {order.orderKind === "REPLACEMENT" ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: "#ED3500", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>
              Replacement order
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginTop: 2 }}>
              {order.parentOrder?.orderNumber ? `Original order ${order.parentOrder.orderNumber}` : "Created after return quality check"}
              {order.replacementReturnRequest?.requestNumber ? ` / ${order.replacementReturnRequest.requestNumber}` : ""}
            </Text>
          </View>
        ) : null}
        <View style={styles.summaryRow}>
          <StatusChip
            label={operationStatus(order.sellerSplits?.[0]?.sellerStatus ?? order.orderStatus ?? order.status).label}
            tone={operationStatus(order.sellerSplits?.[0]?.sellerStatus ?? order.orderStatus ?? order.status).tone}
          />
          <StatusChip
            label={operationStatus(order.deliveryStatus).label}
            tone={operationStatus(order.deliveryStatus).tone}
          />
          <StatusChip
            label={operationStatus(order.paymentStatus).label}
            tone={operationStatus(order.paymentStatus).tone}
          />
        </View>
        <Text style={styles.summaryValue}>Seller total: {formatMoney(sellerTotalPaise, order.currency ?? "INR")}</Text>
        {sellerReceivableSummaries(order).map((receivable) => (
          <View key={receivable.id} style={styles.receivableBox}>
            <Text style={styles.receivableTitle}>Seller-collected COD platform due</Text>
            <Text style={styles.receivableMeta}>
              {receivable.receivableNumber} / {labelValue(receivable.status)} / Outstanding{" "}
              {formatMoney(receivable.outstandingPaise, receivable.currency ?? order.currency ?? "INR")}
            </Text>
          </View>
        ))}
        <View style={styles.itemList}>
          {(order.items ?? []).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text numberOfLines={2} style={styles.itemText}>
                {item.productNameSnapshot ?? item.id}
              </Text>
              <Text style={styles.itemQuantity}>x {item.quantity ?? 1}</Text>
            </View>
          ))}
        </View>
      </View>

      <OperationsSection
        title="Next fulfilment step"
        subtitle={
          actions.length
            ? "Only actions valid for the current seller and delivery status are shown."
            : "No seller action is currently required for this order."
        }
      >
        <View style={styles.actionSurface}>
          {actions.length ? (
            <Field label="Operation note" value={note} onChangeText={setNote} placeholder="Add context for this fulfilment update" multiline />
          ) : (
            <Text style={styles.mutedText}>This order is complete or its next update is handled by the assigned delivery workflow.</Text>
          )}
          <View style={[styles.buttonGrid, isTablet ? styles.buttonGridTablet : null]}>
          {actions.includes("ACCEPT") ? (
            <Button
              title="Accept order"
              onPress={() => {
                setActiveAction("ACCEPT");
                statusMutation.mutate("ACCEPTED");
              }}
              loading={activeAction === "ACCEPT" && statusMutation.isPending}
              style={styles.actionButton}
            />
          ) : null}
          {actions.includes("PROCESSING") ? (
            <Button
              title="Start processing"
              tone="secondary"
              onPress={() => {
                setActiveAction("PROCESSING");
                statusMutation.mutate("PROCESSING");
              }}
              loading={activeAction === "PROCESSING" && statusMutation.isPending}
              style={styles.actionButton}
            />
          ) : null}
          {actions.includes("PACKED") ? (
            <Button
              title="Mark packed"
              tone="secondary"
              onPress={() => void submitDeliveryAction(order, "PACKED", currentDeliveryForm)}
              loading={activeAction === "PACKED" && deliveryMutation.isPending}
              style={styles.actionButton}
            />
          ) : null}
          {actions.includes("DISPATCHED") ? (
            <Button
              title="Dispatch"
              onPress={() => void submitDeliveryAction(order, "DISPATCHED", currentDeliveryForm)}
              loading={activeAction === "DISPATCHED" && deliveryMutation.isPending}
              style={styles.actionButton}
            />
          ) : null}
          {actions.includes("DELIVERED") ? (
            <Button
              title="Mark delivered"
              onPress={() => void submitDeliveryAction(order, "DELIVERED", currentDeliveryForm)}
              loading={activeAction === "DELIVERED" && deliveryMutation.isPending}
              style={styles.actionButton}
            />
          ) : null}
          {actions.includes("CANCELLED") ? (
            <Button title="Cancel order" tone="danger" onPress={() => setConfirmCancelVisible(true)} style={styles.actionButton} />
          ) : null}
          </View>
        </View>
      </OperationsSection>

      <CollapsibleSection
        title="Delivery and handoff"
        defaultOpen={actions.includes("DISPATCHED") || actions.includes("DELIVERED")}
      >
        <SelectField
          label="Delivery mode"
          options={deliveryModeOptions.map((option) => ({ label: option.label, value: option.value }))}
          selectedValue={currentDeliveryForm.deliveryMode}
          onSelect={(value) => updateDeliveryField("deliveryMode", value as DeliveryFormValues["deliveryMode"])}
        />
        <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
          <View style={styles.responsiveField}>
            <Field
              label="Courier or partner name"
              value={currentDeliveryForm.partnerName}
              onChangeText={(value) => updateDeliveryField("partnerName", value)}
              placeholder="Blue Dart, in-house rider, pickup desk"
            />
          </View>
          <View style={styles.responsiveField}>
            <Field
              label="Partner phone"
              value={currentDeliveryForm.partnerPhone}
              onChangeText={(value) => updateDeliveryField("partnerPhone", value)}
              keyboardType="phone-pad"
              placeholder="Contact number"
            />
          </View>
        </View>
        <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
          <View style={styles.responsiveField}>
            <Field
              label="Tracking reference"
              value={currentDeliveryForm.trackingReference}
              onChangeText={(value) => updateDeliveryField("trackingReference", value)}
              autoCapitalize="characters"
              placeholder="Required for courier dispatch"
              error={deliveryErrors.trackingReference}
            />
          </View>
          <View style={styles.responsiveField}>
            <Field
              label="Estimated delivery date"
              value={currentDeliveryForm.estimatedDeliveryDate}
              onChangeText={(value) => updateDeliveryField("estimatedDeliveryDate", value)}
              placeholder="YYYY-MM-DD"
              error={deliveryErrors.estimatedDeliveryDate}
            />
          </View>
        </View>
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
          label="Delivery proof ID or link"
          value={currentDeliveryForm.proofReference}
          onChangeText={(value) => updateDeliveryField("proofReference", value)}
          placeholder="Photo id, slip id, or receiver reference"
        />
        {isCodVisible(order, currentDeliveryForm.deliveryMode) ? (
          <>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Cash collected from customer</Text>
                <Text style={deliveryErrors.codCollected ? styles.fieldError : styles.mutedText}>
                  {deliveryErrors.codCollected ?? "Required before marking a manual-transport COD order delivered."}
                </Text>
              </View>
              <Switch
                accessibilityLabel="Cash collected from customer"
                accessibilityRole="switch"
                accessibilityState={{ checked: currentDeliveryForm.codCollected }}
                onValueChange={(value) => updateDeliveryField("codCollected", value)}
                thumbColor={colors.surface}
                trackColor={{ false: "#D1D5DB", true: colors.primary }}
                value={currentDeliveryForm.codCollected}
              />
            </View>
            {currentDeliveryForm.codCollected ? (
              <>
                <Field
                  label={`Collected amount (${formatMoney(sellerCodExpectedPaise, order.currency ?? "INR")})`}
                  value={currentDeliveryForm.codCollectedAmountRupees}
                  onChangeText={(value) => updateDeliveryField("codCollectedAmountRupees", value)}
                  keyboardType="decimal-pad"
                  placeholder={paiseToRupees(sellerCodExpectedPaise)}
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
      </CollapsibleSection>

      <CollapsibleSection
        title={`Packages (${packages.length})`}
        defaultOpen={packages.some((shipmentPackage) => !shipmentPackage.readyForBookingAt)}
      >
        {packages.length === 0 ? (
          <Text style={styles.mutedText}>No seller package data is available yet.</Text>
        ) : (
          packages.map((shipmentPackage, packageIndex) => {
            const form = packageForms[shipmentPackage.id] ?? createPackageForm(shipmentPackage);
            return (
              <View
                key={shipmentPackage.id}
                style={[
                  styles.packageRow,
                  packageIndex > 0 ? styles.packageDivider : null,
                ]}
              >
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
                      label="L (cm)"
                      keyboardType="number-pad"
                      value={form.lengthCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "lengthCm", value)}
                    />
                  </View>
                  <View style={styles.dimensionCell}>
                    <Field
                      label="W (cm)"
                      keyboardType="number-pad"
                      value={form.breadthCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "breadthCm", value)}
                    />
                  </View>
                  <View style={styles.dimensionCell}>
                    <Field
                      label="H (cm)"
                      keyboardType="number-pad"
                      value={form.heightCm}
                      onChangeText={(value) => updatePackageField(shipmentPackage.id, "heightCm", value)}
                    />
                  </View>
                </View>
                <View style={[styles.buttonGrid, isTablet ? styles.buttonGridTablet : null]}>
                  <Button
                    title="Save package"
                    tone="secondary"
                    onPress={() => void savePackage(shipmentPackage, false)}
                    loading={packageBusyId === shipmentPackage.id}
                    disabled={Boolean(packageBusyId)}
                    style={styles.actionButton}
                  />
                  <Button
                    title="Ready for booking"
                    onPress={() => void savePackage(shipmentPackage, true)}
                    loading={packageBusyId === `${shipmentPackage.id}:ready`}
                    disabled={Boolean(packageBusyId)}
                    style={styles.actionButton}
                  />
                  {shipmentPackage.canDownloadLabel && shipmentPackage.labelDownloadUrl ? (
                    <Button
                      title="Open label"
                      tone="secondary"
                      onPress={() => void openLabel(shipmentPackage)}
                      loading={labelLoadingId === shipmentPackage.id}
                      disabled={Boolean(labelLoadingId)}
                      style={styles.actionButton}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </CollapsibleSection>

      <CollapsibleSection title={`Shipment timeline (${timeline.length})`}>
        {timeline.length === 0 ? (
          <Text style={styles.mutedText}>No shipment activity has been recorded yet.</Text>
        ) : (
          timeline.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <Text style={styles.timelineStatus}>{labelValue(entry.status)}</Text>
              <Text style={styles.timelineNote}>{entry.note}</Text>
              <Text style={styles.timelineAt}>{formatOperationDateTime(entry.at)}</Text>
            </View>
          ))
        )}
      </CollapsibleSection>

      <ConfirmDialog
        visible={confirmCancelVisible}
        title="Cancel this order?"
        message="Cancellation is available only before dispatch. This action is recorded in the order history."
        confirmLabel="Cancel order"
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
    try {
      await deliveryMutation.mutateAsync({ action, payload: result.payload });
    } catch {
      // Mutation feedback is shown by onError.
    }
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

function sellerReceivableSummaries(order: SellerOrder) {
  const fromOrder = order.sellerCashReceivables ?? [];
  const fromSplits = (order.sellerSplits ?? []).flatMap((split) => split.sellerCashReceivables ?? []);
  const fromShipments = (order.shipments ?? []).flatMap((shipment) => shipment.sellerCashReceivable ? [shipment.sellerCashReceivable] : []);
  return [...new Map([...fromOrder, ...fromSplits, ...fromShipments].map((receivable) => [receivable.id, receivable])).values()];
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
  return isManualTransportCodCollection(order, deliveryMode);
}

function labelValue(value: string) {
  return operationStatus(value).label;
}

const styles = StyleSheet.create({
  summarySurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
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
    flex: 1,
    color: colors.muted,
    fontWeight: "700",
  },
  itemList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  itemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  itemQuantity: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  receivableBox: {
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: spacing.sm,
    backgroundColor: "#FFF7F5",
  },
  receivableTitle: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  receivableMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  buttonGrid: {
    gap: spacing.sm,
  },
  buttonGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 150,
  },
  actionSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  responsiveFields: {
    gap: spacing.md,
  },
  responsiveFieldsTablet: {
    flexDirection: "row",
  },
  responsiveField: {
    flex: 1,
    minWidth: 0,
  },
  mutedText: {
    color: colors.muted,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 56,
  },
  switchCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  switchTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  packageRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  packageDivider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
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
