import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";
import { createCorsOptions } from "./app/cors";
import { createRateLimitMiddleware, rateLimitOptionsFromEnv } from "./rate-limit/request-rate-limiter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true
  });

  app.enableCors(createCorsOptions());

  app.use(createRateLimitMiddleware(rateLimitOptionsFromEnv()));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.setGlobalPrefix("api");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("1HandIndia API")
    .setDescription(
      "Complete 1HandIndia marketplace OpenAPI map covering storefront, customer account, seller center, B2B, admin, finance, delivery, courier, returns, CMS, support, payments, reports, search, storage, mobile, and webhook workflows."
    )
    .setVersion("0.1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT or admin session token",
        description:
          "Use Clerk bearer tokens for customer/seller/B2B/delivery sessions, or standalone back-office session tokens for admin, finance, and courier-manager routes."
      },
      "bearer"
    )
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "x-indihub-user-id",
        description:
          "Local development only: platform user id bridge for non-back-office customer, seller, B2B, and delivery role testing."
      },
      "local-dev-user"
    )
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "x-clerk-user-id",
        description: "Local development only: Clerk user id fallback when real Clerk bearer verification is not configured."
      },
      "local-clerk-user"
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`
  });
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/openapi.json",
    yamlDocumentUrl: "api/openapi.yaml",
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: "none",
      operationsSorter: "alpha",
      persistAuthorization: true,
      tagsSorter: "alpha"
    }
  });

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST?.trim() || "0.0.0.0";
  const publicHost = process.env.API_PUBLIC_HOST?.trim() || host;
  await app.listen(port, host);

  console.log(`1HandIndia API listening on http://${publicHost}:${port}/api`);
  console.log(`1HandIndia API docs available on http://${publicHost}:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error("Failed to start 1HandIndia API", error);
  process.exit(1);
});
