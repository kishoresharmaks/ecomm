import { describe, expect, it } from "vitest";
import { buildIndiaPincodeDataset, parseIndiaPincodeCsv } from "./india-pincode-importer";

describe("India pincode importer", () => {
  it("parses Department of Posts CSV rows", () => {
    const records = parseIndiaPincodeCsv(
      [
        "officename,pincode,officeType,Deliverystatus,divisionname,regionname,circlename,Taluk,Districtname,statename",
        "Ada B.O,504293,B.O,Delivery,Adilabad,Hyderabad,Andhra Pradesh,Asifabad,Adilabad,ANDHRA PRADESH"
      ].join("\n")
    );

    expect(records).toEqual([
      {
        officename: "Ada B.O",
        pincode: "504293",
        officeType: "B.O",
        deliveryStatus: "Delivery",
        division: "Adilabad",
        region: "Hyderabad",
        circle: "Andhra Pradesh",
        taluk: "Asifabad",
        block: "",
        district: "Adilabad",
        statename: "ANDHRA PRADESH"
      }
    ]);
  });

  it("maps India Post records into state, district, local-area, and pincode hierarchy", () => {
    const result = buildIndiaPincodeDataset([
      {
        officename: "Kothimir B.O",
        pincode: "504273",
        district: "KUMURAM BHEEM ASIFABAD",
        statename: "TELANGANA"
      },
      {
        officename: "Papanpet B.O",
        pincode: "504299",
        district: "KUMURAM BHEEM ASIFABAD",
        statename: "TELANGANA"
      }
    ]);

    const india = result.dataset.countries[0];
    const telangana = india?.subdivisions?.find((subdivision) => subdivision.code === "IN-TG");
    const district = telangana?.cities?.find((city) => city.code === "IN-TG-KUMURAM-BHEEM-ASIFABAD");

    expect(result.acceptedRows).toBe(2);
    expect(result.skippedRows).toBe(0);
    expect(india?.subdivisions).toHaveLength(36);
    expect(telangana).toMatchObject({ name: "Telangana", type: "State" });
    expect(district).toMatchObject({ name: "Kumuram Bheem Asifabad" });
    expect(district?.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Kothimir",
          postalCode: "504273",
          metadata: expect.objectContaining({
            sourceOfficeName: "Kothimir B.O",
            sourceDistrict: "KUMURAM BHEEM ASIFABAD",
            sourceState: "TELANGANA"
          })
        }),
        expect.objectContaining({ name: "Papanpet", postalCode: "504299" })
      ])
    );
    expect(result.quality).toMatchObject({
      totalRows: 2,
      acceptedRows: 2,
      skippedRows: 0,
      uniquePincodes: 2,
      localAreaCount: 2,
      readyToApply: true
    });
  });

  it("normalizes known India Post state aliases", () => {
    const result = buildIndiaPincodeDataset([
      {
        officename: "Lawspet S.O",
        pincode: 605008,
        district: "PONDICHERRY",
        statename: "PONDICHERRY"
      }
    ]);

    const puducherry = result.dataset.countries[0]?.subdivisions?.find((subdivision) => subdivision.code === "IN-PY");

    expect(result.acceptedRows).toBe(1);
    expect(puducherry?.cities?.[0]).toMatchObject({ name: "Pondicherry" });
  });

  it("moves legacy Andhra Pradesh Telangana districts into Telangana", () => {
    const result = buildIndiaPincodeDataset([
      {
        officename: "Ada B.O",
        pincode: "504293",
        district: "Adilabad",
        statename: "ANDHRA PRADESH"
      }
    ]);

    const telangana = result.dataset.countries[0]?.subdivisions?.find((subdivision) => subdivision.code === "IN-TG");

    expect(result.acceptedRows).toBe(1);
    expect(telangana?.cities?.[0]).toMatchObject({ name: "Adilabad" });
  });

  it("skips records with unknown state names or invalid pincodes", () => {
    const result = buildIndiaPincodeDataset([
      {
        officename: "Missing State B.O",
        pincode: "123456",
        district: "Nowhere",
        statename: "Unknown State"
      },
      {
        officename: "Bad Pincode B.O",
        pincode: "000000",
        district: "Chennai",
        statename: "Tamil Nadu"
      }
    ]);

    expect(result.acceptedRows).toBe(0);
    expect(result.skippedRows).toBe(2);
    expect(result.quality).toMatchObject({
      unknownStateRows: 1,
      invalidPincodeRows: 1,
      readyToApply: false
    });
  });

  it("captures duplicate source rows and postal metadata quality counts", () => {
    const result = buildIndiaPincodeDataset([
      {
        officename: "Kothimir B.O",
        pincode: "504273",
        officeType: "B.O",
        deliveryStatus: "Delivery",
        division: "Adilabad",
        region: "Hyderabad",
        circle: "Telangana",
        taluk: "Asifabad",
        district: "KUMURAM BHEEM ASIFABAD",
        statename: "TELANGANA"
      },
      {
        officename: "Kothimir B.O",
        pincode: "504273",
        officetype: "B.O",
        deliverystatus: "Delivery",
        divisionname: "Adilabad",
        regionname: "Hyderabad",
        circlename: "Telangana",
        districtname: "KUMURAM BHEEM ASIFABAD",
        statename: "TELANGANA"
      }
    ]);

    const district = result.dataset.countries[0]?.subdivisions
      ?.find((subdivision) => subdivision.code === "IN-TG")
      ?.cities?.find((city) => city.code === "IN-TG-KUMURAM-BHEEM-ASIFABAD");

    expect(result.quality).toMatchObject({
      acceptedRows: 2,
      duplicateSourceRows: 1,
      uniquePincodes: 1,
      multiOfficePincodes: 1,
      deliveryStatusCounts: { Delivery: 2 },
      officeTypeCounts: { "B.O": 2 }
    });
    expect(district?.areas).toHaveLength(1);
    expect(district?.areas?.[0]?.metadata).toMatchObject({
      officeType: "B.O",
      deliveryStatus: "Delivery",
      division: "Adilabad",
      region: "Hyderabad",
      circle: "Telangana"
    });
  });
});
