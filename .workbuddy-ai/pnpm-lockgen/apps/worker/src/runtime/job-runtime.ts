import { randomUUID } from "node:crypto";

export type JobEnvelope<TPayload = unknown> = {
  jobId: string;
  jobType: string;
  schemaVersion: number;
  idempotencyKey: string;
  correlationId: string;
  requestId?: string;
  causationId?: string;
  occurredAt: string;
  attempt: number;
  maxAttempts: number;
  metadata?: Record<string, string | number | boolean>;
  payload: TPayload;
};

export type RetryPolicy = {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
};

export function createJobEnvelope<TPayload>(input: {
  jobType: string;
  idempotencyKey: string;
  payload: TPayload;
  jobId?: string;
  correlationId?: string;
  requestId?: string;
  causationId?: string;
  attempt?: number;
  maxAttempts?: number;
  metadata?: Record<string, string | number | boolean>;
}): JobEnvelope<TPayload> {
  const jobId = input.jobId ?? randomUUID();
  return {
    jobId,
    jobType: input.jobType,
    schemaVersion: 1,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId ?? input.requestId ?? jobId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    occurredAt: new Date().toISOString(),
    attempt: input.attempt ?? 1,
    maxAttempts: input.maxAttempts ?? 3,
    ...(input.metadata ? { metadata: sanitizeMetadata(input.metadata) } : {}),
    payload: input.payload,
  };
}

export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random,
) {
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, Math.trunc(attempt) - 1),
  );
  const spread = exponential * Math.max(0, Math.min(1, policy.jitterRatio));
  const jitter = (Math.max(0, Math.min(1, random())) * 2 - 1) * spread;
  return Math.max(0, Math.round(exponential + jitter));
}

export function safeJobError(error: unknown) {
  const source = error instanceof Error ? error : new Error(String(error));
  return {
    name: source.name,
    message: redact(source.message).slice(0, 2_000),
    retryable: isRetryableError(source),
  };
}

export function isRetryableError(error: Error) {
  const message = error.message.toLowerCase();
  return !/(validation|unauthori[sz]ed|forbidden|invalid configuration|invariant|malformed)/.test(
    message,
  );
}

export function createPollingGuard() {
  let running = false;
  return async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (running) return undefined;
    running = true;
    try {
      return await operation();
    } finally {
      running = false;
    }
  };
}

export function jobLifecycleFields<T>(envelope: JobEnvelope<T>) {
  return {
    jobId: envelope.jobId,
    jobType: envelope.jobType,
    schemaVersion: envelope.schemaVersion,
    idempotencyKey: envelope.idempotencyKey,
    correlationId: envelope.correlationId,
    requestId: envelope.requestId,
    causationId: envelope.causationId,
    attempt: envelope.attempt,
    maxAttempts: envelope.maxAttempts,
  };
}

export function registerGracefulShutdown(
  shutdown: () => Promise<void>,
  signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"],
) {
  let shuttingDown = false;
  const handler = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void shutdown().catch((error: unknown) => {
      console.error("Worker graceful shutdown failed", safeJobError(error));
      process.exitCode = 1;
    });
  };
  for (const signal of signals) process.once(signal, handler);
  return () => {
    for (const signal of signals) process.removeListener(signal, handler);
  };
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      /(token|password|secret|credential|authorization|cookie|bank|account)/i.test(key)
        ? "[REDACTED]"
        : value,
    ]),
  );
}

function redact(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password|token|secret|api[_-]?key)=([^\s&]+)/gi, "$1=[REDACTED]");
}
