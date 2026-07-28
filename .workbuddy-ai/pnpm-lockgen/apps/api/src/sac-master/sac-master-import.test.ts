import { describe, expect, it } from "vitest";
import {
  normalizeSacRows,
  parseNormalizedSacCsv,
  planSacImport,
  sacImportChecksum,
} from "./sac-master-import";

describe("SAC master import", () => {
  it("parses quoted normalized CSV and sorts SAC codes", () => {
    expect(
      parseNormalizedSacCsv(
        'sac_code,description\n998719,"Maintenance and repair services, other"\n996511,Road transport services\n',
      ),
    ).toEqual([
      { sacCode: "996511", description: "Road transport services" },
      { sacCode: "998719", description: "Maintenance and repair services, other" },
    ]);
  });

  it("rejects invalid and conflicting SAC rows", () => {
    expect(() => normalizeSacRows([{ sacCode: "9987", description: "Repair" }])).toThrow(
      "exactly 6 digits",
    );
    expect(() =>
      normalizeSacRows([
        { sacCode: "998719", description: "Repair service" },
        { sacCode: "998719", description: "Different service" },
      ]),
    ).toThrow("different descriptions");
  });

  it("produces a stable checksum independent of input order", () => {
    const first = [
      { sacCode: "998719", description: "Repair service" },
      { sacCode: "996511", description: "Road transport service" },
    ];
    expect(sacImportChecksum(first)).toBe(sacImportChecksum([...first].reverse()));
  });

  it("plans insert, update, reactivation, and optional deactivation", () => {
    const plan = planSacImport(
      [
        { sacCode: "996511", description: "Road transport services" },
        { sacCode: "998719", description: "Updated repair services" },
        { sacCode: "999111", description: "New service classification" },
      ],
      [
        { id: "1", sacCode: "996511", description: "Road transport services", isActive: true },
        { id: "2", sacCode: "998719", description: "Old repair services", isActive: false },
        { id: "3", sacCode: "997111", description: "Removed service", isActive: true },
      ],
      true,
    );

    expect(plan.inserts.map((row) => row.sacCode)).toEqual(["999111"]);
    expect(plan.updates.map((row) => [row.sacCode, row.wasActive])).toEqual([
      ["998719", false],
    ]);
    expect(plan.unchanged.map((row) => row.sacCode)).toEqual(["996511"]);
    expect(plan.deactivations.map((row) => row.sacCode)).toEqual(["997111"]);
  });
});
