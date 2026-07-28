import { LocationImportSourceType } from "@indihub/database";
import type { LocationImportDataset, LocationSubdivisionInput } from "./location-importer";

const indiaSubdivisions: LocationSubdivisionInput[] = [
  { code: "IN-AP", name: "Andhra Pradesh", type: "State", sortOrder: 10 },
  { code: "IN-AR", name: "Arunachal Pradesh", type: "State", sortOrder: 20 },
  { code: "IN-AS", name: "Assam", type: "State", sortOrder: 30 },
  { code: "IN-BR", name: "Bihar", type: "State", sortOrder: 40 },
  { code: "IN-CT", name: "Chhattisgarh", type: "State", sortOrder: 50 },
  { code: "IN-GA", name: "Goa", type: "State", sortOrder: 60 },
  { code: "IN-GJ", name: "Gujarat", type: "State", sortOrder: 70 },
  { code: "IN-HR", name: "Haryana", type: "State", sortOrder: 80 },
  { code: "IN-HP", name: "Himachal Pradesh", type: "State", sortOrder: 90 },
  { code: "IN-JH", name: "Jharkhand", type: "State", sortOrder: 100 },
  {
    code: "IN-KA",
    name: "Karnataka",
    type: "State",
    sortOrder: 110,
    cities: [
      {
        code: "IN-KA-BLR",
        name: "Bengaluru",
        sortOrder: 10,
        areas: [
          { code: "IN-KA-BLR-INDIRANAGAR", name: "Indiranagar", postalCode: "560038", sortOrder: 10 },
          { code: "IN-KA-BLR-WHITEFIELD", name: "Whitefield", postalCode: "560066", sortOrder: 20 }
        ]
      }
    ]
  },
  { code: "IN-KL", name: "Kerala", type: "State", sortOrder: 120 },
  { code: "IN-MP", name: "Madhya Pradesh", type: "State", sortOrder: 130 },
  { code: "IN-MH", name: "Maharashtra", type: "State", sortOrder: 140 },
  { code: "IN-MN", name: "Manipur", type: "State", sortOrder: 150 },
  { code: "IN-ML", name: "Meghalaya", type: "State", sortOrder: 160 },
  { code: "IN-MZ", name: "Mizoram", type: "State", sortOrder: 170 },
  { code: "IN-NL", name: "Nagaland", type: "State", sortOrder: 180 },
  { code: "IN-OD", name: "Odisha", type: "State", sortOrder: 190 },
  { code: "IN-PB", name: "Punjab", type: "State", sortOrder: 200 },
  { code: "IN-RJ", name: "Rajasthan", type: "State", sortOrder: 210 },
  { code: "IN-SK", name: "Sikkim", type: "State", sortOrder: 220 },
  {
    code: "IN-TN",
    name: "Tamil Nadu",
    type: "State",
    sortOrder: 230,
    cities: [
      {
        code: "IN-TN-CBE",
        name: "Coimbatore",
        sortOrder: 10,
        areas: [
          { code: "IN-TN-CBE-GANDHIPURAM", name: "Gandhipuram", postalCode: "641012", sortOrder: 10 },
          { code: "IN-TN-CBE-RSPURAM", name: "RS Puram", postalCode: "641002", sortOrder: 20 },
          { code: "IN-TN-CBE-PEELAMEDU", name: "Peelamedu", postalCode: "641004", sortOrder: 30 }
        ]
      },
      {
        code: "IN-TN-CHN",
        name: "Chennai",
        sortOrder: 20,
        areas: [
          { code: "IN-TN-CHN-ANNANAGAR", name: "Anna Nagar", postalCode: "600040", sortOrder: 10 },
          { code: "IN-TN-CHN-TNAGAR", name: "T Nagar", postalCode: "600017", sortOrder: 20 },
          { code: "IN-TN-CHN-ADYAR", name: "Adyar", postalCode: "600020", sortOrder: 30 }
        ]
      }
    ]
  },
  { code: "IN-TG", name: "Telangana", type: "State", sortOrder: 240 },
  { code: "IN-TR", name: "Tripura", type: "State", sortOrder: 250 },
  { code: "IN-UP", name: "Uttar Pradesh", type: "State", sortOrder: 260 },
  { code: "IN-UT", name: "Uttarakhand", type: "State", sortOrder: 270 },
  { code: "IN-WB", name: "West Bengal", type: "State", sortOrder: 280 },
  { code: "IN-AN", name: "Andaman and Nicobar Islands", type: "Union Territory", sortOrder: 290 },
  { code: "IN-CH", name: "Chandigarh", type: "Union Territory", sortOrder: 300 },
  { code: "IN-DH", name: "Dadra and Nagar Haveli and Daman and Diu", type: "Union Territory", sortOrder: 310 },
  { code: "IN-DL", name: "Delhi", type: "Union Territory", sortOrder: 320 },
  { code: "IN-JK", name: "Jammu and Kashmir", type: "Union Territory", sortOrder: 330 },
  { code: "IN-LA", name: "Ladakh", type: "Union Territory", sortOrder: 340 },
  { code: "IN-LD", name: "Lakshadweep", type: "Union Territory", sortOrder: 350 },
  { code: "IN-PY", name: "Puducherry", type: "Union Territory", sortOrder: 360 }
];

export const bundledLocationDataset: LocationImportDataset = {
  source: {
    code: "BUNDLED_LOCATION_BASELINE",
    name: "1HandIndia enabled-market starter locations",
    provider: "1HandIndia",
    sourceType: LocationImportSourceType.BUNDLED_DATA,
    sourceUrl: "docs/IndiHub_LOCATION_DATA_IMPORT_GUIDE.md",
    licenseNote:
      "Starter operational dataset only. Full market coverage must be imported from approved free/open or licensed source files."
  },
  countries: [
    {
      code: "IN",
      name: "India",
      currency: "INR",
      locale: "en-IN",
      phoneCode: "+91",
      postalCodeLabel: "Pincode",
      postalCodePattern: "^[1-9][0-9]{5}$",
      sortOrder: 1,
      subdivisions: indiaSubdivisions
    },
    {
      code: "AE",
      name: "United Arab Emirates",
      currency: "AED",
      locale: "en-AE",
      phoneCode: "+971",
      postalCodeLabel: "Postal code",
      postalCodePattern: "^[A-Za-z0-9 -]{0,12}$",
      sortOrder: 2,
      subdivisions: [
        {
          code: "AE-DU",
          name: "Dubai",
          type: "Emirate",
          sortOrder: 10,
          cities: [
            {
              code: "AE-DU-DXB",
              name: "Dubai",
              sortOrder: 10,
              areas: [
                { code: "AE-DU-DXB-DEIRA", name: "Deira", sortOrder: 10 },
                { code: "AE-DU-DXB-BUSINESSBAY", name: "Business Bay", sortOrder: 20 }
              ]
            }
          ]
        },
        {
          code: "AE-AZ",
          name: "Abu Dhabi",
          type: "Emirate",
          sortOrder: 20,
          cities: [
            {
              code: "AE-AZ-AUH",
              name: "Abu Dhabi",
              sortOrder: 10,
              areas: [{ code: "AE-AZ-AUH-CITY", name: "Abu Dhabi City", sortOrder: 10 }]
            }
          ]
        },
        {
          code: "AE-SH",
          name: "Sharjah",
          type: "Emirate",
          sortOrder: 30,
          cities: [
            {
              code: "AE-SH-SHJ",
              name: "Sharjah",
              sortOrder: 10,
              areas: [{ code: "AE-SH-SHJ-ALNAHDA", name: "Al Nahda", sortOrder: 10 }]
            }
          ]
        }
      ]
    },
    {
      code: "US",
      name: "United States",
      currency: "USD",
      locale: "en-US",
      phoneCode: "+1",
      postalCodeLabel: "ZIP code",
      postalCodePattern: "^\\d{5}(-\\d{4})?$",
      sortOrder: 3,
      subdivisions: [
        {
          code: "US-CA",
          name: "California",
          type: "State",
          sortOrder: 10,
          cities: [
            {
              code: "US-CA-SFO",
              name: "San Francisco",
              sortOrder: 10,
              areas: [
                { code: "US-CA-SFO-SOMA", name: "SoMa", postalCode: "94103", sortOrder: 10 },
                { code: "US-CA-SFO-MISSION", name: "Mission District", postalCode: "94110", sortOrder: 20 }
              ]
            }
          ]
        },
        {
          code: "US-NY",
          name: "New York",
          type: "State",
          sortOrder: 20,
          cities: [
            {
              code: "US-NY-NYC",
              name: "New York City",
              sortOrder: 10,
              areas: [
                { code: "US-NY-NYC-MANHATTAN", name: "Manhattan", postalCode: "10001", sortOrder: 10 },
                { code: "US-NY-NYC-BROOKLYN", name: "Brooklyn", postalCode: "11201", sortOrder: 20 }
              ]
            }
          ]
        }
      ]
    },
    {
      code: "GB",
      name: "United Kingdom",
      currency: "GBP",
      locale: "en-GB",
      phoneCode: "+44",
      postalCodeLabel: "Postcode",
      postalCodePattern: "^[A-Za-z0-9 ]{5,8}$",
      sortOrder: 4,
      subdivisions: [
        {
          code: "GB-ENG",
          name: "England",
          type: "Country",
          sortOrder: 10,
          cities: [
            {
              code: "GB-ENG-LON",
              name: "London",
              sortOrder: 10,
              areas: [
                { code: "GB-ENG-LON-CAMDEN", name: "Camden", postalCode: "NW1", sortOrder: 10 },
                { code: "GB-ENG-LON-CITY", name: "City of London", postalCode: "EC1A", sortOrder: 20 }
              ]
            },
            {
              code: "GB-ENG-MAN",
              name: "Manchester",
              sortOrder: 20,
              areas: [{ code: "GB-ENG-MAN-CENTRE", name: "Manchester City Centre", postalCode: "M1", sortOrder: 10 }]
            }
          ]
        },
        {
          code: "GB-SCT",
          name: "Scotland",
          type: "Country",
          sortOrder: 20,
          cities: [
            {
              code: "GB-SCT-EDI",
              name: "Edinburgh",
              sortOrder: 10,
              areas: [{ code: "GB-SCT-EDI-OLDTOWN", name: "Old Town", postalCode: "EH1", sortOrder: 10 }]
            }
          ]
        }
      ]
    },
    {
      code: "SG",
      name: "Singapore",
      currency: "SGD",
      locale: "en-SG",
      phoneCode: "+65",
      postalCodeLabel: "Postal code",
      postalCodePattern: "^\\d{6}$",
      sortOrder: 5,
      subdivisions: [
        {
          code: "SG-SG",
          name: "Singapore",
          type: "Region",
          sortOrder: 10,
          cities: [
            {
              code: "SG-SG-SIN",
              name: "Singapore",
              sortOrder: 10,
              areas: [
                { code: "SG-SG-SIN-CBD", name: "Central Business District", postalCode: "048616", sortOrder: 10 },
                { code: "SG-SG-SIN-TAMPINES", name: "Tampines", postalCode: "529536", sortOrder: 20 }
              ]
            }
          ]
        }
      ]
    }
  ]
};
