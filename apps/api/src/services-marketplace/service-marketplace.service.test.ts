import {
  ApprovalStatus,
  PaymentProvider,
  PaymentStatus,
  SellerCapability,
  SellerStatus,
  ServiceBookingStatus,
  ServiceCashCollectionStatus,
  ServiceCashDisputeResolution,
  ServiceCancellationPolicy,
  ServiceListingStatus,
  ServicePaymentMode,
  ServicePaymentPurpose,
  ServicePaymentCollectionType,
  ServicePaymentSettlementTreatment,
  ServicePricingModel,
  ServiceVisitMode,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceMarketplaceService } from "./service-marketplace.service";

const customerFixture = { id: "customer-1", userId: "user-1", displayName: "Customer", user: { email: "customer@example.com" } };

describe("ServiceMarketplaceService serviceability", () => {
  const actor = { id: "user-1", email: "customer@example.com", roles: [] };
  const notifications = { notifyEvent: vi.fn() };
  const financeCalculator = { calculateServiceBooking: vi.fn() };
  const customersService = { ensureCustomerForUser: vi.fn() };
  const prisma = {
    client: {
      serviceListing: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      seller: {
        findUnique: vi.fn(),
      },
      locationArea: {
        findFirst: vi.fn(),
      },
      serviceBooking: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      serviceBookingSettlement: {
        findUnique: vi.fn(),
      },
      serviceRefundRequest: {
        aggregate: vi.fn(),
      },
      servicePayment: {
        aggregate: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      serviceSellerReceivable: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      serviceSellerReceivableEvent: {
        create: vi.fn(),
      },
      sellerLedgerEntry: {
        create: vi.fn(),
      },
      serviceQuote: {
        findUnique: vi.fn(),
      },
      sellerServiceAvailabilityRule: {
        findMany: vi.fn(),
      },
      sellerServiceBlockedWindow: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    customersService.ensureCustomerForUser.mockResolvedValue(customerFixture);
    prisma.client.serviceBooking.findFirst.mockResolvedValue(null);
    prisma.client.serviceBooking.findUnique.mockResolvedValue(null);
    prisma.client.serviceBooking.findMany.mockResolvedValue([]);
    prisma.client.serviceBooking.count.mockResolvedValue(0);
    prisma.client.serviceBooking.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "booking-1",
      bookingNumber: data.bookingNumber,
    }));
    prisma.client.serviceBooking.update.mockResolvedValue({});
    prisma.client.seller.findUnique.mockResolvedValue(serviceSeller());
    prisma.client.serviceBookingSettlement.findUnique.mockResolvedValue(null);
    prisma.client.serviceRefundRequest.aggregate.mockResolvedValue({ _sum: { amountPaise: 0 } });
    prisma.client.servicePayment.aggregate.mockResolvedValue({ _sum: { amountPaise: 0 } });
    prisma.client.servicePayment.create.mockResolvedValue({});
    prisma.client.servicePayment.findFirst.mockResolvedValue(null);
    prisma.client.servicePayment.findMany.mockResolvedValue([]);
    prisma.client.servicePayment.findUniqueOrThrow.mockResolvedValue({});
    prisma.client.servicePayment.update.mockResolvedValue({});
    prisma.client.serviceSellerReceivable.findMany.mockResolvedValue([]);
    prisma.client.serviceSellerReceivable.updateMany.mockResolvedValue({ count: 0 });
    prisma.client.serviceSellerReceivableEvent.create.mockResolvedValue({});
    prisma.client.sellerLedgerEntry.create.mockResolvedValue({});
    prisma.client.serviceQuote.findUnique.mockResolvedValue(null);
    prisma.client.sellerServiceAvailabilityRule.findMany.mockResolvedValue([]);
    prisma.client.sellerServiceBlockedWindow.findFirst.mockResolvedValue(null);
    prisma.client.sellerServiceBlockedWindow.findMany.mockResolvedValue([]);
    prisma.client.auditLog.create.mockResolvedValue({});
    prisma.client.$queryRaw.mockResolvedValue([]);
    prisma.client.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma.client));
  });

  it("does not require a customer address for remote bookings even when the listing has local service areas", async () => {
    const listing = serviceListing({
      allowedVisitModes: [ServiceVisitMode.REMOTE],
      areas: [{ pincode: "636016", isActive: true }],
    });
    const bookingRecord = serviceBookingRecord(listing);
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(listing);
    prisma.client.serviceBooking.findFirst.mockResolvedValueOnce(bookingRecord);

    const service = createService();
    const booking = await service.createCustomerBooking(actor as never, {
      serviceSlug: "remote-repair",
      visitMode: ServiceVisitMode.REMOTE,
      customerIssue: "Issue with water supply in the machine.",
    });

    expect(booking.bookingNumber).toMatch(/^SRV-/);
    expect(prisma.client.locationArea.findFirst).not.toHaveBeenCalled();
    expect(prisma.client.serviceBooking.create.mock.calls[0]?.[0]?.data).toMatchObject({
      visitMode: ServiceVisitMode.REMOTE,
    });
  });

  it("enriches manual pincode addresses before checking customer-location serviceability", async () => {
    const listing = serviceListing({
      allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
      areas: [{ cityCode: "IN-TN-SLM", isActive: true }],
    });
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(listing);
    prisma.client.locationArea.findFirst.mockResolvedValue(locationArea());
    prisma.client.serviceBooking.findFirst.mockResolvedValueOnce(serviceBookingRecord(listing));

    const service = createService();
    await service.createCustomerBooking(actor as never, {
      serviceSlug: "doorstep-repair",
      visitMode: ServiceVisitMode.CUSTOMER_LOCATION,
      customerIssue: "Issue with water supply in the machine.",
      addressSnapshot: {
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636114",
        countryCode: "IN",
      },
    });

    expect(prisma.client.locationArea.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          postalCode: "636114",
        }),
      }),
    );
    expect(prisma.client.serviceBooking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        addressSnapshot: expect.objectContaining({
          cityCode: "IN-TN-SLM",
          localAreaCode: "IN-TN-SLM-636114",
          pincode: "636114",
        }),
      }),
    });
  });

  it("uses pincode enrichment for public serviceability checks", async () => {
    prisma.client.serviceListing.findFirst.mockResolvedValue(
      serviceListing({
        allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
        areas: [{ cityCode: "IN-TN-SLM", isActive: true }],
      }),
    );
    prisma.client.locationArea.findFirst.mockResolvedValue(locationArea());

    const service = createService();
    const listing = await service.getPublicService("doorstep-repair", {
      countryCode: "IN",
      pincode: "636114",
    });

    expect(listing.serviceability).toMatchObject({ serviceable: true, matchLevel: "CITY" });
  });

  it("accepts a 10 AM India service slot when the browser sends the equivalent UTC ISO time", async () => {
    const listing = serviceListing({
      serviceDurationMinutes: 60,
      areas: [{ pincode: "636114", isActive: true }],
    });
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(listing);
    prisma.client.locationArea.findFirst.mockResolvedValue(locationArea());
    prisma.client.sellerServiceAvailabilityRule.findMany.mockResolvedValueOnce([
      { dayOfWeek: 3, startMinute: 10 * 60, endMinute: 18 * 60, capacity: 10, isActive: true },
    ]);
    prisma.client.serviceBooking.count.mockResolvedValueOnce(0);
    prisma.client.serviceBooking.findFirst.mockResolvedValueOnce(
      serviceBookingRecord(listing, {
        scheduledStartAt: new Date("2026-07-08T04:30:00.000Z"),
        scheduledEndAt: new Date("2026-07-08T05:30:00.000Z"),
      }),
    );

    const service = createService();
    await service.createCustomerBooking(actor as never, {
      serviceSlug: "doorstep-repair",
      visitMode: ServiceVisitMode.CUSTOMER_LOCATION,
      customerIssue: "Issue with water supply in the machine.",
      scheduledStartAt: "2026-07-08T04:30:00.000Z",
      addressSnapshot: {
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636114",
        countryCode: "IN",
      },
    });

    expect(prisma.client.serviceBooking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduledStartAt: new Date("2026-07-08T04:30:00.000Z"),
      }),
    });
  });

  it("rejects serviceability when customer pincode does not match pincode-restricted service area", async () => {
    prisma.client.serviceListing.findFirst.mockResolvedValue(
      serviceListing({
        allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
        areas: [{ cityCode: "IN-TN-SLM", pincode: "636114", localAreaCode: "PIN-636114-708A9748", isActive: true }],
      }),
    );
    prisma.client.locationArea.findFirst.mockResolvedValue({
      ...locationArea(),
      postalCode: "636139",
      code: "PIN-636139-12345",
    });

    const service = createService();
    const listing = await service.getPublicService("doorstep-repair", {
      countryCode: "IN",
      pincode: "636139",
    });

    expect(listing.serviceability).toMatchObject({
      serviceable: false,
      reason: "This service provider does not currently serve the selected location.",
    });
  });

  it("retires the matching pending Razorpay service request after customer-confirmed provider cash", async () => {
    const listing = serviceListing({
      paymentMode: ServicePaymentMode.ADVANCE_PAYMENT,
      advanceAmountPaise: 20000,
    });
    const cashPayment = servicePayment({
      id: "cash-payment-1",
      provider: PaymentProvider.MANUAL,
      purpose: ServicePaymentPurpose.ADVANCE_PAYMENT,
      collectionType: ServicePaymentCollectionType.PROVIDER_CASH,
      settlementTreatment: ServicePaymentSettlementTreatment.PLATFORM_RECEIVABLE,
      cashCollectionStatus: ServiceCashCollectionStatus.RECORDED,
      amountPaise: 20000,
      status: PaymentStatus.PENDING,
    });
    const pendingRazorpayPayment = servicePayment({
      id: "razorpay-payment-1",
      provider: PaymentProvider.RAZORPAY,
      purpose: ServicePaymentPurpose.ADVANCE_PAYMENT,
      collectionType: ServicePaymentCollectionType.PLATFORM_ONLINE,
      settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
      amountPaise: 20000,
      status: PaymentStatus.PENDING,
    });
    const booking = serviceBookingRecord(listing, {
      totalPayablePaise: 69900,
      advanceAmountPaise: 20000,
      payments: [cashPayment, pendingRazorpayPayment],
    });
    prisma.client.serviceBooking.findFirst.mockResolvedValue(booking);
    prisma.client.servicePayment.findMany.mockResolvedValue([
      { ...cashPayment, status: PaymentStatus.PAID },
      pendingRazorpayPayment,
    ]);
    prisma.client.servicePayment.aggregate.mockResolvedValue({ _sum: { amountPaise: 20000 } });

    const service = createService();
    await service.customerConfirmCashCollection(actor as never, booking.bookingNumber, cashPayment.id, {
      note: "Customer paid cash.",
    });

    expect(prisma.client.servicePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "razorpay-payment-1" },
        data: expect.objectContaining({
          status: PaymentStatus.NOT_REQUIRED,
          providerOrderCreationInProgress: false,
        }),
      }),
    );
    expect(prisma.client.servicePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cash-payment-1" },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          cashCollectionStatus: ServiceCashCollectionStatus.CUSTOMER_CONFIRMED,
          cashDisputeResolution: ServiceCashDisputeResolution.CUSTOMER_CONFIRMED,
        }),
      }),
    );
  });

  it("blocks customer completion approval while even one paise remains unpaid", async () => {
    const listing = serviceListing({ paymentMode: ServicePaymentMode.ADVANCE_PAYMENT, advanceAmountPaise: 20000 });
    const booking = serviceBookingRecord(listing, {
      status: ServiceBookingStatus.COMPLETION_SUBMITTED,
      totalPayablePaise: 69900,
      paidAmountPaise: 69899,
      payments: [
        servicePayment({
          id: "confirmed-cash-1",
          provider: PaymentProvider.MANUAL,
          purpose: ServicePaymentPurpose.PAY_AT_VISIT,
          collectionType: ServicePaymentCollectionType.PROVIDER_CASH,
          settlementTreatment: ServicePaymentSettlementTreatment.PLATFORM_RECEIVABLE,
          cashCollectionStatus: ServiceCashCollectionStatus.CUSTOMER_CONFIRMED,
          amountPaise: 69899,
          status: PaymentStatus.PAID,
        }),
      ],
    });
    prisma.client.serviceBooking.findFirst.mockResolvedValue(booking);

    const service = createService();
    await expect(service.customerConfirmCompletion(actor as never, booking.bookingNumber)).rejects.toThrow(
      "INR 0.01 more before completion can be approved",
    );
    expect(prisma.client.serviceBooking.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ServiceBookingStatus.COMPLETED }),
      }),
    );
  });

  it("rejects short provider cash collection for the remaining visit balance", async () => {
    const sellerActor = { id: "seller-user-1", email: "seller@example.com", roles: [] };
    const listing = serviceListing({ paymentMode: ServicePaymentMode.PAY_AT_VISIT });
    const booking = serviceBookingRecord(listing, {
      status: ServiceBookingStatus.IN_PROGRESS,
      totalPayablePaise: 69900,
      paidAmountPaise: 20000,
      scheduledStartAt: new Date(),
      assignedTechnicianId: "technician-1",
    });
    prisma.client.serviceBooking.findFirst.mockResolvedValue(booking);

    const service = createService();
    await expect(
      service.recordSellerCashCollection(sellerActor as never, booking.bookingNumber, {
        purpose: ServicePaymentPurpose.PAY_AT_VISIT,
        amountPaise: 49899,
      }),
    ).rejects.toThrow("Remaining balance is INR 499.00, but entered INR 498.99");
    expect(prisma.client.servicePayment.create).not.toHaveBeenCalled();
  });

  it("requires an assigned technician before accepting a service booking", async () => {
    const sellerActor = { id: "seller-user-1", email: "seller@example.com", roles: [] };
    const booking = serviceBookingRecord(serviceListing(), {
      status: ServiceBookingStatus.REQUESTED,
    });
    prisma.client.serviceBooking.findFirst.mockResolvedValue(booking);

    const service = createService();
    await expect(
      service.sellerAcceptBooking(sellerActor as never, booking.bookingNumber, {
        scheduledStartAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ).rejects.toThrow("Assign an active technician before you accept this service booking.");
    expect(prisma.client.serviceBooking.update).not.toHaveBeenCalled();
  });

  function createService() {
    return new ServiceMarketplaceService(
      prisma as never,
      customersService as never,
      notifications as never,
      financeCalculator as never,
    );
  }
});

function serviceListing(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "listing-1",
    sellerId: "seller-1",
    categoryId: "category-1",
    title: "Doorstep repair",
    slug: "doorstep-repair",
    description: "Repair service",
    status: ServiceListingStatus.ACTIVE,
    approvalStatus: ApprovalStatus.APPROVED,
    pricingModel: ServicePricingModel.FIXED_PRICE,
    paymentMode: ServicePaymentMode.PAY_AT_VISIT,
    cancellationPolicy: ServiceCancellationPolicy.FLEXIBLE,
    basePricePaise: 49900,
    inspectionFeePaise: 0,
    advanceAmountPaise: 0,
    currency: "INR",
    quoteTtlHours: 48,
    serviceDurationMinutes: null,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
    areas: [],
    packages: [],
    images: [],
    category: { id: "category-1", name: "Services" },
    seller: {
      id: "seller-1",
      userId: "seller-user-1",
      storeName: "A2D Super Market",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      enabledCapabilities: [SellerCapability.SERVICE],
      user: { email: "seller@example.com" },
      profile: null,
      addresses: [],
    },
    ...overrides,
  };
}

function serviceBookingRecord(listing: Record<string, unknown>, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "booking-1",
    bookingNumber: "SRV-2026-ABC123",
    customerId: "customer-1",
    sellerId: listing.sellerId,
    serviceListingId: listing.id,
    servicePackageId: null,
    status: ServiceBookingStatus.REQUESTED,
    visitMode: (listing.allowedVisitModes as ServiceVisitMode[])[0] ?? ServiceVisitMode.CUSTOMER_LOCATION,
    paymentMode: listing.paymentMode,
    cancellationPolicy: listing.cancellationPolicy,
    scheduledStartAt: null,
    scheduledEndAt: null,
    assignedTechnicianId: null,
    addressSnapshot: null,
    customerIssue: "Issue with water supply in the machine.",
    customerNote: null,
    providerNote: null,
    subtotalPaise: 49900,
    inspectionFeePaise: 0,
    advanceAmountPaise: 0,
    totalPayablePaise: 49900,
    paidAmountPaise: 0,
    currency: "INR",
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: customerFixture,
    seller: listing.seller,
    listing,
    package: null,
    assignedTechnician: null,
    quotes: [],
    payments: [],
    disputes: [],
    refundRequests: [],
    settlement: null,
    sellerReceivables: [],
    reviews: [],
    ...overrides,
  };
}

function serviceSeller(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "seller-1",
    userId: "seller-user-1",
    storeName: "A2D Super Market",
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
    enabledCapabilities: [SellerCapability.SERVICE],
    ...overrides,
  };
}

function servicePayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "payment-1",
    bookingId: "booking-1",
    sellerId: "seller-1",
    provider: PaymentProvider.RAZORPAY,
    purpose: ServicePaymentPurpose.FULL_PAYMENT,
    collectionType: ServicePaymentCollectionType.PLATFORM_ONLINE,
    settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
    cashCollectionStatus: ServiceCashCollectionStatus.NOT_APPLICABLE,
    amountPaise: 49900,
    currency: "INR",
    status: PaymentStatus.PENDING,
    idempotencyKey: null,
    cashCollectionEventId: null,
    attemptNumber: 1,
    providerOrderId: null,
    providerOrderCreationInProgress: false,
    providerPaymentId: null,
    referenceNumber: null,
    cashCollectedById: null,
    cashCollectedAt: null,
    customerCashConfirmedAt: null,
    adminCashVerifiedAt: null,
    cashDisputedAt: null,
    cashDisputeReason: null,
    cashDisputeResolution: null,
    cashResolutionNote: null,
    rawResponse: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sellerReceivables: [],
    ...overrides,
  };
}

function locationArea() {
  return {
    id: "area-1",
    code: "IN-TN-SLM-636114",
    name: "Salem 636114",
    postalCode: "636114",
    active: true,
    city: {
      code: "IN-TN-SLM",
      name: "Salem",
      subdivision: {
        code: "IN-TN",
        name: "Tamil Nadu",
        country: {
          code: "IN",
          name: "India",
        },
      },
    },
  };
}
