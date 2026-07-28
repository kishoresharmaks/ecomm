import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type ArchitectureContext = {
  name: string;
  kind: "business" | "composition" | "platform";
  roots: string[];
};

export type BaselineEdge = {
  from: string;
  to: string;
  count: number;
};

export type ArchitectureConfig = {
  schemaVersion: number;
  scanRoots: string[];
  extensions: string[];
  exclude: string[];
  contexts: ArchitectureContext[];
  policy: {
    unrestrictedSources: string[];
    unrestrictedTargets: string[];
    allowedDependencies: Record<string, string[]>;
  };
  baseline: BaselineEdge[];
};

export type BoundaryViolation = {
  source: string;
  target: string;
  specifier: string;
  from: string;
  to: string;
};

export type BoundaryCheckResult = {
  violations: BoundaryViolation[];
  current: BaselineEdge[];
  newEdges: BaselineEdge[];
  growingEdges: Array<BaselineEdge & { baselineCount: number }>;
  staleEdges: Array<BaselineEdge & { currentCount: number }>;
};

const importPattern = /(?:\bimport\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?|\bexport\s+(?:type\s+)?[^"'`;]*?\s+from\s+|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;

function normalizePath(path: string) {
  return path.split(sep).join("/").replace(/^\.\//, "");
}

function matchesExcluded(path: string, patterns: string[]) {
  return patterns.some((pattern) => {
    if (pattern.startsWith("**/*.") && path.endsWith(pattern.slice(4))) return true;
    if (pattern.startsWith("**/") && pattern.endsWith("/**")) {
      return path.includes(`/${pattern.slice(3, -3)}/`) || path.startsWith(`${pattern.slice(3, -3)}/`);
    }
    return path === pattern;
  });
}

function walk(root: string, extensions: Set<string>, excluded: string[], projectRoot: string): string[] {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return extensions.has(extname(root)) ? [root] : [];

  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    const projectPath = normalizePath(relative(projectRoot, absolute));
    if (matchesExcluded(projectPath, excluded)) continue;
    if (entry.isDirectory()) files.push(...walk(absolute, extensions, excluded, projectRoot));
    else if (extensions.has(extname(entry.name))) files.push(absolute);
  }
  return files;
}

function resolveRelativeImport(source: string, specifier: string, extensions: string[]) {
  if (!specifier.startsWith(".")) return undefined;
  const candidate = resolve(dirname(source), specifier);
  const candidates = [
    candidate,
    ...extensions.map((extension) => `${candidate}${extension}`),
    ...extensions.map((extension) => join(candidate, `index${extension}`)),
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile());
}

function contextFor(projectPath: string, contexts: ArchitectureContext[]) {
  const candidates = contexts
    .flatMap((context) => context.roots.map((root) => ({ context: context.name, root: normalizePath(root) })))
    .filter(({ root }) => projectPath === root || projectPath.startsWith(`${root}/`))
    .sort((left, right) => right.root.length - left.root.length);
  return candidates[0]?.context;
}

function isAllowed(from: string, to: string, config: ArchitectureConfig) {
  if (from === to) return true;
  if (config.policy.unrestrictedSources.includes(from)) return true;
  if (config.policy.unrestrictedTargets.includes(to)) return true;
  return config.policy.allowedDependencies[from]?.includes(to) ?? false;
}

export function scanBoundaryViolations(projectRoot: string, config: ArchitectureConfig) {
  const extensions = new Set(config.extensions);
  const sourceFiles = config.scanRoots.flatMap((root) =>
    walk(resolve(projectRoot, root), extensions, config.exclude, projectRoot),
  );
  const violations: BoundaryViolation[] = [];

  for (const sourceFile of sourceFiles) {
    const source = normalizePath(relative(projectRoot, sourceFile));
    const from = contextFor(source, config.contexts);
    if (!from) continue;

    const contents = readFileSync(sourceFile, "utf8");
    importPattern.lastIndex = 0;
    for (const match of contents.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) continue;
      const resolvedTarget = resolveRelativeImport(sourceFile, specifier, config.extensions);
      if (!resolvedTarget) continue;
      const target = normalizePath(relative(projectRoot, resolvedTarget));
      const to = contextFor(target, config.contexts);
      if (!to || isAllowed(from, to, config)) continue;
      violations.push({ source, target, specifier, from, to });
    }
  }

  return violations.sort((left, right) =>
    `${left.from}:${left.to}:${left.source}:${left.specifier}`.localeCompare(
      `${right.from}:${right.to}:${right.source}:${right.specifier}`,
    ),
  );
}

export function summarizeViolationEdges(violations: BoundaryViolation[]): BaselineEdge[] {
  const counts = new Map<string, number>();
  for (const violation of violations) {
    const key = `${violation.from}\0${violation.to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [from = "", to = ""] = key.split("\0");
      return { from, to, count };
    })
    .sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`));
}

export function compareBoundaryBaseline(
  violations: BoundaryViolation[],
  baseline: BaselineEdge[],
): BoundaryCheckResult {
  const current = summarizeViolationEdges(violations);
  const baselineByEdge = new Map(baseline.map((edge) => [`${edge.from}\0${edge.to}`, edge.count]));
  const currentByEdge = new Map(current.map((edge) => [`${edge.from}\0${edge.to}`, edge.count]));
  const newEdges: BaselineEdge[] = [];
  const growingEdges: Array<BaselineEdge & { baselineCount: number }> = [];
  const staleEdges: Array<BaselineEdge & { currentCount: number }> = [];

  for (const edge of current) {
    const baselineCount = baselineByEdge.get(`${edge.from}\0${edge.to}`);
    if (baselineCount === undefined) newEdges.push(edge);
    else if (edge.count > baselineCount) growingEdges.push({ ...edge, baselineCount });
  }
  for (const edge of baseline) {
    const currentCount = currentByEdge.get(`${edge.from}\0${edge.to}`) ?? 0;
    if (currentCount < edge.count) staleEdges.push({ ...edge, currentCount });
  }

  return { violations, current, newEdges, growingEdges, staleEdges };
}

export function loadArchitectureConfig(projectRoot: string) {
  const path = resolve(projectRoot, "config/architecture-boundaries.json");
  return JSON.parse(readFileSync(path, "utf8")) as ArchitectureConfig;
}

export function runBoundaryCheck(projectRoot: string, verifyBaseline = false) {
  const config = loadArchitectureConfig(projectRoot);
  validateConfig(config);
  const result = compareBoundaryBaseline(scanBoundaryViolations(projectRoot, config), config.baseline);
  const failed = result.newEdges.length > 0 || result.growingEdges.length > 0;
  const baselineMismatch = verifyBaseline && result.staleEdges.length > 0;
  return { ...result, failed: failed || baselineMismatch };
}

function validateConfig(config: ArchitectureConfig) {
  if (config.schemaVersion !== 1) throw new Error(`Unsupported architecture schemaVersion: ${config.schemaVersion}`);
  const contextNames = config.contexts.map((context) => context.name);
  if (new Set(contextNames).size !== contextNames.length) throw new Error("Context names must be unique.");
  const rootOwners = new Map<string, string>();
  for (const context of config.contexts) {
    for (const root of context.roots) {
      const normalized = normalizePath(root);
      const owner = rootOwners.get(normalized);
      if (owner) throw new Error(`Context root ${normalized} is owned by both ${owner} and ${context.name}.`);
      rootOwners.set(normalized, context.name);
    }
  }
  for (const edge of config.baseline) {
    if (!contextNames.includes(edge.from) || !contextNames.includes(edge.to) || edge.count < 1) {
      throw new Error(`Invalid baseline edge: ${JSON.stringify(edge)}`);
    }
  }
}

function writeBaseline(projectRoot: string) {
  const configPath = resolve(projectRoot, "config/architecture-boundaries.json");
  const config = loadArchitectureConfig(projectRoot);
  validateConfig(config);
  config.baseline = summarizeViolationEdges(scanBoundaryViolations(projectRoot, config));
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Architecture baseline updated: ${config.baseline.length} context edges.`);
}

function printResult(result: ReturnType<typeof runBoundaryCheck>, verifyBaseline: boolean) {
  console.log(
    `Architecture boundaries: ${result.violations.length} current violation(s) across ${result.current.length} context edge(s).`,
  );
  if (result.newEdges.length) console.error("New context edges:", result.newEdges);
  if (result.growingEdges.length) console.error("Growing context edges:", result.growingEdges);
  if (verifyBaseline && result.staleEdges.length) {
    console.error("Baseline can be tightened (current count is lower):", result.staleEdges);
  }
  if (!result.failed) {
    console.log(verifyBaseline ? "Architecture baseline exactly matches current debt." : "No new or growing boundary debt.");
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const projectRootArg = process.argv.find((argument) => argument.startsWith("--project-root="));
  const projectRoot = projectRootArg
    ? resolve(projectRootArg.slice("--project-root=".length))
    : resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  if (process.argv.includes("--write-baseline")) writeBaseline(projectRoot);
  else {
    const verifyBaseline = process.argv.includes("--verify-baseline");
    const result = runBoundaryCheck(projectRoot, verifyBaseline);
    printResult(result, verifyBaseline);
    if (result.failed) process.exitCode = 1;
  }
}
