import { LocationImportSourceType } from "@indihub/database";
import { describe, expect, it } from "vitest";
import { bundledLocationDataset } from "./bundled-location-data";
import { parseNormalizedLocationCsv } from "./location-importer";

describe("location importer", () => {
  it("builds a normalized nested dataset from CSV source rows", () => {
    const dataset = parseNormalizedLocationCsv(
      [
        "country_code,country_name,currency,locale,phone_code,postal_code_label,subdivision_code,subdivision_name,subdivision_type,city_code,city_name,area_code,area_name,postal_code",
        "IN,India,INR,en-IN,+91,Pincode,IN-TN,Tamil Nadu,State,IN-TN-CBE,Coimbatore,IN-TN-CBE-RS,RS Puram,641002",
        "IN,India,INR,en-IN,+91,Pincode,IN-TN,Tamil Nadu,State,IN-TN-CBE,Coimbatore,IN-TN-CBE-GP,Gandhipuram,641012"
      ].join("\n"),
      {
        code: "test_csv",
        name: "Test CSV",
        provider: "Test",
        sourceType: LocationImportSourceType.MANUAL_CSV
      }
    );

    expect(dataset.source.code).toBe("TEST_CSV");
    expect(dataset.countries).toHaveLength(1);
    expect(dataset.countries[0]).toMatchObject({
      code: "IN",
      name: "India",
      subdivisions: [
        {
          code: "IN-TN",
          cities: [
            {
              code: "IN-TN-CBE",
              areas: [
                { code: "IN-TN-CBE-RS", postalCode: "641002" },
                { code: "IN-TN-CBE-GP", postalCode: "641012" }
              ]
            }
          ]
        }
      ]
    });
  });

  it("rejects CSV files that do not include stable hierarchy codes", () => {
    expect(() =>
      parseNormalizedLocationCsv("country_code,country_name\nIN,India", {
        code: "bad_csv",
        name: "Bad CSV",
        provider: "Test",
        sourceType: LocationImportSourceType.MANUAL_CSV
      })
    ).toThrow("Location CSV is missing required column subdivision_code.");
  });

  it("keeps every India state and union territory in the bundled baseline", () => {
    const india = bundledLocationDataset.countries.find((country) => country.code === "IN");

    expect(india?.subdivisions).toHaveLength(36);
    expect(india?.subdivisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IN-AP", name: "Andhra Pradesh", type: "State" }),
        expect.objectContaining({ code: "IN-TN", name: "Tamil Nadu", type: "State" }),
        expect.objectContaining({ code: "IN-DL", name: "Delhi", type: "Union Territory" }),
        expect.objectContaining({ code: "IN-JK", name: "Jammu and Kashmir", type: "Union Territory" }),
        expect.objectContaining({ code: "IN-LA", name: "Ladakh", type: "Union Territory" })
      ])
    );
  });
});
