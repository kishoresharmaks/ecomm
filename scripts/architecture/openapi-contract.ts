import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findBreakingOpenApiChanges,
  type OpenApiDocument,
} from "../../apps/api/src/app/openapi-compatibility";

export { findBreakingOpenApiChanges };

export async function exportOpenApiContract(projectRoot: string) {
  process.env.INDIHUB_SKIP_BOOTSTRAP_SIDE_EFFECTS = "true";
  const [{ NestFactory }, { SwaggerModule }, { AppModule }, { createSwaggerConfig }] = await Promise.all([
    import("@nestjs/core"),
    import("@nestjs/swagger"),
    import(resolve(projectRoot, "apps/api/src/app/app.module.ts")),
    import(resolve(projectRoot, "apps/api/src/app/swagger.ts")),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix("api");
  const document = SwaggerModule.createDocument(app, createSwaggerConfig(), {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => `${controllerKey}_${methodKey}`,
  });
  await app.close();
  return document as OpenApiDocument;
}

async function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const compareArg = process.argv.find((arg) => arg.startsWith("--compare="));
  const output = resolve(
    projectRoot,
    outputArg?.slice("--output=".length) || "docs/architecture/contracts/openapi.json",
  );
  const document = await exportOpenApiContract(projectRoot);
  if (compareArg) {
    const baseline = JSON.parse(
      readFileSync(resolve(projectRoot, compareArg.slice("--compare=".length)), "utf8"),
    ) as OpenApiDocument;
    const changes = findBreakingOpenApiChanges(baseline, document);
    if (changes.length) {
      console.error("Breaking OpenAPI changes:", changes);
      process.exitCode = 1;
    } else console.log("No breaking OpenAPI changes detected.");
  } else {
    writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
    console.log(`OpenAPI contract written to ${output}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error("OpenAPI contract command failed", error);
    process.exitCode = 1;
  });
}
