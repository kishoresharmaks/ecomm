import type pino from "pino";
import { DeliveryAssignmentStatus, DeliveryStatus, prisma } from "@indihub/database";

type Logger = pino.Logger;

export function startDeliveryAssignmentTimeoutPolling(logger: Logger) {
  if (process.env.DELIVERY_ASSIGNMENT_TIMEOUT_WORKER_ENABLED === "false") {
    logger.info("Delivery assignment timeout worker disabled by DELIVERY_ASSIGNMENT_TIMEOUT_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.DELIVERY_ASSIGNMENT_TIMEOUT_POLL_INTERVAL_MS, 60000);
  const batchSize = positiveInteger(process.env.DELIVERY_ASSIGNMENT_TIMEOUT_BATCH_SIZE, 50);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await releaseExpiredDeliveryAssignments(batchSize);
      if (result.released > 0) {
        logger.info(result, "Expired delivery assignments released");
      }
    } catch (error) {
      logger.error({ error }, "Delivery assignment timeout poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "Delivery assignment timeout worker started");
}

export async function releaseExpiredDeliveryAssignments(limit = 50) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const note = "Delivery partner assignment auto-released after 110 minutes without acceptance.";

  const deliveryDetails = await prisma.deliveryDetail.findMany({
    where: {
      assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      assignmentExpiresAt: { lte: now },
      deliveryPartnerUserId: { not: null },
      status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
    },
    select: {
      id: true,
      orderId: true,
      deliveryPartnerUserId: true,
      status: true,
    },
    orderBy: { assignmentExpiresAt: "asc" },
    take,
  });

  const detailOrderIds = Array.from(new Set(deliveryDetails.map((delivery) => delivery.orderId)));
  const remainingTake = Math.max(0, take - deliveryDetails.length);
  const orderShipmentWhere = detailOrderIds.length
    ? { orderId: { notIn: detailOrderIds } }
    : {};
  const shipments =
    remainingTake > 0
      ? await prisma.orderShipment.findMany({
          where: {
            ...orderShipmentWhere,
            assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
            assignmentExpiresAt: { lte: now },
            deliveryPartnerUserId: { not: null },
            status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
          },
          select: {
            id: true,
            orderId: true,
            deliveryPartnerUserId: true,
          },
          orderBy: { assignmentExpiresAt: "asc" },
          take: remainingTake,
        })
      : [];

  if (!deliveryDetails.length && !shipments.length) {
    return { released: 0, releasedDeliveryDetails: 0, releasedShipments: 0 };
  }

  await prisma.$transaction(async (tx) => {
    if (deliveryDetails.length) {
      const detailIds = deliveryDetails.map((delivery) => delivery.id);
      const orderIds = Array.from(new Set(deliveryDetails.map((delivery) => delivery.orderId)));

      await tx.deliveryDetail.updateMany({
        where: { id: { in: detailIds }, assignmentStatus: DeliveryAssignmentStatus.ASSIGNED },
        data: {
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: now,
          assignmentExpiresAt: null,
          assignmentNote: note,
        },
      });

      await tx.deliveryAssignmentAttempt.updateMany({
        where: {
          deliveryDetailId: { in: detailIds },
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
        data: {
          status: DeliveryAssignmentStatus.CANCELLED,
          respondedAt: now,
          note,
        },
      });

      await tx.orderShipment.updateMany({
        where: {
          orderId: { in: orderIds },
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        },
        data: {
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: now,
          assignmentExpiresAt: null,
          assignmentNote: note,
        },
      });

      await tx.deliveryEvent.createMany({
        data: deliveryDetails.map((delivery) => ({
          deliveryDetailId: delivery.id,
          oldStatus: delivery.status,
          newStatus: delivery.status,
          note,
          updatedById: null,
        })),
      });

      await tx.auditLog.createMany({
        data: orderIds.map((orderId) => ({
          actorUserId: null,
          action: "order.delivery_assignment.expired",
          entityType: "order",
          entityId: orderId,
          newValue: { note },
        })),
      });
    }

    if (shipments.length) {
      const shipmentIds = shipments.map((shipment) => shipment.id);

      await tx.orderShipment.updateMany({
        where: { id: { in: shipmentIds }, assignmentStatus: DeliveryAssignmentStatus.ASSIGNED },
        data: {
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: now,
          assignmentExpiresAt: null,
          assignmentNote: note,
        },
      });

      await tx.auditLog.createMany({
        data: shipments.map((shipment) => ({
          actorUserId: null,
          action: "order.shipment.delivery_assignment.expired",
          entityType: "order_shipment",
          entityId: shipment.id,
          newValue: {
            orderId: shipment.orderId,
            expiredPartnerUserId: shipment.deliveryPartnerUserId,
            note,
          },
        })),
      });
    }
  });

  return {
    released: deliveryDetails.length + shipments.length,
    releasedDeliveryDetails: deliveryDetails.length,
    releasedShipments: shipments.length,
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
