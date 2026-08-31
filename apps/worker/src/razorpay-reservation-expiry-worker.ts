import type pino from "pino";

type Logger = pino.Logger;

type ExpiryResult = {
  checked: number;
  expired: number;
  capturedRecovered: number;
  authorizedSkipped: number;
  conflictsSkipped: number;
  failed: number;
  cutoff: string;
};

export function startRazorpayReservationExpiryPolling(logger: Logger) {
  if (process.env.RAZORPAY_RESERVATION_EXPIRY_WORKER_ENABLED === "false") {
    logger.info(
      "Razorpay reservation expiry worker disabled by RAZORPAY_RESERVATION_EXPIRY_WORKER_ENABLED=false.",
    );
    return;
  }

  if (!process.env.INTERNAL_API_SECRET) {
    logger.warn(
      "INTERNAL_API_SECRET is not configured in environment. Razorpay reservation expiry worker is idle.",
    );
    return;
  }

  const pollIntervalMs = positiveInteger(
    process.env.RAZORPAY_RESERVATION_EXPIRY_POLL_INTERVAL_MS,
    60_000,
  );
  const timeoutMinutes = positiveInteger(
    process.env.RAZORPAY_RESERVATION_TIMEOUT_MINUTES,
    15,
  );
  const batchSize = positiveInteger(
    process.env.RAZORPAY_RESERVATION_EXPIRY_BATCH_SIZE,
    50,
  );
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await expireRazorpayReservations(timeoutMinutes, batchSize);
      if (
        result.expired > 0 ||
        result.capturedRecovered > 0 ||
        result.conflictsSkipped > 0 ||
        result.failed > 0
      ) {
        logger.info(result, "Razorpay reservation expiry batch processed");
      }
    } catch (error) {
      logger.error({ error }, "Razorpay reservation expiry poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info(
    { pollIntervalMs, timeoutMinutes, batchSize },
    "Razorpay reservation expiry worker started",
  );
}

export async function expireRazorpayReservations(
  timeoutMinutes: number,
  limit: number,
  request: typeof fetch = fetch,
) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    throw new Error("INTERNAL_API_SECRET is missing.");
  }

  const apiUrl = normalizeInternalApiBaseUrl(
    process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000/api",
  );
  const response = await request(`${apiUrl}/internal/payments/expire-razorpay-reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ timeoutMinutes, limit }),
  });

  if (!response.ok) {
    throw new Error(
      `Razorpay reservation expiry API responded with status ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as ExpiryResult;
}

export function normalizeInternalApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
