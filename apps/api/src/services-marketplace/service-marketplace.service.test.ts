import {
  ApprovalStatus,
  PaymentProvider,
  PaymentStatus,
  ProductTaxClassification,
  SellerCapability,
  SellerStatus,
  SellerTaxRegistrationStatus,
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
  ServiceQuoteLineType,
  ServiceVisitMode,
  TaxSupplyType,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceMarketplaceService } from "./service-marketplace.service";

const customerFixture = { id: "customer-1", userId: "user-1", displayName: "Customer", user: { email: "customer@example.com" } };

describe("ServiceMarketplaceService serviceability", () => {
  const actor = { id: "user-1", email: "customer@example.com", roles: [] };
  const notifications = { notifyEvent: vi.fn() };
  const financeCalculator = { calculateServiceBooking: vi.fn() };
  const customersService = { ensureCustomerForUser: vi.fn() };
  const taxDocuments = { issueServiceBookingDocument: vi.fn() };
  const prisma = {
    client: {
      customer: {
        findUnique: vi.fn(),
      },
      serviceListing: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      sacMaster: {
        findFirst: vi.fn(),
      },
      hsnMaster: {
        findFirst: vi.fn(),
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
    prisma.client.customer.findUnique.mockResolvedValue({
      ...customerFixture,
      user: { email: "customer@example.com", fullName: "Customer" },
      addresses: [],
    });
    prisma.client.serviceBooking.findFirst.mockResolvedValue(null);
    prisma.client.serviceBooking.findUnique.mockResolvedValue(null);
    prisma.client.serviceBooking.findMany.mockResolvedValue([]);
    prisma.client.serviceBooking.count.mockResolvedValue(0);
    prisma.client.serviceBooking.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "booking-1",
      bookingNumber: data.bookingNumber,
    }));
    prisma.client.serviceBooking.update.mockResolvedValue({});
    prisma.client.serviceListing.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.serviceListing.findUniqueOrThrow.mockResolvedValue(serviceListing());
    prisma.client.sacMaster.findFirst.mockResolvedValue({
      id: "sac-1",
      sacCode: "998719",
      description: "Maintenance and repair services",
      sourceReference: "GST Council classification",
    });
    prisma.client.hsnMaster.findFirst.mockResolvedValue({
      description: "Electrical spare parts",
    });
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
      sellerTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus.NOT_REGISTERED,
      sacCodeSnapshot: "998719",
      gstRatePercentSnapshot: 0,
      taxTotalPaise: 0,
    });
  });

  it("snapshots SAC and inclusive GST for a regular GST service seller", async () => {
    const listing = serviceListing({
      seller: {
        ...(serviceListing().seller as Record<string, unknown>),
        profile: {
          businessLegalName: "A2D Services",
          taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          gstNumber: "33ABCDE1234F1Z5",
        },
      },
      gstRatePercent: 18,
    });
    prisma.client.customer.findUnique.mockResolvedValueOnce({
      ...customerFixture,
      user: { email: "customer@example.com", fullName: "Customer" },
      addresses: [{
        fullName: "Customer",
        line1: "2 Buyer Road",
        line2: null,
        area: "Salem",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636001",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
      }],
    });
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(listing);
    prisma.client.serviceBooking.findFirst.mockResolvedValueOnce(serviceBookingRecord(listing));

    await createService().createCustomerBooking(actor as never, {
      serviceSlug: "doorstep-repair",
      visitMode: ServiceVisitMode.CUSTOMER_LOCATION,
      customerIssue: "Issue with water supply in the machine.",
      addressSnapshot: {
        fullName: "Customer",
        line1: "2 Buyer Road",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636001",
        countryCode: "IN",
        stateCode: "IN-TN",
      },
    });

    expect(prisma.client.serviceBooking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus.GST_REGISTERED,
        serviceTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
        sacCodeSnapshot: "998719",
        gstRatePercentSnapshot: 18,
        taxSupplyTypeSnapshot: TaxSupplyType.INTRA_STATE,
        taxableValuePaise: 42288,
        cgstPaise: 3806,
        sgstPaise: 3806,
        igstPaise: 0,
        taxTotalPaise: 7612,
      }),
    });
  });

  it("rejects stale tax configuration versions before admin approval", async () => {
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(
      serviceListing({
        taxConfigurationVersion: 4,
        taxReviewRequired: true,
        gstRatePercent: 18,
        seller: {
          ...(serviceListing().seller as Record<string, unknown>),
          profile: {
            businessLegalName: "A2D Services",
            taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
            gstNumber: "33ABCDE1234F1Z5",
          },
        },
      }),
    );

    await expect(
      createService().adminUpdateServiceApproval(
        "listing-1",
        {
          approvalStatus: ApprovalStatus.APPROVED,
          expectedTaxConfigurationVersion: 3,
        },
        { id: "admin-1", email: "admin@example.com", roles: [] } as never,
      ),
    ).rejects.toThrow("Service tax configuration changed");
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it("rejects approval when the tax version changes during the transaction", async () => {
    const listing = serviceListing({
      taxConfigurationVersion: 4,
      taxReviewRequired: true,
      gstRatePercent: 18,
      seller: {
        ...(serviceListing().seller as Record<string, unknown>),
        profile: {
          businessLegalName: "A2D Services",
          taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          gstNumber: "33ABCDE1234F1Z5",
        },
      },
    });
    prisma.client.serviceListing.findFirst.mockResolvedValueOnce(listing);
    prisma.client.serviceListing.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      createService().adminUpdateServiceApproval(
        "listing-1",
        {
          approvalStatus: ApprovalStatus.APPROVED,
          expectedTaxConfigurationVersion: 4,
        },
        { id: "admin-1", email: "admin@example.com", roles: [] } as never,
      ),
    ).rejects.toThrow("Service changed during approval");
  });

  it("calculates independent inclusive tax snapshots for mixed SAC and HSN quote lines", async () => {
    const booking = serviceBookingRecord(serviceListing(), {
      sellerTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus.GST_REGISTERED,
      serviceTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
      gstRatePercentSnapshot: 18,
      taxSupplyTypeSnapshot: TaxSupplyType.INTRA_STATE,
    });
    const service = createService() as unknown as {
      serviceQuoteLineSnapshot: (
        booking: unknown,
        line: unknown,
        sortOrder: number,
      ) => Promise<Record<string, unknown>>;
    };

    const serviceLine = await service.serviceQuoteLineSnapshot(
      booking,
      {
        lineType: ServiceQuoteLineType.SERVICE,
        description: "Repair labour",
        quantity: 1,
        unitPaise: 11800,
      },
      0,
    );
    const productLine = await service.serviceQuoteLineSnapshot(
      booking,
      {
        lineType: ServiceQuoteLineType.PRODUCT,
        description: "Replacement part",
        quantity: 2,
        unitPaise: 5900,
        hsnSacCode: "8504",
        taxClassification: ProductTaxClassification.TAXABLE,
        gstRatePercent: 18,
        uqc: "PCS",
      },
      1,
    );

    expect(serviceLine).toMatchObject({
      lineType: ServiceQuoteLineType.SERVICE,
      hsnSacCode: "998719",
      totalPaise: 11800,
      taxableValuePaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      taxTotalPaise: 1800,
    });
    expect(productLine).toMatchObject({
      lineType: ServiceQuoteLineType.PRODUCT,
      hsnSacCode: "8504",
      totalPaise: 11800,
      taxableValuePaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      taxTotalPaise: 1800,
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
    const scheduledStartAt = nextIndiaWednesdayTenAmUtc();
    const scheduledEndAt = new Date(scheduledStartAt.getTime() + 60 * 60_000);
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
        scheduledStartAt,
        scheduledEndAt,
      }),
    );

    const service = createService();
    await service.createCustomerBooking(actor as never, {
      serviceSlug: "doorstep-repair",
      visitMode: ServiceVisitMode.CUSTOMER_LOCATION,
      customerIssue: "Issue with water supply in the machine.",
      scheduledStartAt: scheduledStartAt.toISOString(),
      addressSnapshot: {
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636114",
        countryCode: "IN",
      },
    });

    expect(prisma.client.serviceBooking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduledStartAt,
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
      taxDocuments as never,
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
    taxClassification: ProductTaxClassification.TAXABLE,
    sacCode: "998719",
    gstRatePercent: 0,
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
      profile: {
        businessLegalName: "A2D Services",
        taxRegistrationStatus: SellerTaxRegistrationStatus.NOT_REGISTERED,
        gstNumber: null,
      },
      addresses: [{
        line1: "1 Service Road",
        line2: null,
        area: "Salem",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636001",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
      }],
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
    sellerTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus.NOT_REGISTERED,
    sellerLegalNameSnapshot: "A2D Services",
    sellerGstinSnapshot: null,
    sellerAddressSnapshot: {},
    buyerLegalNameSnapshot: "Customer",
    buyerGstinSnapshot: null,
    buyerAddressSnapshot: {},
    serviceTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
    sacCodeSnapshot: "998719",
    gstRatePercentSnapshot: 0,
    taxSupplyTypeSnapshot: TaxSupplyType.INTER_STATE,
    placeOfSupplyStateCodeSnapshot: null,
    taxableValuePaise: 49900,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    cessPaise: 0,
    taxTotalPaise: 0,
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
    taxDocuments: [],
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

function nextIndiaWednesdayTenAmUtc() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 3) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCHours(4, 30, 0, 0);
  return date;
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
