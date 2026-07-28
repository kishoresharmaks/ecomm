import { describe, expect, it } from "vitest";
import {
  compareBoundaryBaseline,
  summarizeViolationEdges,
  type BoundaryViolation,
} from "./check-boundaries";
import {
  checkPrismaOwnership,
  extractPrismaModels,
  parseOwnershipDocument,
} from "./check-prisma-ownership";

const violations: BoundaryViolation[] = [
  { source: "a.ts", target: "b.ts", specifier: "../b", from: "orders", to: "finance" },
  { source: "c.ts", target: "d.ts", specifier: "../d", from: "orders", to: "finance" },
];

describe("architecture boundary baseline", () => {
  it("groups violations into stable context-edge counts", () => {
    expect(summarizeViolationEdges(violations)).toEqual([
      { from: "orders", to: "finance", count: 2 },
    ]);
  });

  it("blocks new and growing edges while exposing removable debt", () => {
    expect(compareBoundaryBaseline(violations, []).newEdges).toEqual([
      { from: "orders", to: "finance", count: 2 },
    ]);
    expect(
      compareBoundaryBaseline(violations, [{ from: "orders", to: "finance", count: 1 }])
        .growingEdges,
    ).toEqual([{ from: "orders", to: "finance", count: 2, baselineCount: 1 }]);
    expect(
      compareBoundaryBaseline(violations.slice(0, 1), [
        { from: "orders", to: "finance", count: 2 },
      ]).staleEdges,
    ).toEqual([{ from: "orders", to: "finance", count: 2, currentCount: 1 }]);
  });
});

describe("Prisma ownership", () => {
  const schema = "model User {\n id String @id\n}\nmodel Order {\n id String @id\n}\n";
  const manifest = `---\nschemaVersion: 1\nschema: prisma/schema.prisma\n---\n\n## Context: \`identity\`\n\n- \`User\`\n\n## Context: \`orders\`\n\n- \`Order\`\n`;

  it("extracts schema models and ownership sections", () => {
    expect(extractPrismaModels(schema)).toEqual(["Order", "User"]);
    expect(parseOwnershipDocument(manifest).contexts).toEqual({
      identity: ["User"],
      orders: ["Order"],
    });
  });

  it("detects missing, unknown and duplicate model ownership", () => {
    const invalid = `${manifest}\n## Context: \`other\`\n\n- \`User\`\n- \`Ghost\`\n`;
    expect(checkPrismaOwnership(schema, invalid)).toMatchObject({
      missingModels: [],
      unknownModels: ["Ghost"],
      duplicateModels: [{ model: "User", contexts: ["identity", "other"] }],
    });
  });
});
