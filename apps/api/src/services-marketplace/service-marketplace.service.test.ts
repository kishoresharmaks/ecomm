import {
  ApprovalStatus,
  SellerCapability,
  SellerStatus,
  ServiceBookingStatus,
  ServiceCancellationPolicy,
  ServiceListingStatus,
  ServicePaymentMode,
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
      locationArea: {
        findFirst: vi.fn(),
      },
      serviceBooking: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      serviceBookingSettlement: {
        findUnique: vi.fn(),
      },
      serviceQuote: {
        findUnique: vi.fn(),
      },
      sellerServiceAvailabilityRule: {
        findMany: vi.fn(),
      },
      sellerServiceBlockedWindow: {
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
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
    prisma.client.serviceBookingSettlement.findUnique.mockResolvedValue(null);
    prisma.client.serviceQuote.findUnique.mockResolvedValue(null);
    prisma.client.sellerServiceAvailabilityRule.findMany.mockResolvedValue([]);
    prisma.client.sellerServiceBlockedWindow.findMany.mockResolvedValue([]);
    prisma.client.auditLog.create.mockResolvedValue({});
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

function serviceBookingRecord(listing: Record<string, unknown>) {
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
