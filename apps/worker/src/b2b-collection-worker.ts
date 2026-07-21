import type pino from "pino";
import {
  B2BAgeingBucket,
  B2BCollectionTaskStatus,
  B2BPaymentStatus,
  B2BReceivableStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

export function startB2BCollectionPolling(logger: Logger) {
  if (
    process.env.B2B_ORDER_TO_CASH_V2_ENABLED !== "true" ||
    process.env.B2B_COLLECTION_WORKER_ENABLED === "false"
  ) {
    logger.info("B2B collection worker is disabled.");
    return;
  }

  const pollIntervalMs = positiveInteger(
    process.env.B2B_COLLECTION_POLL_INTERVAL_MS,
    60 * 60 * 1000,
  );
  const batchSize = positiveInteger(process.env.B2B_COLLECTION_BATCH_SIZE, 100);
  const reminderIntervalHours = positiveInteger(
    process.env.B2B_COLLECTION_REMINDER_INTERVAL_HOURS,
    24,
  );
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processB2BCollections(batchSize, reminderIntervalHours);
      if (result.checked > 0) logger.info(result, "B2B receivables aged and collection tasks refreshed");
    } catch (error) {
      logger.error({ error }, "B2B collection poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => void poll(), pollIntervalMs);
  logger.info({ pollIntervalMs, batchSize, reminderIntervalHours }, "B2B collection worker started");
}

export async function processB2BCollections(limit = 100, reminderIntervalHours = 24) {
  const take = Math.min(250, Math.max(1, Math.trunc(limit)));
  const reminderHours = Math.min(720, Math.max(1, Math.trunc(reminderIntervalHours)));
  const now = new Date();
  const receivables = await prisma.b2BReceivable.findMany({
    where: {
      outstandingAmountPaise: { gt: 0 },
      status: {
        in: [
          B2BReceivableStatus.OPEN,
          B2BReceivableStatus.PARTIALLY_PAID,
          B2BReceivableStatus.OVERDUE,
        ],
      },
    },
    include: {
      order: { select: { id: true, paymentStatus: true } },
      collectionTasks: {
        where: {
          status: {
            in: [
              B2BCollectionTaskStatus.OPEN,
              B2BCollectionTaskStatus.PROMISED,
              B2BCollectionTaskStatus.ESCALATED,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take,
  });

  let overdue = 0;
  let tasksCreated = 0;
  let remindersAdvanced = 0;

  for (const receivable of receivables) {
    await prisma.$transaction(async (tx) => {
      const bucket = ageingBucket(receivable.dueAt, now);
      const isOverdue = receivable.dueAt.getTime() < now.getTime();
      await tx.b2BReceivable.updateMany({
        where: {
          id: receivable.id,
          outstandingAmountPaise: { gt: 0 },
          status: {
            in: [
              B2BReceivableStatus.OPEN,
              B2BReceivableStatus.PARTIALLY_PAID,
              B2BReceivableStatus.OVERDUE,
            ],
          },
        },
        data: {
          ageingBucket: bucket,
          ...(isOverdue ? { status: B2BReceivableStatus.OVERDUE } : {}),
        },
      });

      if (!isOverdue) return;
      overdue += 1;
      await tx.b2BOrder.updateMany({
        where: {
          id: receivable.order.id,
          paymentStatus: {
            in: [B2BPaymentStatus.PENDING, B2BPaymentStatus.PARTIALLY_PAID],
          },
        },
        data: {
          paymentStatus: B2BPaymentStatus.OVERDUE,
          paymentOverdueAt: now,
        },
      });

      const task = receivable.collectionTasks[0];
      if (!task) {
        await tx.b2BCollectionTask.create({
          data: {
            receivableId: receivable.id,
            dueAt: now,
            nextReminderAt: now,
            note: "Automatically created for an overdue B2B receivable.",
          },
        });
        tasksCreated += 1;
        return;
      }

      if (task.nextReminderAt && task.nextReminderAt.getTime() <= now.getTime()) {
        await tx.b2BCollectionTask.updateMany({
          where: {
            id: task.id,
            status: {
              in: [
                B2BCollectionTaskStatus.OPEN,
                B2BCollectionTaskStatus.PROMISED,
                B2BCollectionTaskStatus.ESCALATED,
              ],
            },
            nextReminderAt: { lte: now },
          },
          data: {
            lastReminderAt: now,
            nextReminderAt: new Date(now.getTime() + reminderHours * 3_600_000),
            reminderCount: { increment: 1 },
          },
        });
        remindersAdvanced += 1;
      }
    });
  }

  return { checked: receivables.length, overdue, tasksCreated, remindersAdvanced };
}

function ageingBucket(dueAt: Date, now: Date) {
  const days = Math.floor((now.getTime() - dueAt.getTime()) / 86_400_000);
  if (days <= 0) return B2BAgeingBucket.CURRENT;
  if (days <= 30) return B2BAgeingBucket.DAYS_1_30;
  if (days <= 60) return B2BAgeingBucket.DAYS_31_60;
  if (days <= 90) return B2BAgeingBucket.DAYS_61_90;
  return B2BAgeingBucket.DAYS_90_PLUS;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
