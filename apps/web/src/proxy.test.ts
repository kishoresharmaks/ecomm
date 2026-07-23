import { describe, expect, it } from "vitest";
import { config } from "./proxy";

describe("web proxy matcher", () => {
  it("runs for RSC and prefetch requests so Clerk auth has middleware context", () => {
    expect(config.matcher).toHaveLength(1);
    expect(config.matcher[0]).not.toHaveProperty("missing");
  });
});
