const TRANSIENT_PRISMA_CONNECTION_PATTERNS = [
  "p1017",
  "connection terminated unexpectedly",
  "connection terminated due to connection timeout",
  "server closed the connection unexpectedly",
  "server has closed the connection",
  "terminating connection due to administrator command",
  "timeout exceeded when trying to connect",
  "connectionclosed",
  "connection lost",
  "econnreset",
  "etimedout",
  "epipe",
];

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

export async function retryTransientPrismaRead<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
) {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 250;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isTransientPrismaConnectionError(error)) {
        throw error;
      }

      await sleep(delayMs * attempt);
    }
  }

  return operation();
}

export function isTransientPrismaConnectionError(error: unknown) {
  const text = collectErrorText(error).toLowerCase();
  return TRANSIENT_PRISMA_CONNECTION_PATTERNS.some((pattern) => text.includes(pattern));
}

function collectErrorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error ?? "");
  }

  const record = error as { message?: unknown; cause?: unknown; code?: unknown };
  return [record.message, record.code, collectCauseText(record.cause)].filter(Boolean).join(" ");
}

function collectCauseText(cause: unknown): string {
  if (!cause || typeof cause !== "object") {
    return String(cause ?? "");
  }

  const record = cause as { message?: unknown; code?: unknown; cause?: unknown };
  return [record.message, record.code, collectCauseText(record.cause)].filter(Boolean).join(" ");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
