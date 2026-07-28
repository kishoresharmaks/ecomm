import { describe, expect, it } from "vitest";
import { findBreakingOpenApiChanges } from "./openapi-contract";

const base = {
  paths: {
    "/api/orders": { get: { responses: {} }, post: { responses: {} } },
  },
  components: {
    schemas: {
      Order: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" }, note: { type: "string" } },
      },
    },
  },
};

describe("OpenAPI compatibility", () => {
  it("allows additive paths and optional fields", () => {
    const candidate = structuredClone(base);
    candidate.paths["/api/health"] = { get: { responses: {} } };
    candidate.components.schemas.Order.properties.status = { type: "string" };
    expect(findBreakingOpenApiChanges(base, candidate)).toEqual([]);
  });

  it("reports removed operations, fields and newly required fields", () => {
    const candidate = structuredClone(base);
    delete candidate.paths["/api/orders"].post;
    delete candidate.components.schemas.Order.properties.note;
    candidate.components.schemas.Order.required.push("status");
    expect(findBreakingOpenApiChanges(base, candidate)).toEqual([
      { location: "POST /api/orders", reason: "operation removed" },
      { location: "components.schemas.Order.note", reason: "property removed" },
      { location: "components.schemas.Order.status", reason: "property became required" },
    ]);
  });
});
