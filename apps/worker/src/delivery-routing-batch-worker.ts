import type pino from "pino";
import {
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryStatus,
  OrderStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

export function startDeliveryBatchRoutingPolling(logger: Logger) {
  if (process.env.DELIVERY_BATCH_ROUTING_WORKER_ENABLED === "false") {
    logger.info("Delivery batch routing worker disabled by DELIVERY_BATCH_ROUTING_WORKER_ENABLED=false.");
    return;
  }

  if (!process.env.INTERNAL_API_SECRET) {
    logger.warn("INTERNAL_API_SECRET is not configured in environment. Delivery batch routing worker is idle.");
    return;
  }

  const pollIntervalMs = 60000; // Poll every 1 minute
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await processDeliveryBatches(logger);
      if (result.processedBatches > 0) {
        logger.info(result, "Delivery batches assigned successfully");
      }
    } catch (error) {
      logger.error({ error }, "Delivery batch routing poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs }, "Delivery batch routing worker started");
}

export async function processDeliveryBatches(logger?: Logger) {
  const cutoffTime = new Date(Date.now() - 3 * 60 * 1000); // 3 minute buffer
  
  const pendingShipments = await prisma.orderShipment.findMany({
    where: {
      status: DeliveryStatus.PACKED,
      deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      updatedAt: {
        lte: cutoffTime
      },
      order: {
        orderStatus: { not: OrderStatus.CANCELLED },
        deliveryStatus: { not: DeliveryStatus.CANCELLED }
      },
      OR: [
        { deliveryPartnerUserId: null },
        { assignmentStatus: { in: [DeliveryAssignmentStatus.REJECTED, DeliveryAssignmentStatus.CANCELLED] } }
      ]
    },
    select: {
      id: true,
      orderId: true,
      sellerId: true,
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (pendingShipments.length === 0) {
    return { processedBatches: 0, totalOrders: 0 };
  }

  // Group by store
  const groupedShipments = new Map<string, Array<{ orderId: string; shipmentId: string }>>();
  for (const shipment of pendingShipments) {
    if (!groupedShipments.has(shipment.sellerId)) {
      groupedShipments.set(shipment.sellerId, []);
    }
    groupedShipments.get(shipment.sellerId)!.push({ orderId: shipment.orderId, shipmentId: shipment.id });
  }

  let processedBatches = 0;
  let totalOrdersAssigned = 0;

  for (const shipments of groupedShipments.values()) {
    const batchSize = 3;
    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);
      const batchIds = Array.from(new Set(batch.map((shipment) => shipment.orderId)));
      const shipmentIds = batch.map((shipment) => shipment.shipmentId);
      
      try {
        const apiUrl = normalizeInternalApiBaseUrl(
          process.env.INTERNAL_API_URL ||
            process.env.NEXT_PUBLIC_API_URL ||
            (process.env.API_PORT ? `http://127.0.0.1:${process.env.API_PORT}/api` : "http://localhost:4000/api"),
        );
        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (!internalSecret) throw new Error("INTERNAL_API_SECRET is missing");
        
        const response = await fetch(`${apiUrl}/internal/delivery/batch-assign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({ orderIds: batchIds, shipmentIds }),
        });
        
        if (!response.ok) {
           const text = await response.text();
           throw new Error(`API responded with status ${response.status}: ${text}`);
        }
        
        const data = await response.json();
        processedBatches++;
        totalOrdersAssigned += data.count || 0;
      } catch (err) {
        logger?.error({ error: err, batchIds }, "Failed to process delivery batch");
      }
    }
  }

  return { processedBatches, totalOrders: totalOrdersAssigned };
}

export function normalizeInternalApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
