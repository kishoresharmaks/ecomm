import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import type { Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app/app.module";
import { createCorsOptions } from "./app/cors";
import { createSwaggerConfig } from "./app/swagger";
import { PinoNestLogger, apiLogger } from "./common/observability/api-logger";
import { HttpLoggingInterceptor } from "./common/observability/http-logging.interceptor";
import { requestContextMiddleware } from "./common/observability/request-context";
import { createRateLimitMiddleware, rateLimitOptionsFromEnv } from "./rate-limit/request-rate-limiter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true
  });
  app.useLogger(new PinoNestLogger());
  app.use(requestContextMiddleware);
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // Prevent search engines from crawling the API domain
  app.use("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /\n");
  });

  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });

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

  const swaggerConfig = createSwaggerConfig();

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

  apiLogger.info({ publicHost, port }, "1HandIndia API listening");
  apiLogger.info({ url: `http://${publicHost}:${port}/api/docs` }, "1HandIndia API docs available");
}

bootstrap().catch((error) => {
  apiLogger.fatal({ err: error }, "Failed to start 1HandIndia API");
  process.exit(1);
});
