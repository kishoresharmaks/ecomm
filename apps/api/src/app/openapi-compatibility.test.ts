import { describe, expect, it } from "vitest";
import {
  findBreakingOpenApiChanges,
  type OpenApiDocument,
} from "./openapi-compatibility";

const baseline: OpenApiDocument = {
  paths: {
    "/api/orders": {
      get: { responses: {} },
      post: { responses: {} },
    },
  },
  components: {
    schemas: {
      Order: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
};

describe("OpenAPI compatibility", () => {
  it("allows additive paths and optional fields", () => {
    const candidate = structuredClone(baseline);
    candidate.paths!["/api/health"] = { get: { responses: {} } };
    candidate.components!.schemas!.Order!.properties = {
      ...(candidate.components!.schemas!.Order!.properties as Record<
        string,
        unknown
      >),
      status: { type: "string" },
    };

    expect(findBreakingOpenApiChanges(baseline, candidate)).toEqual([]);
  });

  it("reports removed paths and schemas", () => {
    const candidate = structuredClone(baseline);
    delete candidate.paths!["/api/orders"];
    delete candidate.components!.schemas!.Order;

    expect(findBreakingOpenApiChanges(baseline, candidate)).toEqual([
      { location: "/api/orders", reason: "path removed" },
      { location: "components.schemas.Order", reason: "schema removed" },
    ]);
  });

  it("reports removed operations and properties plus newly required properties", () => {
    const candidate = structuredClone(baseline);
    delete candidate.paths!["/api/orders"]!.post;
    const orderSchema = candidate.components!.schemas!.Order!;
    delete (orderSchema.properties as Record<string, unknown>).note;
    (orderSchema.required as string[]).push("status");

    expect(findBreakingOpenApiChanges(baseline, candidate)).toEqual([
      { location: "POST /api/orders", reason: "operation removed" },
      { location: "components.schemas.Order.note", reason: "property removed" },
      {
        location: "components.schemas.Order.status",
        reason: "property became required",
      },
    ]);
  });

  it("reports schema type changes", () => {
    const candidate = structuredClone(baseline);
    candidate.components!.schemas!.Order!.type = "array";

    expect(findBreakingOpenApiChanges(baseline, candidate)).toEqual([
      {
        location: "components.schemas.Order",
        reason: "type changed from object to array",
      },
    ]);
  });
});
