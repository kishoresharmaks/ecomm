import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { EMAIL_QUEUE_NAME, type EmailJobPayload } from "./email-job";

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly connection?: IORedis;
  private readonly queue?: Queue<EmailJobPayload>;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  isAvailable() {
    return Boolean(this.queue);
  }

  async enqueueEmail(payload: EmailJobPayload, options?: { delayMs?: number | undefined }) {
    if (!this.queue) {
      return false;
    }

    try {
      await this.queue.add("send", this.queueSafePayload(payload), {
        attempts: 1,
        ...(options?.delayMs ? { delay: options.delayMs } : {}),
        removeOnComplete: 500,
        removeOnFail: 1000,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue email notification ${payload.notificationLogId}: ${String(error)}`,
      );
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.connection?.quit();
  }

  private queueSafePayload(payload: EmailJobPayload): EmailJobPayload {
    const { providerConfig: _providerConfig, ...safePayload } = payload;
    void _providerConfig;
    return safePayload;
  }
}
