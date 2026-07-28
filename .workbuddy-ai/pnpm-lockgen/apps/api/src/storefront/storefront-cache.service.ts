import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";

@Injectable()
export class StorefrontCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(StorefrontCacheService.name);
  private client: IORedis | undefined;
  private fallbackLogged = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log("REDIS_URL not configured. Redis storefront caching is disabled.");
      return;
    }

    try {
      this.client = new IORedis(redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: null,
        retryStrategy: (attempt) => (attempt === 1 ? 250 : null),
      });

      this.client.on("error", (error) => {
        this.disableRedis(error);
      });
    } catch (error) {
      this.logger.error(`Failed to initialize Redis client: ${String(error)}`);
    }
  }

  isAvailable(): boolean {
    return Boolean(this.client);
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.client;
    if (!client) {
      return null;
    }

    try {
      const data = await client.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      this.disableRedis(error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    try {
      const data = JSON.stringify(value);
      await client.set(key, data, "PX", ttlMs);
    } catch (error) {
      this.disableRedis(error);
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      this.disableRedis(error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    try {
      let cursor = "0";
      do {
        const reply = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = reply[0];
        const keys = reply[1];
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      this.disableRedis(error);
    }
  }

  async onModuleDestroy() {
    const client = this.client;
    this.client = undefined;
    client?.disconnect();
  }

  private disableRedis(error: unknown) {
    const client = this.client;
    if (!client) {
      return;
    }

    this.client = undefined;
    client.disconnect();

    if (!this.fallbackLogged) {
      this.fallbackLogged = true;
      this.logger.warn(`Redis storefront caching is unavailable. Using the in-memory fallback: ${String(error)}`);
    }
  }
}
