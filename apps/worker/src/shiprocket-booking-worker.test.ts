import { PaymentProvider } from "@indihub/database";
import { describe, expect, it } from "vitest";
import {
  createShiprocketBookingPayload,
  expectedPackageCodAmountPaise,
} from "./shiprocket-booking-worker";

describe("Shiprocket booking worker helpers", () => {
  it("sends the complete COD payable amount and documented order details", () => {
    const payload = createShiprocketBookingPayload({
      shipmentNumber: "1HI-1001-S1",
      orderDate: new Date("2026-07-24T10:00:00.000Z"),
      paymentMethod: "COD",
      subtotalPaise: 6_999_900,
      codAmountPaise: 7_176_543,
      shippingChargesPaise: 36_600,
      billingCompanyName: "Krish Retail Private Limited",
      customerGstin: "33ABCDE1234F1Z5",
      ewayBillNumber: "331234567890",
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

  it("allocates every COD paise exactly once across multiple shipments", () => {
    const payments = [{ provider: PaymentProvider.COD, method: "COD", amountPaise: 101 }];
    const shipments = [
      { id: "shipment-a", subtotalPaise: 100, shippingPaise: 0, codSurchargePaise: 0 },
      { id: "shipment-b", subtotalPaise: 100, shippingPaise: 0, codSurchargePaise: 0 },
    ];

    const allocated = shipments.map((shipment) =>
      expectedPackageCodAmountPaise(payments, shipments, shipment),
    );

    expect(allocated).toEqual([50, 51]);
    expect(allocated.reduce((total, amount) => total + amount, 0)).toBe(101);
  });
});
