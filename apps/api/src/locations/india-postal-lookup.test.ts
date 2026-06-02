import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { attachStoredIndiaPostalComparison, normalizeIndiaPostalLookupQuery, normalizePostalPinPayload } from "./india-postal-lookup";

describe("India PostalPin lookup helpers", () => {
  it("builds a pincode lookup request", () => {
    expect(normalizeIndiaPostalLookupQuery({ pincode: "110001" })).toEqual({
      queryType: "PINCODE",
      query: "110001",
      sourceUrl: "https://api.postalpincode.in/pincode/110001"
    });
  });

  it("builds a post-office lookup request", () => {
    expect(normalizeIndiaPostalLookupQuery({ postOffice: " Connaught   Place " })).toEqual({
      queryType: "POST_OFFICE",
      query: "Connaught Place",
      sourceUrl: "https://api.postalpincode.in/postoffice/Connaught%20Place"
    });
  });

  it("rejects invalid lookup input", () => {
    expect(() => normalizeIndiaPostalLookupQuery({ pincode: "000000" })).toThrow(BadRequestException);
    expect(() => normalizeIndiaPostalLookupQuery({ pincode: "110001", postOffice: "Connaught" })).toThrow(BadRequestException);
    expect(() => normalizeIndiaPostalLookupQuery({})).toThrow(BadRequestException);
  });

  it("normalizes successful and no-result PostalPin payloads", () => {
    const success = normalizePostalPinPayload(
      {
        queryType: "PINCODE",
        query: "110001",
        sourceUrl: "https://api.postalpincode.in/pincode/110001"
      },
      [
        {
          Message: "Number of pincode(s) found:1",
          Status: "Success",
          PostOffice: [
            {
              Name: "Baroda House",
              BranchType: "Sub Post Office",
              DeliveryStatus: "Non-Delivery",
              Circle: "Delhi",
              District: "Central Delhi",
              Division: "New Delhi Central",
              Region: "Delhi",
              Block: "New Delhi",
              State: "Delhi",
              Country: "India",
              Pincode: "110001"
            }
          ]
        }
      ]
    );

    expect(success).toMatchObject({
      provider: "api.postalpincode.in",
      status: "SUCCESS",
      postOffices: [
        expect.objectContaining({
          name: "Baroda House",
          state: "Delhi",
          pincode: "110001"
        })
      ]
    });

    const empty = normalizePostalPinPayload(
      {
        queryType: "PINCODE",
        query: "999999",
        sourceUrl: "https://api.postalpincode.in/pincode/999999"
      },
      [{ Message: "No records found", Status: "Error", PostOffice: null }]
    );

    expect(empty).toMatchObject({
      status: "NOT_FOUND",
      message: "No records found",
      postOffices: []
    });
  });

  it("compares PostalPin lookup records with stored database areas", () => {
    const result = normalizePostalPinPayload(
      {
        queryType: "PINCODE",
        query: "110001",
        sourceUrl: "https://api.postalpincode.in/pincode/110001"
      },
      [
        {
          Message: "Number of pincode(s) found:2",
          Status: "Success",
          PostOffice: [
            { Name: "Baroda House", Pincode: "110001", State: "Delhi", District: "Central Delhi" },
            { Name: "Connaught Place", Pincode: "110001", State: "Delhi", District: "Central Delhi" }
          ]
        }
      ]
    );

    const compared = attachStoredIndiaPostalComparison(result, [
      {
        code: "PIN-110001-BARODA",
        name: "Baroda House",
        postalCode: "110001",
        cityName: "Central Delhi",
        cityCode: "IN-DL-CENTRAL-DELHI",
        stateName: "Delhi",
        stateCode: "IN-DL",
        source: "INDIA_OGD_PINCODES",
        metadata: { deliveryStatus: "Non-Delivery" }
      },
      {
        code: "PIN-110001-EXTRA",
        name: "Extra Db Area",
        postalCode: "110001",
        cityName: "Central Delhi",
        cityCode: "IN-DL-CENTRAL-DELHI",
        stateName: "Delhi",
        stateCode: "IN-DL",
        source: "INDIA_OGD_PINCODES",
        metadata: null
      }
    ]);

    expect(compared.comparison).toMatchObject({
      status: "PARTIAL",
      storedAreaCount: 2,
      matchedPostOfficeCount: 1,
      missingPostOfficeCount: 1,
      extraStoredAreaCount: 1
    });
    expect(compared.postOffices[0]?.databaseMatch).toMatchObject({ code: "PIN-110001-BARODA" });
    expect(compared.postOffices[1]?.databaseMatch).toBeNull();
  });
});
