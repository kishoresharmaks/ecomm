"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  FileCheck2,
  Package,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Smartphone,
  Truck,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminConfirmationDialog } from "@/components/admin/admin-ux";
import { useB2BAuth } from "./b2b-auth";
import {
  B2BPanel,
  B2BStatusPill,
  formatDateTime,
  formatMoney,
} from "./b2b-ui";
import { useSellerAuth } from "@/components/seller/seller-ui";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  b2bAction,
  createBuyerB2BOnlinePayment,
  downloadB2BDocument,
  getAdminB2BOperation,
  getBuyerB2BOperation,
  getSellerB2BOperation,
  idempotencyKey,
  listAdminB2BDeliveryPartners,
  verifyBuyerB2BOnlinePayment,
  type B2BOperationalOrder,
} from "@/lib/b2b-operations-api";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";

export function BuyerB2BV2OperationsPanel({ orderNumber }: { orderNumber: string }) {
  const auth = useB2BAuth();
  const query = useQuery({
    queryKey: ["b2b-v2-buyer-order", auth.authKey, orderNumber],
    queryFn: () => getBuyerB2BOperation(auth.authHeaders, orderNumber),
    enabled: auth.enabled,
    retry: false,
  });

  if (!auth.enabled || query.isLoading || !query.data) {
    return query.isLoading ? <B2BPanel><div className="h-48 animate-pulse rounded-md bg-[#F8FAFC]" /></B2BPanel> : null;
  }

  return (
    <BuyerOperationsBody
      order={query.data}
      authHeaders={auth.authHeaders}
      onRefresh={() => void query.refetch()}
    />
  );
}

function BuyerOperationsBody({
  order,
  authHeaders,
  onRefresh,
}: {
  order: B2BOperationalOrder;
  authHeaders: Parameters<typeof getBuyerB2BOperation>[0];
  onRefresh: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [payingScheduleId, setPayingScheduleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: ({
      path,
      payload,
    }: {
      path: string;
      payload: Record<string, unknown>;
    }) => b2bAction(authHeaders, path, payload, "POST", idempotencyKey("buyer-b2b")),
    onSuccess: () => {
      setNotice("Action saved.");
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ["b2b-v2-buyer-order"] });
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const primaryShipment = order.shipments[0];

  async function download(path: string, fallbackFileName: string) {
    try {
      setDownloading(true);
      await downloadB2BDocument(authHeaders, path, fallbackFileName);
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  async function payOnline(
    schedule: B2BOperationalOrder["paymentSchedules"][number],
    method: "RAZORPAY" | "UPI",
  ) {
    const amountPaise = Math.max(0, schedule.amountPaise - schedule.paidAmountPaise);
    if (!amountPaise) return;
    try {
      setNotice(null);
      setPayingScheduleId(schedule.id);
      const providerOrder = await createBuyerB2BOnlinePayment(
        authHeaders,
        order.orderNumber,
        {
          method,
          amountPaise,
          paymentScheduleId: schedule.id,
        },
        idempotencyKey(`b2b-${method.toLowerCase()}-order`),
      );
      const checkout = await openRazorpayCheckout(
        providerOrder,
        `${schedule.label} / ${order.orderNumber}`,
        method === "UPI" ? "upi" : undefined,
      );
      if (!checkout) {
        setNotice("Payment window closed. The order remains unpaid.");
        return;
      }
      await verifyBuyerB2BOnlinePayment(
        authHeaders,
        order.orderNumber,
        {
          paymentRecordId: providerOrder.paymentRecordId,
          razorpayOrderId: checkout.razorpay_order_id,
          razorpayPaymentId: checkout.razorpay_payment_id,
          razorpaySignature: checkout.razorpay_signature,
        },
        idempotencyKey("b2b-online-payment-verify"),
      );
      setNotice("Payment verified and allocated to the B2B schedule.");
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ["b2b-v2-buyer-order"] });
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setPayingScheduleId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <B2BPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading
            title="Order-to-cash tracking"
            description="Follow fulfilment, compliance, delivery evidence, payment schedules, and buyer acceptance from one record."
          />
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <B2BStatusPill status={order.status} />
          <StatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>
            {order.paymentStatus.replaceAll("_", " ")}
          </StatusBadge>
          <span className="text-sm font-bold text-[#667085]">Version {order.version}</span>
        </div>
        {notice ? <p className="mt-3 text-sm font-bold text-[#ED3500]">{notice}</p> : null}
      </B2BPanel>

      <AmendmentRequestPanel
        order={order}
        authHeaders={authHeaders}
        path={`/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/amendments`}
        onSaved={onRefresh}
      />

      <LineProgressPanel order={order} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SchedulePanel order={order} />
        <ShipmentPanel order={order} />
      </div>

      <B2BPanel>
        <SectionHeading
          title="Pay B2B milestones"
          description="Pay an outstanding instalment through Razorpay Checkout or a UPI-only checkout."
        />
        <div className="mt-4 grid gap-3">
          {order.paymentSchedules.map((schedule) => {
            const outstanding = Math.max(
              0,
              schedule.amountPaise - schedule.paidAmountPaise,
            );
            return (
              <div
                key={schedule.id}
                className="flex flex-col gap-3 border-b border-[#EEF2F6] pb-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-black text-[#1F2933]">{schedule.label}</p>
                  <p className="text-sm font-semibold text-[#667085]">
                    {outstanding
                      ? `${formatMoney(outstanding)} outstanding`
                      : "This instalment is settled"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!outstanding || payingScheduleId !== null}
                    onClick={() => void payOnline(schedule, "RAZORPAY")}
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Pay online
                  </Button>
                  <Button
                    type="button"
                    disabled={!outstanding || payingScheduleId !== null}
                    onClick={() => void payOnline(schedule, "UPI")}
                  >
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                    Pay by UPI
                  </Button>
                </div>
              </div>
            );
          })}
          {!order.paymentSchedules.length ? (
            <p className="text-sm font-semibold text-[#667085]">
              Payment schedule will appear after commercial approval.
            </p>
          ) : null}
        </div>
      </B2BPanel>

      {primaryShipment?.proofOfDelivery ? (
        <B2BPanel>
          <SectionHeading title="Delivery decision" description="Review the authenticated POD before accepting or disputing delivery." />
          <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085] md:grid-cols-3">
            <Info label="Receiver" value={primaryShipment.proofOfDelivery.receiverName} />
            <Info label="Delivered" value={formatDateTime(primaryShipment.proofOfDelivery.deliveredAt)} />
            <Info label="Acceptance due" value={formatDateTime(primaryShipment.acceptanceDueAt)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {podEvidenceCount(primaryShipment.proofOfDelivery.proofFileKeys) > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={downloading}
                onClick={() =>
                  void download(
                    `/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/shipments/${primaryShipment.id}/pod/0`,
                    `${primaryShipment.shipmentNumber}-pod`,
                  )
                }
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Download POD
              </Button>
            ) : null}
            {primaryShipment.proofOfDelivery.signatureFileKey ? (
              <Button
                type="button"
                variant="outline"
                disabled={downloading}
                onClick={() =>
                  void download(
                    `/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/shipments/${primaryShipment.id}/pod/signature`,
                    `${primaryShipment.shipmentNumber}-signature`,
                  )
                }
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Download signature
              </Button>
            ) : null}
          </div>
          {primaryShipment.acceptanceStatus === "PENDING" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  action.mutate({
                    path: `/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/shipments/${primaryShipment.id}/accept`,
                    payload: { version: order.version },
                  })
                }
                disabled={action.isPending}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Accept delivery
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  action.mutate({
                    path: `/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/shipments/${primaryShipment.id}/dispute`,
                    payload: { version: order.version, disputeReason: disputeReason.trim() },
                  })
                }
                disabled={action.isPending || disputeReason.trim().length < 3}
              >
                Dispute delivery
              </Button>
              <input
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                placeholder="Reason for dispute"
                className="h-10 min-w-64 flex-1 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
              />
            </div>
          ) : <B2BStatusPill status={primaryShipment.acceptanceStatus} />}
        </B2BPanel>
      ) : null}

      {order.paymentRecords.some((payment) => payment.receiptVoucher) ? (
        <B2BPanel>
          <SectionHeading title="Payment receipts" description="Download authenticated receipt vouchers for cleared and verified payments." />
          <div className="mt-4 flex flex-wrap gap-2">
            {order.paymentRecords.filter((payment) => payment.receiptVoucher).map((payment) => (
              <Button
                key={payment.id}
                type="button"
                variant="outline"
                disabled={downloading}
                onClick={() =>
                  void download(
                    `/api/b2b/v2/orders/${encodeURIComponent(order.orderNumber)}/payments/${payment.id}/receipt`,
                    `${payment.receiptVoucher?.voucherNumber ?? "b2b-receipt"}.pdf`,
                  )
                }
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {payment.receiptVoucher?.voucherNumber}
              </Button>
            ))}
          </div>
        </B2BPanel>
      ) : null}

      <B2BPanel>
        <SectionHeading title="Order history" description="Every lifecycle change is recorded with the current operational state." />
        <div className="mt-4 grid gap-3">
          {order.events.map((event) => (
            <div key={event.id} className="flex flex-col gap-1 border-l-2 border-[#FFB19B] pl-3">
              <div className="flex flex-wrap items-center gap-2"><B2BStatusPill status={event.status} /><span className="text-xs font-bold text-[#98A2B3]">{formatDateTime(event.createdAt)}</span></div>
              <p className="text-sm font-semibold text-[#667085]">{event.note ?? "Status updated."}</p>
            </div>
          ))}
        </div>
      </B2BPanel>
    </div>
  );
}

export function SellerB2BV2OperationsPanel({ orderNumber }: { orderNumber: string }) {
  const auth = useSellerAuth();
  const query = useQuery({
    queryKey: ["b2b-v2-seller-order", auth.authKey, orderNumber],
    queryFn: () => getSellerB2BOperation(auth.authHeaders, orderNumber),
    enabled: auth.enabled,
    retry: false,
  });

  if (!auth.enabled || query.isLoading || !query.data) {
    return query.isLoading ? <B2BPanel><div className="h-64 animate-pulse rounded-md bg-[#F8FAFC]" /></B2BPanel> : null;
  }

  return (
    <SellerOperationsBody
      order={query.data}
      authHeaders={auth.authHeaders}
      onRefresh={() => void query.refetch()}
    />
  );
}

function SellerOperationsBody({
  order,
  authHeaders,
  onRefresh,
}: {
  order: B2BOperationalOrder;
  authHeaders: Parameters<typeof getSellerB2BOperation>[0];
  onRefresh: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [failureReason, setFailureReason] = useState("");
  const [transport, setTransport] = useState({ name: "", lr: "", awb: "", vehicle: "" });
  const [downloading, setDownloading] = useState(false);
  const [progressQuantities, setProgressQuantities] = useState<Record<string, string>>({});
  const action = useMutation({
    mutationFn: ({
      path,
      payload,
      method = "POST",
    }: {
      path: string;
      payload: Record<string, unknown>;
      method?: "POST" | "PATCH";
    }) => b2bAction(authHeaders, path, payload, method, idempotencyKey("seller-b2b")),
    onSuccess: () => {
      setNotice("Operation saved.");
      onRefresh();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const availableLines = order.lines.map((line) => ({
    orderLineId: line.id,
    source: sources[line.id] ?? line.fulfilmentPlan?.source ?? "AVAILABLE_STOCK",
    plannedQuantity: line.fulfilmentPlan?.plannedQuantity ?? line.quantity,
  }));
  const pendingTask = order.warehouseTasks.find((task) => ["PENDING", "IN_PROGRESS"].includes(task.status));
  const invoice = order.taxDocuments.find((document) => document.status === "ISSUED");
  const canPlan = [
    "IN_FULFILMENT",
    "PROCUREMENT_IN_PROGRESS",
    "PRODUCTION_IN_PROGRESS",
  ].includes(order.status);
  const canWarehouse = ["STOCK_READY", "PICKING", "PACKING", "QC_PENDING"].includes(order.status);
  const deliveredShipment = order.shipments.find((shipment) => shipment.proofOfDelivery);

  async function download(path: string, fallbackFileName: string) {
    try {
      setDownloading(true);
      await downloadB2BDocument(authHeaders, path, fallbackFileName);
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <B2BPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading title="Seller operations" description="Reserve, source, pick, pack, inspect, invoice, and dispatch this B2B order in sequence." />
          <div className="flex items-center gap-2"><B2BStatusPill status={order.status} /><Button type="button" variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button></div>
        </div>
        {notice ? <p className="mt-3 text-sm font-bold text-[#ED3500]">{notice}</p> : null}
      </B2BPanel>

      <AmendmentRequestPanel
        order={order}
        authHeaders={authHeaders}
        path={`/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/amendments`}
        onSaved={onRefresh}
      />

      <LineProgressPanel order={order} />

      {deliveredShipment?.proofOfDelivery &&
      podEvidenceCount(deliveredShipment.proofOfDelivery.proofFileKeys) > 0 ? (
        <B2BPanel>
          <SectionHeading title="Delivery evidence" description="Review the private POD attached by the assigned delivery partner." />
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            disabled={downloading}
            onClick={() =>
              void download(
                `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/shipments/${deliveredShipment.id}/pod/0`,
                `${deliveredShipment.shipmentNumber}-pod`,
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download POD
          </Button>
        </B2BPanel>
      ) : null}

      <B2BPanel>
        <SectionHeading title="Fulfilment plan" description="Choose whether each line uses reserved stock, procurement, or production." />
        <div className="mt-4 grid gap-3">
          {order.lines.map((line) => {
            const plan = line.fulfilmentPlan;
            const source = sources[line.id] ?? plan?.source ?? "AVAILABLE_STOCK";
            const procurement = plan?.procurementOrder;
            const production = plan?.productionJob;
            const progressValue = progressQuantities[line.id] ?? "";
            return (
              <div key={line.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-center">
                  <div><p className="font-black text-[#1F2933]">{line.description}</p><p className="text-xs font-semibold text-[#667085]">Qty {line.quantity} / {plan?.status ?? "Not planned"}</p></div>
                  <select value={source} onChange={(event) => setSources((current) => ({ ...current, [line.id]: event.target.value }))} className="h-10 rounded-md border border-[#D8E2EA] bg-white px-2 text-sm font-bold">
                    <option value="AVAILABLE_STOCK">Available stock</option><option value="PROCURE">Procure</option><option value="PRODUCE">Produce</option>
                  </select>
                  <StatusBadge tone={plan?.status === "READY" ? "success" : "warning"}>{plan?.status ?? "Pending"}</StatusBadge>
                </div>
                {plan && source === "PROCURE" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
                    {procurement ? <span className="text-sm font-bold text-[#667085]">{procurement.procurementNumber}: {procurement.receivedQuantity}/{procurement.orderedQuantity} received</span> : null}
                    {!procurement ? <Button type="button" size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/procurement-orders`, payload: { version: order.version, fulfilmentPlanId: plan.id } })}>Create procurement order</Button> : null}
                    {procurement && !["RECEIVED", "CANCELLED"].includes(procurement.status) ? (
                      <>
                        <input value={progressValue} onChange={(event) => setProgressQuantities((current) => ({ ...current, [line.id]: event.target.value }))} inputMode="numeric" placeholder="Received qty" className="h-9 w-32 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold" />
                        <Button type="button" size="sm" variant="outline" disabled={action.isPending || !progressValue} onClick={() => { const receivedQuantity = Math.min(procurement.orderedQuantity, Math.max(0, Number(progressValue))); action.mutate({ method: "PATCH", path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/procurement-orders/${procurement.id}`, payload: { version: order.version, status: receivedQuantity >= procurement.orderedQuantity ? "RECEIVED" : "PARTIALLY_RECEIVED", receivedQuantity, rejectedQuantity: procurement.rejectedQuantity } }); }}>Record receipt</Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {plan && source === "PRODUCE" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
                    {production ? <span className="text-sm font-bold text-[#667085]">{production.productionNumber}: {production.completedQuantity}/{production.plannedQuantity} completed</span> : null}
                    {!production ? <Button type="button" size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/production-jobs`, payload: { version: order.version, fulfilmentPlanId: plan.id } })}>Create production job</Button> : null}
                    {production && !["COMPLETED", "CANCELLED"].includes(production.status) ? (
                      <>
                        <input value={progressValue} onChange={(event) => setProgressQuantities((current) => ({ ...current, [line.id]: event.target.value }))} inputMode="numeric" placeholder="Completed qty" className="h-9 w-32 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold" />
                        <Button type="button" size="sm" variant="outline" disabled={action.isPending || !progressValue} onClick={() => { const completedQuantity = Math.min(production.plannedQuantity, Math.max(0, Number(progressValue))); action.mutate({ method: "PATCH", path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/production-jobs/${production.id}`, payload: { version: order.version, status: completedQuantity >= production.plannedQuantity ? "COMPLETED" : "IN_PROGRESS", completedQuantity, rejectedQuantity: production.rejectedQuantity } }); }}>Record completion</Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button className="mt-4" type="button" disabled={!canPlan || action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/fulfilment-plans`, payload: { version: order.version, lines: availableLines } })}>Save fulfilment plan</Button>
      </B2BPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <B2BPanel>
          <SectionHeading title="Warehouse" description="Create and complete pick or pack tasks against the immutable order lines." />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!canWarehouse || action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/warehouse-tasks`, payload: { version: order.version, taskType: "PICK" } })}><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Create pick task</Button>
            <Button type="button" variant="outline" disabled={!canWarehouse || action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/warehouse-tasks`, payload: { version: order.version, taskType: "PACK" } })}><Package className="h-4 w-4" aria-hidden="true" /> Create pack task</Button>
          </div>
          {pendingTask ? <Button className="mt-4" type="button" disabled={action.isPending} onClick={() => action.mutate({ method: "PATCH", path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/warehouse-tasks/${pendingTask.id}`, payload: { version: order.version, status: "COMPLETED", items: pendingTask.items.map((item) => ({ orderLineId: item.b2bOrderLineId, completedQuantity: item.requiredQuantity })) } })}>Complete {pendingTask.taskType.toLowerCase()} task</Button> : null}
        </B2BPanel>
        <B2BPanel>
          <SectionHeading title="Package and QC" description="Seal packages, record inspection evidence, and release the invoice gate." />
          <Button className="mt-4" type="button" variant="outline" disabled={!canWarehouse || action.isPending} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/packages`, payload: { version: order.version, itemAllocations: Object.fromEntries(order.lines.map((line) => [line.id, line.quantity])) } })}><Package className="h-4 w-4" aria-hidden="true" /> Create sealed package</Button>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Button type="button" disabled={action.isPending || !order.packages.length} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/qc-inspections`, payload: { version: order.version, packageId: order.packages[0]?.id, status: "PASSED", checklist: { quantity: true, packaging: true, quality: true } } })}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> QC passed</Button>
            <input value={failureReason} onChange={(event) => setFailureReason(event.target.value)} placeholder="Failure reason if held" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm" />
            <Button type="button" variant="outline" disabled={action.isPending || !failureReason.trim()} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/qc-inspections`, payload: { version: order.version, packageId: order.packages[0]?.id, status: "FAILED", checklist: { quantity: false }, failureReason } })}>Hold QC</Button>
          </div>
        </B2BPanel>
      </div>

      <B2BPanel>
        <SectionHeading title="Invoice and dispatch" description="Issue the final document before dispatch, then record transport and release the shipment." />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={action.isPending || Boolean(invoice) || order.status !== "PACKED_AND_QC_PASSED"} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/final-invoice`, payload: { version: order.version } })}><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Issue final invoice</Button>
          <input value={transport.name} onChange={(event) => setTransport((value) => ({ ...value, name: event.target.value }))} placeholder="Transporter" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm" />
          <input value={transport.lr} onChange={(event) => setTransport((value) => ({ ...value, lr: event.target.value }))} placeholder="LR number" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm" />
          <input value={transport.awb} onChange={(event) => setTransport((value) => ({ ...value, awb: event.target.value }))} placeholder="AWB number" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm" />
          <Button type="button" variant="outline" disabled={action.isPending || !invoice || Boolean(order.shipments.length)} onClick={() => action.mutate({ path: `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/shipments`, payload: { version: order.version, deliveryAddressSnapshot: order.businessBuyer?.addresses?.[0] ?? {}, transporterName: transport.name, lrNumber: transport.lr, awbNumber: transport.awb, packageIds: order.packages.map((item) => item.id) } })}><Truck className="h-4 w-4" aria-hidden="true" /> Prepare shipment</Button>
          {order.shipments[0] ? <DispatchShipmentButton order={order} shipment={order.shipments[0]} transport={transport} isPending={action.isPending} onDispatch={(path, payload) => action.mutate({ path, payload })} /> : null}
        </div>
      </B2BPanel>
    </div>
  );
}

function DispatchShipmentButton({
  order,
  shipment,
  transport,
  isPending,
  onDispatch,
}: {
  order: B2BOperationalOrder;
  shipment: B2BOperationalOrder["shipments"][number];
  transport: { name: string; lr: string; awb: string };
  isPending: boolean;
  onDispatch: (path: string, payload: Record<string, unknown>) => void;
}) {
  return (
    <Button
      type="button"
      disabled={isPending || !["READY", "DRAFT"].includes(shipment.status)}
      onClick={() =>
        onDispatch(
          `/api/seller/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/shipments/${shipment.id}/dispatch`,
          {
            version: order.version,
            transporterName: transport.name || shipment.transporterName,
            lrNumber: transport.lr || shipment.lrNumber,
            awbNumber: transport.awb || shipment.awbNumber,
          },
        )
      }
    >
      Dispatch shipment
    </Button>
  );
}

export function AdminB2BV2OperationsPanel({ orderNumber }: { orderNumber: string }) {
  const auth = useAdminAuth();
  const query = useQuery({
    queryKey: ["b2b-v2-admin-order", orderNumber, auth.authHeaders],
    queryFn: () => getAdminB2BOperation(auth.authHeaders, orderNumber),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  if (query.isLoading || !query.data) {
    return query.isLoading ? <B2BPanel><div className="h-48 animate-pulse rounded-md bg-[#F8FAFC]" /></B2BPanel> : null;
  }
  return <AdminOperationsBody order={query.data} authHeaders={auth.authHeaders} onRefresh={() => void query.refetch()} />;
}

function AdminOperationsBody({
  order,
  authHeaders,
  onRefresh,
}: {
  order: B2BOperationalOrder;
  authHeaders: Parameters<typeof getAdminB2BOperation>[0];
  onRefresh: () => void;
}) {
  const [checks, setChecks] = useState({
    documentMatched: false,
    priceMatched: false,
    quantityMatched: false,
    deliveryTermsMatched: false,
    stockChecked: false,
    taxDataChecked: false,
    creditChecked: false,
  });
  const [note, setNote] = useState("");
  const [controlReason, setControlReason] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [resolution, setResolution] = useState({
    type: "ACCEPTED_AS_DELIVERED",
    reason: "",
    acceptedQuantity: "",
    rejectedQuantity: "",
    returnQuantity: "",
    replacementQuantity: "",
    refundAmountPaise: "",
    receivableAdjustmentPaise: "",
  });
  const [confirmation, setConfirmation] = useState<
    "hold" | "resume" | "cancel" | "resolve" | "reconcile" | null
  >(null);
  const [deliveryUserId, setDeliveryUserId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const deliveryPartners = useQuery({
    queryKey: ["admin-b2b-delivery-partners", authHeaders],
    queryFn: () =>
      listAdminB2BDeliveryPartners(authHeaders, { page: 1, limit: 100 }),
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({
      path,
      payload,
    }: {
      path: string;
      payload: Record<string, unknown>;
    }) =>
      b2bAction(
        authHeaders,
        path,
        payload,
        "POST",
        idempotencyKey("admin-b2b"),
      ),
    onSuccess: () => {
      setNotice("B2B order control saved.");
      setConfirmation(null);
      onRefresh();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const pendingAmendment = order.amendments.find(
    (amendment) => amendment.status === "REQUESTED",
  );
  const pendingCase = order.supportCases.find((supportCase) =>
    ["OPEN", "IN_REVIEW", "WAITING_FOR_BUYER", "WAITING_FOR_SELLER"].includes(
      supportCase.status,
    ),
  );
  const latestReconciliation = order.financialReconciliations[0];
  const confirmationTitle =
    confirmation === "cancel"
      ? "Cancel B2B order?"
      : confirmation === "resume"
        ? "Resume B2B order?"
        : confirmation === "resolve"
          ? "Resolve this B2B dispute?"
          : confirmation === "reconcile"
            ? "Correct financial discrepancies?"
            : "Place B2B order on hold?";
  const confirmationDescription =
    confirmation === "resolve"
      ? resolution.reason.trim()
      : confirmation === "reconcile"
        ? "Cached balances will be corrected from immutable allocations, refunds, and ledger adjustments."
        : controlReason.trim() || "A reason is required.";
  const confirmationLabel =
    confirmation === "cancel"
      ? "Cancel order"
      : confirmation === "resume"
        ? "Resume order"
        : confirmation === "resolve"
          ? "Resolve dispute"
          : confirmation === "reconcile"
            ? "Correct balances"
            : "Place on hold";
  return (
    <B2BPanel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading title="PO and exception control" description="Verify every commercial gate before the seller begins fulfilment." />
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(checks).map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-bold">
            <input type="checkbox" checked={value} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} />
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}
          </label>
        ))}
      </div>
      <label className="mt-4 block space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Exception notes</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Record any variance or approval condition."
          className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() =>
            action.mutate({
              path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/po-review`,
              payload: {
                version: order.version,
                status: Object.values(checks).every(Boolean) ? "APPROVED" : "CHANGES_REQUIRED",
                ...checks,
                ...(note.trim() ? { note: note.trim() } : {}),
              },
            })
          }
          disabled={action.isPending}
        >
          Save PO review
        </Button>
        {notice ? <span className="text-sm font-bold text-[#ED3500]">{notice}</span> : null}
      </div>
      <div className="mt-6 border-t border-[#E5E7EB] pt-5">
        <SectionHeading title="Lifecycle control" description="Pause, resume, or cancel with a mandatory reason and complete audit history." />
        <textarea
          value={controlReason}
          onChange={(event) => setControlReason(event.target.value)}
          rows={3}
          placeholder="Reason required for lifecycle changes"
          className="mt-4 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "ON_HOLD" ? (
            <Button type="button" variant="outline" disabled={controlReason.trim().length < 3} onClick={() => setConfirmation("resume")}><PlayCircle className="h-4 w-4" aria-hidden="true" /> Resume order</Button>
          ) : (
            <Button type="button" variant="outline" disabled={controlReason.trim().length < 3 || ["DISPATCHED", "IN_TRANSIT", "DELIVERED", "DELIVERY_ACCEPTED", "CLOSED", "CANCELLED"].includes(order.status)} onClick={() => setConfirmation("hold")}><PauseCircle className="h-4 w-4" aria-hidden="true" /> Place on hold</Button>
          )}
          <Button type="button" variant="outline" disabled={controlReason.trim().length < 3 || !["PROFORMA_ISSUED", "PO_SUBMITTED", "PO_UNDER_REVIEW", "PO_ACCEPTED", "CREDIT_CLEARANCE_PENDING", "IN_FULFILMENT", "PROCUREMENT_IN_PROGRESS", "PRODUCTION_IN_PROGRESS", "STOCK_READY", "ON_HOLD", "FULFILMENT_REVIEW_REQUIRED"].includes(order.status)} onClick={() => setConfirmation("cancel")}><XCircle className="h-4 w-4" aria-hidden="true" /> Cancel order</Button>
        </div>
      </div>
      {pendingAmendment ? (
        <div className="mt-6 border-t border-[#E5E7EB] pt-5">
          <SectionHeading
            title={`Amendment ${pendingAmendment.amendmentNumber}`}
            description={pendingAmendment.reason}
          />
          <textarea
            value={amendmentReason}
            onChange={(event) => setAmendmentReason(event.target.value)}
            rows={2}
            placeholder="Decision reason"
            className="mt-4 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={action.isPending || amendmentReason.trim().length < 3}
              onClick={() =>
                action.mutate({
                  path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/amendments/${pendingAmendment.id}/decision`,
                  payload: {
                    version: order.version,
                    approved: true,
                    reason: amendmentReason.trim(),
                  },
                })
              }
            >
              Apply amendment
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={action.isPending || amendmentReason.trim().length < 3}
              onClick={() =>
                action.mutate({
                  path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/amendments/${pendingAmendment.id}/decision`,
                  payload: {
                    version: order.version,
                    approved: false,
                    reason: amendmentReason.trim(),
                  },
                })
              }
            >
              Reject amendment
            </Button>
          </div>
        </div>
      ) : null}
      {pendingCase ? (
        <div className="mt-6 border-t border-[#E5E7EB] pt-5">
          <SectionHeading
            title={`Resolve ${pendingCase.caseNumber}`}
            description={`${pendingCase.subject}. Record the accepted quantity and any replacement, refund, or credit adjustment.`}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select
              value={resolution.type}
              onChange={(event) =>
                setResolution((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"
            >
              <option value="ACCEPTED_AS_DELIVERED">Accepted as delivered</option>
              <option value="PARTIAL_ACCEPTANCE">Partial acceptance</option>
              <option value="REPLACEMENT">Replacement</option>
              <option value="RETURN_AND_REFUND">Return and refund</option>
              <option value="CREDIT_NOTE">Credit note</option>
              <option value="CLAIM_REJECTED">Reject claim</option>
            </select>
            {[
              { key: "acceptedQuantity" as const, label: "Accepted qty" },
              { key: "rejectedQuantity" as const, label: "Rejected qty" },
              { key: "returnQuantity" as const, label: "Return qty" },
              {
                key: "replacementQuantity" as const,
                label: "Replacement qty",
              },
              {
                key: "receivableAdjustmentPaise" as const,
                label: "Credit adjustment (paise)",
              },
              { key: "refundAmountPaise" as const, label: "Refund (paise)" },
            ].map(({ key, label }) => (
              <input
                key={key}
                value={resolution[key]}
                onChange={(event) =>
                  setResolution((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder={label}
                className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
              />
            ))}
          </div>
          <textarea
            value={resolution.reason}
            onChange={(event) =>
              setResolution((current) => ({
                ...current,
                reason: event.target.value,
              }))
            }
            rows={2}
            placeholder="Resolution reason"
            className="mt-3 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
          />
          <Button
            className="mt-3"
            type="button"
            disabled={action.isPending || resolution.reason.trim().length < 3}
            onClick={() => setConfirmation("resolve")}
          >
            Resolve dispute
          </Button>
        </div>
      ) : null}
      <div className="mt-6 border-t border-[#E5E7EB] pt-5">
        <SectionHeading
          title="Financial reconciliation"
          description={
            latestReconciliation
              ? `${latestReconciliation.reconciliationNumber}: ${latestReconciliation.status.replaceAll("_", " ")}`
              : "Compare cached balances with immutable allocations, refunds, and receivable adjustments."
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: `/api/finance/b2b/orders/${encodeURIComponent(order.orderNumber)}/reconcile`,
                payload: { version: order.version, correct: false },
              })
            }
          >
            Check balances
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={action.isPending}
            onClick={() => setConfirmation("reconcile")}
          >
            Correct discrepancies
          </Button>
        </div>
      </div>
      {order.shipments[0] ? (
        <div className="mt-6 border-t border-[#E5E7EB] pt-5">
          <SectionHeading title="Delivery assignment" description="Assign an available delivery partner before handoff." />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={deliveryUserId}
              onChange={(event) => setDeliveryUserId(event.target.value)}
              className="h-10 min-w-64 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"
            >
              <option value="">Choose delivery partner</option>
              {deliveryPartners.data?.items.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.fullName ?? partner.email}
                  {partner.deliveryProfile?.vehicleType
                    ? ` / ${partner.deliveryProfile.vehicleType}`
                    : ""}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={!deliveryUserId || action.isPending}
              onClick={() =>
                action.mutate({
                  path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/shipments/${order.shipments[0]!.id}/assign`,
                  payload: { version: order.version, deliveryUserId },
                })
              }
            >
              Assign shipment
            </Button>
            {order.shipments[0].assignedDeliveryUser ? (
              <span className="text-sm font-bold text-[#667085]">
                Current:{" "}
                {order.shipments[0].assignedDeliveryUser.fullName ??
                  order.shipments[0].assignedDeliveryUser.email}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <AdminConfirmationDialog
        open={confirmation !== null}
        title={confirmationTitle}
        description={confirmationDescription}
        confirmLabel={confirmationLabel}
        tone={confirmation === "cancel" ? "danger" : "warning"}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation === "resolve" && pendingCase) {
            const numeric = (value: string) =>
              value.trim() ? Math.max(0, Number(value)) : undefined;
            action.mutate({
              path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/cases/${pendingCase.id}/resolve`,
              payload: {
                version: order.version,
                resolutionType: resolution.type,
                reason: resolution.reason.trim(),
                acceptedQuantity: numeric(resolution.acceptedQuantity),
                rejectedQuantity: numeric(resolution.rejectedQuantity),
                returnQuantity: numeric(resolution.returnQuantity),
                replacementQuantity: numeric(resolution.replacementQuantity),
                refundAmountPaise: numeric(resolution.refundAmountPaise),
                receivableAdjustmentPaise: numeric(
                  resolution.receivableAdjustmentPaise,
                ),
              },
            });
            return;
          }
          if (confirmation === "reconcile") {
            action.mutate({
              path: `/api/finance/b2b/orders/${encodeURIComponent(order.orderNumber)}/reconcile`,
              payload: { version: order.version, correct: true },
            });
            return;
          }
          action.mutate({
            path: `/api/admin/b2b-operations/orders/${encodeURIComponent(order.orderNumber)}/${confirmation}`,
            payload: { version: order.version, reason: controlReason.trim() },
          });
        }}
      />
    </B2BPanel>
  );
}

function AmendmentRequestPanel({
  order,
  authHeaders,
  path,
  onSaved,
}: {
  order: B2BOperationalOrder;
  authHeaders: Parameters<typeof b2bAction>[0];
  path: string;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [paymentDueAt, setPaymentDueAt] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      b2bAction(
        authHeaders,
        path,
        payload,
        "POST",
        idempotencyKey("b2b-amendment"),
      ),
    onSuccess: () => {
      setReason("");
      setPaymentDueAt("");
      setQuantities({});
      setNotice("Amendment submitted for review.");
      onSaved();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const pending = order.amendments.find(
    (amendment) => amendment.status === "REQUESTED",
  );
  const allowed = [
    "PO_ACCEPTED",
    "CREDIT_CLEARANCE_PENDING",
    "IN_FULFILMENT",
    "PROCUREMENT_IN_PROGRESS",
    "PRODUCTION_IN_PROGRESS",
    "STOCK_READY",
    "ON_HOLD",
    "FULFILMENT_REVIEW_REQUIRED",
  ].includes(order.status);
  const lines = order.lines.flatMap((line) => {
    const value = Number(quantities[line.id]);
    return Number.isInteger(value) && value > 0 && value !== line.quantity
      ? [{ orderLineId: line.id, quantity: value }]
      : [];
  });

  return (
    <B2BPanel>
      <SectionHeading
        title="Order amendment"
        description={
          pending
            ? `${pending.amendmentNumber} is awaiting review.`
            : "Request a controlled quantity or payment due-date change without overwriting the agreed order."
        }
      />
      {pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <B2BStatusPill status={pending.status} />
          <span className="text-sm font-semibold text-[#667085]">
            {pending.reason}
          </span>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {order.lines.map((line) => (
              <label key={line.id} className="grid gap-1">
                <span className="text-xs font-bold text-[#667085]">
                  Line {line.lineNumber}: {line.description}
                </span>
                <input
                  value={quantities[line.id] ?? ""}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [line.id]: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  placeholder={`Current quantity ${line.quantity}`}
                  className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                />
              </label>
            ))}
            <label className="grid gap-1">
              <span className="text-xs font-bold text-[#667085]">
                Revised payment due date
              </span>
              <input
                type="date"
                value={paymentDueAt}
                onChange={(event) => setPaymentDueAt(event.target.value)}
                className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
              />
            </label>
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Reason for amendment"
            className="mt-3 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
          />
          <Button
            className="mt-3"
            type="button"
            disabled={
              !allowed ||
              mutation.isPending ||
              reason.trim().length < 3 ||
              (!lines.length && !paymentDueAt)
            }
            onClick={() =>
              mutation.mutate({
                version: order.version,
                reason: reason.trim(),
                ...(lines.length ? { lines } : {}),
                ...(paymentDueAt
                  ? {
                      paymentDueAt: new Date(
                        `${paymentDueAt}T00:00:00`,
                      ).toISOString(),
                    }
                  : {}),
              })
            }
          >
            Request amendment
          </Button>
        </>
      )}
      {notice ? (
        <p className="mt-3 text-sm font-bold text-[#ED3500]">{notice}</p>
      ) : null}
    </B2BPanel>
  );
}

function LineProgressPanel({ order }: { order: B2BOperationalOrder }) {
  return (
    <B2BPanel>
      <SectionHeading
        title="Line fulfilment"
        description="Each line advances independently while the order status remains a broad summary."
      />
      <div className="mt-4 grid gap-3">
        {order.lines.map((line) => (
          <div
            key={line.id}
            className="flex flex-col gap-2 border-b border-[#EEF2F6] pb-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-black text-[#1F2933]">
                Line {line.lineNumber}: {line.description}
              </p>
              <p className="text-sm font-semibold text-[#667085]">
                Ready {line.progress?.readyQuantity ?? 0}, picked{" "}
                {line.progress?.pickedQuantity ?? 0}, packed{" "}
                {line.progress?.packedQuantity ?? 0}, accepted{" "}
                {line.progress?.acceptedQuantity ?? 0} of {line.quantity}
              </p>
            </div>
            <B2BStatusPill
              status={line.progress?.state ?? line.fulfilmentPlan?.status ?? "PENDING"}
            />
          </div>
        ))}
      </div>
    </B2BPanel>
  );
}

function SchedulePanel({ order }: { order: B2BOperationalOrder }) {
  return (
    <B2BPanel>
      <SectionHeading title="Payment schedule" description="Milestones and due dates control fulfilment and dispatch gates." />
      <div className="mt-4 grid gap-3">
        {order.paymentSchedules.map((schedule) => (
          <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2F6] pb-3 text-sm">
            <div><p className="font-black text-[#1F2933]">{schedule.label}</p><p className="font-semibold text-[#667085]">Due {formatDateTime(schedule.dueAt)}</p></div>
            <div className="text-right"><p className="font-black text-[#1F2933]">{formatMoney(schedule.paidAmountPaise)} / {formatMoney(schedule.amountPaise)}</p><B2BStatusPill status={schedule.status} /></div>
          </div>
        ))}
      </div>
    </B2BPanel>
  );
}

function ShipmentPanel({ order }: { order: B2BOperationalOrder }) {
  return (
    <B2BPanel>
      <SectionHeading title="Shipment tracking" description="Transport references and delivery evidence are kept with the B2B order." />
      <div className="mt-4 grid gap-3">
        {order.shipments.length ? order.shipments.map((shipment) => (
          <div key={shipment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{shipment.shipmentNumber}</p><B2BStatusPill status={shipment.status} /></div>
            <p className="mt-1 text-sm font-semibold text-[#667085]">{shipment.transporterName ?? "Transporter pending"} / {shipment.lrNumber ?? shipment.awbNumber ?? "Tracking reference pending"}</p>
            {shipment.events[0] ? <p className="mt-2 text-xs font-bold text-[#667085]">{shipment.events[0].note ?? shipment.events[0].status} / {formatDateTime(shipment.events[0].createdAt)}</p> : null}
          </div>
        )) : <p className="text-sm font-semibold text-[#667085]">Shipment will appear after invoice and compliance gates are complete.</p>}
      </div>
    </B2BPanel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="mt-1 font-bold text-[#1F2933]">{value}</p></div>;
}

function podEvidenceCount(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").length
    : 0;
}
