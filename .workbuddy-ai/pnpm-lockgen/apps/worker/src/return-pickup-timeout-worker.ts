import type pino from "pino";
import {
  DeliveryAssignmentStatus,
  ReverseShipmentStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

export function startReturnPickupTimeoutPolling(logger: Logger) {
  if (process.env.RETURN_PICKUP_TIMEOUT_WORKER_ENABLED === "false") {
    logger.info("Return pickup timeout worker disabled by RETURN_PICKUP_TIMEOUT_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.RETURN_PICKUP_TIMEOUT_POLL_INTERVAL_MS, 60000);
  const batchSize = positiveInteger(process.env.RETURN_PICKUP_TIMEOUT_BATCH_SIZE, 50);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await releaseExpiredReturnPickupAssignments(batchSize);
      if (result.released > 0) {
        logger.info(result, "Expired return pickup assignments released");
      }
    } catch (error) {
      logger.error({ error }, "Return pickup timeout poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "Return pickup timeout worker started");
}

export async function releaseExpiredReturnPickupAssignments(limit = 50) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const shipments = await prisma.reverseShipment.findMany({
    where: {
      assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      assignmentExpiresAt: { lte: now },
      status: ReverseShipmentStatus.ASSIGNED,
      assignedPartnerUserId: { not: null },
    },
    select: {
      id: true,
      returnRequestId: true,
      assignedPartnerUserId: true,
      status: true,
    },
    orderBy: { assignmentExpiresAt: "asc" },
    take,
  });

  if (!shipments.length) {
    return { released: 0 };
  }

  const shipmentIds = shipments.map((shipment) => shipment.id);
  const returnRequestIds = Array.from(new Set(shipments.map((shipment) => shipment.returnRequestId)));
  const note = "Return pickup assignment auto-released after 2 hours without partner acceptance.";

  await prisma.$transaction(async (tx) => {
    await tx.reverseShipment.updateMany({
      where: { id: { in: shipmentIds }, assignmentStatus: DeliveryAssignmentStatus.ASSIGNED },
      data: {
        assignedPartnerUserId: null,
        assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
        status: ReverseShipmentStatus.REQUESTED,
        assignedAt: null,
        acceptedAt: null,
        rejectedAt: now,
        assignmentExpiresAt: null,
        assignmentNote: note,
      },
    });

    await tx.reverseShipmentAssignmentAttempt.updateMany({
      where: {
        reverseShipmentId: { in: shipmentIds },
        status: DeliveryAssignmentStatus.ASSIGNED,
      },
      data: {
        status: DeliveryAssignmentStatus.CANCELLED,
        respondedAt: now,
        note,
      },
    });

    await tx.reverseShipmentEvent.createMany({
      data: shipments.map((shipment) => ({
        reverseShipmentId: shipment.id,
        oldStatus: shipment.status,
        newStatus: ReverseShipmentStatus.REQUESTED,
        note,
        createdById: null,
      })),
    });

    await tx.auditLog.createMany({
      data: returnRequestIds.map((returnRequestId) => ({
        actorUserId: null,
        action: "return.reverse_pickup.assignment_expired",
        entityType: "return_request",
        entityId: returnRequestId,
        newValue: { note },
      })),
    });
  });

  return { released: shipments.length };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
