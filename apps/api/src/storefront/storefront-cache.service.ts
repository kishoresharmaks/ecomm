import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";

@Injectable()
export class StorefrontCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(StorefrontCacheService.name);
  private readonly client?: IORedis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log("REDIS_URL not configured. Redis storefront caching is disabled.");
      return;
    }

    try {
      this.client = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
      });

      this.client.on("error", (error) => {
        this.logger.error(`Redis connection error: ${String(error)}`);
      });
    } catch (error) {
      this.logger.error(`Failed to initialize Redis client: ${String(error)}`);
    }
  }

  isAvailable(): boolean {
    return Boolean(this.client);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(`Failed to GET from Redis cache for key ${key}: ${String(error)}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlMs: number): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const data = JSON.stringify(value);
      await this.client.set(key, data, "PX", ttlMs);
    } catch (error) {
      this.logger.warn(`Failed to SET to Redis cache for key ${key}: ${String(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Failed to DELETE from Redis cache for key ${key}: ${String(error)}`);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      let cursor = "0";
      do {
        const reply = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = reply[0];
        const keys = reply[1];
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      this.logger.warn(`Failed to deletePattern from Redis cache for pattern ${pattern}: ${String(error)}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
