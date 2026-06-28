import type pino from "pino";
import {
  B2BAdminAction,
  B2BAuditActorType,
  B2BPaymentStatus,
  B2BProofStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

export function startB2BOverduePolling(logger: Logger) {
  if (process.env.B2B_OVERDUE_WORKER_ENABLED === "false") {
    logger.info("B2B overdue worker disabled by B2B_OVERDUE_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.B2B_OVERDUE_POLL_INTERVAL_MS, 60 * 60 * 1000);
  const batchSize = positiveInteger(process.env.B2B_OVERDUE_BATCH_SIZE, 100);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await markOverdueB2BOrders(batchSize);
      if (result.marked > 0) {
        logger.info(result, "B2B overdue orders marked");
      }
    } catch (error) {
      logger.error({ error }, "B2B overdue poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "B2B overdue worker started");
}

export async function markOverdueB2BOrders(limit = 100) {
  const take = Math.min(250, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const candidates = await prisma.b2BOrder.findMany({
    where: {
      paymentStatus: B2BPaymentStatus.PENDING,
      paymentDueAt: { lt: now },
      paymentProofs: {
        none: { status: { in: [B2BProofStatus.SUBMITTED, B2BProofStatus.VERIFIED] } },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      paymentDueAt: true,
      paidAmountPaise: true,
    },
    orderBy: { paymentDueAt: "asc" },
    take,
  });

  if (!candidates.length) {
    return { checked: 0, marked: 0 };
  }

  let marked = 0;
  await prisma.$transaction(async (tx) => {
    for (const order of candidates) {
      const updated = await tx.b2BOrder.updateMany({
        where: {
          id: order.id,
          paymentStatus: B2BPaymentStatus.PENDING,
          paymentDueAt: { lt: now },
          paymentProofs: {
            none: { status: { in: [B2BProofStatus.SUBMITTED, B2BProofStatus.VERIFIED] } },
          },
        },
        data: {
          paymentStatus: B2BPaymentStatus.OVERDUE,
          paymentOverdueAt: now,
        },
      });

      if (updated.count === 1) {
        marked += 1;
        await tx.b2BAdminAuditLog.create({
          data: {
            b2bOrderId: order.id,
            actorId: null,
            actorType: B2BAuditActorType.SYSTEM,
            action: B2BAdminAction.PAYMENT_OVERDUE,
            reason: "Payment due date passed with no submitted or verified payment proof.",
            beforeSnapshot: {
              paymentStatus: order.paymentStatus,
              paymentDueAt: order.paymentDueAt.toISOString(),
              paidAmountPaise: order.paidAmountPaise,
            },
            afterSnapshot: {
              paymentStatus: B2BPaymentStatus.OVERDUE,
              paymentOverdueAt: now.toISOString(),
            },
          },
        });
      }
    }
  });

  return { checked: candidates.length, marked };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
