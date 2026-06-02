import "reflect-metadata";
import { createHmac, randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ApprovalStatus,
  B2BEnquiryStatus,
  CartStatus,
  CategoryStatus,
  CodCollectionSource,
  CodCollectionStatus,
  ContentStatus,
  CourierCodRemittanceStatus,
  CourierShipmentStatus,
  CourierWebhookEventStatus,
  DeliveryAssignmentAttemptSource,
  DeliveryAssignmentStatus,
  DeliveryAttemptReason,
  DeliveryMode,
  DeliveryStatus,
  EmailRecipientType,
  EmailTemplateCategory,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductAttributeFieldType,
  ProductAttributeScope,
  ProductListingMode,
  ProductStatus,
  ProductTemplateStatus,
  RoleCode,
  SellerOrderStatus,
  SellerSettlementStatus,
  SellerStatus,
  SellerType,
  SeoEntityType,
  SettingValueType,
  StatusEventType,
  UserStatus,
  VariantStatus,
} from "@indihub/database";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashAdminPassword } from "../auth/admin-password";
import { PrismaService } from "../prisma/prisma.service";
import { AppModule } from "./app.module";

const smtpSendMailMock = vi.hoisted(() =>
  vi.fn(async () => ({ messageId: "<integration-smtp@1handindia.test>" })),
);
const smtpCreateTransportMock = vi.hoisted(() => vi.fn(() => ({ sendMail: smtpSendMailMock })));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: smtpCreateTransportMock,
  },
}));

type PrismaClient = PrismaService["client"];

const runId = `ih-e2e-${Date.now()}`;
const adminEmail = `${runId}-admin@1handindia.test`;
const adminPassword = "IntegrationAdminPass123!";
const financeEmail = `${runId}-finance@1handindia.test`;
const financePassword = "IntegrationFinancePass123!";

describe.sequential("1HandIndia backend integration", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let data: Awaited<ReturnType<typeof seedIntegrationData>>;
  let adminSessionHeader: Record<string, string>;

  beforeAll(async () => {
    process.env.EMAIL_ADMIN_RECIPIENTS = adminEmail;
    process.env.INDIHUB_FIRST_ADMIN_EMAIL = adminEmail;
    process.env.INDIHUB_FIRST_ADMIN_PASSWORD = adminPassword;
    process.env.REDIS_URL = "";
    process.env.FX_PROVIDER = "frankfurter";
    process.env.FX_BASE_CURRENCY = "INR";
    process.env.FX_CACHE_TTL_MINUTES = "360";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix("api");
    await app.init();

    prisma = app.get(PrismaService).client;
    await prisma.$queryRaw`select 1`;
    await cleanupIntegrationData(prisma);
    data = await seedIntegrationData(prisma);
    await setCheckoutPlatformFeeSettings(prisma, {
      enabled: false,
      type: "PERCENTAGE",
      valueBps: 0,
      fixedPaise: 0,
      shippingPaise: 0,
    });
    const adminLogin = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    adminSessionHeader = bearerAuthHeader(adminLogin.body.token as string);
  }, 120000);

  afterAll(async () => {
    if (prisma) {
      await cleanupIntegrationData(prisma);
    }
    await app?.close();
  }, 60000);

  it("keeps health public and blocks admin routes without the admin role", async () => {
    const health = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(health.body).toMatchObject({ ok: true, service: "indihub-api" });

    await request(app.getHttpServer()).get("/api/admin/dashboard").expect(401);
    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set(authHeader(data.customerUser.id))
      .expect(401);

    const dashboard = await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set(adminSessionHeader)
      .expect(200);
    expect(dashboard.body).toEqual(
      expect.objectContaining({
        customers: expect.any(Number),
        pendingSellers: expect.any(Number),
        pendingProducts: expect.any(Number),
        activeOrders: expect.any(Number),
        b2bEnquiries: expect.any(Number),
      }),
    );
  });

  it("allows finance manager access only to the finance workspace APIs", async () => {
    const financeLogin = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({ email: financeEmail, password: financePassword })
      .expect(201);
    const financeSessionHeader = bearerAuthHeader(financeLogin.body.token as string);

    const session = await request(app.getHttpServer())
      .get("/api/admin/auth/me")
      .set(financeSessionHeader)
      .expect(200);
    expect(session.body.roles).toContain(RoleCode.FINANCE);

    await request(app.getHttpServer())
      .get("/api/admin/finance/dashboard")
      .set(financeSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/payments/config")
      .set(financeSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/settings/checkout/platform-fee")
      .set(financeSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/users")
      .set(financeSessionHeader)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/admin/settings")
      .set(financeSessionHeader)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/admin/products")
      .set(financeSessionHeader)
      .expect(403);
  });

  it("routes bank transfer orders through finance verification", async () => {
    await clearActiveCustomerCart(prisma, data.customer.id);
    await prisma.productVariant.update({
      where: { id: data.productVariant.id },
      data: { stockQuantity: 50 },
    });
    await request(app.getHttpServer())
      .patch("/api/admin/payments/config")
      .set(adminSessionHeader)
      .send({
        bankTransfer: {
          enabled: true,
          accountHolderName: "1HandIndia Marketplace",
          bankName: "Integration Bank",
          accountNumber: "1234567890",
          ifscCode: "INTE0001234",
          branch: "Integration Branch",
          upiId: "indihub@testupi",
          instructions: "Use this integration bank account.",
          referenceRequired: true,
        },
        manual: { enabled: true },
      })
      .expect(200);

    const methods = await request(app.getHttpServer())
      .get("/api/payments/checkout-methods")
      .set(authHeader(data.customerUser.id))
      .expect(200);
    expect(methods.body.methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "BANK_TRANSFER",
          enabled: true,
          bankTransferDetails: expect.objectContaining({
            accountHolderName: "1HandIndia Marketplace",
            upiId: "indihub@testupi",
            referenceRequired: true,
          }),
        }),
      ]),
    );

    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 1,
      })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post("/api/account/orders")
      .set(authHeader(data.customerUser.id))
      .send({
        shippingAddress: {
          fullName: "1HandIndia Test Customer",
          phone: "9876543210",
          line1: "12 Test Market Road",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: `${runId}-UTR-001`,
        buyerCountryCode: "IN",
      })
      .expect(201);
    expect(order.body).toMatchObject({
      paymentStatus: PaymentStatus.PENDING,
      payments: expect.arrayContaining([
        expect.objectContaining({
          provider: PaymentProvider.BANK_TRANSFER,
          status: PaymentStatus.PENDING,
        }),
      ]),
    });

    const financeLogin = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({ email: financeEmail, password: financePassword })
      .expect(201);
    const financeSessionHeader = bearerAuthHeader(financeLogin.body.token as string);
    const collections = await request(app.getHttpServer())
      .get(
        `/api/admin/finance/payment-collections?provider=BANK_TRANSFER&search=${encodeURIComponent(order.body.orderNumber as string)}`,
      )
      .set(financeSessionHeader)
      .expect(200);
    expect(collections.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: PaymentProvider.BANK_TRANSFER,
          customerReference: `${runId}-UTR-001`,
        }),
      ]),
    );

    const verified = await request(app.getHttpServer())
      .patch(
        `/api/admin/finance/payment-collections/${order.body.orderNumber}/offline-verification`,
      )
      .set(financeSessionHeader)
      .send({
        decision: "VERIFY",
        transactionReference: `${runId}-UTR-001`,
        note: "Bank receipt matched by finance.",
      })
      .expect(200);
    expect(verified.body).toMatchObject({
      orderNumber: order.body.orderNumber,
      paymentStatus: PaymentStatus.PAID,
    });

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: order.body.orderNumber as string },
      include: {
        payments: true,
        statusEvents: true,
      },
    });
    expect(storedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    expect(storedOrder.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: PaymentProvider.BANK_TRANSFER,
          status: PaymentStatus.PAID,
          providerPaymentId: `${runId}-UTR-001`,
        }),
      ]),
    );
    expect(storedOrder.statusEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusType: StatusEventType.PAYMENT,
          newStatus: PaymentStatus.PAID,
        }),
      ]),
    );
    await prisma.productVariant.update({
      where: { id: data.productVariant.id },
      data: { stockQuantity: 20 },
    });
  });

  it("serves enabled locations and cached market currency rates", async () => {
    const countries = await request(app.getHttpServer())
      .get("/api/locations/countries")
      .expect(200);
    expect(countries.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IN", currency: "INR" }),
        expect.objectContaining({ code: "GB", currency: "GBP" }),
      ]),
    );

    const states = await request(app.getHttpServer())
      .get("/api/locations/states")
      .query({ countryCode: "IN" })
      .expect(200);
    expect(states.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "IN-TN", name: "Tamil Nadu" })]),
    );

    const cities = await request(app.getHttpServer())
      .get("/api/locations/cities")
      .query({ stateCode: "IN-TN" })
      .expect(200);
    expect(cities.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "IN-TN-CBE", name: "Coimbatore" })]),
    );

    const areas = await request(app.getHttpServer())
      .get("/api/locations/areas")
      .query({ cityCode: "IN-TN-CBE", search: "RS", limit: "50" })
      .expect(200);
    expect(areas.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IN-TN-CBE-RS", postalCode: "641012" }),
      ]),
    );

    await request(app.getHttpServer())
      .get("/api/locations/areas")
      .query({ cityCode: "IN-TN-CBE", limit: "bad" })
      .expect(400);

    const market = await request(app.getHttpServer())
      .get("/api/market/currency")
      .query({ countryCode: "GB" })
      .expect(200);
    expect(market.body).toMatchObject({
      countryCode: "GB",
      currency: "GBP",
      baseCurrency: "INR",
      provider: "frankfurter",
      rate: 0.0095,
      isStale: false,
    });

    await request(app.getHttpServer())
      .get("/api/admin/locations/countries")
      .set(authHeader(data.customerUser.id))
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/admin/locations/countries")
      .set(adminSessionHeader)
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/admin/locations/india-postal-lookup")
      .query({ pincode: "110001" })
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/admin/locations/india-postal-lookup")
      .set(adminSessionHeader)
      .query({ pincode: "000000" })
      .expect(400);

    const postalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              Message: "Number of pincode(s) found:1",
              Status: "Success",
              PostOffice: [
                {
                  Name: "Baroda House",
                  BranchType: "Sub Post Office",
                  DeliveryStatus: "Non-Delivery",
                  Circle: "Delhi",
                  District: "Central Delhi",
                  Division: "New Delhi Central",
                  Region: "Delhi",
                  Block: "New Delhi",
                  State: "Delhi",
                  Country: "India",
                  Pincode: "110001",
                },
              ],
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ Message: "No records found", Status: "Error", PostOffice: null }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    try {
      const lookup = await request(app.getHttpServer())
        .get("/api/admin/locations/india-postal-lookup")
        .set(adminSessionHeader)
        .query({ pincode: "110001" })
        .expect(200);
      expect(lookup.body).toMatchObject({
        provider: "api.postalpincode.in",
        queryType: "PINCODE",
        query: "110001",
        status: "SUCCESS",
        postOffices: [
          expect.objectContaining({
            name: "Baroda House",
            state: "Delhi",
            pincode: "110001",
          }),
        ],
      });

      const emptyLookup = await request(app.getHttpServer())
        .get("/api/admin/locations/india-postal-lookup")
        .set(adminSessionHeader)
        .query({ postOffice: "Missing Office" })
        .expect(200);
      expect(emptyLookup.body).toMatchObject({
        queryType: "POST_OFFICE",
        query: "Missing Office",
        status: "NOT_FOUND",
        postOffices: [],
      });

      expect(postalFetch).toHaveBeenCalledWith(
        "https://api.postalpincode.in/pincode/110001",
        expect.objectContaining({
          headers: expect.objectContaining({ accept: "application/json" }),
        }),
      );
      expect(postalFetch).toHaveBeenCalledWith(
        "https://api.postalpincode.in/postoffice/Missing%20Office",
        expect.objectContaining({
          headers: expect.objectContaining({ accept: "application/json" }),
        }),
      );
    } finally {
      postalFetch.mockRestore();
    }
  });

  it("ranks public sellers by browsing location and exposes match metadata", async () => {
    const salemLocalUser = await createUserWithRole(
      prisma,
      data.roles,
      RoleCode.SELLER,
      `${runId}-salem-local@1handindia.test`,
      "1HandIndia Salem Local",
    );
    const salemCityUser = await createUserWithRole(
      prisma,
      data.roles,
      RoleCode.SELLER,
      `${runId}-salem-city@1handindia.test`,
      "1HandIndia Salem City",
    );
    const countryUser = await createUserWithRole(
      prisma,
      data.roles,
      RoleCode.SELLER,
      `${runId}-country-match@1handindia.test`,
      "1HandIndia Country Match",
    );
    const noneUser = await createUserWithRole(
      prisma,
      data.roles,
      RoleCode.SELLER,
      `${runId}-global@1handindia.test`,
      "1HandIndia Global",
    );

    const salemLocalSeller = await createApprovedSeller(
      prisma,
      salemLocalUser.id,
      `000 ${runId} Salem Fairlands`,
      `${runId}-salem-fairlands`,
      {
        area: "Fairlands",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636016",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        localAreaCode: "IN-TN-SLM-FR",
      },
    );
    const salemCitySeller = await createApprovedSeller(
      prisma,
      salemCityUser.id,
      `001 ${runId} Salem Hasthampatti`,
      `${runId}-salem-hasthampatti`,
      {
        area: "Hasthampatti",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636007",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        localAreaCode: "IN-TN-SLM-HS",
      },
    );
    const countrySeller = await createApprovedSeller(
      prisma,
      countryUser.id,
      `003 ${runId} Bengaluru Country`,
      `${runId}-bengaluru-country`,
      {
        area: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-KA",
        cityCode: "IN-KA-BLR",
        localAreaCode: "IN-KA-BLR-IND",
      },
    );
    const noneSeller = await createApprovedSeller(
      prisma,
      noneUser.id,
      `004 ${runId} London Global`,
      `${runId}-london-global`,
      {
        area: "Shoreditch",
        city: "London",
        state: "England",
        pincode: "E1 6AN",
        country: "United Kingdom",
        countryCode: "GB",
        stateCode: "GB-ENG",
        cityCode: "GB-ENG-LON",
        localAreaCode: "GB-ENG-LON-E1",
      },
    );

    const globalStores = await request(app.getHttpServer())
      .get("/api/sellers")
      .query({ limit: 200 })
      .expect(200);

    expect(globalStores.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: salemLocalSeller.slug,
          locationMatchLevel: "NONE",
        }),
        expect.objectContaining({
          slug: salemCitySeller.slug,
          locationMatchLevel: "NONE",
        }),
      ]),
    );

    const localizedStores = await request(app.getHttpServer())
      .get("/api/sellers")
      .query({
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        localAreaCode: "IN-TN-SLM-FR",
        pincode: "636016",
        limit: 200,
      })
      .expect(200);

    const localizedBody = localizedStores.body as unknown as Array<{
      slug: string;
      locationMatchLevel: string;
    }>;
    const slugs = localizedBody.map((seller) => seller.slug);
    const localIndex = slugs.indexOf(salemLocalSeller.slug);
    const cityIndex = slugs.indexOf(salemCitySeller.slug);
    const stateIndex = slugs.indexOf(data.seller.slug);
    const countryIndex = slugs.indexOf(countrySeller.slug);
    const noneIndex = slugs.indexOf(noneSeller.slug);

    expect(localIndex).toBeGreaterThanOrEqual(0);
    expect(cityIndex).toBeGreaterThanOrEqual(0);
    expect(stateIndex).toBeGreaterThanOrEqual(0);
    expect(countryIndex).toBeGreaterThanOrEqual(0);
    expect(noneIndex).toBeGreaterThanOrEqual(0);

    expect(localIndex).toBeLessThan(cityIndex);
    expect(cityIndex).toBeLessThan(stateIndex);
    expect(stateIndex).toBeLessThan(countryIndex);
    expect(countryIndex).toBeLessThan(noneIndex);

    expect(localizedBody[localIndex]).toMatchObject({
      slug: salemLocalSeller.slug,
      locationMatchLevel: "LOCAL_AREA",
    });
    expect(localizedBody[cityIndex]).toMatchObject({
      slug: salemCitySeller.slug,
      locationMatchLevel: "CITY",
    });
    expect(localizedBody[stateIndex]).toMatchObject({
      slug: data.seller.slug,
      locationMatchLevel: "STATE",
    });
    expect(localizedBody[countryIndex]).toMatchObject({
      slug: countrySeller.slug,
      locationMatchLevel: "COUNTRY",
    });
    expect(localizedBody[noneIndex]).toMatchObject({
      slug: noneSeller.slug,
      locationMatchLevel: "NONE",
    });
    expectPublicStorePayloadSafe(localizedBody[localIndex]);

    const storeDetail = await request(app.getHttpServer())
      .get(`/api/sellers/${salemLocalSeller.slug}`)
      .expect(200);
    expect(storeDetail.body).toMatchObject({
      id: salemLocalSeller.id,
      slug: salemLocalSeller.slug,
      storeName: salemLocalSeller.storeName,
      locationMatchLevel: "NONE",
    });
    expectPublicStorePayloadSafe(storeDetail.body);

    const publicProducts = await request(app.getHttpServer())
      .get("/api/products")
      .query({ search: runId, limit: 20 })
      .expect(200);
    const publicProduct = (publicProducts.body.items as Array<{ id?: string; seller?: unknown }>).find(
      (item) => item.id === data.product.id,
    );
    expect(publicProduct?.seller).toBeTruthy();
    expectPublicProductSellerPayloadSafe(publicProduct?.seller);
  }, 30000);

  it("runs customer cart, checkout, seller ownership, delivery, and cancellation through the API", async () => {
    const firstAddress = await request(app.getHttpServer())
      .post("/api/account/addresses")
      .set(authHeader(data.customerUser.id))
      .send({
        label: "Home",
        fullName: "1HandIndia Test Customer",
        phone: "9876543210",
        line1: "12 Test Market Road",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641012",
      })
      .expect(201);
    expect(firstAddress.body).toMatchObject({ isDefault: true });

    const secondAddress = await request(app.getHttpServer())
      .post("/api/account/addresses")
      .set(authHeader(data.customerUser.id))
      .send({
        label: "Office",
        fullName: "1HandIndia Test Customer",
        phone: "9876543211",
        line1: "24 Integration Avenue",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641012",
      })
      .expect(201);
    expect(secondAddress.body).toMatchObject({ isDefault: false });

    await request(app.getHttpServer())
      .delete(`/api/account/addresses/${firstAddress.body.id}`)
      .set(authHeader(data.customerUser.id))
      .expect(200);

    const promotedAddress = await prisma.customerAddress.findUniqueOrThrow({
      where: { id: secondAddress.body.id as string },
    });
    expect(promotedAddress.isDefault).toBe(true);

    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.sellerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 1,
      })
      .expect(403);

    const cart = await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 2,
      })
      .expect(201);
    const cartItems = cart.body.items as Array<Record<string, unknown>>;
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0]).toMatchObject({ quantity: 2 });

    const order = await request(app.getHttpServer())
      .post("/api/account/orders")
      .set(authHeader(data.customerUser.id))
      .send({
        shippingAddress: {
          fullName: "1HandIndia Test Customer",
          phone: "9876543210",
          line1: "12 Test Market Road",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "MANUAL",
        buyerCountryCode: "GB",
        shippingPaise: 0,
        customerNote: "Integration test order",
      })
      .expect(201);
    expect(order.body).toMatchObject({
      orderStatus: "PLACED",
      paymentStatus: PaymentStatus.PENDING,
      totalPaise: 24000,
      currency: "INR",
      buyerCountryCode: "GB",
      buyerCurrency: "GBP",
      buyerTotalMinor: 228,
    });

    const orderNumber = order.body.orderNumber as string;
    await request(app.getHttpServer())
      .get(`/api/seller/orders/${orderNumber}`)
      .set(authHeader(data.otherSellerUser.id))
      .expect(404);

    const sellerOrder = await request(app.getHttpServer())
      .get(`/api/seller/orders/${orderNumber}`)
      .set(authHeader(data.sellerUser.id))
      .expect(200);
    expect(sellerOrder.body.sellerSplits).toEqual(
      expect.arrayContaining([expect.objectContaining({ sellerId: data.seller.id })]),
    );
    expect(sellerOrder.body.sellerSplits).toHaveLength(1);
    expect(sellerOrder.body.items).toHaveLength(1);

    const accepted = await request(app.getHttpServer())
      .patch(`/api/seller/orders/${orderNumber}/status`)
      .set(authHeader(data.sellerUser.id))
      .send({
        sellerStatus: SellerOrderStatus.ACCEPTED,
        note: "Seller accepted the order.",
      })
      .expect(200);
    expect(accepted.body.orderStatus).toBe(OrderStatus.CONFIRMED);
    expect(accepted.body.sellerSplits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerStatus: SellerOrderStatus.ACCEPTED }),
      ]),
    );
    expect(accepted.body.statusEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusType: StatusEventType.SELLER,
          newStatus: SellerOrderStatus.ACCEPTED,
        }),
        expect.objectContaining({
          statusType: StatusEventType.ORDER,
          newStatus: OrderStatus.CONFIRMED,
        }),
      ]),
    );

    const delivery = await request(app.getHttpServer())
      .patch(`/api/seller/orders/${orderNumber}/delivery`)
      .set(authHeader(data.sellerUser.id))
      .send({
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        partnerName: "Manual Courier Test",
        partnerPhone: "9876543210",
        trackingReference: `${runId}-TRK`,
        status: DeliveryStatus.DISPATCHED,
        deliveryNote: "Seller dispatched through manual courier",
      })
      .expect(200);
    expect(delivery.body.deliveryStatus).toBe(DeliveryStatus.DISPATCHED);
    expect(delivery.body.orderStatus).toBe(OrderStatus.SHIPPED);
    expect(delivery.body.sellerSplits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerStatus: SellerOrderStatus.DISPATCHED }),
      ]),
    );
    expect(delivery.body.statusEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusType: StatusEventType.DELIVERY,
          newStatus: DeliveryStatus.DISPATCHED,
        }),
        expect.objectContaining({
          statusType: StatusEventType.SELLER,
          newStatus: SellerOrderStatus.DISPATCHED,
        }),
        expect.objectContaining({
          statusType: StatusEventType.ORDER,
          newStatus: OrderStatus.SHIPPED,
        }),
      ]),
    );

    const tracked = await request(app.getHttpServer())
      .post("/api/orders/track")
      .send({ orderNumber, contact: "9876543210" })
      .expect(200);
    expect(tracked.body).toMatchObject({
      orderNumber,
      deliveryStatus: DeliveryStatus.DISPATCHED,
      deliveryDetail: {
        trackingReference: null,
        status: DeliveryStatus.DISPATCHED,
      },
      shippingLocation: {
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641012",
      },
      buyerCurrency: "GBP",
      buyerTotalMinor: 228,
    });
    expect(tracked.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productNameSnapshot: data.product.name, quantity: 2 }),
      ]),
    );

    await request(app.getHttpServer())
      .post("/api/orders/track")
      .send({ orderNumber, contact: "0000000000" })
      .expect(404);

    const rejectedCustomerCancellation = await request(app.getHttpServer())
      .patch(`/api/account/orders/${orderNumber}/cancel`)
      .set(authHeader(data.customerUser.id))
      .send({ note: "Customer changed test order" })
      .expect(400);
    expect(rejectedCustomerCancellation.body.message).toBe(
      "This order has already been dispatched. Please contact support for cancellation or refund help.",
    );

    const dispatchedVariant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: data.productVariant.id },
    });
    expect(dispatchedVariant.stockQuantity).toBe(18);

    const rejectedSellerCancellation = await request(app.getHttpServer())
      .patch(`/api/seller/orders/${orderNumber}/status`)
      .set(authHeader(data.sellerUser.id))
      .send({
        sellerStatus: SellerOrderStatus.CANCELLED,
        note: "Seller tried to cancel after dispatch.",
      })
      .expect(400);
    expect(rejectedSellerCancellation.body.message).toBe(
      "This seller package has already been dispatched. Contact admin to handle return or refund.",
    );

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/admin/orders/${orderNumber}/status`)
      .set(adminSessionHeader)
      .send({ orderStatus: OrderStatus.CANCELLED, note: "Admin cancelled dispatched test order" })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      orderStatus: "CANCELLED",
      paymentStatus: PaymentStatus.NOT_REQUIRED,
      deliveryStatus: DeliveryStatus.CANCELLED,
      payments: expect.arrayContaining([
        expect.objectContaining({
          status: PaymentStatus.NOT_REQUIRED,
        }),
      ]),
      sellerSplits: expect.arrayContaining([
        expect.objectContaining({
          sellerStatus: SellerOrderStatus.CANCELLED,
          settlementStatus: SellerSettlementStatus.CANCELLED,
        }),
      ]),
    });

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: data.productVariant.id },
    });
    expect(variant.stockQuantity).toBe(20);

    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 1,
      })
      .expect(201);

    await prisma.seller.update({
      where: { id: data.seller.id },
      data: { status: SellerStatus.SUSPENDED },
    });

    await request(app.getHttpServer())
      .post("/api/account/orders")
      .set(authHeader(data.customerUser.id))
      .send({
        shippingAddress: {
          fullName: "1HandIndia Test Customer",
          phone: "9876543210",
          line1: "12 Test Market Road",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "MANUAL",
        shippingPaise: 0,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/account/wishlist/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productId: data.product.id,
      })
      .expect(404);

    await prisma.seller.update({
      where: { id: data.seller.id },
      data: { status: SellerStatus.APPROVED },
    });
  }, 20000);

  it("creates seller-level shipment packages for multi-seller checkout", async () => {
    const otherSellerProduct = await prisma.product.create({
      data: {
        sellerId: data.otherSeller.id,
        categoryId: data.category.id,
        name: `${runId} Other Seller Shipment Product`,
        slug: `${runId}-other-seller-shipment-product`,
        description: "Second seller product used to verify seller-level shipments.",
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        searchText: `${runId} other seller shipment product`,
        variants: {
          create: {
            sku: `${runId}-OTHER-SHIPMENT-SKU`,
            variantName: "1 Unit",
            pricePaise: 7000,
            mrpPaise: 9000,
            stockQuantity: 10,
            status: VariantStatus.ACTIVE,
          },
        },
      },
      include: { variants: true },
    });
    const otherSellerVariant = otherSellerProduct.variants[0];
    if (!otherSellerVariant) {
      throw new Error("Other seller shipment variant was not created.");
    }

    let orderNumber: string | undefined;
    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: otherSellerVariant.id,
          quantity: 1,
        })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "44 Multi Seller Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "MANUAL",
          buyerCountryCode: "IN",
        })
        .expect(201);

      orderNumber = order.body.orderNumber as string;
      expect(order.body.sellerSplits).toHaveLength(2);
      expect(order.body.shipments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            shipmentNumber: `${orderNumber}-S01`,
            sellerId: data.seller.id,
            subtotalPaise: 12000,
            status: DeliveryStatus.PENDING,
          }),
          expect.objectContaining({
            shipmentNumber: `${orderNumber}-S02`,
            sellerId: data.otherSeller.id,
            subtotalPaise: 7000,
            status: DeliveryStatus.PENDING,
          }),
        ]),
      );

      const firstSellerOrder = await request(app.getHttpServer())
        .get(`/api/seller/orders/${orderNumber}`)
        .set(authHeader(data.sellerUser.id))
        .expect(200);
      expect(firstSellerOrder.body.items).toHaveLength(1);
      expect(firstSellerOrder.body.sellerSplits).toHaveLength(1);
      expect(firstSellerOrder.body.shipments).toEqual([
        expect.objectContaining({ sellerId: data.seller.id, status: DeliveryStatus.PENDING }),
      ]);

      const secondSellerOrder = await request(app.getHttpServer())
        .get(`/api/seller/orders/${orderNumber}`)
        .set(authHeader(data.otherSellerUser.id))
        .expect(200);
      expect(secondSellerOrder.body.items).toHaveLength(1);
      expect(secondSellerOrder.body.sellerSplits).toHaveLength(1);
      expect(secondSellerOrder.body.shipments).toEqual([
        expect.objectContaining({ sellerId: data.otherSeller.id, status: DeliveryStatus.PENDING }),
      ]);

      const firstSellerDispatched = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/delivery`)
        .set(authHeader(data.sellerUser.id))
        .send({
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          trackingReference: `${runId}-MULTI-SELLER-SHIPMENT`,
          status: DeliveryStatus.DISPATCHED,
          deliveryNote: "First seller dispatched their own package.",
        })
        .expect(200);
      expect(firstSellerDispatched.body.shipments).toEqual([
        expect.objectContaining({
          sellerId: data.seller.id,
          status: DeliveryStatus.DISPATCHED,
          trackingReference: `${runId}-MULTI-SELLER-SHIPMENT`,
        }),
      ]);

      const secondSellerAfterFirstDispatch = await request(app.getHttpServer())
        .get(`/api/seller/orders/${orderNumber}`)
        .set(authHeader(data.otherSellerUser.id))
        .expect(200);
      expect(secondSellerAfterFirstDispatch.body.shipments).toEqual([
        expect.objectContaining({
          sellerId: data.otherSeller.id,
          status: DeliveryStatus.PENDING,
          trackingReference: null,
        }),
      ]);
    } finally {
      if (orderNumber) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${orderNumber}/cancel`)
          .set(authHeader(data.customerUser.id))
          .send({ note: "Reset stock after multi-seller shipment assertion" });
      }
      await clearActiveCustomerCart(prisma, data.customer.id);
    }
  }, 20000);

  it("keeps COD pending, marks verified Razorpay paid, and preserves payment status during seller updates", async () => {
    const razorpayKeySecret = `${runId}_rzp_secret`;
    const providerOrderId = `${runId.replace(/[^a-zA-Z0-9]/g, "_")}_rzp_order_paid`;
    const providerPaymentId = `${runId.replace(/[^a-zA-Z0-9]/g, "_")}_rzp_payment_paid`;
    let codOrderNumber: string | undefined;
    let razorpayOrderNumber: string | undefined;

    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Collect cash on delivery.",
      razorpayEnabled: true,
      razorpayKeyId: `${runId}_rzp_key`,
      razorpayKeySecret,
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.endsWith("/v1/orders")) {
        return new Response(JSON.stringify({ id: providerOrderId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith(`/v1/payments/${encodeURIComponent(providerPaymentId)}`)) {
        return new Response(
          JSON.stringify({
            id: providerPaymentId,
            order_id: providerOrderId,
            amount: 12000,
            currency: "INR",
            status: "captured",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Unexpected Razorpay test request", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const codOrder = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "12 COD Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      codOrderNumber = codOrder.body.orderNumber as string;
      expect(codOrder.body).toMatchObject({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
      });
      expect(codOrder.body.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.COD,
            method: "COD",
            status: PaymentStatus.PENDING,
          }),
        ]),
      );

      const acceptedCod = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${codOrderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.ACCEPTED,
          note: "COD order accepted by seller.",
        })
        .expect(200);
      expect(acceptedCod.body).toMatchObject({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.CONFIRMED,
      });
      expect(acceptedCod.body.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sellerStatus: SellerOrderStatus.ACCEPTED }),
        ]),
      );

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const razorpayOrder = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "12 Online Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "RAZORPAY",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      razorpayOrderNumber = razorpayOrder.body.orderNumber as string;
      expect(razorpayOrder.body).toMatchObject({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
      });
      expect(razorpayOrder.body.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.RAZORPAY,
            method: "RAZORPAY",
            status: PaymentStatus.PENDING,
          }),
        ]),
      );

      const providerOrder = await request(app.getHttpServer())
        .post(`/api/payments/razorpay/orders/${razorpayOrderNumber}`)
        .set(authHeader(data.customerUser.id))
        .expect(201);
      expect(providerOrder.body).toMatchObject({
        razorpayOrderId: providerOrderId,
        amountPaise: 12000,
        currency: "INR",
        orderNumber: razorpayOrderNumber,
      });

      const signature = createHmac("sha256", razorpayKeySecret)
        .update(`${providerOrderId}|${providerPaymentId}`)
        .digest("hex");
      const verified = await request(app.getHttpServer())
        .post("/api/payments/razorpay/verify")
        .set(authHeader(data.customerUser.id))
        .send({
          razorpayOrderId: providerOrderId,
          razorpayPaymentId: providerPaymentId,
          razorpaySignature: signature,
        })
        .expect(201);
      expect(verified.body).toMatchObject({
        received: true,
        paymentId: expect.any(String),
        status: PaymentStatus.PAID,
      });

      const acceptedPaid = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${razorpayOrderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.ACCEPTED,
          note: "Paid online order accepted by seller.",
        })
        .expect(200);
      expect(acceptedPaid.body).toMatchObject({
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
      });
      expect(acceptedPaid.body.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sellerStatus: SellerOrderStatus.ACCEPTED }),
        ]),
      );

      const storedPaidOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber: razorpayOrderNumber },
        include: { payments: true },
      });
      expect(storedPaidOrder.paymentStatus).toBe(PaymentStatus.PAID);
      expect(storedPaidOrder.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.RAZORPAY,
            status: PaymentStatus.PAID,
            providerOrderId,
            providerPaymentId,
          }),
        ]),
      );
    } finally {
      if (codOrderNumber) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${codOrderNumber}/cancel`)
          .set(authHeader(data.customerUser.id))
          .send({ note: "Reset stock after COD payment-status assertion" });
      }
      if (razorpayOrderNumber) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${razorpayOrderNumber}/cancel`)
          .set(authHeader(data.customerUser.id))
          .send({ note: "Reset stock after Razorpay payment-status assertion" });
      }
      vi.unstubAllGlobals();
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
      await clearActiveCustomerCart(prisma, data.customer.id);
    }
  });

  it("clears unpaid payment and seller settlement state when admin cancels an order", async () => {
    let orderNumber: string | undefined;
    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Collect cash on delivery.",
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await prisma.productVariant.update({
        where: { id: data.productVariant.id },
        data: { stockQuantity: 20 },
      });
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "12 Admin Cancel Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      orderNumber = order.body.orderNumber as string;
      expect(order.body).toMatchObject({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
      });

      const cancelled = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderNumber}/status`)
        .set(adminSessionHeader)
        .send({
          orderStatus: OrderStatus.CANCELLED,
          note: "Admin cancelled unpaid COD order.",
        })
        .expect(200);

      expect(cancelled.body).toMatchObject({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
        deliveryStatus: DeliveryStatus.CANCELLED,
        payments: expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.COD,
            status: PaymentStatus.NOT_REQUIRED,
          }),
        ]),
        sellerSplits: expect.arrayContaining([
          expect.objectContaining({
            sellerStatus: SellerOrderStatus.CANCELLED,
            settlementStatus: SellerSettlementStatus.CANCELLED,
          }),
        ]),
        shipments: expect.arrayContaining([
          expect.objectContaining({
            status: DeliveryStatus.CANCELLED,
            assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
          }),
        ]),
      });

      const storedOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          payments: true,
          sellerSplits: true,
          statusEvents: true,
        },
      });
      expect(storedOrder.paymentStatus).toBe(PaymentStatus.NOT_REQUIRED);
      expect(storedOrder.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.COD,
            status: PaymentStatus.NOT_REQUIRED,
          }),
        ]),
      );
      expect(storedOrder.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sellerStatus: SellerOrderStatus.CANCELLED,
            settlementStatus: SellerSettlementStatus.CANCELLED,
          }),
        ]),
      );
      expect(storedOrder.statusEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statusType: StatusEventType.PAYMENT,
            newStatus: PaymentStatus.NOT_REQUIRED,
          }),
          expect.objectContaining({
            statusType: StatusEventType.ORDER,
            newStatus: OrderStatus.CANCELLED,
          }),
        ]),
      );

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: data.productVariant.id },
      });
      expect(variant.stockQuantity).toBe(20);

      const sellerReport = await request(app.getHttpServer())
        .get("/api/seller/reports/sales")
        .set(authHeader(data.sellerUser.id))
        .expect(200);
      const recentOrders = sellerReport.body.recentOrders as Array<{
        order?: { orderNumber?: string };
      }>;
      expect(recentOrders.some((split) => split.order?.orderNumber === orderNumber)).toBe(false);
    } finally {
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
      await clearActiveCustomerCart(prisma, data.customer.id);
      await prisma.productVariant.update({
        where: { id: data.productVariant.id },
        data: { stockQuantity: 20 },
      });
    }
  });

  it("lets customers cancel before dispatch while preserving the money and seller report rules", async () => {
    let orderNumber: string | undefined;
    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Collect cash on delivery.",
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await prisma.productVariant.update({
        where: { id: data.productVariant.id },
        data: { stockQuantity: 20 },
      });
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "12 Customer Cancel Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      orderNumber = order.body.orderNumber as string;

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.ACCEPTED,
          note: "Seller accepted before customer cancellation.",
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.PROCESSING,
          note: "Packed but not dispatched yet.",
        })
        .expect(200);

      const cancelled = await request(app.getHttpServer())
        .patch(`/api/account/orders/${orderNumber}/cancel`)
        .set(authHeader(data.customerUser.id))
        .send({ note: "Customer cancelled before dispatch." })
        .expect(200);

      expect(cancelled.body).toMatchObject({
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
        deliveryStatus: DeliveryStatus.CANCELLED,
        payments: expect.arrayContaining([
          expect.objectContaining({
            provider: PaymentProvider.COD,
            status: PaymentStatus.NOT_REQUIRED,
          }),
        ]),
        sellerSplits: expect.arrayContaining([
          expect.objectContaining({
            sellerStatus: SellerOrderStatus.CANCELLED,
            settlementStatus: SellerSettlementStatus.CANCELLED,
          }),
        ]),
      });

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: data.productVariant.id },
      });
      expect(variant.stockQuantity).toBe(20);

      const sellerReport = await request(app.getHttpServer())
        .get("/api/seller/reports/sales")
        .set(authHeader(data.sellerUser.id))
        .expect(200);
      const recentOrders = sellerReport.body.recentOrders as Array<{
        order?: { orderNumber?: string };
      }>;
      expect(recentOrders.some((split) => split.order?.orderNumber === orderNumber)).toBe(false);
    } finally {
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
      await clearActiveCustomerCart(prisma, data.customer.id);
      await prisma.productVariant.update({
        where: { id: data.productVariant.id },
        data: { stockQuantity: 20 },
      });
    }
  });

  it("lets delivery partners update their own profile details without changing COD limits", async () => {
    try {
      const profile = await request(app.getHttpServer())
        .get("/api/delivery/profile")
        .set(authHeader(data.deliveryPartnerUser.id))
        .expect(200);
      expect(profile.body).toMatchObject({
        id: data.deliveryPartnerUser.id,
        deliveryProfile: {
          phone: "9876543210",
          vehicleNumber: "TN 30 IH 1001",
          isAvailable: true,
          servicePincodes: ["641012", "636304"],
          codCashLimitPaise: 500000,
          effectiveCodCashLimitPaise: 500000,
        },
      });

      await request(app.getHttpServer())
        .get("/api/delivery/profile")
        .set(authHeader(data.sellerUser.id))
        .expect(403);

      await request(app.getHttpServer())
        .patch("/api/delivery/profile")
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({ codCashLimitPaise: 99999999 })
        .expect(400);

      const updated = await request(app.getHttpServer())
        .patch("/api/delivery/profile")
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          phone: "9876543211",
          vehicleNumber: "TN 30 IH 2002",
          isAvailable: false,
          serviceCountryCode: "IN",
          serviceStateCode: "IN-TN",
          serviceCityCode: "IN-TN-SALEM",
          servicePincodes: ["636114", "636304", "636114"],
          serviceLocalAreaCodes: ["PIN-636114-708A9748"],
          notes: "Available for Salem routes.",
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        id: data.deliveryPartnerUser.id,
        phone: "9876543211",
        deliveryProfile: {
          phone: "9876543211",
          vehicleNumber: "TN 30 IH 2002",
          isAvailable: false,
          serviceCountryCode: "IN",
          serviceStateCode: "IN-TN",
          serviceCityCode: "IN-TN-SALEM",
          servicePincodes: ["636114", "636304"],
          serviceLocalAreaCodes: ["PIN-636114-708A9748"],
          codCashLimitPaise: 500000,
          effectiveCodCashLimitPaise: 500000,
          notes: "Available for Salem routes.",
        },
      });

      const storedProfile = await prisma.deliveryPartnerProfile.findUniqueOrThrow({
        where: { userId: data.deliveryPartnerUser.id },
      });
      expect(storedProfile.codCashLimitPaise).toBe(500000);
      const audit = await prisma.auditLog.findFirst({
        where: {
          actorUserId: data.deliveryPartnerUser.id,
          action: "delivery_partner.profile_updated",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeTruthy();
    } finally {
      await prisma.user.update({
        where: { id: data.deliveryPartnerUser.id },
        data: { phone: null },
      });
      await prisma.deliveryPartnerProfile.upsert({
        where: { userId: data.deliveryPartnerUser.id },
        update: {
          phone: "9876543210",
          vehicleNumber: "TN 30 IH 1001",
          isAvailable: true,
          serviceCountryCode: "IN",
          serviceStateCode: null,
          serviceCityCode: null,
          servicePincodes: ["641012", "636304"],
          serviceLocalAreaCodes: [],
          codCashLimitPaise: 500000,
          notes: null,
        },
        create: {
          userId: data.deliveryPartnerUser.id,
          phone: "9876543210",
          vehicleNumber: "TN 30 IH 1001",
          isAvailable: true,
          serviceCountryCode: "IN",
          servicePincodes: ["641012", "636304"],
          codCashLimitPaise: 500000,
        },
      });
    }
  });

  it("runs deliver-to-address local delivery from checkout routing to delivered COD success", async () => {
    let orderNumber: string | undefined;
    let localRateCardId: string | undefined;
    let courierRateCardId: string | undefined;
    const courierProviderCode = "IH_E2E_COURIER";
    const previousCourierProvider = await prisma.courierProviderSetting.findUnique({
      where: { providerCode: courierProviderCode },
    });
    const localShippingAddress = {
      fullName: "1HandIndia Route Customer",
      phone: "9876543210",
      line1: "42 RS Puram Main Road",
      area: "RS Puram",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "641012",
      countryCode: "IN",
      stateCode: "IN-TN",
      cityCode: "IN-TN-CBE",
      localAreaCode: "IN-TN-CBE-RS",
    };

    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Collect cash on delivery.",
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    try {
      await prisma.productVariant.update({
        where: { id: data.productVariant.id },
        data: { stockQuantity: 50 },
      });
      await prisma.deliveryPartnerProfile.update({
        where: { userId: data.deliveryPartnerUser.id },
        data: {
          phone: "9876543210",
          vehicleNumber: "TN 30 IH 1001",
          isAvailable: true,
          priority: 1,
          serviceCountryCode: "IN",
          serviceStateCode: "IN-TN",
          serviceCityCode: "IN-TN-CBE",
          servicePincodes: ["641012"],
          serviceLocalAreaCodes: ["IN-TN-CBE-RS"],
          codCashLimitPaise: 500000,
        },
      });

      const localRateCard = await request(app.getHttpServer())
        .post("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .send({
          name: `${runId} E2E Local Delivery`,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          countryCode: "IN",
          stateCode: "IN-TN",
          cityCode: "IN-TN-CBE",
          pincode: "641012",
          localAreaCode: "IN-TN-CBE-RS",
          shippingChargePaise: 4900,
          freeAbovePaise: 999999,
          codSurchargeType: "FLAT",
          codSurchargeFlatPaise: 600,
          priority: 1,
          isActive: true,
        })
        .expect(201);
      localRateCardId = (localRateCard.body as { item: { id: string } }).item.id;

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const quote = await request(app.getHttpServer())
        .post("/api/checkout/resolve-delivery")
        .set(authHeader(data.customerUser.id))
        .send({
          deliveryPreference: "DELIVER_TO_ADDRESS",
          shippingAddress: localShippingAddress,
          paymentMethod: "COD",
        })
        .expect(201);
      expect(quote.body).toMatchObject({
        deliveryPreference: "DELIVER_TO_ADDRESS",
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        recommendedPartnerUserId: data.deliveryPartnerUser.id,
        matchedRateCardId: localRateCardId,
        shippingChargePaise: 4900,
        codSurchargePaise: 600,
        totalDeliveryChargePaise: 5500,
        routingFailed: false,
      });

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: localShippingAddress,
          deliveryPreference: "DELIVER_TO_ADDRESS",
          paymentMethod: "COD",
          buyerCountryCode: "IN",
        })
        .expect(201);
      orderNumber = order.body.orderNumber as string;
      const codDuePaise = order.body.totalPaise as number;
      expect(order.body).toMatchObject({
        orderStatus: OrderStatus.PLACED,
        paymentStatus: PaymentStatus.PENDING,
        deliveryStatus: DeliveryStatus.PENDING,
        deliveryDetail: {
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          shippingChargeSnapshot: {
            source: "RATE_CARD",
            rateCardId: localRateCardId,
            chargePaise: 4900,
          },
          codSurchargeSnapshot: {
            source: "RATE_CARD",
            rateCardId: localRateCardId,
            amountPaise: 600,
            paymentMethod: "COD",
          },
        },
      });
      expect(order.body.shippingPaise).toBe(5500);

      const initialTrack = await request(app.getHttpServer())
        .post("/api/orders/track")
        .send({ orderNumber, contact: "9876543210" })
        .expect(200);
      expect(initialTrack.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PENDING,
        deliveryStatus: DeliveryStatus.PENDING,
        deliveryDetail: {
          partnerName: null,
          partnerPhone: null,
          trackingReference: null,
        },
      });

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.ACCEPTED,
          note: "Seller accepted the routed delivery order.",
        })
        .expect(200);

      const packed = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.PROCESSING,
          note: "Seller packed routed delivery order.",
        })
        .expect(200);
      expect(packed.body).toMatchObject({
        orderStatus: OrderStatus.PROCESSING,
        deliveryStatus: DeliveryStatus.PACKED,
        deliveryDetail: {
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          status: DeliveryStatus.PACKED,
        },
      });
      expect(packed.body.shipments).toEqual([
        expect.objectContaining({
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          status: DeliveryStatus.PACKED,
        }),
      ]);

      const assignedTrack = await request(app.getHttpServer())
        .post("/api/orders/track")
        .send({ orderNumber, contact: "9876543210" })
        .expect(200);
      expect(assignedTrack.body.deliveryDetail).toMatchObject({
        partnerName: null,
        partnerPhone: null,
        trackingReference: null,
      });
      expect(assignedTrack.body.customerDeliveryTimeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Assigned to delivery partner", completed: true }),
        ]),
      );

      await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.IN_TRANSIT,
          deliveryNote: "Cannot update before accepting assignment.",
        })
        .expect(400);

      const acceptedAssignment = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/assignment`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          decision: "ACCEPT",
          note: "Accepted routed local delivery.",
        })
        .expect(200);
      expect(acceptedAssignment.body.deliveryDetail).toMatchObject({
        assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
      });
      expect(acceptedAssignment.body.shipments).toEqual([
        expect.objectContaining({
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
        }),
      ]);

      await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.DISPATCHED,
          deliveryNote: "Order picked up from seller.",
        })
        .expect(200);

      const outForDelivery = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.IN_TRANSIT,
          deliveryNote: "Out for delivery to customer.",
        })
        .expect(200);
      expect(outForDelivery.body).toMatchObject({
        orderNumber,
        orderStatus: OrderStatus.SHIPPED,
        deliveryStatus: DeliveryStatus.IN_TRANSIT,
      });

      const delivered = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.DELIVERED,
          deliveryNote: "Delivered successfully.",
          receiverName: "1HandIndia Route Customer",
          proofNote: "Customer confirmed delivery at doorstep.",
          proofReference: "Manual proof register E2E-001",
          codCollected: true,
          codCollectedAmountPaise: codDuePaise,
          codCollectionNote: "Collected full COD amount including delivery charges.",
        })
        .expect(200);
      expect(delivered.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.DELIVERED,
        deliveryStatus: DeliveryStatus.DELIVERED,
        deliveryDetail: {
          receiverName: "1HandIndia Route Customer",
          proofReference: "Manual proof register E2E-001",
          codCollectionStatus: CodCollectionStatus.COLLECTED,
          codCollectedAmountPaise: codDuePaise,
        },
      });
      expect(delivered.body.shipments).toEqual([
        expect.objectContaining({
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
          status: DeliveryStatus.DELIVERED,
        }),
      ]);

      const verifiedCod = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderNumber}/cod-verification`)
        .set(adminSessionHeader)
        .send({ decision: "VERIFY", note: "Full routed COD amount received by admin." })
        .expect(200);
      expect(verifiedCod.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PAID,
        deliveryDetail: {
          codCollectionStatus: CodCollectionStatus.VERIFIED,
          codVerificationNote: "Full routed COD amount received by admin.",
        },
      });

      const successTrack = await request(app.getHttpServer())
        .post("/api/orders/track")
        .send({ orderNumber, contact: "9876543210" })
        .expect(200);
      expect(successTrack.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.DELIVERED,
        deliveryStatus: DeliveryStatus.DELIVERED,
        deliveryDetail: {
          partnerName: null,
          partnerPhone: null,
          trackingReference: null,
          codCollectionStatus: CodCollectionStatus.VERIFIED,
          codCollectedAmountPaise: codDuePaise,
        },
      });
      expect(successTrack.body.customerDeliveryTimeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Assigned to delivery partner", completed: true }),
          expect.objectContaining({ label: "Picked up", completed: true }),
          expect.objectContaining({ label: "Out for delivery", completed: true }),
          expect.objectContaining({ label: "COD collected", completed: true }),
          expect.objectContaining({ label: "Delivered", completed: true }),
        ]),
      );

      const storedOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          deliveryDetail: true,
          payments: true,
          sellerSplits: true,
          statusEvents: true,
        },
      });
      expect(storedOrder.paymentStatus).toBe(PaymentStatus.PAID);
      expect(storedOrder.deliveryDetail).toMatchObject({
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        deliveryPartnerUserId: data.deliveryPartnerUser.id,
        assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
        receiverName: "1HandIndia Route Customer",
        proofReference: "Manual proof register E2E-001",
        codCollectionStatus: CodCollectionStatus.VERIFIED,
        codCollectedAmountPaise: codDuePaise,
      });
      expect(storedOrder.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PAID }),
        ]),
      );
      expect(storedOrder.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sellerStatus: SellerOrderStatus.DELIVERED,
            settlementStatus: SellerSettlementStatus.ELIGIBLE,
          }),
        ]),
      );
      expect(storedOrder.statusEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statusType: StatusEventType.DELIVERY,
            newStatus: DeliveryStatus.PACKED,
          }),
          expect.objectContaining({
            statusType: StatusEventType.DELIVERY,
            newStatus: DeliveryStatus.IN_TRANSIT,
          }),
          expect.objectContaining({
            statusType: StatusEventType.PAYMENT,
            newStatus: PaymentStatus.PAID,
          }),
        ]),
      );

      const assignmentAttempts = await prisma.deliveryAssignmentAttempt.findMany({
        where: { orderId: storedOrder.id },
      });
      expect(assignmentAttempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            partnerUserId: data.deliveryPartnerUser.id,
            source: DeliveryAssignmentAttemptSource.AUTO,
            status: DeliveryAssignmentStatus.ACCEPTED,
          }),
        ]),
      );

      await request(app.getHttpServer())
        .post("/api/admin/courier-providers")
        .set(adminSessionHeader)
        .send({
          providerCode: courierProviderCode,
          displayName: "Integration Test Courier",
          mode: "MANUAL",
          isActive: true,
          serviceableCountryCodes: ["GB"],
          credentialsConfigured: false,
          webhookSecretConfigured: false,
          notes: `${runId} simulator check`,
        })
        .expect(201);
      const courierRateCard = await request(app.getHttpServer())
        .post("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .send({
          name: `${runId} E2E courier GB`,
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          countryCode: "GB",
          shippingChargePaise: 15000,
          priority: 1,
          isActive: true,
        })
        .expect(201);
      courierRateCardId = (courierRateCard.body as { item: { id: string } }).item.id;
      const courierSimulation = await request(app.getHttpServer())
        .post("/api/admin/routing-simulator")
        .set(adminSessionHeader)
        .send({
          deliveryPreference: "DELIVER_TO_ADDRESS",
          shippingAddress: {
            fullName: "1HandIndia Courier Customer",
            phone: "9876543210",
            line1: "88 Test Lane",
            countryCode: "GB",
            stateCode: "GB-ENG",
            cityCode: "GB-ENG-LON",
            localAreaCode: "GB-ENG-LON-E1",
            pincode: "E1 6AN",
          },
          subtotalPaise: 48900,
          paymentMethod: "MANUAL",
        })
        .expect(201);
      expect(courierSimulation.body).toMatchObject({
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        courierProviderCode,
        matchedRateCardId: courierRateCardId,
        shippingChargePaise: 15000,
        routingFailed: false,
      });
    } finally {
      if (courierRateCardId) {
        await prisma.shippingRateCard.deleteMany({ where: { id: courierRateCardId } });
      }
      if (localRateCardId) {
        await prisma.shippingRateCard.deleteMany({ where: { id: localRateCardId } });
      }
      if (previousCourierProvider) {
        await prisma.courierProviderSetting.update({
          where: { providerCode: courierProviderCode },
          data: {
            displayName: previousCourierProvider.displayName,
            mode: previousCourierProvider.mode,
            isActive: previousCourierProvider.isActive,
            serviceableCountryCodes: previousCourierProvider.serviceableCountryCodes,
            credentialsConfigured: previousCourierProvider.credentialsConfigured,
            webhookSecretConfigured: previousCourierProvider.webhookSecretConfigured,
            settingsSnapshot: previousCourierProvider.settingsSnapshot ?? Prisma.JsonNull,
            notes: previousCourierProvider.notes,
          },
        });
      } else {
        await prisma.courierProviderSetting.deleteMany({
          where: { providerCode: courierProviderCode },
        });
      }
      await clearActiveCustomerCart(prisma, data.customer.id);
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
    }
  }, 60000);

  it("blocks duplicate active shipping rate cards and upserts courier providers cleanly", async () => {
    let rateCardId: string | undefined;
    let inactiveDuplicateRateCardId: string | undefined;
    let summaryAddressId: string | undefined;
    const providerCode = `${runId}_TEST_COURIER`;
    const normalizedProviderCode = providerCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

    try {
      const firstRateCard = await request(app.getHttpServer())
        .post("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .send({
          name: `${runId} duplicate guard`,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          countryCode: "ZZ",
          stateCode: "ZZ-TEST",
          cityCode: "ZZ-TEST-CITY",
          pincode: "999001",
          shippingChargePaise: 4800,
          minSubtotalPaise: 0,
          maxSubtotalPaise: 99900,
          priority: 10,
          isActive: true,
        })
        .expect(201);
      rateCardId = (firstRateCard.body as { item: { id: string } }).item.id;

      const duplicateRateCard = await request(app.getHttpServer())
        .post("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .send({
          name: `${runId} conflicting duplicate`,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          countryCode: "ZZ",
          stateCode: "zz-test",
          cityCode: "zz-test-city",
          pincode: "999001",
          shippingChargePaise: 4900,
          minSubtotalPaise: 50000,
          maxSubtotalPaise: 150000,
          priority: 99,
          isActive: true,
        })
        .expect(400);
      expect(String(duplicateRateCard.body.message)).toContain(
        "already covers this same delivery mode",
      );

      const inactiveDuplicateRateCard = await request(app.getHttpServer())
        .post("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .send({
          name: `${runId} inactive duplicate guard`,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          countryCode: "ZZ",
          stateCode: "zz-test",
          cityCode: "zz-test-city",
          pincode: "999001",
          shippingChargePaise: 4900,
          minSubtotalPaise: 50000,
          maxSubtotalPaise: 150000,
          priority: 99,
          isActive: false,
        })
        .expect(201);
      inactiveDuplicateRateCardId = (inactiveDuplicateRateCard.body as { item: { id: string } })
        .item.id;

      const duplicateActivation = await request(app.getHttpServer())
        .patch(`/api/admin/rate-cards/${inactiveDuplicateRateCardId}/active`)
        .set(adminSessionHeader)
        .send({ isActive: true })
        .expect(400);
      expect(String(duplicateActivation.body.message)).toContain(
        "already covers this same delivery mode",
      );

      const removedRateCard = await request(app.getHttpServer())
        .delete(`/api/admin/rate-cards/${inactiveDuplicateRateCardId}`)
        .set(adminSessionHeader)
        .expect(200);
      expect(removedRateCard.body).toMatchObject({
        deleted: true,
        item: { id: inactiveDuplicateRateCardId },
      });
      const removedRateCardId = inactiveDuplicateRateCardId;
      inactiveDuplicateRateCardId = undefined;

      const rateCardList = await request(app.getHttpServer())
        .get("/api/admin/rate-cards")
        .set(adminSessionHeader)
        .expect(200);
      expect(
        (rateCardList.body.items as Array<{ id: string }>).some(
          (item) => item.id === removedRateCardId,
        ),
      ).toBe(false);

      await request(app.getHttpServer())
        .patch(`/api/admin/rate-cards/${rateCardId}`)
        .set(adminSessionHeader)
        .send({
          name: `${runId} duplicate guard updated`,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          countryCode: "ZZ",
          stateCode: "ZZ-TEST",
          cityCode: "ZZ-TEST-CITY",
          pincode: "999001",
          shippingChargePaise: 4700,
          minSubtotalPaise: 0,
          maxSubtotalPaise: 99900,
          priority: 10,
          isActive: true,
        })
        .expect(200);

      const summaryAddress = await prisma.customerAddress.create({
        data: {
          customerId: data.customer.id,
          label: `${runId} pincode-only shipping`,
          fullName: "Pincode Only Customer",
          phone: "9876543210",
          line1: "Test address without stored location codes",
          city: "Test City",
          state: "Test State",
          pincode: "999001",
          country: "Testland",
          countryCode: "ZZ",
          isDefault: false,
        },
      });
      summaryAddressId = summaryAddress.id;
      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const routedSummary = await request(app.getHttpServer())
        .get(
          `/api/cart/checkout-summary?buyerCountryCode=IN&deliveryPreference=DELIVER_TO_ADDRESS&paymentMethod=MANUAL&addressId=${summaryAddressId}`,
        )
        .set(authHeader(data.customerUser.id))
        .expect(200);
      expect(routedSummary.body).toMatchObject({
        shippingPaise: 4700,
      });
      const routedSummarySnapshot = routedSummary.body as {
        feeSnapshot: { deliveryRouting: unknown };
      };
      expect(routedSummarySnapshot.feeSnapshot.deliveryRouting).toMatchObject({
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      });

      const routedQuote = await request(app.getHttpServer())
        .post("/api/checkout/resolve-delivery")
        .set(authHeader(data.customerUser.id))
        .send({
          deliveryPreference: "DELIVER_TO_ADDRESS",
          addressId: summaryAddressId,
          paymentMethod: "MANUAL",
        })
        .expect(201);
      expect(routedQuote.body).toMatchObject({
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        matchedRateCardId: rateCardId,
        shippingChargePaise: 4700,
        routingFailed: false,
      });

      const firstProvider = await request(app.getHttpServer())
        .post("/api/admin/courier-providers")
        .set(adminSessionHeader)
        .send({
          providerCode,
          displayName: "Test Courier",
          mode: "MANUAL",
          isActive: true,
          serviceableCountryCodes: ["in", "IN", "gb"],
          credentialsConfigured: false,
          webhookSecretConfigured: false,
        })
        .expect(201);
      expect(firstProvider.body).toMatchObject({
        providerCode: normalizedProviderCode,
        isActive: true,
        serviceableCountryCodes: ["IN", "GB"],
      });

      const apiKey = `${runId}-courier-api-key`;
      const apiSecret = `${runId}-courier-api-secret`;
      const apiPassword = `${runId}-courier-api-password`;
      const webhookSecret = `${runId}-courier-webhook-secret`;
      const updatedProvider = await request(app.getHttpServer())
        .post("/api/admin/courier-providers")
        .set(adminSessionHeader)
        .send({
          providerCode,
          displayName: "Test Courier Managed",
          mode: "LIVE",
          isActive: false,
          serviceableCountryCodes: ["SG"],
          adapterCode: "GENERIC_REST",
          apiBaseUrl: "https://courier.example.test",
          bookingEndpointPath: "/v1/shipments/book",
          trackingEndpointPath: "/v1/shipments/track",
          labelEndpointPath: "/v1/shipments/label",
          cancellationEndpointPath: "/v1/shipments/cancel",
          accountCode: "test-account",
          username: "test-user",
          apiKey,
          apiSecret,
          password: apiPassword,
          webhookSecret,
          credentialsConfigured: true,
          webhookSecretConfigured: true,
          notes: "Updated from admin provider settings.",
        })
        .expect(201);
      expect(updatedProvider.body).toMatchObject({
        providerCode: normalizedProviderCode,
        displayName: "Test Courier Managed",
        isActive: false,
        serviceableCountryCodes: ["SG"],
        credentialsConfigured: true,
        webhookSecretConfigured: true,
        adapterCode: "GENERIC_REST",
        apiBaseUrl: "https://courier.example.test",
        bookingEndpointPath: "/v1/shipments/book",
        trackingEndpointPath: "/v1/shipments/track",
        labelEndpointPath: "/v1/shipments/label",
        cancellationEndpointPath: "/v1/shipments/cancel",
        accountCode: "test-account",
        username: "test-user",
        apiKeyConfigured: true,
        apiSecretConfigured: true,
        passwordConfigured: true,
        liveApiCallsEnabled: true,
      });
      expect(JSON.stringify(updatedProvider.body)).not.toContain(apiKey);
      expect(JSON.stringify(updatedProvider.body)).not.toContain(apiSecret);
      expect(JSON.stringify(updatedProvider.body)).not.toContain(apiPassword);
      expect(JSON.stringify(updatedProvider.body)).not.toContain(webhookSecret);

      const storedProvider = await prisma.courierProviderSetting.findUniqueOrThrow({
        where: { providerCode: normalizedProviderCode },
      });
      expect(storedProvider.settingsSnapshot).toMatchObject({
        adapterCode: "GENERIC_REST",
        apiBaseUrl: "https://courier.example.test",
        credentials: {
          apiKey,
          apiSecret,
          password: apiPassword,
        },
        webhookSecret,
      });

      const retainedSecretsProvider = await request(app.getHttpServer())
        .post("/api/admin/courier-providers")
        .set(adminSessionHeader)
        .send({
          providerCode,
          displayName: "Test Courier Managed",
          mode: "LIVE",
          isActive: true,
          serviceableCountryCodes: ["SG"],
          adapterCode: "GENERIC_REST",
          apiBaseUrl: "https://courier.example.test",
          bookingEndpointPath: "/v1/shipments/book",
          trackingEndpointPath: "/v1/shipments/track",
          labelEndpointPath: "/v1/shipments/label",
          cancellationEndpointPath: "/v1/shipments/cancel",
          accountCode: "test-account",
          username: "test-user",
          credentialsConfigured: true,
          webhookSecretConfigured: true,
        })
        .expect(201);
      expect(retainedSecretsProvider.body).toMatchObject({
        apiKeyConfigured: true,
        apiSecretConfigured: true,
        passwordConfigured: true,
        webhookSecretConfigured: true,
      });

      const providerCount = await prisma.courierProviderSetting.count({
        where: { providerCode: normalizedProviderCode },
      });
      expect(providerCount).toBe(1);
    } finally {
      if (summaryAddressId) {
        await prisma.customerAddress.deleteMany({ where: { id: summaryAddressId } });
      }
      await clearActiveCustomerCart(prisma, data.customer.id);
      if (inactiveDuplicateRateCardId) {
        await prisma.shippingRateCard.deleteMany({ where: { id: inactiveDuplicateRateCardId } });
      }
      if (rateCardId) {
        await prisma.shippingRateCard.deleteMany({ where: { id: rateCardId } });
      }
      await prisma.courierProviderSetting.deleteMany({
        where: { providerCode: normalizedProviderCode },
      });
    }
  });

  it("records delivery partner COD collection and lets admin verify it before marking payment paid", async () => {
    let orderNumber: string | undefined;

    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Collect cash on delivery.",
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "18 Delivery Partner Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      orderNumber = order.body.orderNumber as string;
      expect(order.body).toMatchObject({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
      });

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.ACCEPTED,
          note: "Seller accepted before delivery assignment.",
        })
        .expect(200);

      const assigned = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderNumber}/delivery`)
        .set(adminSessionHeader)
        .send({
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          partnerName: "1HandIndia Delivery Fleet",
          partnerPhone: "9876543210",
          status: DeliveryStatus.DISPATCHED,
          deliveryNote: "Assigned to delivery partner.",
        })
        .expect(200);
      expect(assigned.body.deliveryDetail).toMatchObject({
        deliveryPartnerUserId: data.deliveryPartnerUser.id,
        partnerName: "1HandIndia Delivery Fleet",
        status: DeliveryStatus.DISPATCHED,
      });
      const assignedDeliveryDetail = assigned.body.deliveryDetail as { trackingReference: string };
      const generatedTrackingReference = assignedDeliveryDetail.trackingReference;
      const firstTrackingReference = parseDeliveryTrackingReference(generatedTrackingReference);

      await request(app.getHttpServer())
        .get("/api/delivery/orders")
        .set(authHeader(data.sellerUser.id))
        .expect(403);

      const queue = await request(app.getHttpServer())
        .get("/api/delivery/orders")
        .set(authHeader(data.deliveryPartnerUser.id))
        .expect(200);
      expect(queue.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ orderNumber })]),
      );

      const sellerAssignedOrder = await request(app.getHttpServer())
        .get(`/api/seller/orders/${orderNumber}`)
        .set(authHeader(data.sellerUser.id))
        .expect(200);
      const sellerAssignedDelivery = sellerAssignedOrder.body.deliveryDetail as {
        trackingReference: string;
      };
      expect(sellerAssignedDelivery.trackingReference).toBe(generatedTrackingReference);

      const deliveryPartnerAssignedOrder = await request(app.getHttpServer())
        .get(`/api/delivery/orders/${orderNumber}`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .expect(200);
      const deliveryPartnerAssignedDelivery = deliveryPartnerAssignedOrder.body.deliveryDetail as {
        trackingReference: string;
        assignmentStatus: DeliveryAssignmentStatus;
      };
      expect(deliveryPartnerAssignedDelivery.trackingReference).toBe(generatedTrackingReference);
      expect(deliveryPartnerAssignedDelivery.assignmentStatus).toBe(
        DeliveryAssignmentStatus.ASSIGNED,
      );

      await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.IN_TRANSIT,
          deliveryNote: "Should require acceptance first.",
        })
        .expect(400);

      const acceptedAssignment = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/assignment`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          decision: "ACCEPT",
          note: "Accepted for delivery.",
        })
        .expect(200);
      expect(acceptedAssignment.body.deliveryDetail).toMatchObject({
        assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
      });

      const attempt = await request(app.getHttpServer())
        .post(`/api/delivery/orders/${orderNumber}/attempts`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          reason: DeliveryAttemptReason.CUSTOMER_NOT_REACHABLE,
          note: "Customer did not answer the first call.",
          nextAttemptDate: "2026-05-29",
        })
        .expect(201);
      const attemptedDelivery = attempt.body as {
        deliveryDetail: { attempts: Array<{ reason: string; note?: string | null }> };
      };
      expect(attemptedDelivery.deliveryDetail.attempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: DeliveryAttemptReason.CUSTOMER_NOT_REACHABLE,
            note: "Customer did not answer the first call.",
          }),
        ]),
      );

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);
      const sequenceOrder = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Sequence Customer",
            phone: "9876543210",
            line1: "20 Delivery Partner Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      const secondAssigned = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${sequenceOrder.body.orderNumber}/delivery`)
        .set(adminSessionHeader)
        .send({
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          deliveryPartnerUserId: data.deliveryPartnerUser.id,
          partnerName: "1HandIndia Delivery Fleet",
          partnerPhone: "9876543210",
          status: DeliveryStatus.DISPATCHED,
          deliveryNote: "Second assignment should receive the next tracking sequence.",
        })
        .expect(200);
      const secondAssignedDeliveryDetail = secondAssigned.body.deliveryDetail as {
        trackingReference: string;
      };
      const secondTrackingReference = parseDeliveryTrackingReference(
        secondAssignedDeliveryDetail.trackingReference,
      );
      expect(secondTrackingReference.dateKey).toBe(firstTrackingReference.dateKey);
      expect(secondTrackingReference.sequence).toBe(firstTrackingReference.sequence + 1);

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);
      const autoOrder = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Auto Assign Customer",
            phone: "9876543210",
            line1: "22 Delivery Partner Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      const autoOrderNumber = autoOrder.body.orderNumber as string;

      const packedAutoAssigned = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${autoOrderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.PROCESSING,
          note: "Seller packed this order for pickup.",
        })
        .expect(200);
      expect(packedAutoAssigned.body.deliveryDetail).toMatchObject({
        status: DeliveryStatus.PACKED,
        deliveryPartnerUserId: data.deliveryPartnerUser.id,
        assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      });

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);
      const fallbackOrder = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Fallback Customer",
            phone: "9876543210",
            line1: "31 Thumbal Main Road",
            area: "Vellalapatti",
            city: "Salem",
            state: "Tamil Nadu",
            pincode: "636114",
          },
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          paymentMethod: "MANUAL",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      const fallbackAssigned = await request(app.getHttpServer())
        .patch(`/api/seller/orders/${fallbackOrder.body.orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.PROCESSING,
          note: "Seller packed fallback-route order.",
        })
        .expect(200);
      const fallbackAssignedDelivery = fallbackAssigned.body.deliveryDetail as {
        assignmentNote: string;
        assignmentStatus: DeliveryAssignmentStatus;
        deliveryPartnerUserId: string;
        status: DeliveryStatus;
      };
      expect(fallbackAssignedDelivery).toMatchObject({
        status: DeliveryStatus.PACKED,
        deliveryPartnerUserId: expect.any(String),
        assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      });
      expect(fallbackAssignedDelivery.assignmentNote).toContain("Review route");

      const rejectedAssignment = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${autoOrderNumber}/assignment`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          decision: "REJECT",
          note: "Route capacity full.",
        })
        .expect(200);
      expect(rejectedAssignment.body.deliveryDetail).toMatchObject({
        assignmentStatus: DeliveryAssignmentStatus.REJECTED,
        deliveryPartnerUserId: null,
      });

      const backupDeliveryPartner = await createUserWithRole(
        prisma,
        data.roles,
        RoleCode.DELIVERY_PARTNER,
        `${runId}-delivery-backup@1handindia.test`,
        "1HandIndia Backup Delivery Partner",
      );
      await prisma.deliveryPartnerProfile.create({
        data: {
          userId: backupDeliveryPartner.id,
          phone: "9876543212",
          vehicleNumber: "TN 30 IH 2002",
          isAvailable: true,
          serviceCountryCode: "IN",
          servicePincodes: ["641012"],
          codCashLimitPaise: 500000,
        },
      });
      const reassignedAfterReject = await request(app.getHttpServer())
        .post(`/api/admin/delivery/orders/${autoOrderNumber}/auto-assign`)
        .set(adminSessionHeader)
        .expect(201);
      const reassignedAfterRejectDetail = reassignedAfterReject.body.deliveryDetail as {
        assignmentNote: string;
        assignmentStatus: DeliveryAssignmentStatus;
        deliveryPartnerUserId: string;
      };
      expect(reassignedAfterRejectDetail).toMatchObject({
        assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
        deliveryPartnerUserId: backupDeliveryPartner.id,
      });
      expect(reassignedAfterRejectDetail.assignmentNote).toContain("1 rejected partner(s) skipped");
      const packedAutoAssignedOrderId = packedAutoAssigned.body.id as string;
      const assignmentAttempts = await prisma.deliveryAssignmentAttempt.findMany({
        where: { orderId: packedAutoAssignedOrderId },
        orderBy: { createdAt: "asc" },
      });
      expect(assignmentAttempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            partnerUserId: data.deliveryPartnerUser.id,
            source: DeliveryAssignmentAttemptSource.AUTO,
            status: DeliveryAssignmentStatus.REJECTED,
          }),
          expect.objectContaining({
            partnerUserId: backupDeliveryPartner.id,
            source: DeliveryAssignmentAttemptSource.AUTO,
            status: DeliveryAssignmentStatus.ASSIGNED,
          }),
        ]),
      );

      const unassignedQueue = await request(app.getHttpServer())
        .get("/api/admin/delivery/unassigned-orders")
        .set(adminSessionHeader)
        .expect(200);
      expect(unassignedQueue.body.items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ orderNumber: autoOrderNumber })]),
      );

      const inTransit = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.IN_TRANSIT,
          deliveryNote: "Picked up by delivery partner.",
        })
        .expect(200);
      expect(inTransit.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PENDING,
        deliveryStatus: DeliveryStatus.IN_TRANSIT,
        orderStatus: OrderStatus.SHIPPED,
        deliveryDetail: {
          trackingReference: generatedTrackingReference,
        },
      });

      const delivered = await request(app.getHttpServer())
        .patch(`/api/delivery/orders/${orderNumber}/delivery`)
        .set(authHeader(data.deliveryPartnerUser.id))
        .send({
          status: DeliveryStatus.DELIVERED,
          deliveryNote: "Delivered and COD collected.",
          codCollected: true,
          codCollectedAmountPaise: 12000,
          codCollectionNote: "Collected exact COD amount from customer.",
        })
        .expect(200);
      expect(delivered.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PENDING,
        deliveryStatus: DeliveryStatus.DELIVERED,
        orderStatus: OrderStatus.DELIVERED,
        deliveryDetail: {
          trackingReference: generatedTrackingReference,
          codCollectionStatus: CodCollectionStatus.COLLECTED,
          codCollectedAmountPaise: 12000,
          codCollectedBy: expect.objectContaining({ id: data.deliveryPartnerUser.id }),
        },
      });

      const storedOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          deliveryDetail: { include: { attempts: true } },
          sellerSplits: true,
          payments: true,
          statusEvents: true,
        },
      });
      expect(storedOrder.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(storedOrder.deliveryDetail?.deliveryPartnerUserId).toBe(data.deliveryPartnerUser.id);
      expect(storedOrder.deliveryDetail?.trackingReference).toBe(generatedTrackingReference);
      expect(storedOrder.deliveryDetail?.assignmentStatus).toBe(DeliveryAssignmentStatus.ACCEPTED);
      expect(storedOrder.deliveryDetail?.attempts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: DeliveryAttemptReason.CUSTOMER_NOT_REACHABLE }),
        ]),
      );
      expect(storedOrder.deliveryDetail?.codCollectionStatus).toBe(CodCollectionStatus.COLLECTED);
      expect(storedOrder.deliveryDetail?.codCollectedAmountPaise).toBe(12000);
      expect(storedOrder.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sellerStatus: SellerOrderStatus.DELIVERED }),
        ]),
      );
      expect(storedOrder.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PENDING }),
        ]),
      );
      expect(storedOrder.statusEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statusType: StatusEventType.DELIVERY,
            newStatus: DeliveryStatus.DELIVERED,
          }),
          expect.objectContaining({
            statusType: StatusEventType.SELLER,
            newStatus: SellerOrderStatus.DELIVERED,
          }),
          expect.objectContaining({
            statusType: StatusEventType.ORDER,
            newStatus: OrderStatus.DELIVERED,
          }),
        ]),
      );

      const verifiedCod = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderNumber}/cod-verification`)
        .set(adminSessionHeader)
        .send({ decision: "VERIFY", note: "Cash matched at admin desk." })
        .expect(200);
      expect(verifiedCod.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PAID,
        deliveryDetail: {
          codCollectionStatus: CodCollectionStatus.VERIFIED,
          codCollectedAmountPaise: 12000,
        },
      });
      expect(verifiedCod.body.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PAID }),
        ]),
      );

      const trackedOrder = await request(app.getHttpServer())
        .post("/api/orders/track")
        .send({ orderNumber, contact: "9876543210" })
        .expect(200);
      expect(trackedOrder.body).toMatchObject({
        orderNumber,
        paymentStatus: PaymentStatus.PAID,
        deliveryStatus: DeliveryStatus.DELIVERED,
        deliveryDetail: {
          partnerPhone: null,
          trackingReference: null,
          codCollectionStatus: CodCollectionStatus.VERIFIED,
          codCollectedAmountPaise: 12000,
          codCollectionNote: "Collected exact COD amount from customer.",
          codVerificationNote: "Cash matched at admin desk.",
        },
      });
      expect(trackedOrder.body.customerDeliveryTimeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Assigned to delivery partner", completed: true }),
          expect.objectContaining({ label: "Out for delivery", completed: true }),
          expect.objectContaining({ label: "COD collected", completed: true }),
          expect.objectContaining({ label: "Delivered", completed: true }),
        ]),
      );
      const trackedDelivery = (trackedOrder.body as { deliveryDetail: { events: unknown[] } })
        .deliveryDetail;
      expect(trackedDelivery.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ newStatus: DeliveryStatus.IN_TRANSIT }),
          expect.objectContaining({ newStatus: DeliveryStatus.DELIVERED }),
        ]),
      );

      const verifiedStoredOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          deliveryDetail: true,
          sellerSplits: true,
          payments: true,
          statusEvents: true,
        },
      });
      expect(verifiedStoredOrder.paymentStatus).toBe(PaymentStatus.PAID);
      expect(verifiedStoredOrder.deliveryDetail?.codCollectionStatus).toBe(
        CodCollectionStatus.VERIFIED,
      );
      expect(verifiedStoredOrder.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PAID }),
        ]),
      );
      expect(verifiedStoredOrder.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sellerStatus: SellerOrderStatus.DELIVERED,
            settlementStatus: SellerSettlementStatus.ELIGIBLE,
          }),
        ]),
      );
      expect(verifiedStoredOrder.statusEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statusType: StatusEventType.PAYMENT,
            newStatus: PaymentStatus.PAID,
          }),
        ]),
      );
    } finally {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
    }
  }, 20000);

  it("auto-assigns deterministically under high delivery partner load", async () => {
    const load = await seedHighVolumeAutoAssignmentData(prisma, data);
    const startedAt = Date.now();

    const assigned = await request(app.getHttpServer())
      .post(`/api/admin/delivery/orders/${load.targetOrderNumber}/auto-assign`)
      .set(adminSessionHeader)
      .expect(201);

    const elapsedMs = Date.now() - startedAt;
    const deliveryDetail = assigned.body.deliveryDetail as {
      assignmentNote: string;
      assignmentStatus: DeliveryAssignmentStatus;
      deliveryPartnerUserId: string;
    };

    expect(deliveryDetail).toMatchObject({
      assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      deliveryPartnerUserId: load.winnerPartnerId,
    });
    expect(deliveryDetail.assignmentNote).toContain("Matched local area");
    expect(deliveryDetail.assignmentNote).toContain("Workload 0");
    expect(deliveryDetail.assignmentNote).toContain(
      `${load.rejectedPartnerCount} rejected partner(s) skipped`,
    );
    expect(elapsedMs).toBeLessThan(10000);

    const attempts = await prisma.deliveryAssignmentAttempt.findMany({
      where: { orderId: load.targetOrderId },
      select: { partnerUserId: true, status: true, source: true },
    });
    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partnerUserId: load.winnerPartnerId,
          source: DeliveryAssignmentAttemptSource.AUTO,
          status: DeliveryAssignmentStatus.ASSIGNED,
        }),
      ]),
    );
    const rejectedPartnerIdSet = new Set<string>(load.rejectedPartnerIds);
    const wronglyReassignedRejectedPartners = attempts.filter(
      (attempt) =>
        attempt.status === DeliveryAssignmentStatus.ASSIGNED &&
        rejectedPartnerIdSet.has(attempt.partnerUserId),
    );
    expect(wronglyReassignedRejectedPartners).toHaveLength(0);
  }, 120000);

  it("keeps auto assignment limited to local delivery partner mode", async () => {
    await prisma.productVariant.update({
      where: { id: data.productVariant.id },
      data: { stockQuantity: 50 },
    });
    await clearActiveCustomerCart(prisma, data.customer.id);
    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 1,
      })
      .expect(201);

    const courierOrder = await request(app.getHttpServer())
      .post("/api/account/orders")
      .set(authHeader(data.customerUser.id))
      .send({
        shippingAddress: {
          fullName: "1HandIndia Courier Customer",
          phone: "9876543210",
          line1: "88 Courier Street",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "MANUAL",
        buyerCountryCode: "IN",
        shippingPaise: 0,
      })
      .expect(201);
    const courierOrderNumber = courierOrder.body.orderNumber as string;

    const packedCourierOrder = await request(app.getHttpServer())
      .patch(`/api/seller/orders/${courierOrderNumber}/status`)
      .set(authHeader(data.sellerUser.id))
      .send({
        sellerStatus: SellerOrderStatus.PROCESSING,
        note: "Seller packed third-party courier order.",
      })
      .expect(200);
    expect(packedCourierOrder.body.deliveryDetail).toMatchObject({
      deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
      status: DeliveryStatus.PACKED,
      deliveryPartnerUserId: null,
      assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
    });

    await request(app.getHttpServer())
      .post(`/api/admin/delivery/orders/${courierOrderNumber}/auto-assign`)
      .set(adminSessionHeader)
      .expect(400);

    await clearActiveCustomerCart(prisma, data.customer.id);
    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({
        productVariantId: data.productVariant.id,
        quantity: 1,
      })
      .expect(201);

    const pickupOrder = await request(app.getHttpServer())
      .post("/api/account/orders")
      .set(authHeader(data.customerUser.id))
      .send({
        shippingAddress: {
          fullName: "1HandIndia Pickup Customer",
          phone: "9876543210",
          line1: "Seller pickup desk",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.STORE_PICKUP,
        paymentMethod: "MANUAL",
        buyerCountryCode: "IN",
        shippingPaise: 0,
      })
      .expect(201);
    const pickupOrderNumber = pickupOrder.body.orderNumber as string;

    const packedPickupOrder = await request(app.getHttpServer())
      .patch(`/api/seller/orders/${pickupOrderNumber}/status`)
      .set(authHeader(data.sellerUser.id))
      .send({
        sellerStatus: SellerOrderStatus.PROCESSING,
        note: "Seller packed store pickup order.",
      })
      .expect(200);
    expect(packedPickupOrder.body.deliveryDetail).toMatchObject({
      deliveryMode: DeliveryMode.STORE_PICKUP,
      status: DeliveryStatus.PACKED,
      deliveryPartnerUserId: null,
      assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
    });

    await request(app.getHttpServer())
      .post(`/api/admin/delivery/orders/${pickupOrderNumber}/auto-assign`)
      .set(adminSessionHeader)
      .expect(400);

    await clearActiveCustomerCart(prisma, data.customer.id);
  }, 30000);

  it("processes third-party courier tracking and COD remittance without marking COD paid early", async () => {
    const providerCode = `${safeRunCode()}_COURIER_COD`;
    const webhookSecret = `${runId}-courier-cod-webhook-secret`;
    const awbNumber = `${safeRunCode()}AWB001`;
    let orderNumber: string | undefined;

    await setCheckoutPaymentFlowSettings(prisma, {
      codEnabled: true,
      codMaxOrderPaise: 500000,
      codInstructions: "Courier collects COD and remits to admin bank.",
      razorpayEnabled: false,
      razorpayKeyId: "",
      razorpayKeySecret: "",
      bankTransferEnabled: false,
      manualEnabled: true,
    });

    try {
      await request(app.getHttpServer())
        .post("/api/admin/courier-providers")
        .set(adminSessionHeader)
        .send({
          providerCode,
          displayName: "Integration Courier COD",
          mode: "MANUAL",
          isActive: true,
          serviceableCountryCodes: ["ZZ"],
          webhookSecret,
          webhookSecretConfigured: true,
          credentialsConfigured: false,
          notes: `${runId} courier COD remittance test`,
        })
        .expect(201);

      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Courier COD Customer",
            phone: "9876543210",
            line1: "77 Courier COD Street",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "COD",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);
      const orderBody = order.body as {
        orderNumber: string;
        totalPaise: number;
        shipments: Array<{ shipmentNumber: string }>;
      };
      orderNumber = orderBody.orderNumber;
      const shipmentNumber = orderBody.shipments[0]?.shipmentNumber;
      if (!shipmentNumber) {
        throw new Error("Courier COD order did not create a seller package.");
      }
      const expectedCodAmountPaise = orderBody.totalPaise;

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${orderNumber}/status`)
        .set(authHeader(data.sellerUser.id))
        .send({
          sellerStatus: SellerOrderStatus.PROCESSING,
          note: "Seller packed courier COD package.",
        })
        .expect(200);

      const booked = await request(app.getHttpServer())
        .post(`/api/admin/courier-shipments/${shipmentNumber}/book`)
        .set(adminSessionHeader)
        .send({
          providerCode,
          awbNumber,
          providerOrderId: `${safeRunCode()}_PROVIDER_ORDER_001`,
          trackingUrl: `https://courier.example.test/track/${awbNumber}`,
          note: "Booked from provider dashboard.",
        })
        .expect(201);
      const bookedBody = booked.body as {
        shipments: Array<{
          shipmentNumber: string;
          courierShipment?: Record<string, unknown> | null;
        }>;
      };
      expect(bookedBody.shipments[0]).toMatchObject({
        shipmentNumber,
        courierShipment: expect.objectContaining({
          providerCode,
          awbNumber,
          trackingStatus: CourierShipmentStatus.BOOKED,
        }),
      });

      const webhookPayload = {
        eventId: `${safeRunCode()}_COURIER_DELIVERED_001`,
        awbNumber,
        status: "DELIVERED",
      };
      const rawWebhookBody = Buffer.from(JSON.stringify(webhookPayload));
      const signature = createHmac("sha256", webhookSecret).update(rawWebhookBody).digest("hex");
      const deliveredWebhook = await request(app.getHttpServer())
        .post(`/api/webhooks/couriers/${providerCode}/tracking`)
        .set({ "content-type": "application/json", "x-courier-signature": signature })
        .send(rawWebhookBody.toString())
        .expect(201);
      expect(deliveredWebhook.body).toMatchObject({
        status: "PROCESSED",
        courierShipmentId: expect.any(String),
      });

      const duplicateWebhook = await request(app.getHttpServer())
        .post(`/api/webhooks/couriers/${providerCode}/tracking`)
        .set({ "content-type": "application/json", "x-courier-signature": signature })
        .send(rawWebhookBody.toString())
        .expect(201);
      expect(duplicateWebhook.body).toMatchObject({
        status: "SKIPPED",
        reason: "Duplicate webhook event.",
      });

      const storedAfterDelivery = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          payments: true,
          shipments: {
            include: {
              courierShipment: true,
              courierCodRemittance: true,
            },
          },
        },
      });
      expect(storedAfterDelivery.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(storedAfterDelivery.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PENDING }),
        ]),
      );
      const deliveredShipment = storedAfterDelivery.shipments[0];
      expect(deliveredShipment).toBeDefined();
      expect(deliveredShipment).toMatchObject({
        status: DeliveryStatus.DELIVERED,
        codCollectionSource: CodCollectionSource.THIRD_PARTY_COURIER,
        codCollectionStatus: CodCollectionStatus.COLLECTED,
        courierTrackingStatus: CourierShipmentStatus.DELIVERED,
        courierCodRemittance: expect.objectContaining({
          expectedAmountPaise: expectedCodAmountPaise,
          collectedAmountPaise: expectedCodAmountPaise,
          status: CourierCodRemittanceStatus.COURIER_COLLECTED,
        }),
      });

      const webhookEventCount = await prisma.courierWebhookEvent.count({
        where: {
          providerCode,
          providerEventId: webhookPayload.eventId,
          status: CourierWebhookEventStatus.PROCESSED,
        },
      });
      expect(webhookEventCount).toBe(1);

      const remittanceQueue = await request(app.getHttpServer())
        .get(`/api/admin/finance/courier-cod-remittances?search=${encodeURIComponent(awbNumber)}`)
        .set(adminSessionHeader)
        .expect(200);
      const remittanceQueueBody = remittanceQueue.body as {
        items: Array<{
          id: string;
          awbNumber?: string;
          expectedAmountPaise: number;
          status: CourierCodRemittanceStatus;
        }>;
      };
      expect(remittanceQueueBody.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            awbNumber,
            expectedAmountPaise: expectedCodAmountPaise,
            status: CourierCodRemittanceStatus.COURIER_COLLECTED,
          }),
        ]),
      );
      const remittanceId = remittanceQueueBody.items[0]?.id;
      if (!remittanceId) {
        throw new Error("Courier COD remittance queue did not return the package row.");
      }

      await request(app.getHttpServer())
        .post("/api/admin/finance/courier-cod-remittances")
        .set(adminSessionHeader)
        .send({
          shipmentNumber,
          awbNumber,
          remittedAmountPaise: expectedCodAmountPaise,
          remittanceReference: `${safeRunCode()}_COURIER_UTR_001`,
          reportReference: `${safeRunCode()}_COURIER_REPORT_001`,
          notes: "Courier COD report matched bank credit.",
        })
        .expect(201);

      const verified = await request(app.getHttpServer())
        .patch(`/api/admin/finance/courier-cod-remittances/${remittanceId}/verify`)
        .set(adminSessionHeader)
        .send({
          decision: "VERIFY",
          note: "Courier COD remittance verified by finance.",
        })
        .expect(200);
      expect(verified.body.paymentStatus).toBe(PaymentStatus.PAID);

      const storedAfterVerification = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        include: {
          payments: true,
          shipments: { include: { courierCodRemittance: true } },
          sellerSplits: true,
        },
      });
      expect(storedAfterVerification.paymentStatus).toBe(PaymentStatus.PAID);
      expect(storedAfterVerification.payments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: PaymentProvider.COD, status: PaymentStatus.PAID }),
        ]),
      );
      const verifiedShipment = storedAfterVerification.shipments[0];
      expect(verifiedShipment).toBeDefined();
      expect(verifiedShipment?.courierCodRemittance).toMatchObject({
        status: CourierCodRemittanceStatus.VERIFIED,
        remittedAmountPaise: expectedCodAmountPaise,
      });
      expect(storedAfterVerification.sellerSplits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ settlementStatus: SellerSettlementStatus.ELIGIBLE }),
        ]),
      );
    } finally {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await setCheckoutPaymentFlowSettings(prisma, {
        codEnabled: false,
        codMaxOrderPaise: 0,
        codInstructions: "Pay cash to the delivery partner when the order is delivered.",
        razorpayEnabled: false,
        razorpayKeyId: "",
        razorpayKeySecret: "",
        bankTransferEnabled: false,
        manualEnabled: true,
      });
    }
  }, 60000);

  it("applies fixed buyer platform fee once per checkout across cart summary and order placement", async () => {
    await clearActiveCustomerCart(prisma, data.customer.id);
    await setCheckoutPlatformFeeSettings(prisma, {
      enabled: true,
      type: "FIXED",
      valueBps: 1000,
      fixedPaise: 500,
      shippingPaise: 0,
    });

    let orderNumber: string | undefined;

    try {
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 5,
        })
        .expect(201);

      const summary = await request(app.getHttpServer())
        .get("/api/cart/checkout-summary?buyerCountryCode=IN")
        .set(authHeader(data.customerUser.id))
        .expect(200);

      expect(summary.body).toMatchObject({
        itemCount: 5,
        subtotalPaise: 60000,
        shippingPaise: 0,
        platformFeePaise: 500,
        totalPaise: 60500,
      });

      const order = await request(app.getHttpServer())
        .post("/api/account/orders")
        .set(authHeader(data.customerUser.id))
        .send({
          shippingAddress: {
            fullName: "1HandIndia Test Customer",
            phone: "9876543210",
            line1: "12 Test Market Road",
            city: "Coimbatore",
            state: "Tamil Nadu",
            pincode: "641012",
          },
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          paymentMethod: "MANUAL",
          buyerCountryCode: "IN",
          shippingPaise: 0,
        })
        .expect(201);

      orderNumber = order.body.orderNumber as string;
      expect(order.body).toMatchObject({
        subtotalPaise: 60000,
        shippingPaise: 0,
        platformFeePaise: 500,
        totalPaise: 60500,
        buyerPlatformFeeMinor: 500,
        buyerTotalMinor: 60500,
      });

      const storedOrder = await prisma.order.findUniqueOrThrow({
        where: { orderNumber },
        select: {
          platformFeePaise: true,
          totalPaise: true,
          checkoutFeeSnapshot: true,
        },
      });
      expect(storedOrder.platformFeePaise).toBe(500);
      expect(storedOrder.totalPaise).toBe(60500);
      expect(storedOrder.checkoutFeeSnapshot).toMatchObject({
        platformFee: {
          enabled: true,
          type: "FIXED",
          fixedPaise: 500,
          amountPaise: 500,
        },
      });
    } finally {
      if (orderNumber) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${orderNumber}/cancel`)
          .set(authHeader(data.customerUser.id))
          .send({ note: "Reset integration stock after fixed fee assertion" });
      }
      await setCheckoutPlatformFeeSettings(prisma, {
        enabled: false,
        type: "PERCENTAGE",
        valueBps: 0,
        fixedPaise: 0,
        shippingPaise: 0,
      });
      await clearActiveCustomerCart(prisma, data.customer.id);
    }
  });

  it("persists checkout platform fee settings through the admin API and uses them after readback", async () => {
    await clearActiveCustomerCart(prisma, data.customer.id);
    await setCheckoutPlatformFeeSettings(prisma, {
      enabled: false,
      type: "PERCENTAGE",
      valueBps: 0,
      fixedPaise: 0,
      shippingPaise: 0,
    });
    const settingsRequest = request(app.getHttpServer()) as ReturnType<typeof request> & {
      put: (url: string) => ReturnType<ReturnType<typeof request>["patch"]>;
    };

    try {
      await settingsRequest
        .put("/api/admin/settings/checkout/platform-fee")
        .set(authHeader(data.customerUser.id))
        .send({
          enabled: true,
          type: "PERCENTAGE",
          valueBps: 250,
          fixedPaise: 0,
        })
        .expect(401);

      const saved = await settingsRequest
        .put("/api/admin/settings/checkout/platform-fee")
        .set(adminSessionHeader)
        .send({
          enabled: true,
          type: "PERCENTAGE",
          valueBps: 250,
          fixedPaise: 0,
        })
        .expect(200);
      expect(saved.body).toMatchObject({
        enabled: true,
        type: "PERCENTAGE",
        valueBps: 250,
        fixedPaise: 0,
      });

      const checkoutSettings = await request(app.getHttpServer())
        .get("/api/admin/settings?group=checkout")
        .set(adminSessionHeader)
        .expect(200);
      expect(checkoutSettings.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "checkout.platform_fee.enabled", value: true }),
          expect.objectContaining({ key: "checkout.platform_fee.type", value: "PERCENTAGE" }),
          expect.objectContaining({ key: "checkout.platform_fee.value_bps", value: 250 }),
          expect.objectContaining({ key: "checkout.platform_fee.fixed_paise", value: 0 }),
        ]),
      );

      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const summary = await request(app.getHttpServer())
        .get("/api/cart/checkout-summary?buyerCountryCode=IN")
        .set(authHeader(data.customerUser.id))
        .expect(200);
      expect(summary.body).toMatchObject({
        itemCount: 1,
        subtotalPaise: 12000,
        platformFeePaise: 300,
        totalPaise: 12300,
        buyerPlatformFeeMinor: 300,
        buyerTotalMinor: 12300,
      });
    } finally {
      await setCheckoutPlatformFeeSettings(prisma, {
        enabled: false,
        type: "PERCENTAGE",
        valueBps: 0,
        fixedPaise: 0,
        shippingPaise: 0,
      });
      await clearActiveCustomerCart(prisma, data.customer.id);
    }
  });

  it("manages transactional email templates, settings, logs, retries, and audit records through the admin email API", async () => {
    const defaultEmailSettingId = "00000000-0000-0000-0000-000000000001";
    const emailThemeCode = `${runId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_EMAIL_THEME`;
    const originalEmailSetting = await prisma.emailSetting.findUnique({
      where: { id: defaultEmailSettingId },
    });
    let triggerRestore: {
      id: string;
      templateId: string | null;
      isEnabled: boolean;
      delayMinutes: number;
    } | null = null;
    const template = await prisma.notificationTemplate.create({
      data: {
        code: `${runId}_EMAIL_TEMPLATE`,
        name: `${runId} Direct email template`,
        category: EmailTemplateCategory.CUSTOMER,
        channel: NotificationChannel.EMAIL,
        subject: "Hello {{ customerName }}",
        body: "Order {{ orderNumber }} is waiting.",
        status: ContentStatus.DRAFT,
      },
    });
    const log = await prisma.notificationLog.create({
      data: {
        channel: NotificationChannel.EMAIL,
        templateCode: template.code,
        recipient: `${runId}-email-log@1handindia.test`,
        subject: "Stored old subject",
        body: "Stored old body",
        variables: {
          customerName: "Integration Customer",
          orderNumber: "1HIEMAIL001",
        },
        status: NotificationStatus.SKIPPED,
        errorMessage: "Email sending disabled for retry setup.",
      },
    });
    const apiRequest = request(app.getHttpServer()) as ReturnType<typeof request> & {
      put: (url: string) => ReturnType<ReturnType<typeof request>["patch"]>;
    };

    try {
      const templates = await request(app.getHttpServer())
        .get("/api/admin/email/templates")
        .set(adminSessionHeader)
        .expect(200);
      expect(templates.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: template.id,
            code: template.code,
            name: `${runId} Direct email template`,
            category: "CUSTOMER",
            channel: "EMAIL",
          }),
        ]),
      );
      const customerTemplates = await request(app.getHttpServer())
        .get("/api/admin/email/templates")
        .query({ category: "CUSTOMER", search: runId })
        .set(adminSessionHeader)
        .expect(200);
      expect(customerTemplates.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: template.id })]),
      );

      const detail = await request(app.getHttpServer())
        .get(`/api/admin/email/templates/${template.id}`)
        .set(adminSessionHeader)
        .expect(200);
      expect(detail.body).toMatchObject({
        code: template.code,
        channel: "EMAIL",
        subject: "Hello {{ customerName }}",
      });

      const createdTemplate = await request(app.getHttpServer())
        .post("/api/admin/email/templates")
        .set(adminSessionHeader)
        .send({
          name: `${runId} Created customer welcome`,
          category: "CUSTOMER",
          subject: "Welcome {{ customerName }}",
          body: "Hello {{ customerName }}",
          status: "PUBLISHED",
        })
        .expect(201);
      const createdTemplateId = String(createdTemplate.body.id);
      expect(createdTemplate.body).toMatchObject({
        name: `${runId} Created customer welcome`,
        category: "CUSTOMER",
        channel: "EMAIL",
        subject: "Welcome {{ customerName }}",
        status: "PUBLISHED",
      });
      expect(createdTemplate.body.code).toMatch(/^CUSTOMER_/);

      const createdTheme = await request(app.getHttpServer())
        .post("/api/admin/email/themes")
        .set(adminSessionHeader)
        .send({
          code: emailThemeCode,
          name: `${runId} Email Theme`,
          status: "DRAFT",
          tokens: {
            brandColor: "#ED3500",
            accentColor: "#163B5C",
            backgroundColor: "#FFFCFB",
            surfaceColor: "#FFFFFF",
            textColor: "#1F2933",
            mutedTextColor: "#667085",
            buttonBackgroundColor: "#ED3500",
            buttonTextColor: "#FFFFFF",
            buttonStyle: "SOLID",
            footerText: `${runId} transactional footer`,
            borderRadius: 8,
            fontFamily: "Arial",
          },
        })
        .expect(201);
      const createdThemeId = String(createdTheme.body.id);
      const themes = await request(app.getHttpServer())
        .get("/api/admin/email/themes")
        .set(adminSessionHeader)
        .expect(200);
      expect(themes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: createdThemeId, code: emailThemeCode }),
        ]),
      );
      const updatedTheme = await request(app.getHttpServer())
        .patch(`/api/admin/email/themes/${createdThemeId}`)
        .set(adminSessionHeader)
        .send({
          name: `${runId} Published Email Theme`,
          status: "PUBLISHED",
          tokens: {
            brandColor: "#163B5C",
            accentColor: "#ED3500",
            backgroundColor: "#FAF7F0",
            surfaceColor: "#FFFFFF",
            textColor: "#1F2933",
            mutedTextColor: "#667085",
            buttonBackgroundColor: "#163B5C",
            buttonTextColor: "#FFFFFF",
            buttonStyle: "OUTLINE",
            footerText: `${runId} updated footer`,
            borderRadius: 10,
            fontFamily: "Verdana",
          },
        })
        .expect(200);
      expect(updatedTheme.body).toMatchObject({
        id: createdThemeId,
        code: emailThemeCode,
        name: `${runId} Published Email Theme`,
        status: "PUBLISHED",
      });

      await request(app.getHttpServer())
        .patch(`/api/admin/email/templates/${template.id}`)
        .set(adminSessionHeader)
        .send({
          code: `${runId}_BROKEN_CODE`,
          channel: "SMS",
          subject: "Blocked update",
          body: "Blocked update",
          status: "PUBLISHED",
        })
        .expect(400);
      const unchanged = await prisma.notificationTemplate.findUniqueOrThrow({
        where: { id: template.id },
      });
      expect(unchanged).toMatchObject({ code: template.code, channel: NotificationChannel.EMAIL });

      const updated = await request(app.getHttpServer())
        .patch(`/api/admin/email/templates/${template.id}`)
        .set(adminSessionHeader)
        .send({
          name: `${runId} Updated email template`,
          category: "ORDER",
          subject: "Updated {{ customerName }}",
          body: "Order {{ orderNumber }} is ready.",
          status: "PUBLISHED",
          themeId: createdThemeId,
          styleOverrides: {
            brandColor: "#163B5C",
            footerText: `${runId} template footer`,
          },
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        code: template.code,
        name: `${runId} Updated email template`,
        category: "ORDER",
        channel: "EMAIL",
        subject: "Updated {{ customerName }}",
        body: "Order {{ orderNumber }} is ready.",
        status: "PUBLISHED",
        themeId: createdThemeId,
        styleOverrides: {
          brandColor: "#163B5C",
          footerText: `${runId} template footer`,
        },
      });
      const orderTemplates = await request(app.getHttpServer())
        .get("/api/admin/email/templates")
        .query({ category: "ORDER", search: runId })
        .set(adminSessionHeader)
        .expect(200);
      expect(orderTemplates.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: template.id })]),
      );

      const triggers = await request(app.getHttpServer())
        .get("/api/admin/email/triggers")
        .set(adminSessionHeader)
        .expect(200);
      const triggerItems = triggers.body as unknown as Array<{
        id: string;
        eventCode: string;
        recipientType: string;
        templateId: string | null;
        isEnabled: boolean;
        delayMinutes: number;
      }>;
      const customerRegisteredTrigger = triggerItems.find(
        (item: { eventCode: string; recipientType: string }) =>
          item.eventCode === "CUSTOMER_REGISTERED" && item.recipientType === "CUSTOMER",
      );
      if (!customerRegisteredTrigger) {
        throw new Error("CUSTOMER_REGISTERED email trigger was not created.");
      }
      triggerRestore = {
        id: customerRegisteredTrigger.id,
        templateId: customerRegisteredTrigger.templateId,
        isEnabled: customerRegisteredTrigger.isEnabled,
        delayMinutes: customerRegisteredTrigger.delayMinutes,
      };
      await request(app.getHttpServer())
        .patch(`/api/admin/email/triggers/${customerRegisteredTrigger.id}`)
        .set(adminSessionHeader)
        .send({
          templateId: template.id,
          isEnabled: true,
          delayMinutes: 0,
        })
        .expect(400);
      const updatedTrigger = await request(app.getHttpServer())
        .patch(`/api/admin/email/triggers/${customerRegisteredTrigger.id}`)
        .set(adminSessionHeader)
        .send({
          templateId: createdTemplateId,
          isEnabled: true,
          delayMinutes: 30,
        })
        .expect(200);
      expect(updatedTrigger.body).toMatchObject({
        eventCode: "CUSTOMER_REGISTERED",
        recipientType: "CUSTOMER",
        templateId: createdTemplateId,
        isEnabled: true,
        delayMinutes: 0,
      });
      await request(app.getHttpServer())
        .patch(`/api/admin/email/triggers/${customerRegisteredTrigger.id}`)
        .set(adminSessionHeader)
        .send({
          templateId: createdTemplateId,
          isEnabled: false,
          delayMinutes: 0,
        })
        .expect(200);

      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          eventCode: "CUSTOMER_REGISTERED",
          recipientType: EmailRecipientType.CUSTOMER,
          triggerRule: { connect: { id: customerRegisteredTrigger.id } },
        },
      });

      await apiRequest
        .put("/api/admin/email/settings/current")
        .set(adminSessionHeader)
        .send({
          provider: "smtp",
          senderName: `${runId} Email Desk`,
          senderEmail: `${runId}-sender@1handindia.test`,
          adminRecipients: `${runId}-ops@1handindia.test, ${runId}-support@1handindia.test`,
          isEnabled: true,
          providerConfig: {
            brevoApiKey: `${runId}-brevo-secret`,
            resendApiKey: "",
            sendgridApiKey: "",
            smtpHost: "smtp.1handindia.test",
            smtpPort: 587,
            smtpUsername: `${runId}-sender@1handindia.test`,
            smtpPassword: `${runId}-smtp-secret`,
            smtpSecure: false,
            smtpBridgeUrl: "",
          },
        })
        .expect(200);
      const emailSetting = await request(app.getHttpServer())
        .get("/api/admin/email/settings/current")
        .set(adminSessionHeader)
        .expect(200);
      expect(emailSetting.body).toMatchObject({
        provider: "smtp",
        senderName: `${runId} Email Desk`,
        senderEmail: `${runId}-sender@1handindia.test`,
        adminRecipients: `${runId}-ops@1handindia.test, ${runId}-support@1handindia.test`,
        isEnabled: true,
        providerConfig: {
          brevoApiKey: "",
          brevoApiKeyConfigured: true,
          resendApiKey: "",
          resendApiKeyConfigured: false,
          sendgridApiKey: "",
          sendgridApiKeyConfigured: false,
          smtpHost: "smtp.1handindia.test",
          smtpPort: 587,
          smtpUsername: `${runId}-sender@1handindia.test`,
          smtpPassword: "",
          smtpPasswordConfigured: true,
          smtpSecure: false,
          smtpBridgeUrl: "",
        },
      });

      const logs = await request(app.getHttpServer())
        .get("/api/admin/email/logs")
        .query({ templateCode: template.code, category: "ORDER", eventCode: "CUSTOMER_REGISTERED" })
        .set(adminSessionHeader)
        .expect(200);
      expect(logs.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: log.id,
            templateCode: template.code,
            eventCode: "CUSTOMER_REGISTERED",
            recipientType: "CUSTOMER",
          }),
        ]),
      );

      const overview = await request(app.getHttpServer())
        .get("/api/admin/email/overview")
        .set(adminSessionHeader)
        .expect(200);
      expect(overview.body).toMatchObject({
        pipelineMode: "IMMEDIATE",
        setting: {
          provider: "smtp",
          isEnabled: true,
          providerConfigured: true,
        },
        logs: {
          totals: {
            SKIPPED: expect.any(Number),
          },
          recent: {
            skipped: expect.arrayContaining([
              expect.objectContaining({
                id: log.id,
                templateCode: template.code,
                eventCode: "CUSTOMER_REGISTERED",
              }),
            ]),
          },
        },
        triggers: {
          enabled: expect.any(Number),
        },
      });

      smtpCreateTransportMock.mockClear();
      smtpSendMailMock.mockClear();
      const retried = await request(app.getHttpServer())
        .post(`/api/admin/email/logs/${log.id}/retry`)
        .set(adminSessionHeader)
        .expect(201);
      expect(retried.body).toMatchObject({
        id: log.id,
        status: "SENT",
        subject: "Updated Integration Customer",
      });
      expect(retried.body.body).toContain("<!doctype html>");
      expect(retried.body.body).toContain("Order 1HIEMAIL001 is ready.");
      expect(retried.body.body).toContain("#163B5C");
      expect(retried.body.body).toContain(`${runId} template footer`);
      expect(smtpCreateTransportMock).toHaveBeenCalledWith({
        host: "smtp.1handindia.test",
        port: 587,
        secure: false,
        auth: {
          user: `${runId}-sender@1handindia.test`,
          pass: `${runId}-smtp-secret`,
        },
      });

      await request(app.getHttpServer())
        .get("/api/admin/notifications")
        .set(adminSessionHeader)
        .expect(200);

      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "email.template.updated",
            entityId: template.id,
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "email.template.created",
            entityId: createdTemplateId,
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "email.trigger.updated",
            entityId: customerRegisteredTrigger.id,
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "email.theme.created",
            entityId: createdThemeId,
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "email.theme.updated",
            entityId: createdThemeId,
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
      await expect(
        prisma.auditLog.findFirstOrThrow({
          where: {
            action: "settings.email.updated",
            actorUserId: data.adminUser.id,
          },
        }),
      ).resolves.toBeTruthy();
    } finally {
      if (triggerRestore) {
        await prisma.emailTriggerRule.update({
          where: { id: triggerRestore.id },
          data: {
            isEnabled: triggerRestore.isEnabled,
            delayMinutes: triggerRestore.delayMinutes,
            ...(triggerRestore.templateId
              ? { template: { connect: { id: triggerRestore.templateId } } }
              : { template: { disconnect: true } }),
          },
        });
      }
      if (originalEmailSetting) {
        await prisma.emailSetting.update({
          where: { id: defaultEmailSettingId },
          data: {
            provider: originalEmailSetting.provider,
            senderName: originalEmailSetting.senderName,
            senderEmail: originalEmailSetting.senderEmail,
            adminRecipients: originalEmailSetting.adminRecipients,
            isEnabled: originalEmailSetting.isEnabled,
            providerConfig: originalEmailSetting.providerConfig ?? {},
          },
        });
      } else {
        await prisma.emailSetting.deleteMany({ where: { id: defaultEmailSettingId } });
      }
    }
  });

  it("allows only one order to be created from concurrent checkout submits for the same active cart", async () => {
    let orderNumber: string | undefined;

    try {
      await clearActiveCustomerCart(prisma, data.customer.id);
      await request(app.getHttpServer())
        .post("/api/cart/items")
        .set(authHeader(data.customerUser.id))
        .send({
          productVariantId: data.productVariant.id,
          quantity: 1,
        })
        .expect(201);

      const payload = {
        shippingAddress: {
          fullName: "1HandIndia Test Customer",
          phone: "9876543210",
          line1: "12 Test Market Road",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "MANUAL",
        buyerCountryCode: "IN",
        shippingPaise: 0,
      };

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post("/api/account/orders")
          .set(authHeader(data.customerUser.id))
          .send(payload),
        request(app.getHttpServer())
          .post("/api/account/orders")
          .set(authHeader(data.customerUser.id))
          .send(payload),
      ]);
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([201, 400]);
      orderNumber = responses.find((response) => response.status === 201)?.body.orderNumber as
        | string
        | undefined;
      expect(orderNumber).toBeTruthy();
    } finally {
      if (orderNumber) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${orderNumber}/cancel`)
          .set(authHeader(data.customerUser.id))
          .send({ note: "Reset stock after concurrent checkout assertion" });
      }
      await clearActiveCustomerCart(prisma, data.customer.id);
    }
  });

  it("prevents overselling when two customers concurrently checkout the last stock unit", async () => {
    const secondCustomerUser = await createUserWithRole(
      prisma,
      data.roles,
      RoleCode.CUSTOMER,
      `${runId}-stock-race-customer@1handindia.test`,
      "1HandIndia Stock Race Customer",
    );
    const secondCustomer = await prisma.customer.create({
      data: {
        userId: secondCustomerUser.id,
        displayName: "1HandIndia Stock Race Customer",
        status: UserStatus.ACTIVE,
        wishlist: {
          create: {},
        },
      },
    });
    const raceProduct = await prisma.product.create({
      data: {
        sellerId: data.seller.id,
        categoryId: data.category.id,
        name: `${runId} Race Stock Product`,
        slug: `${runId}-race-stock-product`,
        description: "Low-stock product used to prove checkout cannot oversell.",
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        searchText: `${runId} Race Stock Product low stock`,
        variants: {
          create: {
            sku: `${runId}-RACE-STOCK-SKU`,
            variantName: "Last Unit",
            pricePaise: 9000,
            stockQuantity: 1,
            status: VariantStatus.ACTIVE,
          },
        },
      },
      include: {
        variants: true,
      },
    });
    const raceVariant = raceProduct.variants[0]!;
    const checkoutActors = [
      { userId: data.customerUser.id, customerId: data.customer.id },
      { userId: secondCustomerUser.id, customerId: secondCustomer.id },
    ];
    let winningOrderNumber: string | undefined;
    let winningUserId: string | undefined;

    try {
      await Promise.all(
        checkoutActors.map(async (actor) => {
          await clearActiveCustomerCart(prisma, actor.customerId);
          await request(app.getHttpServer())
            .post("/api/cart/items")
            .set(authHeader(actor.userId))
            .send({
              productVariantId: raceVariant.id,
              quantity: 1,
            })
            .expect(201);
        }),
      );

      const payload = {
        shippingAddress: {
          fullName: "1HandIndia Test Customer",
          phone: "9876543210",
          line1: "12 Test Market Road",
          city: "Coimbatore",
          state: "Tamil Nadu",
          pincode: "641012",
        },
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        paymentMethod: "MANUAL",
        buyerCountryCode: "IN",
        shippingPaise: 0,
      };

      const responses = await Promise.all(
        checkoutActors.map((actor) =>
          request(app.getHttpServer())
            .post("/api/account/orders")
            .set(authHeader(actor.userId))
            .send(payload),
        ),
      );
      const statuses = responses.map((response) => response.status).sort();
      const successIndex = responses.findIndex((response) => response.status === 201);
      const failed = responses.find((response) => response.status === 400);
      const stockAfterCheckout = await prisma.productVariant.findUniqueOrThrow({
        where: { id: raceVariant.id },
      });

      expect(statuses).toEqual([201, 400]);
      expect(String(failed?.body.message ?? "")).toContain("Insufficient stock");
      expect(stockAfterCheckout.stockQuantity).toBe(0);
      winningOrderNumber = responses[successIndex]?.body.orderNumber as string | undefined;
      winningUserId = checkoutActors[successIndex]?.userId;
      expect(winningOrderNumber).toBeTruthy();
      expect(winningUserId).toBeTruthy();
    } finally {
      if (winningOrderNumber && winningUserId) {
        await request(app.getHttpServer())
          .patch(`/api/account/orders/${winningOrderNumber}/cancel`)
          .set(authHeader(winningUserId))
          .send({ note: "Reset stock after low-stock concurrency assertion" });
      }
      await Promise.all(
        checkoutActors.map((actor) => clearActiveCustomerCart(prisma, actor.customerId)),
      );
    }
  });

  it("runs seller product submission and admin product approval through the API", async () => {
    await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.customerUser.id))
      .send(createSellerProductPayload(data.category.id, data.customerUser.id))
      .expect(403);

    const submitted = await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send(createSellerProductPayload(data.category.id, data.sellerUser.id))
      .expect(201);
    expect(submitted.body).toMatchObject({
      name: `${runId} API Submitted Product`,
      status: ProductStatus.INACTIVE,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
    });

    const productId = submitted.body.id as string;
    const approved = await request(app.getHttpServer())
      .patch(`/api/admin/products/${productId}/approval`)
      .set(adminSessionHeader)
      .send({ decision: "APPROVE", note: "Integration test approval" })
      .expect(200);
    expect(approved.body).toMatchObject({
      id: productId,
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    const publicProducts = await request(app.getHttpServer())
      .get("/api/products")
      .query({ search: `${runId} API Submitted Product` })
      .expect(200);
    expect(publicProducts.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );
  });

  it("applies category HSN/GST defaults while keeping seller product tax override fields structured", async () => {
    const taxCategory = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set(adminSessionHeader)
      .send({
        name: `${runId} Audio Accessories`,
        status: CategoryStatus.ACTIVE,
        defaultHsnCode: "8518",
        defaultGstRatePercent: 18,
        defaultTaxDescription: "Bluetooth speakers and audio accessories.",
      })
      .expect(201);
    const categoryId = taxCategory.body.id as string;
    expect(taxCategory.body).toMatchObject({
      defaultHsnCode: "8518",
      defaultTaxDescription: "Bluetooth speakers and audio accessories.",
    });
    expect(Number(taxCategory.body.defaultGstRatePercent)).toBe(18);

    const suggestions = await request(app.getHttpServer())
      .get("/api/hsn-master")
      .query({ search: "Bluetooth", categoryId })
      .expect(200);
    expect(suggestions.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hsnCode: "8518",
          description: "Bluetooth speakers and audio accessories.",
        }),
      ]),
    );

    const attributesWithoutTax: Record<string, unknown> = { ...marketplaceEssentialAttributes() };
    delete attributesWithoutTax.hsnCode;
    delete attributesWithoutTax.gstRatePercent;
    const submitted = await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send({
        ...createDynamicProductPayload(categoryId, data.sellerUser.id, "category-tax-default"),
        attributes: attributesWithoutTax,
      })
      .expect(201);

    expect(submitted.body).toMatchObject({
      hsnCode: "8518",
      attributes: expect.objectContaining({
        hsnCode: "8518",
        gstRatePercent: 18,
      }),
    });
    expect(Number(submitted.body.gstRatePercent)).toBe(18);

    await request(app.getHttpServer())
      .patch(`/api/admin/products/${submitted.body.id as string}/approval`)
      .set(adminSessionHeader)
      .send({ decision: "APPROVE", note: "Category tax defaults verified" })
      .expect(200);
  });

  it("uses admin product templates to validate seller attributes dynamically", async () => {
    const templateCode = `${safeRunCode()}_MOBILE_TEMPLATE`;
    const template = await request(app.getHttpServer())
      .post("/api/admin/product-templates")
      .set(adminSessionHeader)
      .send({
        name: `${runId} Mobile Template`,
        code: templateCode,
        description: "Integration mobile template with product and variant attributes.",
        status: ProductTemplateStatus.ACTIVE,
        listingMode: ProductListingMode.CART_AND_ENQUIRY,
        sortOrder: 30,
        fields: [
          {
            label: "Brand",
            fieldKey: "brand",
            fieldType: ProductAttributeFieldType.SELECT,
            scope: ProductAttributeScope.PRODUCT,
            isRequired: true,
            options: ["Acme", "IndiPhone"],
            isFilterable: true,
            isSearchable: true,
            sortOrder: 10,
          },
          {
            label: "Storage",
            fieldKey: "storage",
            fieldType: ProductAttributeFieldType.SELECT,
            scope: ProductAttributeScope.VARIANT,
            isRequired: true,
            options: ["128GB", "256GB"],
            isFilterable: true,
            sortOrder: 20,
          },
          {
            label: "Color",
            fieldKey: "color",
            fieldType: ProductAttributeFieldType.TEXT,
            scope: ProductAttributeScope.VARIANT,
            isRequired: false,
            sortOrder: 30,
          },
        ],
      })
      .expect(201);
    const templateId = template.body.id as string;

    const category = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set(adminSessionHeader)
      .send({
        name: `${runId} Mobile Listings`,
        status: CategoryStatus.ACTIVE,
        productTemplateId: templateId,
      })
      .expect(201);
    const categoryId = category.body.id as string;
    expect(category.body).toMatchObject({ productTemplateId: templateId });

    await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send({
        ...createDynamicProductPayload(categoryId, data.sellerUser.id, "missing-brand"),
        attributes: {},
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send({
        ...createDynamicProductPayload(categoryId, data.sellerUser.id, "invalid-storage"),
        attributes: { brand: "Acme" },
        variants: [
          {
            sku: `${runId}-INVALID-STORAGE`,
            variantName: "512GB Blue",
            pricePaise: 2500000,
            stockQuantity: 4,
            status: VariantStatus.ACTIVE,
            attributes: { storage: "512GB", color: "Blue" },
          },
        ],
      })
      .expect(400);

    const submitted = await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send({
        ...createDynamicProductPayload(categoryId, data.sellerUser.id, "valid-mobile"),
        attributes: { brand: "Acme" },
        variants: [
          {
            sku: `${runId}-DYNAMIC-MOBILE-128`,
            variantName: "128GB Blue",
            pricePaise: 2400000,
            mrpPaise: 2800000,
            stockQuantity: 6,
            status: VariantStatus.ACTIVE,
            attributes: { storage: "128GB", color: "Blue" },
          },
        ],
      })
      .expect(201);

    expect(submitted.body).toMatchObject({
      listingMode: ProductListingMode.CART_AND_ENQUIRY,
      attributes: { brand: "Acme" },
      category: {
        productTemplate: {
          id: templateId,
          code: templateCode,
        },
      },
      variants: [expect.objectContaining({ attributes: { storage: "128GB", color: "Blue" } })],
    });
  });

  it("blocks enquiry-only product listings from cart operations", async () => {
    const template = await request(app.getHttpServer())
      .post("/api/admin/product-templates")
      .set(adminSessionHeader)
      .send({
        name: `${runId} Property Template`,
        code: `${safeRunCode()}_PROPERTY_TEMPLATE`,
        description: "Integration property template for enquiry-only listings.",
        status: ProductTemplateStatus.ACTIVE,
        listingMode: ProductListingMode.ENQUIRY_ONLY,
        fields: [
          {
            label: "Location",
            fieldKey: "location",
            fieldType: ProductAttributeFieldType.TEXT,
            scope: ProductAttributeScope.PRODUCT,
            isRequired: true,
            isFilterable: true,
            isSearchable: true,
            sortOrder: 10,
          },
          {
            label: "Area sqft",
            fieldKey: "areaSqft",
            fieldType: ProductAttributeFieldType.NUMBER,
            scope: ProductAttributeScope.PRODUCT,
            isRequired: true,
            sortOrder: 20,
          },
        ],
      })
      .expect(201);
    const templateId = template.body.id as string;

    const category = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set(adminSessionHeader)
      .send({
        name: `${runId} Property Listings`,
        status: CategoryStatus.ACTIVE,
        productTemplateId: templateId,
      })
      .expect(201);
    const categoryId = category.body.id as string;

    const submitted = await request(app.getHttpServer())
      .post("/api/seller/products")
      .set(authHeader(data.sellerUser.id))
      .send({
        ...createDynamicProductPayload(categoryId, data.sellerUser.id, "property"),
        name: `${runId} Enquiry Villa`,
        attributes: marketplaceEssentialAttributes({ location: "Salem", areaSqft: 1500 }),
        variants: [
          {
            sku: `${runId}-PROPERTY-BASE`,
            variantName: "Base listing",
            pricePaise: 750000000,
            stockQuantity: 1,
            status: VariantStatus.ACTIVE,
          },
        ],
      })
      .expect(201);
    expect(submitted.body).toMatchObject({ listingMode: ProductListingMode.ENQUIRY_ONLY });

    const submittedBody = submitted.body as { id: string; variants: Array<{ id: string }> };
    const variantId = submittedBody.variants[0]?.id;
    if (!variantId) {
      throw new Error("Enquiry-only product variant was not returned.");
    }
    await request(app.getHttpServer())
      .patch(`/api/admin/products/${submittedBody.id}/approval`)
      .set(adminSessionHeader)
      .send({ decision: "APPROVE", note: "Enquiry-only integration test approval" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/cart/items")
      .set(authHeader(data.customerUser.id))
      .send({ productVariantId: variantId, quantity: 1 })
      .expect(400);
  });

  it("runs B2B enquiry submission, seller ownership checks, seller response, and admin readback", async () => {
    await request(app.getHttpServer())
      .post("/api/b2b/enquiries")
      .set(authHeader(data.customerUser.id))
      .send({
        productId: data.product.id,
        quantity: 25,
        message: "Need a wholesale quotation for this integration test.",
      })
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/b2b/profile")
      .set(authHeader(data.customerUser.id))
      .expect(404);

    const customerB2BProfile = await request(app.getHttpServer())
      .patch("/api/b2b/profile")
      .set(authHeader(data.customerUser.id))
      .send({
        companyName: `${runId} Customer Buyer Company`,
        gstNumber: "33ABCDE1234F1Z5",
        contactName: "Customer B2B Prospect",
        contactPhone: "9876543211",
      })
      .expect(200);
    expect(customerB2BProfile.body).toMatchObject({
      companyName: `${runId} Customer Buyer Company`,
      status: UserStatus.ACTIVE,
    });

    const customerBuyerEnquiry = await request(app.getHttpServer())
      .post("/api/b2b/enquiries")
      .set(authHeader(data.customerUser.id))
      .send({
        productId: data.product.id,
        quantity: 10,
        message: "Need a customer-upgraded B2B quotation for this integration test.",
      })
      .expect(201);
    expect(customerBuyerEnquiry.body).toMatchObject({
      productId: data.product.id,
      sellerId: data.seller.id,
      status: B2BEnquiryStatus.SUBMITTED,
    });

    const enquiry = await request(app.getHttpServer())
      .post("/api/b2b/enquiries")
      .set(authHeader(data.businessBuyerUser.id))
      .send({
        productId: data.product.id,
        quantity: 25,
        message: "Need a wholesale quotation for this integration test.",
      })
      .expect(201);
    expect(enquiry.body).toMatchObject({
      productId: data.product.id,
      sellerId: data.seller.id,
      status: B2BEnquiryStatus.SUBMITTED,
    });

    const enquiryId = enquiry.body.id as string;
    await request(app.getHttpServer())
      .patch(`/api/b2b/enquiries/${enquiryId}/confirm`)
      .set(authHeader(data.businessBuyerUser.id))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/seller/b2b-enquiries/${enquiryId}/responses`)
      .set(authHeader(data.otherSellerUser.id))
      .send({
        responseMessage: "Wrong seller should not be able to answer.",
        quotedPricePaise: 11000,
      })
      .expect(404);

    const response = await request(app.getHttpServer())
      .post(`/api/seller/b2b-enquiries/${enquiryId}/responses`)
      .set(authHeader(data.sellerUser.id))
      .send({
        responseMessage: "We can supply this quantity for the requested test quotation.",
        quotedPricePaise: 10500,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      id: enquiryId,
      status: B2BEnquiryStatus.RESPONDED,
    });
    expect(response.body.responses).toEqual(
      expect.arrayContaining([expect.objectContaining({ quotedPricePaise: 10500 })]),
    );

    const confirmed = await request(app.getHttpServer())
      .patch(`/api/b2b/enquiries/${enquiryId}/confirm`)
      .set(authHeader(data.businessBuyerUser.id))
      .expect(200);
    expect(confirmed.body).toMatchObject({
      id: enquiryId,
      status: B2BEnquiryStatus.BUYER_CONFIRMED,
    });

    await request(app.getHttpServer())
      .post(`/api/seller/b2b-enquiries/${enquiryId}/responses`)
      .set(authHeader(data.sellerUser.id))
      .send({
        responseMessage: "Late response after buyer confirmation should be blocked.",
        quotedPricePaise: 10200,
      })
      .expect(400);

    const approvedEnquiry = await request(app.getHttpServer())
      .patch(`/api/admin/b2b-enquiries/${enquiryId}/approve`)
      .set(adminSessionHeader)
      .expect(200);
    expect(approvedEnquiry.body).toMatchObject({
      id: enquiryId,
      status: B2BEnquiryStatus.ADMIN_APPROVED,
    });

    await request(app.getHttpServer())
      .patch(`/api/b2b/enquiries/${enquiryId}/cancel`)
      .set(authHeader(data.businessBuyerUser.id))
      .expect(400);

    const finalisedEnquiry = await request(app.getHttpServer())
      .patch(`/api/admin/b2b-enquiries/${enquiryId}/finalise`)
      .set(adminSessionHeader)
      .expect(200);
    expect(finalisedEnquiry.body).toMatchObject({
      id: enquiryId,
      status: B2BEnquiryStatus.FINALISED,
    });

    await request(app.getHttpServer())
      .patch(`/api/admin/b2b-enquiries/${enquiryId}/status`)
      .set(adminSessionHeader)
      .send({ status: B2BEnquiryStatus.CANCELLED, note: "Finalised enquiries should stay locked." })
      .expect(400);

    const adminView = await request(app.getHttpServer())
      .get(`/api/admin/b2b-enquiries/${enquiryId}`)
      .set(adminSessionHeader)
      .expect(200);
    expect(adminView.body).toMatchObject({
      id: enquiryId,
      businessBuyerId: data.businessBuyer.id,
      status: B2BEnquiryStatus.FINALISED,
    });
  });

  it("verifies CMS, support, settings, reports, audit, payment, notification, and storage API boundaries", async () => {
    const cmsPage = await request(app.getHttpServer())
      .get(`/api/cms/pages/${data.cmsPage.slug}`)
      .expect(200);
    expect(cmsPage.body).toMatchObject({
      slug: data.cmsPage.slug,
      status: ContentStatus.PUBLISHED,
    });

    const draftBanner = await request(app.getHttpServer())
      .post("/api/admin/cms/banners")
      .set(adminSessionHeader)
      .send({
        title: `${runId} Draft Homepage Banner`,
        subtitle: "Draft banners should stay hidden from the storefront feed.",
        imageUrl: "indihub/cms/draft-homepage-banner.jpg",
        linkUrl: "/categories",
        status: ContentStatus.DRAFT,
        sortOrder: 1,
      })
      .expect(201);

    const futureBanner = await request(app.getHttpServer())
      .post("/api/admin/cms/banners")
      .set(adminSessionHeader)
      .send({
        title: `${runId} Future Homepage Banner`,
        subtitle: "Future banners should stay hidden until the start date.",
        imageUrl: "indihub/cms/future-homepage-banner.jpg",
        linkUrl: "/stores",
        status: ContentStatus.PUBLISHED,
        sortOrder: 1,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const expiredBanner = await request(app.getHttpServer())
      .post("/api/admin/cms/banners")
      .set(adminSessionHeader)
      .send({
        title: `${runId} Expired Homepage Banner`,
        subtitle: "Expired banners should stay hidden from the storefront feed.",
        imageUrl: "indihub/cms/expired-homepage-banner.jpg",
        linkUrl: "/b2b",
        status: ContentStatus.PUBLISHED,
        sortOrder: 1,
        endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const publishedBanner = await request(app.getHttpServer())
      .post("/api/admin/cms/banners")
      .set(adminSessionHeader)
      .send({
        title: `${runId} Published Homepage Banner`,
        subtitle: "Published banners should power the storefront hero.",
        imageUrl: "indihub/cms/published-homepage-banner.jpg",
        linkUrl: `/categories/${data.category.slug}`,
        eyebrow: "Local stores",
        ctaLabel: "Explore category",
        secondaryCtaLabel: "Browse stores",
        secondaryLinkUrl: "/stores",
        mobileImageUrl: "indihub/cms/published-homepage-banner-mobile.jpg",
        imageAlt: "Featured products from approved sellers",
        textPosition: "CENTER",
        status: ContentStatus.PUBLISHED,
        sortOrder: 2,
      })
      .expect(201);
    expect(publishedBanner.body).toMatchObject({
      title: `${runId} Published Homepage Banner`,
      status: ContentStatus.PUBLISHED,
      imageUrl: "indihub/cms/published-homepage-banner.jpg",
      linkUrl: `/categories/${data.category.slug}`,
      eyebrow: "Local stores",
      ctaLabel: "Explore category",
      secondaryCtaLabel: "Browse stores",
      secondaryLinkUrl: "/stores",
      mobileImageUrl: "indihub/cms/published-homepage-banner-mobile.jpg",
      imageAlt: "Featured products from approved sellers",
      textPosition: "CENTER",
    });

    const publicBanners = await request(app.getHttpServer()).get("/api/cms/banners").expect(200);
    const publicBannerItems = publicBanners.body as unknown as Array<{
      id: string;
      title: string;
      status: ContentStatus;
      ctaLabel?: string;
      textPosition?: string;
    }>;
    expect(publicBannerItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedBanner.body.id,
          title: `${runId} Published Homepage Banner`,
          status: ContentStatus.PUBLISHED,
          ctaLabel: "Explore category",
          textPosition: "CENTER",
        }),
      ]),
    );
    expect(publicBannerItems.some((banner) => banner.id === draftBanner.body.id)).toBe(false);
    expect(publicBannerItems.some((banner) => banner.id === futureBanner.body.id)).toBe(false);
    expect(publicBannerItems.some((banner) => banner.id === expiredBanner.body.id)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/admin/cms/banners/${publishedBanner.body.id}`)
      .set(adminSessionHeader)
      .send({ title: `${runId} Updated Homepage Banner`, ctaLabel: "Shop now" })
      .expect(200);
    const updatedPublicBanners = await request(app.getHttpServer())
      .get("/api/cms/banners")
      .expect(200);
    expect(updatedPublicBanners.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedBanner.body.id,
          title: `${runId} Updated Homepage Banner`,
          ctaLabel: "Shop now",
        }),
      ]),
    );

    const draftHomepageSection = await request(app.getHttpServer())
      .post("/api/admin/cms/homepage-sections")
      .set(adminSessionHeader)
      .send({
        sectionType: "featured_categories",
        title: `${runId} Draft Homepage Categories`,
        status: ContentStatus.DRAFT,
        config: {
          items: [
            {
              sourceType: "category",
              sourceId: data.category.id,
              label: data.category.name,
              linkUrl: `/categories/${data.category.slug}`,
            },
          ],
        },
      })
      .expect(201);

    const publishedHomepageSection = await request(app.getHttpServer())
      .post("/api/admin/cms/homepage-sections")
      .set(adminSessionHeader)
      .send({
        sectionType: "featured_categories",
        title: `${runId} Published Homepage Categories`,
        status: ContentStatus.PUBLISHED,
        sortOrder: 3,
        config: {
          eyebrow: "Shop by category",
          subtitle: "Admin-selected categories should appear on the storefront.",
          items: [
            {
              sourceType: "category",
              sourceId: data.category.id,
              slug: data.category.slug,
              label: data.category.name,
              description: "Integration category",
              linkUrl: `/categories/${data.category.slug}`,
            },
          ],
        },
      })
      .expect(201);
    expect(publishedHomepageSection.body).toMatchObject({
      title: `${runId} Published Homepage Categories`,
      status: ContentStatus.PUBLISHED,
      config: {
        items: [
          expect.objectContaining({
            sourceType: "category",
            sourceId: data.category.id,
            label: data.category.name,
            linkUrl: `/categories/${data.category.slug}`,
          }),
        ],
      },
    });

    const publicHomepageSections = await request(app.getHttpServer())
      .get("/api/cms/homepage-sections")
      .expect(200);
    const publicHomepageSectionItems = publicHomepageSections.body as unknown as Array<{
      id: string;
      title: string;
      status: ContentStatus;
    }>;
    expect(publicHomepageSectionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedHomepageSection.body.id,
          title: `${runId} Published Homepage Categories`,
          status: ContentStatus.PUBLISHED,
        }),
      ]),
    );
    expect(
      publicHomepageSectionItems.some((section) => section.id === draftHomepageSection.body.id),
    ).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/admin/cms/homepage-sections/${publishedHomepageSection.body.id}`)
      .set(adminSessionHeader)
      .send({ title: `${runId} Updated Homepage Categories` })
      .expect(200);
    const updatedPublicHomepageSections = await request(app.getHttpServer())
      .get("/api/cms/homepage-sections")
      .expect(200);
    expect(updatedPublicHomepageSections.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedHomepageSection.body.id,
          title: `${runId} Updated Homepage Categories`,
        }),
      ]),
    );

    const manualDealProduct = await prisma.product.create({
      data: {
        sellerId: data.seller.id,
        categoryId: data.category.id,
        name: `${runId} Admin Selected Deal Product`,
        slug: `${runId}-admin-selected-deal-product`,
        description: "Non-discounted product manually promoted through the admin flash sale.",
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        searchText: `${runId} admin selected flash sale`,
        images: {
          create: {
            url: "indihub/products/admin-selected-deal.jpg",
            altText: "Admin selected flash sale product",
            isPrimary: true,
          },
        },
        variants: {
          create: {
            sku: `${runId}-ADMIN-DEAL-SKU`,
            variantName: "Flash Sale Pack",
            pricePaise: 9900,
            stockQuantity: 5,
            status: VariantStatus.ACTIVE,
          },
        },
      },
    });

    const activeDealSection = await request(app.getHttpServer())
      .post("/api/admin/cms/homepage-sections")
      .set(adminSessionHeader)
      .send({
        sectionType: "deal_strip",
        title: `${runId} Admin Flash Sale`,
        status: ContentStatus.PUBLISHED,
        sortOrder: 0,
        config: {
          subtitle: "Admin-selected sale products should lead the storefront flash sale.",
          ctaLabel: "View all deals",
          ctaUrl: "/deals",
          endsAt: new Date(Date.now() + 86_400_000).toISOString(),
          items: [
            {
              sourceType: "product",
              sourceId: manualDealProduct.id,
              slug: manualDealProduct.slug,
              label: manualDealProduct.name,
              badge: "52",
              linkUrl: `/products/${manualDealProduct.slug}`,
            },
          ],
        },
      })
      .expect(201);

    const productSeo = await request(app.getHttpServer())
      .post("/api/admin/cms/seo")
      .set(adminSessionHeader)
      .send({
        entityType: SeoEntityType.PRODUCT,
        entityId: data.product.id,
        routePath: `/products/${data.product.slug}`,
        metaTitle: `${runId} Approved Product Online | 1HandIndia`,
        metaDescription:
          "Buy the approved integration product from verified marketplace sellers with clear pricing, availability, and order tracking on 1HandIndia.",
        canonicalUrl: `https://www.1handindia.com/products/${data.product.slug}`,
        robotsDirective: "index,follow",
        ogTitle: `${runId} Approved Product`,
        ogDescription: "Verified seller product detail page for marketplace SEO.",
        ogImageUrl: "indihub/seo/approved-product.jpg",
        focusKeyword: "approved integration product",
        structuredDataType: "Product",
        status: ContentStatus.PUBLISHED,
      })
      .expect(201);
    expect(productSeo.body).toMatchObject({
      entityType: SeoEntityType.PRODUCT,
      entityId: data.product.id,
      routePath: `/products/${data.product.slug}`,
      status: ContentStatus.PUBLISHED,
    });
    expect(productSeo.body.seoScore).toBeGreaterThanOrEqual(70);

    await request(app.getHttpServer())
      .post("/api/admin/cms/seo")
      .set(adminSessionHeader)
      .send({
        entityType: SeoEntityType.PRODUCT,
        entityId: data.product.id,
        routePath: `/products/${data.product.slug}`,
        metaTitle: "Duplicate product SEO",
        status: ContentStatus.DRAFT,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/admin/cms/seo")
      .set(adminSessionHeader)
      .send({
        entityType: SeoEntityType.CUSTOM_ROUTE,
        routePath: `/products/${data.product.slug}`,
        metaTitle: `${runId} Conflicting Route SEO`,
        status: ContentStatus.DRAFT,
      })
      .expect(409);

    const resolvedSeo = await request(app.getHttpServer())
      .get(`/api/cms/seo/resolve?entityType=${SeoEntityType.PRODUCT}&entityId=${data.product.id}`)
      .expect(200);
    expect(resolvedSeo.body).toMatchObject({
      id: productSeo.body.id,
      metaTitle: `${runId} Approved Product Online | 1HandIndia`,
    });

    const redirect = await request(app.getHttpServer())
      .post("/api/admin/cms/redirects")
      .set(adminSessionHeader)
      .send({
        sourcePath: `/${runId}-old-product`,
        targetPath: `/products/${data.product.slug}`,
        statusCode: 301,
        enabled: true,
      })
      .expect(201);
    expect(redirect.body).toMatchObject({
      sourcePath: `/${runId}-old-product`,
      targetPath: `/products/${data.product.slug}`,
      statusCode: 301,
      enabled: true,
    });

    await request(app.getHttpServer())
      .post("/api/admin/cms/redirects")
      .set(adminSessionHeader)
      .send({
        sourcePath: `/${runId}-loop`,
        targetPath: `/${runId}-loop`,
        statusCode: 301,
      })
      .expect(400);

    const media = await request(app.getHttpServer())
      .post("/api/admin/cms/media")
      .set(adminSessionHeader)
      .send({
        title: `${runId} Product SEO OG`,
        url: "indihub/seo/approved-product.jpg",
        publicId: "indihub/test/approved-product",
        mediaType: "image",
        altText: "Approved product SEO image",
        usageContext: "product-seo",
        width: 1200,
        height: 630,
      })
      .expect(201);
    expect(media.body).toMatchObject({
      title: `${runId} Product SEO OG`,
      altText: "Approved product SEO image",
      usageContext: "product-seo",
    });

    const menuItem = await request(app.getHttpServer())
      .post("/api/admin/cms/menus")
      .set(adminSessionHeader)
      .send({
        area: "header",
        label: `${runId} Stores`,
        href: "/stores",
        status: ContentStatus.PUBLISHED,
        sortOrder: 50,
      })
      .expect(201);
    expect(menuItem.body).toMatchObject({
      label: `${runId} Stores`,
      href: "/stores",
      status: ContentStatus.PUBLISHED,
    });

    const childMenuItem = await request(app.getHttpServer())
      .post("/api/admin/cms/menus")
      .set(adminSessionHeader)
      .send({
        area: "header",
        label: `${runId} Store approvals`,
        href: "/stores/approved",
        parentId: menuItem.body.id,
        status: ContentStatus.PUBLISHED,
        sortOrder: 10,
      })
      .expect(201);
    expect(childMenuItem.body).toMatchObject({
      parentId: menuItem.body.id,
      label: `${runId} Store approvals`,
    });

    const publicMenus = await request(app.getHttpServer())
      .get("/api/cms/menus?area=header")
      .expect(200);
    expect(publicMenus.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: menuItem.body.id,
          children: expect.arrayContaining([
            expect.objectContaining({ id: childMenuItem.body.id }),
          ]),
        }),
      ]),
    );
    expect(publicMenus.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: childMenuItem.body.id })]),
    );

    const storefrontHome = await request(app.getHttpServer())
      .get("/api/storefront/home")
      .query({
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-CBE",
        localAreaCode: "IN-TN-CBE-RS",
        limit: "4",
      })
      .expect(200);
    const storefrontHomeBody = storefrontHome.body as {
      banners: Array<{ id: string; title: string }>;
      homepageSections: Array<{ id: string; title: string }>;
      categories: Array<{ id: string; _count?: { products?: number } }>;
      storesNearYou: Array<{
        id: string;
        locationMatchLevel: string;
        _count?: { products?: number };
      }>;
      productRails: {
        featured: Array<{ id: string }>;
        latest: Array<{ id: string }>;
        deals: Array<{ id: string }>;
      };
      stats: Record<string, number>;
      menus: {
        header: Array<{ id: string; children?: Array<{ id: string }> }>;
      };
    };
    expect(storefrontHomeBody.banners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedBanner.body.id,
          title: `${runId} Updated Homepage Banner`,
        }),
      ]),
    );
    expect(storefrontHomeBody.banners.some((banner) => banner.id === draftBanner.body.id)).toBe(
      false,
    );
    expect(storefrontHomeBody.banners.some((banner) => banner.id === futureBanner.body.id)).toBe(
      false,
    );
    expect(storefrontHomeBody.banners.some((banner) => banner.id === expiredBanner.body.id)).toBe(
      false,
    );
    expect(storefrontHomeBody.homepageSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedHomepageSection.body.id,
          title: `${runId} Updated Homepage Categories`,
        }),
        expect.objectContaining({
          id: activeDealSection.body.id,
          title: `${runId} Admin Flash Sale`,
        }),
      ]),
    );
    expect(
      storefrontHomeBody.homepageSections.some(
        (section) => section.id === draftHomepageSection.body.id,
      ),
    ).toBe(false);
    const liveHomeCategory = storefrontHomeBody.categories.find(
      (category) => category.id === data.category.id,
    );
    expect(liveHomeCategory?._count?.products ?? 0).toBeGreaterThanOrEqual(1);
    const nearbyHomeStore = storefrontHomeBody.storesNearYou.find(
      (store) => store.id === data.seller.id,
    );
    expect(nearbyHomeStore).toMatchObject({
      locationMatchLevel: "LOCAL_AREA",
    });
    expectPublicStorePayloadSafe(nearbyHomeStore);
    expect(nearbyHomeStore?._count?.products ?? 0).toBeGreaterThanOrEqual(1);
    expect(storefrontHomeBody.productRails.latest).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: data.product.id })]),
    );
    expect(storefrontHomeBody.productRails.deals).toEqual([
      expect.objectContaining({ id: manualDealProduct.id, campaignBadge: "52" }),
    ]);
    const storefrontDeals = await request(app.getHttpServer())
      .get("/api/storefront/deals")
      .query({ limit: "8" })
      .expect(200);
    expect(storefrontDeals.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 8,
      items: [expect.objectContaining({ id: manualDealProduct.id, campaignBadge: "52" })],
    });
    expect(storefrontHomeBody.stats).toEqual(
      expect.objectContaining({
        liveProducts: expect.any(Number),
        approvedStores: expect.any(Number),
        activeCustomers: expect.any(Number),
        activeCategories: expect.any(Number),
        verifiedSellers: expect.any(Number),
        verifiedSellerPercent: expect.any(Number),
      }),
    );
    expect(storefrontHomeBody.menus.header).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: menuItem.body.id,
          children: expect.arrayContaining([
            expect.objectContaining({ id: childMenuItem.body.id }),
          ]),
        }),
      ]),
    );

    const sitemap = await request(app.getHttpServer())
      .get("/api/admin/cms/sitemap")
      .set(adminSessionHeader)
      .expect(200);
    expect(sitemap.body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/seller/register", source: "seller_landing" }),
        expect.objectContaining({ path: "/b2b/register", source: "b2b_landing" }),
        expect.objectContaining({ path: "/contact", source: "support_landing" }),
        expect.objectContaining({ path: `/products/${data.product.slug}`, source: "product" }),
        expect.objectContaining({ path: `/categories/${data.category.slug}`, source: "category" }),
      ]),
    );
    expect(sitemap.body.excludedRoutePrefixes).toEqual(
      expect.arrayContaining(["/admin", "/account", "/checkout"]),
    );
    const sitemapPaths = (sitemap.body.entries as Array<{ path: string }>).map(
      (entry) => entry.path,
    );
    expect(sitemapPaths).not.toContain("/admin");
    expect(sitemapPaths.some((path) => path.startsWith("/b2b/enquiries"))).toBe(false);
    expect(sitemapPaths.some((path) => path.startsWith("/seller/orders"))).toBe(false);

    const revisions = await request(app.getHttpServer())
      .get(`/api/admin/cms/revisions?entityType=seo_entry&entityId=${productSeo.body.id}`)
      .set(adminSessionHeader)
      .expect(200);
    expect(revisions.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: "seo_entry",
          entityId: productSeo.body.id,
          action: "created",
        }),
      ]),
    );

    const support = await request(app.getHttpServer())
      .post("/api/support-requests")
      .send({
        name: "Integration Support User",
        email: `${runId}-support@1handindia.test`,
        phone: "9876543210",
        subject: "Integration support request",
        message: "This public support request verifies the backend support API.",
      })
      .expect(201);
    expect(support.body).toMatchObject({ subject: "Integration support request" });

    await request(app.getHttpServer())
      .get("/api/admin/settings")
      .set(authHeader(data.customerUser.id))
      .expect(401);

    await request(app.getHttpServer())
      .get("/api/admin/support-requests")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/settings")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/reports")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/audit-logs")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/notifications")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/admin/payments/readiness")
      .set(adminSessionHeader)
      .expect(200);
    await request(app.getHttpServer())
      .patch("/api/admin/payments/config")
      .set(adminSessionHeader)
      .send({
        razorpay: {
          enabled: false,
          mode: "TEST",
          keyId: `${runId}_rzp_key`,
          keySecret: `${runId}_rzp_secret`,
          webhookSecret: `${runId}_webhook_secret`,
        },
        cod: {
          enabled: true,
          instructions: "Collect cash on delivery.",
          maxOrderPaise: 500000,
        },
        bankTransfer: { enabled: false },
        manual: { enabled: true },
      })
      .expect(200);
    const paymentConfig = await request(app.getHttpServer())
      .get("/api/admin/payments/config")
      .set(adminSessionHeader)
      .expect(200);
    expect(paymentConfig.body).toMatchObject({
      razorpay: {
        enabled: false,
        configured: true,
        keySecretConfigured: true,
        webhookSecretConfigured: true,
      },
      cod: {
        enabled: true,
        maxOrderPaise: 500000,
      },
    });
    expect(JSON.stringify(paymentConfig.body)).not.toContain(`${runId}_rzp_secret`);
    expect(JSON.stringify(paymentConfig.body)).not.toContain(`${runId}_webhook_secret`);
    const settings = await request(app.getHttpServer())
      .get("/api/admin/settings?group=payments")
      .set(adminSessionHeader)
      .expect(200);
    expect(JSON.stringify(settings.body)).not.toContain(`${runId}_rzp_secret`);
    const genericSettingsRequest = request(app.getHttpServer()) as ReturnType<typeof request> & {
      put: (url: string) => ReturnType<ReturnType<typeof request>["patch"]>;
    };
    const genericSecretSetting = await genericSettingsRequest
      .put(`/api/admin/settings/${runId}.temporary_secret`)
      .set(adminSessionHeader)
      .send({
        value: `${runId}_raw_secret`,
        valueType: SettingValueType.STRING,
        group: "payments",
      })
      .expect(200);
    expect(genericSecretSetting.body.value).toBe("[secret configured]");
    expect(JSON.stringify(genericSecretSetting.body)).not.toContain(`${runId}_raw_secret`);
    await request(app.getHttpServer())
      .patch("/api/admin/payments/config")
      .set(adminSessionHeader)
      .send({
        razorpay: {
          enabled: false,
          keyId: "",
          clearKeySecret: true,
          clearWebhookSecret: true,
        },
        cod: {
          enabled: false,
          instructions: "Pay cash to the delivery partner when the order is delivered.",
          maxOrderPaise: 0,
        },
        bankTransfer: { enabled: false },
        manual: { enabled: true },
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch("/api/storage/configuration")
      .set(adminSessionHeader)
      .send({
        publicImages: {
          provider: "IMAGEKIT",
          baseUrl: `https://ik.imagekit.io/${runId}-images`,
          imageKit: {
            publicKey: `${runId}_imagekit_public_key`,
            privateKey: `${runId}_imagekit_private_key`,
          },
        },
        privateStorage: {
          enabled: true,
          endpoint: "https://s3.example.test",
          region: "ap-south-1",
          bucket: `${runId}-private-documents`,
          accessKeyId: `${runId}_s3_access_key`,
          secretAccessKey: `${runId}_s3_secret`,
        },
      })
      .expect(200);
    const storageConfig = await request(app.getHttpServer())
      .get("/api/storage/configuration")
      .set(adminSessionHeader)
      .expect(200);
    expect(storageConfig.body).toMatchObject({
      publicImages: {
        provider: "IMAGEKIT",
        configured: true,
        baseUrl: `https://ik.imagekit.io/${runId}-images`,
        imageKit: {
          configured: true,
          publicKeyConfigured: true,
          privateKeyConfigured: true,
        },
      },
      privateStorage: {
        enabled: true,
        configured: true,
        bucket: `${runId}-private-documents`,
        accessKeyIdConfigured: true,
        secretAccessKeyConfigured: true,
      },
    });
    expect(JSON.stringify(storageConfig.body)).not.toContain(`${runId}_imagekit_private_key`);
    expect(JSON.stringify(storageConfig.body)).not.toContain(`${runId}_s3_secret`);
    const storageReadiness = await request(app.getHttpServer())
      .get("/api/storage/readiness")
      .set(adminSessionHeader)
      .expect(200);
    expect(storageReadiness.body).toMatchObject({
      publicImages: {
        provider: "IMAGEKIT",
        configured: true,
      },
      privateStorage: {
        enabled: true,
        configured: true,
        bucket: `${runId}-private-documents`,
      },
    });
    const sellerPublicImageUpload = await request(app.getHttpServer())
      .post("/api/storage/public-image/upload-request")
      .set(authHeader(data.sellerUser.id))
      .send({
        purpose: "SELLER_PRODUCT_IMAGE",
        fileName: "product.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);
    expect(sellerPublicImageUpload.body).toMatchObject({
      provider: "imagekit",
      urlEndpoint: `https://ik.imagekit.io/${runId}-images`,
      publicKey: `${runId}_imagekit_public_key`,
      folder: `indihub/sellers/${data.sellerUser.id}/products`,
    });
    await request(app.getHttpServer())
      .get("/api/storage/readiness")
      .set(authHeader(data.sellerUser.id))
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/storage/configuration")
      .set(authHeader(data.sellerUser.id))
      .expect(401);
  });
});

function authHeader(userId: string) {
  return { "x-indihub-user-id": userId };
}

function bearerAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function parseDeliveryTrackingReference(value: string) {
  const match = /^1HI-DEL-(\d{8})-(\d{6})$/.exec(value);
  expect(match).not.toBeNull();
  return {
    dateKey: match?.[1] ?? "",
    sequence: Number(match?.[2] ?? "0"),
  };
}

async function clearActiveCustomerCart(prisma: PrismaClient, customerId: string) {
  const activeCarts = await prisma.cart.findMany({
    where: {
      customerId,
      status: CartStatus.ACTIVE,
    },
    select: { id: true },
  });
  const cartIds = activeCarts.map((cart) => cart.id);

  if (cartIds.length) {
    await prisma.cartItem.deleteMany({
      where: {
        cartId: { in: cartIds },
      },
    });
  }
}

async function setCheckoutPlatformFeeSettings(
  prisma: PrismaClient,
  settings: {
    enabled: boolean;
    type: "PERCENTAGE" | "FIXED" | "MANUAL";
    valueBps: number;
    fixedPaise: number;
    shippingPaise: number;
  },
) {
  await upsertSettingValue(
    prisma,
    "shipping.default_charge_paise",
    "shipping",
    SettingValueType.NUMBER,
    settings.shippingPaise,
  );
  await upsertSettingValue(
    prisma,
    "checkout.platform_fee.enabled",
    "checkout",
    SettingValueType.BOOLEAN,
    settings.enabled,
  );
  await upsertSettingValue(
    prisma,
    "checkout.platform_fee.type",
    "checkout",
    SettingValueType.STRING,
    settings.type,
  );
  await upsertSettingValue(
    prisma,
    "checkout.platform_fee.value_bps",
    "checkout",
    SettingValueType.NUMBER,
    settings.valueBps,
  );
  await upsertSettingValue(
    prisma,
    "checkout.platform_fee.fixed_paise",
    "checkout",
    SettingValueType.NUMBER,
    settings.fixedPaise,
  );
}

async function setCheckoutPaymentFlowSettings(
  prisma: PrismaClient,
  settings: {
    codEnabled: boolean;
    codMaxOrderPaise: number;
    codInstructions: string;
    razorpayEnabled: boolean;
    razorpayKeyId: string;
    razorpayKeySecret: string;
    bankTransferEnabled: boolean;
    manualEnabled: boolean;
  },
) {
  await upsertSettingValue(
    prisma,
    "checkout.cod.enabled",
    "checkout",
    SettingValueType.BOOLEAN,
    settings.codEnabled,
  );
  await upsertSettingValue(
    prisma,
    "payments.cod.max_order_paise",
    "payments",
    SettingValueType.NUMBER,
    settings.codMaxOrderPaise,
  );
  await upsertSettingValue(
    prisma,
    "payments.cod.instructions",
    "payments",
    SettingValueType.STRING,
    settings.codInstructions,
  );
  await upsertSettingValue(
    prisma,
    "payments.razorpay.enabled",
    "payments",
    SettingValueType.BOOLEAN,
    settings.razorpayEnabled,
  );
  await upsertSettingValue(
    prisma,
    "payments.razorpay.mode",
    "payments",
    SettingValueType.STRING,
    "TEST",
  );
  await upsertSettingValue(
    prisma,
    "payments.razorpay.key_id",
    "payments",
    SettingValueType.STRING,
    settings.razorpayKeyId,
  );
  await upsertSettingValue(
    prisma,
    "payments.razorpay.key_secret",
    "payments",
    SettingValueType.STRING,
    settings.razorpayKeySecret,
  );
  await upsertSettingValue(
    prisma,
    "payments.bank_transfer.enabled",
    "payments",
    SettingValueType.BOOLEAN,
    settings.bankTransferEnabled,
  );
  await upsertSettingValue(
    prisma,
    "payments.manual.enabled",
    "payments",
    SettingValueType.BOOLEAN,
    settings.manualEnabled,
  );
}

async function upsertSettingValue(
  prisma: PrismaClient,
  key: string,
  group: string,
  valueType: SettingValueType,
  value: boolean | number | string,
) {
  await prisma.setting.upsert({
    where: { key },
    update: {
      value,
      valueType,
      group,
    },
    create: {
      key,
      value,
      valueType,
      group,
    },
  });
}

function createSellerProductPayload(categoryId: string, sellerUserId: string) {
  return {
    categoryId,
    name: `${runId} API Submitted Product`,
    description: "A seller-submitted product created by the backend integration test.",
    attributes: marketplaceEssentialAttributes(),
    images: [
      {
        url: `indihub/sellers/${sellerUserId}/products/integration-product.jpg`,
        altText: "Integration product",
      },
    ],
    variants: [
      {
        sku: `${runId}-SUBMITTED-SKU`,
        variantName: "Default Pack",
        pricePaise: 15000,
        mrpPaise: 18000,
        stockQuantity: 8,
        status: VariantStatus.ACTIVE,
      },
    ],
  };
}

function createDynamicProductPayload(categoryId: string, sellerUserId: string, suffix: string) {
  return {
    categoryId,
    name: `${runId} Dynamic ${suffix}`,
    description: "A seller-submitted dynamic product created by the backend integration test.",
    attributes: {},
    images: [
      {
        url: `indihub/sellers/${sellerUserId}/products/${suffix}.jpg`,
        altText: `${suffix} integration product`,
      },
    ],
    variants: [
      {
        sku: `${runId}-${suffix}-SKU`,
        variantName: "Default option",
        pricePaise: 15000,
        stockQuantity: 3,
        status: VariantStatus.ACTIVE,
        attributes: {},
      },
    ],
  };
}

function marketplaceEssentialAttributes(overrides: Record<string, unknown> = {}) {
  return {
    brand: "1HandIndia",
    condition: "New",
    unitOfMeasure: "Pack",
    gstRatePercent: 5,
    hsnCode: "100630",
    returnEligibility: "Returnable",
    packageWeightGrams: 500,
    ...overrides,
  };
}

function safeRunCode() {
  return runId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

async function seedIntegrationData(prisma: PrismaClient) {
  await seedIntegrationLocations(prisma);

  const roles = await ensureRoles(prisma);
  const adminUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.ADMIN,
    adminEmail,
    "1HandIndia Test Admin",
  );
  const financeUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.FINANCE,
    financeEmail,
    "1HandIndia Test Finance",
  );
  const financePasswordHash = await hashAdminPassword(financePassword);
  await prisma.adminCredential.create({
    data: {
      userId: financeUser.id,
      passwordHash: financePasswordHash.hash,
      passwordSalt: financePasswordHash.salt,
      passwordAlgorithm: "scrypt",
    },
  });
  const customerUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.CUSTOMER,
    `${runId}-customer@1handindia.test`,
    "1HandIndia Test Customer",
  );
  const sellerUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.SELLER,
    `${runId}-seller@1handindia.test`,
    "1HandIndia Test Seller",
  );
  const otherSellerUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.SELLER,
    `${runId}-other-seller@1handindia.test`,
    "1HandIndia Other Seller",
  );
  const businessBuyerUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.BUSINESS_BUYER,
    `${runId}-buyer@1handindia.test`,
    "1HandIndia B2B Buyer",
  );
  const deliveryPartnerUser = await createUserWithRole(
    prisma,
    roles,
    RoleCode.DELIVERY_PARTNER,
    `${runId}-delivery@1handindia.test`,
    "1HandIndia Delivery Partner",
  );
  await prisma.deliveryPartnerProfile.create({
    data: {
      userId: deliveryPartnerUser.id,
      phone: "9876543210",
      vehicleNumber: "TN 30 IH 1001",
      isAvailable: true,
      serviceCountryCode: "IN",
      servicePincodes: ["641012", "636304"],
      codCashLimitPaise: 500000,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      userId: customerUser.id,
      displayName: "1HandIndia Test Customer",
      status: UserStatus.ACTIVE,
      wishlist: {
        create: {},
      },
    },
  });

  const seller = await createApprovedSeller(
    prisma,
    sellerUser.id,
    `${runId} Seller Store`,
    `${runId}-seller-store`,
  );
  const otherSeller = await createApprovedSeller(
    prisma,
    otherSellerUser.id,
    `${runId} Other Seller Store`,
    `${runId}-other-seller-store`,
  );

  const businessBuyer = await prisma.businessBuyer.create({
    data: {
      userId: businessBuyerUser.id,
      companyName: `${runId} Buyer Company`,
      gstNumber: "29ABCDE1234F1Z5",
      contactName: "1HandIndia B2B Buyer",
      contactPhone: "9876543210",
      status: UserStatus.ACTIVE,
    },
  });

  const category = await prisma.category.create({
    data: {
      slug: `${runId}-category`,
      name: `${runId} Category`,
      status: CategoryStatus.ACTIVE,
    },
  });

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      name: `${runId} Approved Product`,
      slug: `${runId}-approved-product`,
      description: "Approved product used by backend integration tests.",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      searchText: `${runId} Approved Product integration`,
      images: {
        create: {
          url: "indihub/products/approved-product.jpg",
          altText: "Approved integration product",
          isPrimary: true,
        },
      },
      variants: {
        create: {
          sku: `${runId}-APPROVED-SKU`,
          variantName: "1 Unit",
          pricePaise: 12000,
          mrpPaise: 15000,
          stockQuantity: 20,
          status: VariantStatus.ACTIVE,
        },
      },
    },
    include: {
      variants: true,
    },
  });

  const cmsPage = await prisma.cmsPage.create({
    data: {
      slug: `${runId}-policy`,
      title: "Integration Policy",
      content: "Integration policy page content.",
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  await prisma.setting.upsert({
    where: { key: "payments.manual.enabled" },
    update: {
      value: true,
      valueType: SettingValueType.BOOLEAN,
      group: "payments",
    },
    create: {
      key: "payments.manual.enabled",
      value: true,
      valueType: SettingValueType.BOOLEAN,
      group: "payments",
    },
  });

  const productVariant = product.variants[0];
  if (!productVariant) {
    throw new Error("Integration test product variant was not created.");
  }

  return {
    roles,
    adminUser,
    financeUser,
    customerUser,
    sellerUser,
    otherSellerUser,
    businessBuyerUser,
    deliveryPartnerUser,
    customer,
    seller,
    otherSeller,
    businessBuyer,
    category,
    product,
    productVariant,
    cmsPage,
  };
}

async function seedIntegrationLocations(prisma: PrismaClient) {
  const india = await prisma.locationCountry.upsert({
    where: { code: "IN" },
    update: {
      name: "India",
      currency: "INR",
      locale: "en-IN",
      phoneCode: "+91",
      postalCodeLabel: "Pincode",
      postalCodePattern: "^[1-9][0-9]{5}$",
      enabled: true,
      sortOrder: 10,
    },
    create: {
      code: "IN",
      name: "India",
      currency: "INR",
      locale: "en-IN",
      phoneCode: "+91",
      postalCodeLabel: "Pincode",
      postalCodePattern: "^[1-9][0-9]{5}$",
      enabled: true,
      sortOrder: 10,
    },
  });
  const uk = await prisma.locationCountry.upsert({
    where: { code: "GB" },
    update: {
      name: "United Kingdom",
      currency: "GBP",
      locale: "en-GB",
      phoneCode: "+44",
      postalCodeLabel: "Postal code",
      postalCodePattern: "^[A-Z]{1,2}[0-9][A-Z0-9]?\\s?[0-9][A-Z]{2}$",
      enabled: true,
      sortOrder: 40,
    },
    create: {
      code: "GB",
      name: "United Kingdom",
      currency: "GBP",
      locale: "en-GB",
      phoneCode: "+44",
      postalCodeLabel: "Postal code",
      postalCodePattern: "^[A-Z]{1,2}[0-9][A-Z0-9]?\\s?[0-9][A-Z]{2}$",
      enabled: true,
      sortOrder: 40,
    },
  });

  const tamilNadu = await prisma.locationSubdivision.upsert({
    where: { countryId_code: { countryId: india.id, code: "IN-TN" } },
    update: { name: "Tamil Nadu", type: "State", sortOrder: 10 },
    create: {
      countryId: india.id,
      code: "IN-TN",
      name: "Tamil Nadu",
      type: "State",
      sortOrder: 10,
    },
  });
  const coimbatore = await prisma.locationCity.upsert({
    where: { subdivisionId_code: { subdivisionId: tamilNadu.id, code: "IN-TN-CBE" } },
    update: { name: "Coimbatore", sortOrder: 10 },
    create: {
      subdivisionId: tamilNadu.id,
      code: "IN-TN-CBE",
      name: "Coimbatore",
      sortOrder: 10,
    },
  });
  await prisma.locationArea.upsert({
    where: { cityId_code: { cityId: coimbatore.id, code: "IN-TN-CBE-RS" } },
    update: { name: "RS Puram", postalCode: "641012", sortOrder: 10 },
    create: {
      cityId: coimbatore.id,
      code: "IN-TN-CBE-RS",
      name: "RS Puram",
      postalCode: "641012",
      sortOrder: 10,
    },
  });

  const england = await prisma.locationSubdivision.upsert({
    where: { countryId_code: { countryId: uk.id, code: "GB-ENG" } },
    update: { name: "England", type: "Country", sortOrder: 10 },
    create: {
      countryId: uk.id,
      code: "GB-ENG",
      name: "England",
      type: "Country",
      sortOrder: 10,
    },
  });
  const london = await prisma.locationCity.upsert({
    where: { subdivisionId_code: { subdivisionId: england.id, code: "GB-ENG-LON" } },
    update: { name: "London", sortOrder: 10 },
    create: {
      subdivisionId: england.id,
      code: "GB-ENG-LON",
      name: "London",
      sortOrder: 10,
    },
  });
  await prisma.locationArea.upsert({
    where: { cityId_code: { cityId: london.id, code: "GB-ENG-LON-E1" } },
    update: { name: "Shoreditch", postalCode: "E1 6AN", sortOrder: 10 },
    create: {
      cityId: london.id,
      code: "GB-ENG-LON-E1",
      name: "Shoreditch",
      postalCode: "E1 6AN",
      sortOrder: 10,
    },
  });

  await prisma.currencyRate.upsert({
    where: {
      baseCurrency_quoteCurrency_provider: {
        baseCurrency: "INR",
        quoteCurrency: "GBP",
        provider: "frankfurter",
      },
    },
    update: {
      rate: "0.0095",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      rawResponse: { rate: 0.0095, source: "integration-test" },
    },
    create: {
      baseCurrency: "INR",
      quoteCurrency: "GBP",
      provider: "frankfurter",
      rate: "0.0095",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      rawResponse: { rate: 0.0095, source: "integration-test" },
    },
  });
}

async function ensureRoles(prisma: PrismaClient) {
  const roleInputs = [
    { code: RoleCode.ADMIN, name: "Admin" },
    { code: RoleCode.CUSTOMER, name: "Customer" },
    { code: RoleCode.SELLER, name: "Seller" },
    { code: RoleCode.BUSINESS_BUYER, name: "Business Buyer" },
    { code: RoleCode.DELIVERY_PARTNER, name: "Delivery Partner" },
    { code: RoleCode.FINANCE, name: "Finance Manager" },
  ];

  const roles = await Promise.all(
    roleInputs.map((role) =>
      prisma.role.upsert({
        where: { code: role.code },
        update: { name: role.name },
        create: {
          code: role.code,
          name: role.name,
          description: `${role.name} role for integration tests.`,
        },
      }),
    ),
  );

  return Object.fromEntries(roles.map((role) => [role.code, role]));
}

async function createUserWithRole(
  prisma: PrismaClient,
  roles: Awaited<ReturnType<typeof ensureRoles>>,
  roleCode: RoleCode,
  email: string,
  fullName: string,
) {
  const role = roles[roleCode];
  if (!role) {
    throw new Error(`Missing integration-test role ${roleCode}`);
  }

  return prisma.user.create({
    data: {
      email,
      fullName,
      status: UserStatus.ACTIVE,
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
    },
  });
}

function expectPublicStorePayloadSafe(value: unknown) {
  const store = expectRecord(value);
  expectNoProperties(store, [
    "userId",
    "user",
    "status",
    "approvalStatus",
    "commissionType",
    "commissionValue",
    "subscriptionPlanId",
    "subscriptionStatus",
    "subscriptionStartedAt",
    "subscriptionCurrentPeriodEnd",
    "subscriptionPlan",
    "updatedAt",
    "deletedAt",
  ]);

  if (store.profile !== null && store.profile !== undefined) {
    expectNoProperties(expectRecord(store.profile), [
      "id",
      "sellerId",
      "contactName",
      "contactPhone",
      "contactEmail",
      "updatedAt",
    ]);
  }

  const addresses = store.addresses;
  expect(Array.isArray(addresses)).toBe(true);
  for (const address of addresses as unknown[]) {
    expectNoProperties(expectRecord(address), [
      "id",
      "sellerId",
      "line1",
      "line2",
      "pincode",
      "stateCode",
      "cityCode",
      "localAreaCode",
      "latitude",
      "longitude",
      "createdAt",
      "updatedAt",
    ]);
  }
}

function expectPublicProductSellerPayloadSafe(value: unknown) {
  const seller = expectRecord(value);
  expectNoProperties(seller, ["userId", "user", "status", "approvalStatus", "subscriptionPlan"]);

  if (seller.profile !== null && seller.profile !== undefined) {
    expectNoProperties(expectRecord(seller.profile), [
      "id",
      "sellerId",
      "contactName",
      "contactPhone",
      "contactEmail",
      "createdAt",
      "updatedAt",
    ]);
  }
}

function expectRecord(value: unknown): Record<string, unknown> {
  expect(value).toEqual(expect.any(Object));
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function expectNoProperties(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    expect(record).not.toHaveProperty(key);
  }
}

async function createApprovedSeller(
  prisma: PrismaClient,
  userId: string,
  storeName: string,
  slug: string,
  addressOverrides?: Partial<{
    line1: string;
    line2: string | null;
    area: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    countryCode: string;
    stateCode: string;
    cityCode: string;
    localAreaCode: string | null;
  }>,
) {
  return prisma.seller.create({
    data: {
      userId,
      sellerType: SellerType.LOCAL_SHOP,
      storeName,
      slug,
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      profile: {
        create: {
          contactName: storeName,
          contactPhone: "9876543210",
          contactEmail: `${slug}@1handindia.test`,
          description: "Integration test seller profile",
        },
      },
      addresses: {
        create: {
          line1: addressOverrides?.line1 ?? "Integration Street",
          line2: addressOverrides?.line2 ?? null,
          area: addressOverrides?.area ?? "RS Puram",
          city: addressOverrides?.city ?? "Coimbatore",
          state: addressOverrides?.state ?? "Tamil Nadu",
          pincode: addressOverrides?.pincode ?? "641012",
          country: addressOverrides?.country ?? "India",
          countryCode: addressOverrides?.countryCode ?? "IN",
          stateCode: addressOverrides?.stateCode ?? "IN-TN",
          cityCode: addressOverrides?.cityCode ?? "IN-TN-CBE",
          localAreaCode: addressOverrides?.localAreaCode ?? "IN-TN-CBE-RS",
        },
      },
    },
  });
}

async function seedHighVolumeAutoAssignmentData(
  prisma: PrismaClient,
  data: Awaited<ReturnType<typeof seedIntegrationData>>,
) {
  const deliveryPartnerRole = data.roles[RoleCode.DELIVERY_PARTNER];
  if (!deliveryPartnerRole) {
    throw new Error("Delivery partner role is required for high-volume assignment test.");
  }

  const loadKey = `${safeRunCode()}LOAD`;
  const loadPincode = "642999";
  const loadLocalAreaCode = `${loadKey}_AREA`;
  const targetOrderId = randomUUID();
  const targetDeliveryDetailId = randomUUID();
  const winnerPartnerId = randomUUID();
  const rejectedPartnerCount = 200;
  const busyPartnerCount = 500;
  const codLimitPartnerCount = 200;
  const rejectedPartnerIds = Array.from({ length: rejectedPartnerCount }, () => randomUUID());
  const busyPartnerIds = Array.from({ length: busyPartnerCount }, () => randomUUID());
  const codLimitPartnerIds = Array.from({ length: codLimitPartnerCount }, () => randomUUID());
  const partnerIds = [
    winnerPartnerId,
    ...rejectedPartnerIds,
    ...busyPartnerIds,
    ...codLimitPartnerIds,
  ];
  const createdAtBase = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await prisma.user.createMany({
    data: partnerIds.map((id, index) => ({
      id,
      email: `${runId}-load-delivery-${index}@1handindia.test`,
      fullName:
        id === winnerPartnerId
          ? "1HandIndia Load Winner Partner"
          : `1HandIndia Load Partner ${index}`,
      status: UserStatus.ACTIVE,
      createdAt: new Date(createdAtBase.getTime() + index * 1000),
      updatedAt: new Date(createdAtBase.getTime() + index * 1000),
    })),
  });
  await prisma.userRole.createMany({
    data: partnerIds.map((userId) => ({
      userId,
      roleId: deliveryPartnerRole.id,
    })),
  });
  await prisma.deliveryPartnerProfile.createMany({
    data: partnerIds.map((userId, index) => ({
      userId,
      phone: `98${String(index).padStart(8, "0").slice(0, 8)}`,
      vehicleNumber: `TN 30 LD ${String(index).padStart(4, "0")}`,
      isAvailable: true,
      serviceCountryCode: "IN",
      serviceStateCode: "IN-TN",
      serviceCityCode: "IN-TN-CBE",
      servicePincodes: [loadPincode],
      serviceLocalAreaCodes: [loadLocalAreaCode],
      codCashLimitPaise: 1_000_000,
    })),
  });

  const targetOrderNumber = `${loadKey}-TARGET`;
  await prisma.order.create({
    data: {
      id: targetOrderId,
      orderNumber: targetOrderNumber,
      customerId: data.customer.id,
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.PENDING,
      deliveryStatus: DeliveryStatus.PACKED,
      subtotalPaise: 50_000,
      totalPaise: 50_000,
      shippingAddressSnapshot: {
        fullName: "1HandIndia Load Customer",
        phone: "9876543210",
        line1: "Load Test Delivery Street",
        area: "Load Area",
        city: "Coimbatore",
        state: "Tamil Nadu",
        country: "India",
        pincode: loadPincode,
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-CBE",
        localAreaCode: loadLocalAreaCode,
      },
      deliveryDetail: {
        create: {
          id: targetDeliveryDetailId,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          status: DeliveryStatus.PACKED,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
        },
      },
      payments: {
        create: {
          provider: PaymentProvider.COD,
          method: "COD",
          amountPaise: 50_000,
          status: PaymentStatus.PENDING,
        },
      },
    },
  });

  await prisma.deliveryAssignmentAttempt.createMany({
    data: rejectedPartnerIds.map((partnerUserId) => ({
      orderId: targetOrderId,
      deliveryDetailId: targetDeliveryDetailId,
      partnerUserId,
      source: DeliveryAssignmentAttemptSource.AUTO,
      status: DeliveryAssignmentStatus.REJECTED,
      note: "Rejected earlier during high-volume assignment test.",
      assignedById: data.adminUser.id,
      respondedAt: new Date(),
    })),
  });

  const supportOrderRows: Array<{
    id: string;
    orderNumber: string;
    customerId: string;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    deliveryStatus: DeliveryStatus;
    subtotalPaise: number;
    totalPaise: number;
  }> = [];
  const supportDeliveryRows: Array<{
    id: string;
    orderId: string;
    deliveryMode: DeliveryMode;
    deliveryPartnerUserId: string;
    assignmentStatus: DeliveryAssignmentStatus;
    assignedAt: Date;
    status: DeliveryStatus;
    codCollectionStatus?: CodCollectionStatus;
    codCollectedAmountPaise?: number;
    codCollectedAt?: Date;
    codCollectedById?: string;
  }> = [];
  const assignmentHistoryRows: Array<{
    orderId: string;
    deliveryDetailId: string;
    partnerUserId: string;
    source: DeliveryAssignmentAttemptSource;
    status: DeliveryAssignmentStatus;
    note: string;
    assignedById: string;
  }> = [];

  busyPartnerIds.forEach((partnerUserId, index) => {
    const orderId = randomUUID();
    const deliveryDetailId = randomUUID();
    supportOrderRows.push({
      id: orderId,
      orderNumber: `${loadKey}-BUSY-${index}`,
      customerId: data.customer.id,
      orderStatus: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.PENDING,
      deliveryStatus: DeliveryStatus.PACKED,
      subtotalPaise: 10_000,
      totalPaise: 10_000,
    });
    supportDeliveryRows.push({
      id: deliveryDetailId,
      orderId,
      deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      deliveryPartnerUserId: partnerUserId,
      assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      assignedAt: new Date(),
      status: DeliveryStatus.PACKED,
    });
    assignmentHistoryRows.push({
      orderId,
      deliveryDetailId,
      partnerUserId,
      source: DeliveryAssignmentAttemptSource.AUTO,
      status: DeliveryAssignmentStatus.ASSIGNED,
      note: "Existing busy workload assignment.",
      assignedById: data.adminUser.id,
    });
  });

  codLimitPartnerIds.forEach((partnerUserId, index) => {
    const orderId = randomUUID();
    supportOrderRows.push({
      id: orderId,
      orderNumber: `${loadKey}-COD-${index}`,
      customerId: data.customer.id,
      orderStatus: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PENDING,
      deliveryStatus: DeliveryStatus.DELIVERED,
      subtotalPaise: 980_000,
      totalPaise: 980_000,
    });
    supportDeliveryRows.push({
      id: randomUUID(),
      orderId,
      deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      deliveryPartnerUserId: partnerUserId,
      assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
      assignedAt: new Date(),
      status: DeliveryStatus.DELIVERED,
      codCollectionStatus: CodCollectionStatus.COLLECTED,
      codCollectedAmountPaise: 980_000,
      codCollectedAt: new Date(),
      codCollectedById: partnerUserId,
    });
  });

  await prisma.order.createMany({ data: supportOrderRows });
  await prisma.deliveryDetail.createMany({ data: supportDeliveryRows });
  await prisma.deliveryAssignmentAttempt.createMany({ data: assignmentHistoryRows });

  return {
    targetOrderId,
    targetOrderNumber,
    winnerPartnerId,
    rejectedPartnerIds,
    rejectedPartnerCount,
  };
}

async function cleanupIntegrationData(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email: { contains: runId } }, { email: { startsWith: "ih-e2e-" } }],
    },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  const customers = await prisma.customer.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const customerIds = customers.map((customer) => customer.id);

  const sellers = await prisma.seller.findMany({
    where: {
      OR: [{ userId: { in: userIds } }, { slug: { contains: runId } }],
    },
    select: { id: true },
  });
  const sellerIds = sellers.map((seller) => seller.id);

  const businessBuyers = await prisma.businessBuyer.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const businessBuyerIds = businessBuyers.map((buyer) => buyer.id);

  const categories = await prisma.category.findMany({
    where: { slug: { contains: runId } },
    select: { id: true },
  });
  const categoryIds = categories.map((category) => category.id);

  const productTemplates = await prisma.productTemplate.findMany({
    where: {
      OR: [{ name: { contains: runId } }, { code: { contains: safeRunCode() } }],
    },
    select: { id: true },
  });
  const productTemplateIds = productTemplates.map((template) => template.id);

  const products = await prisma.product.findMany({
    where: {
      OR: [{ sellerId: { in: sellerIds } }, { slug: { contains: runId } }],
    },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);

  const productVariants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: { id: true },
  });
  const productVariantIds = productVariants.map((variant) => variant.id);

  const carts = await prisma.cart.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const cartIds = carts.map((cart) => cart.id);

  const orders = await prisma.order.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const paymentIds = payments.map((payment) => payment.id);

  const deliveryDetails = await prisma.deliveryDetail.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const deliveryDetailIds = deliveryDetails.map((delivery) => delivery.id);
  const orderShipments = await prisma.orderShipment.findMany({
    where: { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] },
    select: { id: true },
  });
  const orderShipmentIds = orderShipments.map((shipment) => shipment.id);

  const enquiries = await prisma.b2BEnquiry.findMany({
    where: {
      OR: [
        { businessBuyerId: { in: businessBuyerIds } },
        { sellerId: { in: sellerIds } },
        { productId: { in: productIds } },
      ],
    },
    select: { id: true },
  });
  const enquiryIds = enquiries.map((enquiry) => enquiry.id);

  const supportRequests = await prisma.supportRequest.findMany({
    where: {
      OR: [{ userId: { in: userIds } }, { email: { contains: runId } }],
    },
    select: { id: true },
  });
  const supportRequestIds = supportRequests.map((supportRequest) => supportRequest.id);

  const seoEntries = await prisma.seoEntry.findMany({
    where: {
      OR: [
        { metaTitle: { contains: runId } },
        { key: { contains: runId } },
        { entityId: { in: [...productIds, ...categoryIds, ...sellerIds] } },
        { routePath: { contains: runId } },
      ],
    },
    select: { id: true },
  });
  const seoEntryIds = seoEntries.map((entry) => entry.id);

  const redirects = await prisma.cmsRedirect.findMany({
    where: { OR: [{ sourcePath: { contains: runId } }, { targetPath: { contains: runId } }] },
    select: { id: true },
  });
  const redirectIds = redirects.map((redirect) => redirect.id);

  const mediaAssets = await prisma.cmsMediaAsset.findMany({
    where: {
      OR: [
        { title: { contains: runId } },
        { publicId: { contains: runId } },
        { usageContext: { contains: runId } },
      ],
    },
    select: { id: true },
  });
  const mediaAssetIds = mediaAssets.map((asset) => asset.id);

  const menuItems = await prisma.cmsMenuItem.findMany({
    where: { label: { contains: runId } },
    select: { id: true },
  });
  const menuItemIds = menuItems.map((menuItem) => menuItem.id);

  const entityIds = [
    ...sellerIds,
    ...businessBuyerIds,
    ...categoryIds,
    ...productTemplateIds,
    ...productIds,
    ...productVariantIds,
    ...orderIds,
    ...enquiryIds,
    ...supportRequestIds,
    ...seoEntryIds,
    ...redirectIds,
    ...mediaAssetIds,
    ...menuItemIds,
  ];

  await prisma.b2BEnquiryResponse.deleteMany({
    where: {
      OR: [{ enquiryId: { in: enquiryIds } }, { responderUserId: { in: userIds } }],
    },
  });
  await prisma.b2BEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
  await prisma.paymentEvent.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.courierWebhookEvent.deleteMany({
    where: {
      OR: [
        { orderShipmentId: { in: orderShipmentIds } },
        { providerCode: { contains: safeRunCode() } },
      ],
    },
  });
  await prisma.courierCodRemittance.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.courierShipment.deleteMany({
    where: {
      OR: [
        { orderId: { in: orderIds } },
        { sellerId: { in: sellerIds } },
        { providerCode: { contains: safeRunCode() } },
      ],
    },
  });
  await prisma.deliveryEvent.deleteMany({ where: { deliveryDetailId: { in: deliveryDetailIds } } });
  await prisma.deliveryDetail.deleteMany({ where: { id: { in: deliveryDetailIds } } });
  await prisma.orderStatusEvent.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { createdById: { in: userIds } }] },
  });
  await prisma.orderShipment.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.orderItem.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.orderSellerSplit.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.checkoutSession.deleteMany({
    where: { OR: [{ customerId: { in: customerIds } }, { cartId: { in: cartIds } }] },
  });
  await prisma.cartItem.deleteMany({
    where: { OR: [{ cartId: { in: cartIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.cartItem.deleteMany({
    where: { productVariant: { product: { sellerId: { in: sellerIds } } } },
  });
  await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
  await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.wishlistItem.deleteMany({
    where: { product: { sellerId: { in: sellerIds } } },
  });
  await prisma.wishlist.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [{ createdById: { in: userIds } }, { productVariantId: { in: productVariantIds } }],
    },
  });
  await prisma.inventoryMovement.deleteMany({
    where: { productVariant: { product: { sellerId: { in: sellerIds } } } },
  });
  await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productImage.deleteMany({
    where: { product: { sellerId: { in: sellerIds } } },
  });
  await prisma.productVariant.deleteMany({
    where: { OR: [{ id: { in: productVariantIds } }, { product: { sellerId: { in: sellerIds } } }] },
  });
  await prisma.product.deleteMany({
    where: { OR: [{ id: { in: productIds } }, { sellerId: { in: sellerIds } }] },
  });
  await prisma.cmsRevision.deleteMany({
    where: {
      OR: [{ actorUserId: { in: userIds } }, { entityId: { in: entityIds } }],
    },
  });
  await prisma.seoEntry.deleteMany({ where: { id: { in: seoEntryIds } } });
  await prisma.cmsRedirect.deleteMany({ where: { id: { in: redirectIds } } });
  await prisma.cmsMediaAsset.deleteMany({ where: { id: { in: mediaAssetIds } } });
  await prisma.cmsMenuItem.deleteMany({ where: { id: { in: menuItemIds } } });
  await prisma.cmsPage.deleteMany({ where: { slug: { contains: runId } } });
  await prisma.banner.deleteMany({ where: { title: { contains: runId } } });
  await prisma.homepageSection.deleteMany({ where: { title: { contains: runId } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.productTemplateField.deleteMany({
    where: { productTemplateId: { in: productTemplateIds } },
  });
  await prisma.productTemplate.deleteMany({ where: { id: { in: productTemplateIds } } });
  await prisma.sellerDocument.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await prisma.sellerAddress.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await prisma.sellerProfile.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.businessBuyerAddress.deleteMany({
    where: { businessBuyerId: { in: businessBuyerIds } },
  });
  await prisma.businessBuyer.deleteMany({ where: { id: { in: businessBuyerIds } } });
  await prisma.customerAddress.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  await prisma.notificationLog.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { recipient: { contains: runId } }],
    },
  });
  await prisma.notificationTemplate.deleteMany({
    where: {
      OR: [{ code: { contains: runId } }, { name: { contains: runId } }],
    },
  });
  await prisma.emailTheme.deleteMany({
    where: {
      OR: [
        { code: { contains: runId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase() } },
        { name: { contains: runId } },
      ],
    },
  });
  await prisma.courierProviderSetting.deleteMany({
    where: {
      OR: [
        { providerCode: { contains: safeRunCode() } },
        { providerCode: { contains: "_TEST_COURIER" } },
      ],
    },
  });
  await prisma.shippingRateCard.deleteMany({
    where: { name: { contains: runId } },
  });
  await prisma.supportRequest.deleteMany({ where: { id: { in: supportRequestIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ actorUserId: { in: userIds } }, { entityId: { in: entityIds } }],
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
