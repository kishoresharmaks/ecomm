import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type OwnershipManifest = {
  schemaVersion: number;
  schema: string;
  contexts: Record<string, string[]>;
};

export type OwnershipCheckResult = {
  schemaModels: string[];
  ownedModels: string[];
  missingModels: string[];
  unknownModels: string[];
  duplicateModels: Array<{ model: string; contexts: string[] }>;
};

const contextHeadingPattern = /^##\s+Context:\s+`([^`]+)`\s*$/gm;
const modelPattern = /^-\s+`([A-Za-z][A-Za-z0-9_]*)`\s*$/gm;

export function extractPrismaModels(schema: string) {
  return [...schema.matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)]
    .map((match) => match[1])
    .filter((model): model is string => Boolean(model))
    .sort();
}

export function parseOwnershipDocument(markdown: string): OwnershipManifest {
  const frontMatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontMatter?.[1]) throw new Error("Prisma ownership document must start with YAML front matter.");
  const schemaVersion = Number(frontMatter[1].match(/^schemaVersion:\s*(\d+)\s*$/m)?.[1]);
  const schema = frontMatter[1].match(/^schema:\s*([^\r\n]+)\s*$/m)?.[1]?.trim();
  if (schemaVersion !== 1 || !schema) throw new Error("Ownership front matter requires schemaVersion: 1 and schema.");

  const headings = [...markdown.matchAll(contextHeadingPattern)];
  if (!headings.length) throw new Error("Ownership document has no context sections.");
  const contexts: Record<string, string[]> = {};
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const name = heading?.[1];
    if (!heading || !name) continue;
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    contexts[name] = [...section.matchAll(modelPattern)]
      .map((match) => match[1])
      .filter((model): model is string => Boolean(model));
  }
  return { schemaVersion, schema, contexts };
}

export function checkPrismaOwnership(schema: string, markdown: string): OwnershipCheckResult {
  const schemaModels = extractPrismaModels(schema);
  const manifest = parseOwnershipDocument(markdown);
  const owners = new Map<string, string[]>();
  for (const [context, models] of Object.entries(manifest.contexts)) {
    for (const model of models) owners.set(model, [...(owners.get(model) ?? []), context]);
  }
  const ownedModels = [...owners.keys()].sort();
  const schemaSet = new Set(schemaModels);
  const missingModels = schemaModels.filter((model) => !owners.has(model));
  const unknownModels = ownedModels.filter((model) => !schemaSet.has(model));
  const duplicateModels = [...owners.entries()]
    .filter(([, contexts]) => contexts.length > 1)
    .map(([model, contexts]) => ({ model, contexts: [...contexts].sort() }))
    .sort((left, right) => left.model.localeCompare(right.model));
  return { schemaModels, ownedModels, missingModels, unknownModels, duplicateModels };
}

export function runPrismaOwnershipCheck(projectRoot: string) {
  const ownershipPath = resolve(projectRoot, "docs/architecture/prisma-model-ownership.md");
  const markdown = readFileSync(ownershipPath, "utf8");
  const manifest = parseOwnershipDocument(markdown);
  const schemaPath = resolve(projectRoot, manifest.schema);
  const result = checkPrismaOwnership(readFileSync(schemaPath, "utf8"), markdown);
  return {
    ...result,
    failed:
      result.missingModels.length > 0 ||
      result.unknownModels.length > 0 ||
      result.duplicateModels.length > 0,
  };
}

function printResult(result: ReturnType<typeof runPrismaOwnershipCheck>) {
  console.log(
    `Prisma ownership: ${result.schemaModels.length} schema model(s), ${result.ownedModels.length} ownership entr${result.ownedModels.length === 1 ? "y" : "ies"}.`,
  );
  if (result.missingModels.length) console.error("Models without an owner:", result.missingModels);
  if (result.unknownModels.length) console.error("Ownership entries not in schema:", result.unknownModels);
  if (result.duplicateModels.length) console.error("Models with multiple owners:", result.duplicateModels);
  if (!result.failed) console.log("Every Prisma model has exactly one bounded-context owner.");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const projectRootArg = process.argv.find((argument) => argument.startsWith("--project-root="));
  const projectRoot = projectRootArg
    ? resolve(projectRootArg.slice("--project-root=".length))
    : resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = runPrismaOwnershipCheck(projectRoot);
  printResult(result);
  if (result.failed) process.exitCode = 1;
}
