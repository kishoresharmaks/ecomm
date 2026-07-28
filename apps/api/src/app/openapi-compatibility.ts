export type OpenApiSchema = Record<string, unknown>;

export type OpenApiDocument = {
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, OpenApiSchema> };
};

export type BreakingOpenApiChange = {
  location: string;
  reason: string;
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

export function findBreakingOpenApiChanges(
  baseline: OpenApiDocument,
  candidate: OpenApiDocument,
): BreakingOpenApiChange[] {
  const changes: BreakingOpenApiChange[] = [];

  comparePaths(baseline, candidate, changes);
  compareSchemas(baseline, candidate, changes);

  return changes;
}

function comparePaths(
  baseline: OpenApiDocument,
  candidate: OpenApiDocument,
  changes: BreakingOpenApiChange[],
) {
  for (const [path, baselineItem] of Object.entries(baseline.paths ?? {})) {
    const candidateItem = candidate.paths?.[path];
    if (!candidateItem) {
      changes.push({ location: path, reason: "path removed" });
      continue;
    }

    for (const method of HTTP_METHODS) {
      if (baselineItem[method] && !candidateItem[method]) {
        changes.push({
          location: `${method.toUpperCase()} ${path}`,
          reason: "operation removed",
        });
      }
    }
  }
}

function compareSchemas(
  baseline: OpenApiDocument,
  candidate: OpenApiDocument,
  changes: BreakingOpenApiChange[],
) {
  const candidateSchemas = candidate.components?.schemas ?? {};

  for (const [name, baselineSchema] of Object.entries(
    baseline.components?.schemas ?? {},
  )) {
    const candidateSchema = candidateSchemas[name];
    if (!candidateSchema) {
      changes.push({
        location: `components.schemas.${name}`,
        reason: "schema removed",
      });
      continue;
    }

    compareSchema(name, baselineSchema, candidateSchema, changes);
  }
}

function compareSchema(
  name: string,
  baseline: OpenApiSchema,
  candidate: OpenApiSchema,
  changes: BreakingOpenApiChange[],
) {
  if (baseline.type && candidate.type && baseline.type !== candidate.type) {
    changes.push({
      location: `components.schemas.${name}`,
      reason: `type changed from ${String(baseline.type)} to ${String(candidate.type)}`,
    });
  }

  const baselineRequired = new Set(
    Array.isArray(baseline.required) ? (baseline.required as string[]) : [],
  );
  const candidateRequired = new Set(
    Array.isArray(candidate.required) ? (candidate.required as string[]) : [],
  );
  const baselineProperties = asRecord(baseline.properties);
  const candidateProperties = asRecord(candidate.properties);

  for (const property of Object.keys(baselineProperties)) {
    if (!(property in candidateProperties)) {
      changes.push({
        location: `components.schemas.${name}.${property}`,
        reason: "property removed",
      });
    }
  }

  for (const property of candidateRequired) {
    if (!baselineRequired.has(property)) {
      changes.push({
        location: `components.schemas.${name}.${property}`,
        reason: "property became required",
      });
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
