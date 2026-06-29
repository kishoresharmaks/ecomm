import "dotenv/config";
import {
  ApprovalStatus,
  CategoryStatus,
  prisma,
  RoleCode,
  SellerBusinessType,
  SellerCapability,
  SellerStatus,
  SellerSubscriptionStatus,
  SellerType,
  ServiceCancellationPolicy,
  ServiceListingStatus,
  ServicePaymentMode,
  ServicePricingModel,
  ServiceVisitMode,
  UserStatus,
  type Prisma,
} from "../../packages/database/src/index";

const DEMO_SELLER_EMAIL = "services-demo@1handindia.local";
const DEMO_SELLER_SLUG = "indihub-demo-services";

type DemoPackage = {
  name: string;
  description?: string;
  pricePaise: number;
  mrpPaise?: number;
  durationMinutes?: number;
};

type DemoArea = {
  label: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

type DemoService = {
  title: string;
  slug: string;
  categorySlug: string;
  description: string;
  pricingModel: ServicePricingModel;
  paymentMode: ServicePaymentMode;
  cancellationPolicy: ServiceCancellationPolicy;
  basePricePaise?: number | null;
  inspectionFeePaise?: number;
  advanceAmountPaise?: number;
  quoteTtlHours?: number;
  serviceDurationMinutes?: number;
  allowedVisitModes: ServiceVisitMode[];
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  requirements: string[];
  serviceRating?: Prisma.Decimal | number;
  serviceReviewCount?: number;
  imageUrl: string;
  imageAlt: string;
  packages?: DemoPackage[];
  areas?: DemoArea[];
};

const serviceCategories = [
  {
    name: "Home Services",
    slug: "home-services",
    description: "On-demand repair, cleaning, and maintenance services for homes.",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 810,
  },
  {
    name: "Appliance Care",
    slug: "appliance-care",
    description: "AC, water purifier, kitchen appliance, and household equipment support.",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 820,
  },
  {
    name: "Beauty & Wellness",
    slug: "beauty-wellness-services",
    description: "At-home grooming and wellness appointments by vetted providers.",
    imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 830,
  },
  {
    name: "Digital Support",
    slug: "digital-support-services",
    description: "Remote troubleshooting and setup support for customer devices and accounts.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    sortOrder: 840,
  },
] as const;

const bengaluruAreas: DemoArea[] = [
  {
    label: "Bengaluru Central",
    countryCode: "IN",
    stateCode: "KA",
    cityCode: "BENGALURU",
    pincode: "560001",
    latitude: 12.9716,
    longitude: 77.5946,
    radiusKm: 18,
  },
  {
    label: "Koramangala and HSR",
    countryCode: "IN",
    stateCode: "KA",
    cityCode: "BENGALURU",
    pincode: "560034",
    latitude: 12.9352,
    longitude: 77.6245,
    radiusKm: 12,
  },
];

const demoServices: DemoService[] = [
  {
    title: "AC Deep Cleaning & Installation",
    slug: "demo-ac-deep-cleaning-installation",
    categorySlug: "appliance-care",
    description:
      "Professional split and window AC cleaning, gas-pressure check, basic troubleshooting, and installation support for homes and small offices.",
    pricingModel: ServicePricingModel.FIXED_PRICE,
    paymentMode: ServicePaymentMode.FULL_PAYMENT,
    cancellationPolicy: ServiceCancellationPolicy.MODERATE,
    basePricePaise: 149900,
    serviceDurationMinutes: 90,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
    highlights: ["Technician visit", "Deep coil cleaning", "Basic performance check", "Invoice-ready demo service"],
    inclusions: ["Indoor unit cleaning", "Outdoor unit dusting", "Drain pipe check", "Basic gas-pressure inspection"],
    exclusions: ["Spare parts", "Gas refilling", "Major repair work"],
    requirements: ["Working power supply", "Access to indoor and outdoor units"],
    serviceRating: 4.7,
    serviceReviewCount: 46,
    imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "AC technician servicing an indoor unit",
    packages: [
      { name: "Window AC Service", description: "Deep cleaning and basic performance check for one window AC.", pricePaise: 149900, mrpPaise: 189900, durationMinutes: 75 },
      { name: "Split AC Service", description: "Indoor and outdoor unit cleaning for one split AC.", pricePaise: 189900, mrpPaise: 239900, durationMinutes: 90 },
      { name: "AC Installation", description: "Standard installation visit for one split AC.", pricePaise: 249900, mrpPaise: 319900, durationMinutes: 120 },
    ],
    areas: bengaluruAreas,
  },
  {
    title: "Home Plumbing Visit",
    slug: "demo-home-plumbing-visit",
    categorySlug: "home-services",
    description:
      "Request a plumber for leakage checks, tap replacement, bathroom fittings, kitchen sink issues, and quote-first repair work.",
    pricingModel: ServicePricingModel.QUOTE_FIRST,
    paymentMode: ServicePaymentMode.PAY_AT_VISIT,
    cancellationPolicy: ServiceCancellationPolicy.FLEXIBLE,
    basePricePaise: null,
    serviceDurationMinutes: 60,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
    highlights: ["Quote after issue review", "Local provider assignment", "Useful for unknown repair scope"],
    inclusions: ["Problem diagnosis", "Repair estimate", "Minor tightening or fitting check"],
    exclusions: ["Parts and materials", "Civil work", "Hidden pipe replacement"],
    requirements: ["Clear photos or description of the issue", "Access to the affected area"],
    serviceRating: 4.5,
    serviceReviewCount: 31,
    imageUrl: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Plumber repairing a sink pipe",
    areas: bengaluruAreas,
  },
  {
    title: "Electrical Safety Inspection",
    slug: "demo-electrical-safety-inspection",
    categorySlug: "home-services",
    description:
      "Inspection-fee service for switchboards, MCB panels, earthing concerns, appliance load checks, and safety recommendations.",
    pricingModel: ServicePricingModel.INSPECTION_FEE,
    paymentMode: ServicePaymentMode.INSPECTION_FEE,
    cancellationPolicy: ServiceCancellationPolicy.MODERATE,
    basePricePaise: null,
    inspectionFeePaise: 39900,
    serviceDurationMinutes: 45,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION, ServiceVisitMode.PROVIDER_LOCATION],
    highlights: ["Inspection fee upfront", "Final quote after visit", "Safety-focused report notes"],
    inclusions: ["Visible wiring check", "MCB/load assessment", "Repair recommendation"],
    exclusions: ["Replacement parts", "Concealed wiring work", "Permit or society approvals"],
    requirements: ["Adult customer present", "Access to main distribution board"],
    serviceRating: 4.8,
    serviceReviewCount: 22,
    imageUrl: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Electrician inspecting wiring",
    areas: bengaluruAreas,
  },
  {
    title: "Water Purifier Service",
    slug: "demo-water-purifier-service",
    categorySlug: "appliance-care",
    description:
      "RO and UV water purifier service with filter health check, cleaning, leak check, and service estimate for replacement parts.",
    pricingModel: ServicePricingModel.FIXED_PRICE,
    paymentMode: ServicePaymentMode.FULL_PAYMENT,
    cancellationPolicy: ServiceCancellationPolicy.FLEXIBLE,
    basePricePaise: 69900,
    serviceDurationMinutes: 60,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
    highlights: ["RO/UV cleaning", "Filter health check", "Leakage diagnosis", "TDS reading"],
    inclusions: ["External cleaning", "Pipe and leak check", "TDS test", "Basic sanitisation"],
    exclusions: ["Filter cartridges", "Pump or membrane replacement", "New installation drilling"],
    requirements: ["Running water supply", "Power socket near purifier"],
    serviceRating: 4.6,
    serviceReviewCount: 39,
    imageUrl: "https://images.unsplash.com/photo-1542013936693-884638332954?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Kitchen sink and drinking water setup",
    packages: [
      { name: "Basic Service", description: "Cleaning, leak check, and TDS test.", pricePaise: 69900, mrpPaise: 89900, durationMinutes: 45 },
      { name: "Service + Filter Check", description: "Basic service with detailed filter condition review.", pricePaise: 99900, mrpPaise: 129900, durationMinutes: 60 },
    ],
    areas: bengaluruAreas,
  },
  {
    title: "Salon at Home Grooming",
    slug: "demo-salon-at-home-grooming",
    categorySlug: "beauty-wellness-services",
    description:
      "At-home grooming packages for haircut, beard styling, cleanup, and basic wellness appointments with hygienic kit handling.",
    pricingModel: ServicePricingModel.FIXED_PRICE,
    paymentMode: ServicePaymentMode.FULL_PAYMENT,
    cancellationPolicy: ServiceCancellationPolicy.STRICT,
    basePricePaise: 49900,
    serviceDurationMinutes: 50,
    allowedVisitModes: [ServiceVisitMode.CUSTOMER_LOCATION],
    highlights: ["At-home appointment", "Package-based pricing", "Hygiene-first provider workflow"],
    inclusions: ["Selected grooming service", "Disposable towel/cape where applicable", "Post-service cleanup"],
    exclusions: ["Chemical treatments", "Premium products", "Services not selected in package"],
    requirements: ["Well-lit seating space", "Access to clean water if needed"],
    serviceRating: 4.4,
    serviceReviewCount: 27,
    imageUrl: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Salon grooming tools arranged for a home appointment",
    packages: [
      { name: "Haircut", description: "Standard haircut at home.", pricePaise: 49900, mrpPaise: 69900, durationMinutes: 40 },
      { name: "Haircut + Beard", description: "Haircut with beard trim or styling.", pricePaise: 79900, mrpPaise: 99900, durationMinutes: 60 },
      { name: "Grooming Combo", description: "Haircut, beard, cleanup, and basic head massage.", pricePaise: 119900, mrpPaise: 149900, durationMinutes: 90 },
    ],
    areas: bengaluruAreas,
  },
  {
    title: "Remote Laptop Software Support",
    slug: "demo-remote-laptop-software-support",
    categorySlug: "digital-support-services",
    description:
      "Remote support for slow laptop diagnosis, app setup, email configuration, backup guidance, and basic operating-system troubleshooting.",
    pricingModel: ServicePricingModel.FIXED_PRICE,
    paymentMode: ServicePaymentMode.FULL_PAYMENT,
    cancellationPolicy: ServiceCancellationPolicy.FLEXIBLE,
    basePricePaise: 59900,
    serviceDurationMinutes: 45,
    allowedVisitModes: [ServiceVisitMode.REMOTE],
    highlights: ["Remote-only service", "No location required", "Good for mobile booking tests"],
    inclusions: ["Video/remote guidance", "Basic cleanup checklist", "App or account setup help"],
    exclusions: ["Hardware repair", "Paid software licences", "Data recovery guarantees"],
    requirements: ["Stable internet connection", "Admin access to your laptop if setup needs it"],
    serviceRating: 4.9,
    serviceReviewCount: 18,
    imageUrl: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Remote laptop support session",
    packages: [
      { name: "Quick Fix Session", description: "Up to 30 minutes of remote troubleshooting.", pricePaise: 59900, mrpPaise: 79900, durationMinutes: 30 },
      { name: "Setup Session", description: "Up to 60 minutes for email, apps, backup, or device setup.", pricePaise: 99900, mrpPaise: 129900, durationMinutes: 60 },
    ],
  },
];

async function main() {
  assertDemoSeedAllowed();

  const sellerRole = await prisma.role.upsert({
    where: { code: RoleCode.SELLER },
    update: { name: "Seller", description: "Marketplace seller, hyperlocal store, or service provider." },
    create: {
      code: RoleCode.SELLER,
      name: "Seller",
      description: "Marketplace seller, hyperlocal store, or service provider.",
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: DEMO_SELLER_EMAIL },
    update: {
      fullName: "IndiHub Demo Services",
      status: UserStatus.ACTIVE,
    },
    create: {
      email: DEMO_SELLER_EMAIL,
      fullName: "IndiHub Demo Services",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: sellerUser.id, roleId: sellerRole.id } },
    update: {},
    create: { userId: sellerUser.id, roleId: sellerRole.id },
  });

  const seller = await upsertDemoSeller(sellerUser.id);
  await upsertDemoSellerProfile(seller.id);
  await replaceDemoSellerAddress(seller.id);

  const categoryIdsBySlug = new Map<string, string>();
  for (const category of serviceCategories) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        status: CategoryStatus.ACTIVE,
        sortOrder: category.sortOrder,
        deletedAt: null,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        status: CategoryStatus.ACTIVE,
        sortOrder: category.sortOrder,
      },
    });
    categoryIdsBySlug.set(category.slug, created.id);
  }

  for (const service of demoServices) {
    const categoryId = categoryIdsBySlug.get(service.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category for demo service ${service.slug}.`);
    }
    await upsertDemoService(seller.id, categoryId, service);
  }

  console.log(`Demo services seed completed for local/development DB.`);
  console.log(`Seller: ${DEMO_SELLER_EMAIL} (${DEMO_SELLER_SLUG})`);
  console.log(`Categories: ${serviceCategories.length}; services: ${demoServices.length}`);
}

async function upsertDemoSeller(userId: string) {
  const existingByUser = await prisma.seller.findUnique({ where: { userId } });
  const existingBySlug = await prisma.seller.findUnique({ where: { slug: DEMO_SELLER_SLUG } });

  if (existingByUser && existingBySlug && existingByUser.id !== existingBySlug.id) {
    throw new Error(
      `Cannot seed demo services: seller user ${DEMO_SELLER_EMAIL} and slug ${DEMO_SELLER_SLUG} point to different sellers.`,
    );
  }

  const data = {
    storeName: "IndiHub Demo Services",
    slug: DEMO_SELLER_SLUG,
    sellerType: SellerType.SERVICE_PROVIDER,
    primaryCapability: SellerCapability.SERVICE,
    enabledCapabilities: [SellerCapability.SERVICE],
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
    subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
    serviceRating: 4.7,
    serviceReviewCount: 183,
    deletedAt: null,
  } satisfies Prisma.SellerUpdateInput;

  if (existingByUser) {
    return prisma.seller.update({ where: { id: existingByUser.id }, data });
  }

  if (existingBySlug) {
    return prisma.seller.update({ where: { id: existingBySlug.id }, data: { ...data, user: { connect: { id: userId } } } });
  }

  return prisma.seller.create({
    data: {
      userId,
      storeName: "IndiHub Demo Services",
      slug: DEMO_SELLER_SLUG,
      sellerType: SellerType.SERVICE_PROVIDER,
      primaryCapability: SellerCapability.SERVICE,
      enabledCapabilities: [SellerCapability.SERVICE],
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      serviceRating: 4.7,
      serviceReviewCount: 183,
    },
  });
}

async function upsertDemoSellerProfile(sellerId: string) {
  await prisma.sellerProfile.upsert({
    where: { sellerId },
    update: {
      logoUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=512&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80",
      description: "Local demo provider for testing service discovery, quotes, inspection fees, bookings, and lifecycle actions.",
      businessLegalName: "IndiHub Demo Services Private Limited",
      businessType: SellerBusinessType.PRIVATE_LIMITED,
      gstNumber: "29ABCDE1234F1Z5",
      panNumber: "ABCDE1234F",
      contactName: "Demo Services Desk",
      contactPhone: "+919900000001",
      contactEmail: DEMO_SELLER_EMAIL,
    },
    create: {
      sellerId,
      logoUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=512&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80",
      description: "Local demo provider for testing service discovery, quotes, inspection fees, bookings, and lifecycle actions.",
      businessLegalName: "IndiHub Demo Services Private Limited",
      businessType: SellerBusinessType.PRIVATE_LIMITED,
      gstNumber: "29ABCDE1234F1Z5",
      panNumber: "ABCDE1234F",
      contactName: "Demo Services Desk",
      contactPhone: "+919900000001",
      contactEmail: DEMO_SELLER_EMAIL,
    },
  });
}

async function replaceDemoSellerAddress(sellerId: string) {
  await prisma.sellerAddress.deleteMany({ where: { sellerId } });
  await prisma.sellerAddress.create({
    data: {
      sellerId,
      line1: "Demo Service Hub, MG Road",
      line2: "Near Trinity Metro Station",
      area: "Ashok Nagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      countryCode: "IN",
      stateCode: "KA",
      cityCode: "BENGALURU",
      latitude: 12.9716,
      longitude: 77.5946,
    },
  });
}

async function upsertDemoService(sellerId: string, categoryId: string, service: DemoService) {
  const listing = await prisma.serviceListing.upsert({
    where: { slug: service.slug },
    update: {
      sellerId,
      categoryId,
      title: service.title,
      description: service.description,
      status: ServiceListingStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      pricingModel: service.pricingModel,
      paymentMode: service.paymentMode,
      cancellationPolicy: service.cancellationPolicy,
      basePricePaise: service.basePricePaise ?? null,
      inspectionFeePaise: service.inspectionFeePaise ?? 0,
      advanceAmountPaise: service.advanceAmountPaise ?? 0,
      currency: "INR",
      quoteTtlHours: service.quoteTtlHours ?? 48,
      serviceDurationMinutes: service.serviceDurationMinutes ?? null,
      allowedVisitModes: service.allowedVisitModes,
      highlights: service.highlights,
      inclusions: service.inclusions,
      exclusions: service.exclusions,
      requirements: service.requirements,
      serviceRating: service.serviceRating ?? null,
      serviceReviewCount: service.serviceReviewCount ?? 0,
      searchText: createSearchText(service),
      deletedAt: null,
    },
    create: {
      sellerId,
      categoryId,
      title: service.title,
      slug: service.slug,
      description: service.description,
      status: ServiceListingStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      pricingModel: service.pricingModel,
      paymentMode: service.paymentMode,
      cancellationPolicy: service.cancellationPolicy,
      basePricePaise: service.basePricePaise ?? null,
      inspectionFeePaise: service.inspectionFeePaise ?? 0,
      advanceAmountPaise: service.advanceAmountPaise ?? 0,
      currency: "INR",
      quoteTtlHours: service.quoteTtlHours ?? 48,
      serviceDurationMinutes: service.serviceDurationMinutes ?? null,
      allowedVisitModes: service.allowedVisitModes,
      highlights: service.highlights,
      inclusions: service.inclusions,
      exclusions: service.exclusions,
      requirements: service.requirements,
      serviceRating: service.serviceRating ?? null,
      serviceReviewCount: service.serviceReviewCount ?? 0,
      searchText: createSearchText(service),
    },
  });

  await prisma.serviceListingImage.deleteMany({ where: { serviceListingId: listing.id } });
  await prisma.serviceListingImage.create({
    data: {
      serviceListingId: listing.id,
      url: service.imageUrl,
      altText: service.imageAlt,
      sortOrder: 0,
      isPrimary: true,
    },
  });

  await prisma.serviceArea.deleteMany({ where: { serviceListingId: listing.id } });
  if (service.areas?.length) {
    await prisma.serviceArea.createMany({
      data: service.areas.map((area) => ({
        serviceListingId: listing.id,
        label: area.label,
        countryCode: area.countryCode ?? null,
        stateCode: area.stateCode ?? null,
        cityCode: area.cityCode ?? null,
        localAreaCode: area.localAreaCode ?? null,
        pincode: area.pincode ?? null,
        latitude: area.latitude ?? null,
        longitude: area.longitude ?? null,
        radiusKm: area.radiusKm ?? null,
        isActive: true,
      })),
    });
  }

  for (const [index, item] of (service.packages ?? []).entries()) {
    const existingPackage = await prisma.servicePackage.findFirst({
      where: { serviceListingId: listing.id, name: item.name },
    });
    const packageData = {
      description: item.description ?? null,
      pricePaise: item.pricePaise,
      mrpPaise: item.mrpPaise ?? null,
      currency: "INR",
      durationMinutes: item.durationMinutes ?? service.serviceDurationMinutes ?? null,
      sortOrder: index,
      isActive: true,
    };
    if (existingPackage) {
      await prisma.servicePackage.update({ where: { id: existingPackage.id }, data: packageData });
    } else {
      await prisma.servicePackage.create({
        data: {
          serviceListingId: listing.id,
          name: item.name,
          ...packageData,
        },
      });
    }
  }
}

function createSearchText(service: DemoService) {
  return [
    service.title,
    service.description,
    service.categorySlug,
    service.highlights.join(" "),
    service.inclusions.join(" "),
    service.requirements.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function assertDemoSeedAllowed() {
  if (process.env.INDIHUB_ALLOW_DEMO_SERVICE_SEED === "true") {
    return;
  }

  const db = databaseIdentity(process.env.DATABASE_URL);
  const deploymentValues = [process.env.NODE_ENV, process.env.VERCEL_ENV, process.env.INDIHUB_ENV]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  const productionLikeEnv = deploymentValues.some((value) => isProtectedEnvValue(value));
  const riskyDatabaseName = db.name ? isProtectedEnvValue(db.name.toLowerCase()) : false;
  const localHost = ["localhost", "127.0.0.1", "host.docker.internal"].includes(db.host.toLowerCase());
  const developmentDatabaseName = db.name ? /(^|[_-])(dev|local|demo|test|e2e|integration)([_-]|$)/i.test(db.name) : false;

  if (productionLikeEnv || riskyDatabaseName || (!localHost && !developmentDatabaseName)) {
    throw new Error(
      "Refusing to seed demo services outside an obvious local/development database. " +
        "Use INDIHUB_ALLOW_DEMO_SERVICE_SEED=true only when you have verified the target DB is disposable/local.",
    );
  }
}

function databaseIdentity(rawUrl: string | undefined) {
  if (!rawUrl) {
    return { host: "localhost", name: "indihub" };
  }
  try {
    const url = new URL(rawUrl);
    return { host: url.hostname || "unknown", name: decodeURIComponent(url.pathname.replace(/^\//, "")) };
  } catch {
    return { host: "unknown", name: "unknown" };
  }
}

function isProtectedEnvValue(value: string) {
  const compact = value.replace(/[^a-z0-9]+/g, "");
  return ["production", "prod", "staging", "stage", "preproduction", "preprod", "uat"].includes(compact);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
