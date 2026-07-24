import { describe, expect, it } from "vitest";
import { createShiprocketBookingPayload } from "./shiprocket.adapter";

describe("Shiprocket adapter payload", () => {
  it("sends the complete COD payable amount and documented order details", () => {
    const payload = createShiprocketBookingPayload({
      providerCode: "SHIPROCKET",
      shipmentNumber: "1HI-1001-S1",
      orderNumber: "1HI-1001",
      orderDate: new Date("2026-07-24T10:00:00.000Z"),
      currency: "INR",
      paymentMethod: "COD",
      subtotalPaise: 6_999_900,
      codAmountPaise: 7_176_543,
      shippingChargesPaise: 36_600,
      billingCompanyName: "Krish Retail Private Limited",
      customerGstin: "33ABCDE1234F1Z5",
      pickupLocationName: "Seller Warehouse",
      shippingAddress: {
        fullName: "Krish Kumar",
        phone: "9876543210",
        email: "buyer@example.com",
        line1: "10 Market Road",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641001",
        country: "India",
      },
      sellerAddress: {
        line1: "20 Seller Road",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641002",
        country: "India",
      },
      items: [{
        name: "Industrial Product",
        sku: "IND-100",
        quantity: 1,
        unitPricePaise: 6_999_900,
        hsnCode: "8517",
      }],
      parcel: {
        weightGrams: 1_250,
        lengthCm: 20,
        breadthCm: 15,
        heightCm: 10,
        ewayBillNumber: "331234567890",
      },
      settings: {},
    });

    expect(payload).toMatchObject({
      sub_total: 71_765.43,
      shipping_charges: 366,
      transaction_charges: 1_400.43,
      total_discount: 0,
      billing_company_name: "Krish Retail Private Limited",
      customer_gstin: "33ABCDE1234F1Z5",
      ewaybill_no: "331234567890",
      weight: 1.25,
      order_items: [{
        name: "Industrial Product",
        sku: "IND-100",
        units: 1,
        selling_price: 69_999,
        hsn: 8517,
      }],
    });
    expect(payload).not.toHaveProperty("collectable_amount");
  });
});
