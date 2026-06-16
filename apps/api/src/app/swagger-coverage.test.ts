import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listControllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      return listControllerFiles(entryPath);
    }

    return entry.endsWith(".controller.ts") ? [entryPath] : [];
  });
}

describe("Swagger/OpenAPI coverage", () => {
  const sourceRoot = path.resolve(process.cwd(), "src");

  it("keeps every controller grouped with Swagger tags", () => {
    const missingTags = listControllerFiles(sourceRoot)
      .filter((filePath) => readFileSync(filePath, "utf8").includes("@Controller"))
      .filter((filePath) => !readFileSync(filePath, "utf8").includes("@ApiTags"));

    expect(missingTags).toEqual([]);
  });

  it("documents every route method with an operation summary", () => {
    const undocumentedRoutes = listControllerFiles(sourceRoot).flatMap((filePath) => {
      const text = readFileSync(filePath, "utf8");
      const routeCount = [...text.matchAll(/@(Get|Post|Put|Patch|Delete)\b/g)].length;
      const operationCount = [...text.matchAll(/@ApiOperation\b/g)].length;

      return routeCount > operationCount
        ? [`${path.relative(sourceRoot, filePath)} has ${routeCount} routes and ${operationCount} ApiOperation decorators`]
        : [];
    });

    expect(undocumentedRoutes).toEqual([]);
  });

  it("exports the full API document with deep route scanning enabled", () => {
    const mainSource = readFileSync(path.join(sourceRoot, "main.ts"), "utf8");

    expect(mainSource).toContain("deepScanRoutes: true");
    expect(mainSource).toContain('jsonDocumentUrl: "api/openapi.json"');
    expect(mainSource).toContain('yamlDocumentUrl: "api/openapi.yaml"');
  });
});
