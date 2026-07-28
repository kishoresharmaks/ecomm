import { DocumentBuilder } from "@nestjs/swagger";

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle("1HandIndia API")
    .setDescription(
      "Complete 1HandIndia marketplace OpenAPI map covering storefront, customer account, seller center, B2B, admin, finance, delivery, courier, returns, CMS, support, payments, reports, search, storage, mobile, and webhook workflows.",
    )
    .setVersion("0.1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT or admin session token",
        description:
          "Use Clerk bearer tokens for customer/seller/B2B/delivery sessions, or standalone back-office session tokens for admin, finance, and courier-manager routes.",
      },
      "bearer",
    )
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "x-indihub-user-id",
        description:
          "Local development only: platform user id bridge for non-back-office customer, seller, B2B, and delivery role testing.",
      },
      "local-dev-user",
    )
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "x-clerk-user-id",
        description:
          "Local development only: Clerk user id fallback when real Clerk bearer verification is not configured.",
      },
      "local-clerk-user",
    )
    .build();
}
