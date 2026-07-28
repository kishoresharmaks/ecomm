import type pino from "pino";
import {
  B2BDeliveryAcceptanceStatus,
  B2BOrderStatus,
  B2BPaymentStatus,
  B2BShipmentStatus,
  SellerSettlementStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

export function startB2BPodAutoAcceptPolling(logger: Logger) {
  if (
    process.env.B2B_ORDER_TO_CASH_V2_ENABLED !== "true" ||
    process.env.B2B_POD_AUTO_ACCEPT_WORKER_ENABLED === "false"
  ) {
    logger.info("B2B POD auto-accept worker is disabled.");
    return;
  }

  const pollIntervalMs = positiveInteger(
    process.env.B2B_POD_AUTO_ACCEPT_POLL_INTERVAL_MS,
    15 * 60 * 1000,
  );
  const batchSize = positiveInteger(process.env.B2B_POD_AUTO_ACCEPT_BATCH_SIZE, 100);
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const result = await autoAcceptB2BDeliveries(batchSize);
      if (result.accepted > 0) logger.info(result, "B2B deliveries auto-accepted");
    } catch (error) {
      logger.error({ error }, "B2B POD auto-accept poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => void poll(), pollIntervalMs);
  logger.info({ pollIntervalMs, batchSize }, "B2B POD auto-accept worker started");
}

export async function autoAcceptB2BDeliveries(limit = 100) {
  const take = Math.min(250, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const candidates = await prisma.b2BShipment.findMany({
    where: {
      status: B2BShipmentStatus.DELIVERED,
      acceptanceStatus: B2BDeliveryAcceptanceStatus.PENDING,
      acceptanceDueAt: { lte: now },
      proofOfDelivery: { isNot: null },
    },
    select: {
      id: true,
      b2bOrderId: true,
      shipmentNumber: true,
      order: { select: { id: true, status: true, paymentStatus: true } },
    },
    orderBy: [{ acceptanceDueAt: "asc" }, { id: "asc" }],
    take,
  });

  let accepted = 0;
  for (const shipment of candidates) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.b2BShipment.updateMany({
        where: {
          id: shipment.id,
          status: B2BShipmentStatus.DELIVERED,
          acceptanceStatus: B2BDeliveryAcceptanceStatus.PENDING,
          acceptanceDueAt: { lte: now },
        },
        data: {
          acceptanceStatus: B2BDeliveryAcceptanceStatus.AUTO_ACCEPTED,
          acceptedAt: now,
        },
      });
      if (claimed.count !== 1) return;

      const pendingShipments = await tx.b2BShipment.count({
        where: {
          b2bOrderId: shipment.b2bOrderId,
          acceptanceStatus: {
            in: [
              B2BDeliveryAcceptanceStatus.PENDING,
              B2BDeliveryAcceptanceStatus.DISPUTED,
            ],
          },
        },
      });
      if (pendingShipments === 0) {
        const closesOrder = shipment.order.paymentStatus === B2BPaymentStatus.PAID;
        await tx.b2BOrder.update({
          where: { id: shipment.order.id },
          data: {
            status: closesOrder
              ? B2BOrderStatus.CLOSED
              : B2BOrderStatus.DELIVERY_ACCEPTED,
            version: { increment: 1 },
            ...(closesOrder
              ? {
                  settlementStatus: SellerSettlementStatus.ELIGIBLE,
                  settlementEligibleAt: now,
                }
              : {}),
          },
        });
        await tx.b2BOrderEvent.create({
          data: {
            b2bOrderId: shipment.b2bOrderId,
            status: closesOrder
              ? B2BOrderStatus.CLOSED
              : B2BOrderStatus.DELIVERY_ACCEPTED,
            note: closesOrder
              ? `Delivery auto-accepted for ${shipment.shipmentNumber}; buyer payment was already cleared and the order was closed.`
              : `Delivery auto-accepted after the configured POD review window for ${shipment.shipmentNumber}.`,
          },
        });
      }
      accepted += 1;
    });
  }

  return { checked: candidates.length, accepted };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
