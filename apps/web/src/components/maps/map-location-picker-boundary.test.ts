import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./map-location-picker.tsx", import.meta.url), "utf8");

describe("map location picker callback boundary", () => {
  it("does not use an unstable parent callback as an effect dependency", () => {
    expect(source).toContain("const onChangeRef = useRef(onChange);");
    expect(source).toContain("onChangeRef.current?.({");
    expect(source).not.toContain("longitude, onChange]);");
  });
});
