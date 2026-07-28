import { Injectable } from "@nestjs/common";
import IORedis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

export type ComponentStatus = "available" | "degraded" | "not_configured";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness() {
    return {
      ok: true,
      status: "live" as const,
      service: "indihub-api",
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const database = await this.databaseStatus();
    const redis = await this.redisStatus();
    return {
      ok: database.status === "available",
      status: database.status === "available" ? (redis.status === "available" ? "ready" : "degraded") : "not_ready",
      service: "indihub-api",
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    } as const;
  }

  private async databaseStatus() {
    try {
      await withTimeout(this.prisma.client.$queryRaw`SELECT 1`, 2_000);
      return { status: "available" as ComponentStatus };
    } catch {
      return { status: "degraded" as ComponentStatus, reason: "database_unavailable" };
    }
  }

  private async redisStatus() {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return { status: "not_configured" as ComponentStatus };
    const client = new IORedis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1_000,
    });
    try {
      await withTimeout(client.connect(), 1_500);
      await withTimeout(client.ping(), 1_000);
      return { status: "available" as ComponentStatus };
    } catch {
      return { status: "degraded" as ComponentStatus, reason: "redis_unavailable" };
    } finally {
      client.disconnect();
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Dependency check timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
