import type pino from "pino";
import {
  CodCollectionSource,
  CourierProviderMode,
  CourierShipmentStatus,
  DeliveryMode,
  OrderShipmentPackageStatus,
  PaymentProvider,
  Prisma,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;
type JsonRecord = Record<string, unknown>;

type CourierProviderAdapterSnapshot = {
  adapterCode?: string | null;
  apiBaseUrl?: string | null;
  bookingEndpointPath?: string | null;
  labelEndpointPath?: string | null;
  preferredCourierCompanyId?: string | null;
  accountCode?: string | null;
  username?: string | null;
  credentials?: {
    password?: string | null;
  } | null;
  defaultPackage?: {
    weightGrams?: number | null;
    lengthCm?: number | null;
    breadthCm?: number | null;
    heightCm?: number | null;
  } | null;
};

type ClaimedShipment = {
  id: string;
  shipmentNumber: string;
  wasStaleLock: boolean;
};

type BookingRequest = {
  shipmentNumber: string;
  orderDate: Date;
  paymentMethod: "COD" | "PREPAID";
  subtotalPaise: number;
  codAmountPaise: number;
  pickupLocationName: string;
  shippingAddress: BookingAddress;
  sellerAddress: BookingAddress;
  items: BookingItem[];
  parcel: BookingParcel;
  settings: CourierProviderAdapterSnapshot;
};

type BookingAddress = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

type BookingItem = {
  name: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
};

type BookingParcel = {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
};

type BookingResult = {
  providerOrderId?: string | null;
  awbNumber?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  trackingStatus: CourierShipmentStatus;
  trackingStatusLabel: string;
  bookingPayloadSnapshot: unknown;
  bookingResponseSnapshot: unknown;
  source: "LIVE_ADAPTER" | "RECOVERY_LOOKUP";
};

type ShiprocketResponse = Record<string, unknown>;

const providerCode = "SHIPROCKET";
const defaultBaseUrl = "https://apiv2.shiprocket.in";
const authEndpoint = "/v1/external/auth/login";
const defaultBookingEndpoint = "/v1/external/orders/create/adhoc";
const defaultOrderLookupEndpoint = "/v1/external/orders/show";
const defaultServiceabilityEndpoint = "/v1/external/courier/serviceability";
const defaultAwbEndpoint = "/v1/external/courier/assign/awb";
const defaultLabelEndpoint = "/v1/external/courier/generate/label";
const requestTimeoutMs = 30000;
const maxTransientAttempts = 3;
const backoffMinutes = [5, 15, 45] as const;

export function startShiprocketBookingPolling(logger: Logger) {
  if (process.env.SHIPROCKET_BOOKING_WORKER_ENABLED === "false") {
    logger.info("Shiprocket booking worker disabled by SHIPROCKET_BOOKING_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.SHIPROCKET_BOOKING_POLL_INTERVAL_MS, 60000);
  const batchSize = positiveInteger(process.env.SHIPROCKET_BOOKING_BATCH_SIZE, 50);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await processShiprocketBookingBatch(batchSize, logger);
      if (result.claimed > 0) {
        logger.info(result, "Shiprocket automatic booking batch processed");
      }
    } catch (error) {
      logger.error({ error }, "Shiprocket automatic booking poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "Shiprocket automatic booking worker started");
}

export async function processShiprocketBookingBatch(limit = 50, logger?: Logger) {
  const take = Math.min(50, Math.max(1, Math.trunc(limit)));
  const claimed = await claimShiprocketBookings(take);
  let booked = 0;
  let transientFailed = 0;
  let terminalFailed = 0;
  const terminalizedExhausted = await terminalizeExhaustedShiprocketBookings(take);
  terminalFailed += terminalizedExhausted;

  for (const shipment of claimed) {
    try {
      const outcome = await processClaimedShipment(shipment);
      if (outcome === "booked") {
        booked += 1;
      } else if (outcome === "terminal") {
        terminalFailed += 1;
      } else {
        transientFailed += 1;
      }
    } catch (error) {
      transientFailed += 1;
      logger?.error({ error, shipmentNumber: shipment.shipmentNumber }, "Shiprocket booking worker failed unexpectedly");
      await recordTransientFailure(shipment.id, providerCode, error);
    }
  }

  return { claimed: claimed.length, booked, transientFailed, terminalFailed };
}

async function claimShiprocketBookings(limit: number): Promise<ClaimedShipment[]> {
  return prisma.$queryRaw<ClaimedShipment[]>`
    WITH claimed AS (
      SELECT
        os.id,
        (
          os."booking_in_progress" = true
          AND (
            os."booking_claimed_at" IS NULL
            OR os."booking_claimed_at" < NOW() - INTERVAL '10 minutes'
          )
        ) AS "wasStaleLock"
      FROM "order_shipments" os
      LEFT JOIN "courier_shipments" cs ON cs."order_shipment_id" = os.id
      WHERE os."ready_for_booking_at" IS NOT NULL
        AND os."delivery_mode" = 'THIRD_PARTY_COURIER'
        AND os."courier_provider_code" = ${providerCode}
        AND os."status" NOT IN ('DELIVERED', 'CANCELLED')
        AND (
          os."booking_in_progress" = false
          OR os."booking_claimed_at" IS NULL
          OR os."booking_claimed_at" < NOW() - INTERVAL '10 minutes'
        )
        AND (os."booking_next_attempt_at" IS NULL OR os."booking_next_attempt_at" <= NOW())
        AND (cs.id IS NULL OR cs."tracking_status" = 'NOT_BOOKED')
        AND os."routing_permanent_failure_at" IS NULL
        AND (cs."booking_attempt_count" IS NULL OR cs."booking_attempt_count" < ${maxTransientAttempts})
      ORDER BY os."ready_for_booking_at" ASC
      LIMIT ${limit}
      FOR UPDATE OF os SKIP LOCKED
    )
    UPDATE "order_shipments" os
    SET "booking_in_progress" = true, "booking_claimed_at" = NOW()
    FROM claimed
    WHERE os.id = claimed.id
    RETURNING os.id, os."shipment_number" AS "shipmentNumber", claimed."wasStaleLock";
  `;
}

async function processClaimedShipment(shipment: ClaimedShipment): Promise<"booked" | "transient" | "terminal"> {
  const context = await loadBookingContext(shipment.shipmentNumber);
  if (!context) {
    await releaseShipmentLock(shipment.id);
    return "terminal";
  }

  let reservedAttemptCount: number | null = null;
  try {
    const request = buildBookingRequest(context);
    if (shipment.wasStaleLock) {
      const existing = await lookupShiprocketBooking(request);
      if (existing.found) {
        await recordBookingSuccess(context, {
          providerOrderId: existing.providerOrderId,
          awbNumber: existing.awbNumber,
          courierName: existing.courierName,
          courierCode: existing.courierCode,
          trackingUrl: existing.trackingUrl,
          labelUrl: existing.labelUrl,
          trackingStatus: existing.awbNumber ? CourierShipmentStatus.BOOKED : CourierShipmentStatus.NOT_BOOKED,
          trackingStatusLabel: existing.trackingStatusLabel,
          bookingPayloadSnapshot: { source: "SHIPROCKET_LOOKUP", shipmentNumber: request.shipmentNumber },
          bookingResponseSnapshot: existing.bookingResponseSnapshot,
          source: "RECOVERY_LOOKUP",
        });
        return "booked";
      }
    }

    reservedAttemptCount = await reserveFreshBookingAttempt(context);
    const result = await createShiprocketBooking(request);
    await recordBookingSuccess(context, result, {
      incrementAttempt: false,
      bookingAttemptCount: reservedAttemptCount,
    });
    return "booked";
  } catch (error) {
    if (isTerminalBookingError(error)) {
      await recordTerminalFailure(context, error);
      return "terminal";
    }

    const failedTerminally = await recordTransientFailure(context.id, providerCode, error, {
      ...(reservedAttemptCount === null ? {} : { attemptCount: reservedAttemptCount }),
      incrementAttempt: reservedAttemptCount === null,
    });
    return failedTerminally ? "terminal" : "transient";
  }
}

async function loadBookingContext(shipmentNumber: string) {
  const shipment = await prisma.orderShipment.findUnique({
    where: { shipmentNumber },
    include: {
      order: {
        include: {
          payments: true,
          shipments: true,
          customer: { include: { user: true } },
        },
      },
      seller: {
        include: {
          profile: true,
          addresses: true,
          courierProviderSettings: { where: { providerCode, isActive: true } },
        },
      },
      packages: { orderBy: { sequence: "asc" } },
      courierShipment: true,
    },
  });

  if (!shipment || shipment.deliveryMode !== DeliveryMode.THIRD_PARTY_COURIER) {
    return null;
  }

  const provider = await prisma.courierProviderSetting.findUnique({ where: { providerCode } });
  if (!provider || !provider.isActive || provider.mode === CourierProviderMode.MANUAL || !provider.credentialsConfigured) {
    throw new TerminalBookingError("Shiprocket provider is not active with live credentials configured.");
  }

  return { ...shipment, provider };
}

async function terminalizeExhaustedShiprocketBookings(limit: number) {
  const shipments = await prisma.orderShipment.findMany({
    where: {
      deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
      courierProviderCode: providerCode,
      routingPermanentFailureAt: null,
      OR: [{ bookingInProgress: false }, { bookingClaimedAt: null }, { bookingClaimedAt: { lt: staleLockCutoff() } }],
      courierShipment: {
        trackingStatus: CourierShipmentStatus.NOT_BOOKED,
        bookingAttemptCount: { gte: maxTransientAttempts },
      },
    },
    select: {
      id: true,
      shipmentNumber: true,
      orderId: true,
      sellerId: true,
      courierShipment: { select: { bookingAttemptCount: true, bookingError: true } },
      packages: { select: { id: true }, orderBy: { sequence: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  if (!shipments.length) {
    return 0;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const shipment of shipments) {
      const message =
        shipment.courierShipment?.bookingError ??
        "Courier booking reached the automatic retry limit and now needs manual review.";
      await tx.courierShipment.update({
        where: { orderShipmentId: shipment.id },
        data: {
          trackingStatus: CourierShipmentStatus.FAILED,
          trackingStatusLabel: "Courier booking failed permanently after retries.",
          bookingError: message,
        },
      });
      await tx.orderShipment.update({
        where: { id: shipment.id },
        data: {
          bookingInProgress: false,
          bookingClaimedAt: null,
          bookingNextAttemptAt: null,
          routingFailed: true,
          routingFailureNote: message,
          routingLastAttemptAt: now,
          routingPermanentFailureAt: now,
          courierTrackingStatus: CourierShipmentStatus.FAILED,
        },
      });
      if (shipment.packages[0]) {
        await tx.orderShipmentPackage.update({
          where: { id: shipment.packages[0].id },
          data: { status: OrderShipmentPackageStatus.FAILED },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: "courier.shipment.booking_terminal_failure",
          entityType: "order_shipment",
          entityId: shipment.id,
          newValue: {
            actorType: "SYSTEM",
            providerCode,
            shipmentNumber: shipment.shipmentNumber,
            message,
            bookingAttemptCount: shipment.courierShipment?.bookingAttemptCount ?? maxTransientAttempts,
            alertAdmin: true,
          },
        },
      });
    }
  });

  return shipments.length;
}

async function reserveFreshBookingAttempt(context: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.courierShipment.findUnique({ where: { orderShipmentId: context.id } });
    const nextAttemptCount = (existing?.bookingAttemptCount ?? 0) + 1;
    await tx.courierShipment.upsert({
      where: { orderShipmentId: context.id },
      update: {
        providerCode,
        trackingStatus: CourierShipmentStatus.NOT_BOOKED,
        trackingStatusLabel: "Shiprocket automatic booking attempt started.",
        bookingAttemptCount: { increment: 1 },
        bookingError: null,
      },
      create: {
        orderShipmentId: context.id,
        orderId: context.orderId,
        sellerId: context.sellerId,
        providerCode,
        trackingStatus: CourierShipmentStatus.NOT_BOOKED,
        trackingStatusLabel: "Shiprocket automatic booking attempt started.",
        bookingAttemptCount: nextAttemptCount,
        bookingPayloadSnapshot: {
          source: "SHIPROCKET_WORKER_ATTEMPT_RESERVED",
          shipmentNumber: context.shipmentNumber,
        },
      },
    });
    return nextAttemptCount;
  });
}

function buildBookingRequest(context: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>): BookingRequest {
  const settings = providerSnapshot(context.provider.settingsSnapshot);
  const pickupLocationName = context.seller.courierProviderSettings[0]?.pickupLocationName?.trim();
  if (!pickupLocationName) {
    throw new TerminalBookingError("Seller pickup location is missing for Shiprocket.");
  }
  const shippingAddress = readAddressSnapshot(context.order.shippingAddressSnapshot);
  if (!shippingAddress) {
    throw new TerminalBookingError("Courier booking needs a delivery address snapshot.");
  }
  const sellerAddress = context.seller.addresses[0];
  if (!sellerAddress) {
    throw new TerminalBookingError("Courier booking needs a seller pickup address.");
  }
  const items = readPackageItems(context.packages[0]?.itemAllocations ?? null);
  if (!items.length) {
    throw new TerminalBookingError("Courier booking needs package item allocations.");
  }
  const parcel = resolveParcel(context.packages[0], settings.defaultPackage);

  return {
    shipmentNumber: context.shipmentNumber,
    orderDate: context.order.createdAt,
    paymentMethod: hasCodPayment(context.order.payments) ? "COD" : "PREPAID",
    subtotalPaise: context.subtotalPaise,
    codAmountPaise: expectedPackageCodAmountPaise(context.order.payments, context.order.shipments, context),
    pickupLocationName,
    shippingAddress: {
      ...shippingAddress,
      fullName: shippingAddress.fullName ?? context.order.customer.user.fullName ?? "Customer",
      email: context.order.customer.user.email,
      phone: shippingAddress.phone ?? context.order.customer.user.phone,
    },
    sellerAddress: {
      fullName: context.seller.storeName,
      email: context.seller.profile?.contactEmail ?? null,
      phone: context.seller.profile?.contactPhone ?? null,
      line1: sellerAddress.line1,
      line2: sellerAddress.line2,
      area: sellerAddress.area,
      city: sellerAddress.city,
      state: sellerAddress.state,
      pincode: sellerAddress.pincode,
      country: sellerAddress.country,
    },
    items,
    parcel,
    settings,
  };
}

async function lookupShiprocketBooking(request: BookingRequest) {
  const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
  const token = await authenticate(baseUrl, request.settings);
  const params = new URLSearchParams({ order_id: request.shipmentNumber });
  const response = await getJsonAllowNotFound(`${urlFor(baseUrl, defaultOrderLookupEndpoint)}?${params.toString()}`, token);
  if (response.notFound) {
    return { found: false as const, bookingResponseSnapshot: { lookup: { status: 404 } } };
  }

  const body = response.body;
  const awbNumber =
    readText(body, ["awb_code"]) ??
    readText(body, ["awb"]) ??
    readText(body, ["data", "awb_code"]) ??
    readText(body, ["data", "awb"]);

  return {
    found: true as const,
    providerOrderId:
      readText(body, ["order_id"]) ?? readText(body, ["data", "order_id"]) ?? readText(body, ["id"]) ?? request.shipmentNumber,
    awbNumber,
    courierName: readText(body, ["courier_name"]) ?? readText(body, ["data", "courier_name"]),
    courierCode: readText(body, ["courier_code"]) ?? readText(body, ["data", "courier_code"]),
    trackingUrl: awbNumber ? `https://shiprocket.co/tracking/${encodeURIComponent(awbNumber)}` : null,
    labelUrl: readText(body, ["label_url"]) ?? readText(body, ["data", "label_url"]),
    trackingStatusLabel:
      readText(body, ["status"]) ??
      readText(body, ["data", "status"]) ??
      "Shiprocket booking recovered from order lookup.",
    bookingResponseSnapshot: { lookup: body },
  };
}

async function createShiprocketBooking(request: BookingRequest): Promise<BookingResult> {
  const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
  const token = await authenticate(baseUrl, request.settings);
  const bookingPayload = createBookingPayload(request);
  const createResponse = await postJson(urlFor(baseUrl, request.settings.bookingEndpointPath || defaultBookingEndpoint), bookingPayload, token);
  const shipmentId =
    readText(createResponse, ["shipment_id"]) ??
    readText(createResponse, ["data", "shipment_id"]) ??
    readText(createResponse, ["payload", "shipment_id"]);
  const providerOrderId =
    readText(createResponse, ["order_id"]) ??
    readText(createResponse, ["data", "order_id"]) ??
    shipmentId ??
    request.shipmentNumber;
  let awbNumber =
    readText(createResponse, ["awb_code"]) ??
    readText(createResponse, ["awb"]) ??
    readText(createResponse, ["data", "awb_code"]) ??
    readText(createResponse, ["data", "awb"]);
  let statusLabel = awbNumber ? "Shipment booked with Shiprocket." : "Shiprocket order created.";
  let serviceabilityResponse: unknown = null;
  let awbResponse: unknown = null;
  let labelResponse: unknown = null;

  if (!awbNumber && shipmentId) {
    serviceabilityResponse = await fetchServiceability(baseUrl, token, request);
    const courierCompanyId = request.settings.preferredCourierCompanyId?.trim() || readRecommendedCourierCompanyId(serviceabilityResponse);
    if (courierCompanyId) {
      awbResponse = await postJson(
        urlFor(baseUrl, defaultAwbEndpoint),
        { shipment_id: numericOrText(shipmentId), courier_id: numericOrText(courierCompanyId) },
        token,
      );
      awbNumber =
        readText(awbResponse, ["response", "data", "awb_code"]) ??
        readText(awbResponse, ["data", "awb_code"]) ??
        readText(awbResponse, ["awb_code"]) ??
        readText(awbResponse, ["awb"]);
      statusLabel = awbNumber ? "Shiprocket AWB assigned." : "Shiprocket order created; AWB is pending provider assignment.";
    }
  }

  if (shipmentId && awbNumber) {
    labelResponse = await postJson(
      urlFor(baseUrl, request.settings.labelEndpointPath || defaultLabelEndpoint),
      { shipment_id: [numericOrText(shipmentId)] },
      token,
    ).catch((error: unknown) => ({ error: errorMessage(error) }));
  }

  const labelUrl =
    readText(labelResponse, ["label_url"]) ??
    readText(labelResponse, ["labelUrl"]) ??
    readText(labelResponse, ["data", "label_url"]) ??
    readText(labelResponse, ["response", "label_url"]);

  const courierName =
    readText(awbResponse, ["response", "data", "courier_name"]) ??
    readText(awbResponse, ["data", "courier_name"]) ??
    readText(awbResponse, ["courier_name"]) ??
    readText(createResponse, ["courier_name"]);

  const courierCode =
    readText(awbResponse, ["response", "data", "courier_company_id"]) ??
    readText(awbResponse, ["data", "courier_company_id"]) ??
    readText(awbResponse, ["courier_company_id"]) ??
    readText(createResponse, ["courier_company_id"]);

  return {
    providerOrderId,
    awbNumber,
    courierName,
    courierCode,
    trackingUrl: awbNumber ? `https://shiprocket.co/tracking/${encodeURIComponent(awbNumber)}` : null,
    labelUrl,
    trackingStatus: awbNumber ? CourierShipmentStatus.BOOKED : CourierShipmentStatus.NOT_BOOKED,
    trackingStatusLabel: statusLabel,
    bookingPayloadSnapshot: bookingPayload,
    bookingResponseSnapshot: { create: createResponse, serviceability: serviceabilityResponse, awb: awbResponse, label: labelResponse },
    source: "LIVE_ADAPTER",
  };
}

async function recordBookingSuccess(
  context: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>,
  result: BookingResult,
  options: { incrementAttempt?: boolean; bookingAttemptCount?: number } = {},
) {
  const now = new Date();
  const orderShipmentPackage = context.packages[0];
  if (!orderShipmentPackage) {
    throw new TerminalBookingError("Courier booking needs a shipment package.");
  }
  const providerOrderId = result.providerOrderId ?? null;
  const awbNumber = result.awbNumber ?? null;
  const trackingUrl = result.trackingUrl ?? null;
  const labelUrl = result.labelUrl ?? null;
  const incrementAttempt = options.incrementAttempt ?? true;
  const bookingAttemptCount = options.bookingAttemptCount ?? 1;

  await prisma.$transaction(async (tx) => {
    const courierShipmentUpdate = {
      providerCode,
      providerOrderId,
      awbNumber,
      trackingStatus: result.trackingStatus,
      trackingStatusLabel: result.trackingStatusLabel,
      trackingUrl,
      labelUrl,
      ...(incrementAttempt ? { bookingAttemptCount: { increment: 1 } } : {}),
      bookingError: result.trackingStatus === CourierShipmentStatus.BOOKED ? null : result.trackingStatusLabel,
      bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : null,
      bookingPayloadSnapshot: inputJson(result.bookingPayloadSnapshot),
      bookingResponseSnapshot: inputJson(result.bookingResponseSnapshot),
    };
    const courierConsignmentUpdate = {
      providerCode,
      providerOrderId,
      pickupLocationName: context.seller.courierProviderSettings[0]?.pickupLocationName ?? null,
      trackingStatus: result.trackingStatus,
      trackingStatusLabel: result.trackingStatusLabel,
      labelDocumentUrl: labelUrl,
      ...(incrementAttempt ? { bookingAttemptCount: { increment: 1 } } : {}),
      bookingError: result.trackingStatus === CourierShipmentStatus.BOOKED ? null : result.trackingStatusLabel,
      bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : null,
      bookingPayloadSnapshot: inputJson(result.bookingPayloadSnapshot),
      bookingResponseSnapshot: inputJson(result.bookingResponseSnapshot),
    };
    const courierShipment = await tx.courierShipment.upsert({
      where: { orderShipmentId: context.id },
      update: courierShipmentUpdate,
      create: {
        orderShipmentId: context.id,
        orderId: context.orderId,
        sellerId: context.sellerId,
        providerCode,
        providerOrderId,
        awbNumber,
        trackingStatus: result.trackingStatus,
        trackingStatusLabel: result.trackingStatusLabel,
        trackingUrl,
        labelUrl,
        bookingAttemptCount,
        bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : null,
        bookingError: result.trackingStatus === CourierShipmentStatus.BOOKED ? null : result.trackingStatusLabel,
        bookingPayloadSnapshot: inputJson(result.bookingPayloadSnapshot),
        bookingResponseSnapshot: inputJson(result.bookingResponseSnapshot),
      },
    });

    const consignmentNumber = `${context.shipmentNumber}-C01`;
    const courierConsignment = await tx.courierConsignment.upsert({
      where: { consignmentNumber },
      update: courierConsignmentUpdate,
      create: {
        consignmentNumber,
        orderShipmentId: context.id,
        orderId: context.orderId,
        sellerId: context.sellerId,
        providerCode,
        providerOrderId,
        pickupLocationName: context.seller.courierProviderSettings[0]?.pickupLocationName ?? null,
        trackingStatus: result.trackingStatus,
        trackingStatusLabel: result.trackingStatusLabel,
        labelDocumentUrl: labelUrl,
        bookingAttemptCount,
        bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : null,
        bookingError: result.trackingStatus === CourierShipmentStatus.BOOKED ? null : result.trackingStatusLabel,
        bookingPayloadSnapshot: inputJson(result.bookingPayloadSnapshot),
        bookingResponseSnapshot: inputJson(result.bookingResponseSnapshot),
      },
    });

    const courierPackageData = {
      orderShipmentId: context.id,
      orderId: context.orderId,
      sellerId: context.sellerId,
      providerPackageId: providerOrderId,
      awbNumber,
      courierName: result.courierName ?? "Shiprocket",
      courierCode: result.courierCode ?? providerCode,
      trackingStatus: result.trackingStatus,
      trackingStatusLabel: result.trackingStatusLabel,
      trackingUrl,
      labelUrl,
      bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : null,
    };
    const existingPackage = await tx.courierConsignmentPackage.findFirst({
      where: { courierConsignmentId: courierConsignment.id, orderShipmentPackageId: orderShipmentPackage.id },
    });
    if (existingPackage) {
      await tx.courierConsignmentPackage.update({ where: { id: existingPackage.id }, data: courierPackageData });
    } else {
      await tx.courierConsignmentPackage.create({
        data: { courierConsignmentId: courierConsignment.id, orderShipmentPackageId: orderShipmentPackage.id, ...courierPackageData },
      });
    }

    await tx.orderShipmentPackage.update({
      where: { id: orderShipmentPackage.id },
      data: {
        status: packageStatusFromCourierStatus(result.trackingStatus),
        bookedAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? now : orderShipmentPackage.bookedAt,
      },
    });

    await tx.orderShipment.update({
      where: { id: context.id },
      data: {
        courierProviderCode: providerCode,
        awbNumber,
        courierTrackingStatus: result.trackingStatus,
        labelUrl,
        trackingReference: awbNumber ?? providerOrderId ?? context.trackingReference,
        bookingInProgress: false,
        bookingClaimedAt: null,
        bookingNextAttemptAt: result.trackingStatus === CourierShipmentStatus.BOOKED ? null : nextAttemptDate(1),
        codCollectionSource: hasCodPayment(context.order.payments)
          ? CodCollectionSource.THIRD_PARTY_COURIER
          : context.codCollectionSource,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: "courier.shipment.booked",
        entityType: "order_shipment",
        entityId: context.id,
        newValue: {
          actorType: "SYSTEM",
          providerCode,
          shipmentNumber: context.shipmentNumber,
          awbNumber,
          providerOrderId,
          source: result.source,
        },
      },
    });

    if (hasCodPayment(context.order.payments)) {
      await tx.courierCodRemittance.upsert({
        where: { orderShipmentId: context.id },
        update: {
          courierShipmentId: courierShipment.id,
          providerCode,
          awbNumber,
          expectedAmountPaise: expectedPackageCodAmountPaise(context.order.payments, context.order.shipments, context),
        },
        create: {
          courierShipmentId: courierShipment.id,
          orderShipmentId: context.id,
          orderId: context.orderId,
          sellerId: context.sellerId,
          providerCode,
          awbNumber,
          expectedAmountPaise: expectedPackageCodAmountPaise(context.order.payments, context.order.shipments, context),
        },
      });
    }
  });
}

async function recordTransientFailure(
  shipmentId: string,
  code: string,
  error: unknown,
  options: { attemptCount?: number; incrementAttempt?: boolean } = {},
) {
  const message = errorMessage(error);
  const existing = await prisma.courierShipment.findUnique({ where: { orderShipmentId: shipmentId } });
  const incrementAttempt = options.incrementAttempt ?? true;
  const nextAttemptCount = options.attemptCount ?? (existing?.bookingAttemptCount ?? 0) + 1;
  const terminal = nextAttemptCount >= maxTransientAttempts;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const shipment = await tx.orderShipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { packages: { orderBy: { sequence: "asc" } } } });
    const courierShipmentUpdate = {
      providerCode: code,
      trackingStatus: terminal ? CourierShipmentStatus.FAILED : CourierShipmentStatus.NOT_BOOKED,
      trackingStatusLabel: terminal ? "Courier booking failed permanently after retries." : "Courier booking failed transiently.",
      ...(incrementAttempt ? { bookingAttemptCount: { increment: 1 } } : {}),
      bookingError: message,
    };
    await tx.courierShipment.upsert({
      where: { orderShipmentId: shipmentId },
      update: courierShipmentUpdate,
      create: {
        orderShipmentId: shipmentId,
        orderId: shipment.orderId,
        sellerId: shipment.sellerId,
        providerCode: code,
        trackingStatus: terminal ? CourierShipmentStatus.FAILED : CourierShipmentStatus.NOT_BOOKED,
        trackingStatusLabel: terminal ? "Courier booking failed permanently after retries." : "Courier booking failed transiently.",
        bookingAttemptCount: nextAttemptCount,
        bookingError: message,
        bookingPayloadSnapshot: { source: "SHIPROCKET_WORKER_FAILURE", shipmentNumber: shipment.shipmentNumber },
      },
    });
    await tx.orderShipment.update({
      where: { id: shipmentId },
      data: {
        bookingInProgress: false,
        bookingClaimedAt: null,
        bookingNextAttemptAt: terminal ? null : nextAttemptDate(nextAttemptCount),
        courierProviderCode: code,
        courierTrackingStatus: terminal ? CourierShipmentStatus.FAILED : CourierShipmentStatus.NOT_BOOKED,
        ...(terminal
          ? {
              routingFailed: true,
              routingFailureNote: message,
              routingLastAttemptAt: now,
              routingPermanentFailureAt: now,
            }
          : { routingLastAttemptAt: now }),
      },
    });
    if (shipment.packages[0]) {
      await tx.orderShipmentPackage.update({
        where: { id: shipment.packages[0].id },
        data: { status: terminal ? OrderShipmentPackageStatus.FAILED : OrderShipmentPackageStatus.BOOKING_PENDING },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: terminal ? "courier.shipment.booking_terminal_failure" : "courier.shipment.booking_transient_failure",
        entityType: "order_shipment",
        entityId: shipmentId,
        newValue: {
          actorType: "SYSTEM",
          providerCode: code,
          shipmentNumber: shipment.shipmentNumber,
          message,
          bookingAttemptCount: nextAttemptCount,
          nextAttemptAt: terminal ? null : nextAttemptDate(nextAttemptCount).toISOString(),
          alertAdmin: terminal,
        },
      },
    });
  });

  return terminal;
}

async function recordTerminalFailure(
  context: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>,
  error: unknown,
) {
  const message = errorMessage(error);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.courierShipment.upsert({
      where: { orderShipmentId: context.id },
      update: {
        providerCode,
        trackingStatus: CourierShipmentStatus.FAILED,
        trackingStatusLabel: "Courier booking needs manual review.",
        bookingError: message,
      },
      create: {
        orderShipmentId: context.id,
        orderId: context.orderId,
        sellerId: context.sellerId,
        providerCode,
        trackingStatus: CourierShipmentStatus.FAILED,
        trackingStatusLabel: "Courier booking needs manual review.",
        bookingAttemptCount: 0,
        bookingError: message,
        bookingPayloadSnapshot: { source: "SHIPROCKET_WORKER_TERMINAL_FAILURE", shipmentNumber: context.shipmentNumber },
      },
    });
    await tx.orderShipment.update({
      where: { id: context.id },
      data: {
        bookingInProgress: false,
        bookingClaimedAt: null,
        bookingNextAttemptAt: null,
        routingFailed: true,
        routingFailureNote: message,
        routingLastAttemptAt: now,
        routingPermanentFailureAt: now,
        courierProviderCode: providerCode,
        courierTrackingStatus: CourierShipmentStatus.FAILED,
      },
    });
    if (context.packages[0]) {
      await tx.orderShipmentPackage.update({
        where: { id: context.packages[0].id },
        data: { status: OrderShipmentPackageStatus.FAILED },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: "courier.shipment.booking_terminal_failure",
        entityType: "order_shipment",
        entityId: context.id,
        newValue: {
          actorType: "SYSTEM",
          providerCode,
          shipmentNumber: context.shipmentNumber,
          message,
          alertAdmin: true,
        },
      },
    });
  });
}

async function releaseShipmentLock(shipmentId: string) {
  await prisma.orderShipment.update({
    where: { id: shipmentId },
    data: { bookingInProgress: false, bookingClaimedAt: null },
  });
}

function packageStatusFromCourierStatus(status: CourierShipmentStatus) {
  return status === CourierShipmentStatus.BOOKED
    ? OrderShipmentPackageStatus.BOOKED
    : status === CourierShipmentStatus.FAILED
      ? OrderShipmentPackageStatus.FAILED
      : OrderShipmentPackageStatus.BOOKING_PENDING;
}

function providerSnapshot(value: Prisma.JsonValue | null): CourierProviderAdapterSnapshot {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CourierProviderAdapterSnapshot) : {};
}

function readAddressSnapshot(value: Prisma.JsonValue | null): BookingAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as JsonRecord;
  return {
    fullName: stringValue(record.fullName) ?? stringValue(record.name),
    phone: stringValue(record.phone),
    email: stringValue(record.email),
    line1: stringValue(record.line1) ?? stringValue(record.addressLine1),
    line2: stringValue(record.line2) ?? stringValue(record.addressLine2),
    area: stringValue(record.area) ?? stringValue(record.localAreaName),
    city: stringValue(record.city),
    state: stringValue(record.state),
    pincode: stringValue(record.pincode) ?? stringValue(record.postalCode),
    country: stringValue(record.country) ?? "India",
  };
}

function readPackageItems(value: Prisma.JsonValue | null): BookingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const record = item as JsonRecord;
    const quantity = numberValue(record.quantity) ?? 0;
    if (quantity <= 0) {
      return [];
    }
    return [{
      name: stringValue(record.productName) ?? "Product",
      sku: stringValue(record.productVariantId) ?? stringValue(record.orderItemId) ?? "SKU",
      quantity,
      unitPricePaise: Math.max(1, Math.floor((numberValue(record.lineTotalPaise) ?? 100) / quantity)),
    }];
  });
}

function resolveParcel(
  shipmentPackage: { weightGrams: number | null; lengthCm: number | null; breadthCm: number | null; heightCm: number | null } | undefined,
  defaults: CourierProviderAdapterSnapshot["defaultPackage"],
): BookingParcel {
  const weightGrams = positiveDimension(shipmentPackage?.weightGrams, "package weight");
  return {
    weightGrams,
    lengthCm: positiveDimension(shipmentPackage?.lengthCm ?? defaults?.lengthCm ?? 20, "package length"),
    breadthCm: positiveDimension(shipmentPackage?.breadthCm ?? defaults?.breadthCm ?? 15, "package breadth"),
    heightCm: positiveDimension(shipmentPackage?.heightCm ?? defaults?.heightCm ?? 8, "package height"),
  };
}

function positiveDimension(value: number | null | undefined, label: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new TerminalBookingError(`Courier booking needs a valid ${label}.`);
  }
  return Number(value);
}

function hasCodPayment(payments: Array<{ provider: PaymentProvider; method: string | null }>) {
  return payments.some((payment) => payment.provider === PaymentProvider.COD || payment.method?.toUpperCase() === "COD");
}

function expectedPackageCodAmountPaise(
  payments: Array<{ provider: PaymentProvider; method: string | null; amountPaise: number }>,
  shipments: Array<{ id: string; subtotalPaise: number; shippingPaise: number; codSurchargePaise: number }>,
  shipment: { id: string; subtotalPaise: number; shippingPaise: number; codSurchargePaise: number },
) {
  const codTotal = payments
    .filter((payment) => payment.provider === PaymentProvider.COD || payment.method?.toUpperCase() === "COD")
    .reduce((sum, payment) => sum + payment.amountPaise, 0);
  if (codTotal <= 0) {
    return 0;
  }
  const shipmentTotal = shipment.subtotalPaise + shipment.shippingPaise + shipment.codSurchargePaise;
  const allTotal = shipments.reduce((sum, item) => sum + item.subtotalPaise + item.shippingPaise + item.codSurchargePaise, 0);
  return allTotal > 0 ? Math.round((codTotal * shipmentTotal) / allTotal) : codTotal;
}

async function authenticate(baseUrl: string, settings: CourierProviderAdapterSnapshot) {
  const email = settings.username?.trim();
  const password = settings.credentials?.password?.trim();
  if (!email || !password) {
    throw new TerminalBookingError("Shiprocket live booking needs API username/email and password.");
  }
  const response = await postJson(urlFor(baseUrl, authEndpoint), { email, password });
  const token = readText(response, ["token"]) ?? readText(response, ["data", "token"]);
  if (!token) {
    throw new TransientBookingError("Shiprocket authentication did not return a token.");
  }
  return token;
}

function createBookingPayload(request: BookingRequest) {
  const nameParts = splitName(request.shippingAddress.fullName ?? "Customer");
  const payload: JsonRecord = {
    order_id: request.shipmentNumber,
    order_date: request.orderDate.toISOString().slice(0, 10),
    pickup_location: request.pickupLocationName,
    billing_customer_name: nameParts.firstName,
    billing_last_name: nameParts.lastName,
    billing_address: requiredText(request.shippingAddress.line1, "delivery address line 1"),
    billing_address_2: compactText([request.shippingAddress.line2, request.shippingAddress.area]),
    billing_city: requiredText(request.shippingAddress.city, "delivery city"),
    billing_pincode: requiredText(request.shippingAddress.pincode, "delivery pincode"),
    billing_state: requiredText(request.shippingAddress.state, "delivery state"),
    billing_country: request.shippingAddress.country ?? "India",
    billing_email: request.shippingAddress.email ?? "orders@1handindia.com",
    billing_phone: requiredText(request.shippingAddress.phone, "delivery phone"),
    shipping_is_billing: true,
    order_items: request.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: paiseToRupees(item.unitPricePaise),
    })),
    payment_method: request.paymentMethod === "COD" ? "COD" : "Prepaid",
    sub_total: paiseToRupees(request.subtotalPaise),
    length: request.parcel.lengthCm,
    breadth: request.parcel.breadthCm,
    height: request.parcel.heightCm,
    weight: gramsToKg(request.parcel.weightGrams),
  };
  if (request.settings.accountCode) {
    payload.channel_id = numericOrText(request.settings.accountCode);
  }
  return payload;
}

async function fetchServiceability(baseUrl: string, token: string, request: BookingRequest) {
  const params = new URLSearchParams({
    pickup_postcode: requiredText(request.sellerAddress.pincode, "seller pickup pincode"),
    delivery_postcode: requiredText(request.shippingAddress.pincode, "delivery pincode"),
    cod: request.paymentMethod === "COD" ? "1" : "0",
    weight: gramsToKg(request.parcel.weightGrams),
  });
  return getJson(`${urlFor(baseUrl, defaultServiceabilityEndpoint)}?${params.toString()}`, token);
}

async function postJson(url: string, payload: unknown, token?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  return parseJsonResponse(response, url);
}

async function getJson(url: string, token: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: jsonHeaders(token),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  return parseJsonResponse(response, url);
}

async function getJsonAllowNotFound(url: string, token: string): Promise<{ notFound: true } | { notFound: false; body: ShiprocketResponse }> {
  const response = await fetch(url, {
    method: "GET",
    headers: jsonHeaders(token),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (response.status === 404) {
    return { notFound: true };
  }
  return { notFound: false, body: await parseJsonResponse(response, url) };
}

async function parseJsonResponse(response: Response, url: string): Promise<ShiprocketResponse> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as ShiprocketResponse) : {};
  if (!response.ok) {
    const message = `Shiprocket request failed (${response.status}) for ${url}: ${safeBodyMessage(body)}`;
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new TransientBookingError(message);
    }
    throw new TerminalBookingError(message);
  }
  return body;
}

function jsonHeaders(token?: string) {
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function nextAttemptDate(attemptCount: number) {
  const minutes = backoffMinutes[Math.min(attemptCount - 1, backoffMinutes.length - 1)] ?? 45;
  return new Date(Date.now() + minutes * 60000);
}

function staleLockCutoff() {
  return new Date(Date.now() - 10 * 60000);
}

function isTerminalBookingError(error: unknown) {
  return error instanceof TerminalBookingError;
}

class TerminalBookingError extends Error {}
class TransientBookingError extends Error {}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return (value === undefined ? null : value) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Shiprocket request timed out.";
    }
    return error.message;
  }
  return String(error);
}

function safeBodyMessage(body: unknown) {
  if (!body || typeof body !== "object") {
    return String(body ?? "No response body.");
  }
  return JSON.stringify(body).slice(0, 500);
}

function requiredText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new TerminalBookingError(`Courier booking needs ${label}.`);
  }
  return trimmed;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function urlFor(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function readText(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[key];
  }
  if (typeof current === "string" && current.trim()) {
    return current.trim();
  }
  if (typeof current === "number" && Number.isFinite(current)) {
    return String(current);
  }
  return null;
}

function readRecommendedCourierCompanyId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as JsonRecord;
  const data = record.data;
  const available = data && typeof data === "object" && !Array.isArray(data) ? (data as JsonRecord).available_courier_companies : null;
  if (!Array.isArray(available) || !available.length) {
    return null;
  }
  return readText(available[0], ["courier_company_id"]) ?? readText(available[0], ["id"]);
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "Customer",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "Customer",
  };
}

function compactText(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(", ");
}

function paiseToRupees(value: number) {
  return Math.max(0, value / 100);
}

function gramsToKg(value: number) {
  return (Math.max(1, value) / 1000).toFixed(2);
}

function numericOrText(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
