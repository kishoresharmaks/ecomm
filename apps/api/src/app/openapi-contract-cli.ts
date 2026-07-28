import "reflect-metadata";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import {
  findBreakingOpenApiChanges,
  type OpenApiDocument,
} from "./openapi-compatibility";
import { createSwaggerConfig } from "./swagger";

async function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const compareArg = process.argv.find((arg) => arg.startsWith("--compare="));
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix("api");
  const document = SwaggerModule.createDocument(app, createSwaggerConfig(), {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  }) as unknown as OpenApiDocument;
  await app.close();

  if (compareArg) {
    const baseline = JSON.parse(
      readFileSync(resolve(projectRoot, compareArg.slice("--compare=".length)), "utf8"),
    ) as OpenApiDocument;
    const changes = findBreakingOpenApiChanges(baseline, document);
    if (changes.length) {
      console.error("Breaking OpenAPI changes:", changes);
      process.exitCode = 1;
    } else console.log("No breaking OpenAPI changes detected.");
    return;
  }
  const output = resolve(
    projectRoot,
    outputArg?.slice("--output=".length) || "docs/architecture/contracts/openapi.json",
  );
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`OpenAPI contract written to ${output}`);
}

void main().catch((error) => {
  console.error("OpenAPI contract command failed", error);
  process.exitCode = 1;
});
