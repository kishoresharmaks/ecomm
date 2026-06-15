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
    .setDescription("Phase 1 marketplace API for storefront, seller, B2B, admin, orders, delivery, and email workflows.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

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
