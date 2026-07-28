import type pino from "pino";
import { prisma, PushNotificationType, ServiceBookingStatus, ServiceQuoteStatus } from "@indihub/database";

type Logger = pino.Logger;

export function startServiceQuoteExpiryPolling(logger: Logger) {
  if (process.env.SERVICE_QUOTE_EXPIRY_WORKER_ENABLED === "false") {
    logger.info("Service quote expiry worker disabled by SERVICE_QUOTE_EXPIRY_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.SERVICE_QUOTE_EXPIRY_POLL_INTERVAL_MS, 15 * 60 * 1000);
  const batchSize = positiveInteger(process.env.SERVICE_QUOTE_EXPIRY_BATCH_SIZE, 100);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await expireServiceQuotes(batchSize);
      if (result.expired > 0) {
        logger.info(result, "Service quotes expired");
      }
    } catch (error) {
      logger.error({ error }, "Service quote expiry poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "Service quote expiry worker started");
}

export async function expireServiceQuotes(limit = 100) {
  const take = Math.min(250, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const quotes = await prisma.serviceQuote.findMany({
    where: {
      status: ServiceQuoteStatus.SENT,
      expiresAt: { lte: now },
      booking: { status: ServiceBookingStatus.QUOTE_SENT },
    },
    select: {
      id: true,
      bookingId: true,
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          customerId: true,
          status: true,
          listing: { select: { title: true } },
        },
      },
    },
    orderBy: { expiresAt: "asc" },
    take,
  });

  if (!quotes.length) {
    return { checked: 0, expired: 0 };
  }

  let expired = 0;
  await prisma.$transaction(async (tx) => {
    for (const quote of quotes) {
      const updatedQuote = await tx.serviceQuote.updateMany({
        where: { id: quote.id, status: ServiceQuoteStatus.SENT, expiresAt: { lte: now } },
        data: { status: ServiceQuoteStatus.EXPIRED, expiredAt: now },
      });

      if (updatedQuote.count === 1) {
        expired += 1;
        await tx.serviceBooking.updateMany({
          where: { id: quote.bookingId, status: ServiceBookingStatus.QUOTE_SENT },
          data: { status: ServiceBookingStatus.QUOTE_EXPIRED },
        });
        await tx.auditLog.create({
          data: {
            action: "service_quote.expired",
            entityType: "service_booking",
            entityId: quote.bookingId,
            oldValue: { status: quote.booking.status },
            newValue: {
              quoteStatus: ServiceQuoteStatus.EXPIRED,
              bookingStatus: ServiceBookingStatus.QUOTE_EXPIRED,
              expiredAt: now.toISOString(),
            },
          },
        });
        await tx.customerNotification.upsert({
          where: {
            customerId_type_sourceType_sourceId: {
              customerId: quote.booking.customerId,
              type: PushNotificationType.SERVICE_BOOKING,
              sourceType: "service_quote",
              sourceId: quote.id,
            },
          },
          update: {
            title: "Service quote expired",
            body: `${quote.booking.listing.title} quote expired. Ask the provider for a revised quote from your booking page.`,
            href: `/account/service-bookings/${quote.booking.bookingNumber}`,
            readAt: null,
            metadata: {
              bookingId: quote.bookingId,
              quoteId: quote.id,
              bookingNumber: quote.booking.bookingNumber,
              status: ServiceBookingStatus.QUOTE_EXPIRED,
            },
          },
          create: {
            customerId: quote.booking.customerId,
            type: PushNotificationType.SERVICE_BOOKING,
            title: "Service quote expired",
            body: `${quote.booking.listing.title} quote expired. Ask the provider for a revised quote from your booking page.`,
            href: `/account/service-bookings/${quote.booking.bookingNumber}`,
            sourceType: "service_quote",
            sourceId: quote.id,
            metadata: {
              bookingId: quote.bookingId,
              quoteId: quote.id,
              bookingNumber: quote.booking.bookingNumber,
              status: ServiceBookingStatus.QUOTE_EXPIRED,
            },
          },
        });
      }
    }
  });

  return { checked: quotes.length, expired };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
