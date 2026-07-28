import { describe, expect, it } from "vitest";
import {
  activeOrderReturnRequest,
  acceptedReturnReasonsForSelection,
  availableReturnQuantity,
  availableReturnQuantityWithRequests,
  customerSafeReturnDetail,
  itemReturnPolicyState,
  mobileItemReturnPolicy,
  orderCanStartReturn,
  orderReturnPolicyState,
  selectedReturnItems,
  validateReturnForm,
} from "./return-eligibility";

describe("mobile return eligibility helpers", () => {
  it("allows returns only for delivered paid or not-required payment orders", () => {
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "SHIPPED", paymentStatus: "PAID" })).toBe(true);
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "SHIPPED", paymentStatus: "NOT_REQUIRED" })).toBe(true);
    expect(orderCanStartReturn({ deliveryStatus: "IN_TRANSIT", orderStatus: "SHIPPED", paymentStatus: "PAID" })).toBe(false);
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "DELIVERED", paymentStatus: "PENDING" })).toBe(false);
    expect(
      orderCanStartReturn({
        deliveryDetail: { deliveryMode: "STORE_PICKUP" },
        deliveryStatus: "DELIVERED",
        orderStatus: "DELIVERED",
        paymentStatus: "PAID",
      }),
    ).toBe(false);
  });

  it("uses active quantity and deducts quantities held by submitted requests", () => {
    expect(availableReturnQuantity({ activeQuantity: 2, quantity: 3 })).toBe(2);
    expect(availableReturnQuantity({ activeQuantity: null, quantity: 3 })).toBe(3);
    expect(
      availableReturnQuantityWithRequests({
        activeQuantity: 2,
        quantity: 3,
        returnItems: [
          {
            id: "return_item_1",
            returnRequestId: "return_1",
            quantity: 2,
            status: "PENDING_REVIEW",
            resolution: "REFUND",
            returnRequest: {
              requestNumber: "RET-1",
              status: "PENDING_REVIEW",
              resolution: "REFUND" as const,
            },
          },
        ],
      }),
    ).toBe(0);
  });

  it("finds the submitted active request and calculates both delivery windows", () => {
    const order = {
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-02T10:00:00.000Z",
      shipments: [
        {
          id: "shipment_1",
          status: "DELIVERED",
          packages: [
            {
              id: "package_1",
              deliveredAt: "2026-07-10T10:00:00.000Z",
            },
          ],
        },
      ],
      items: [
        {
          id: "item_1",
          activeQuantity: 1,
          productNameSnapshot: "Product",
          quantity: 1,
          unitPricePaise: 1000,
          lineTotalPaise: 1000,
          returnItems: [
            {
              id: "return_item_1",
              returnRequestId: "return_1",
              quantity: 1,
              status: "PENDING_REVIEW",
              resolution: "REFUND" as const,
              createdAt: "2026-07-11T10:00:00.000Z",
              returnRequest: {
                requestNumber: "RET-1",
                status: "PENDING_REVIEW",
                resolution: "REFUND" as const,
                createdAt: "2026-07-11T10:00:00.000Z",
              },
            },
          ],
        },
      ],
    };

    expect(activeOrderReturnRequest(order)?.requestNumber).toBe("RET-1");
    expect(
      orderReturnPolicyState(
        order,
        { returnWindowDays: 7, replacementWindowDays: 10 },
        new Date("2026-07-15T10:00:00.000Z"),
      ),
    ).toMatchObject({
      refund: {
        deadlineAt: "2026-07-17T10:00:00.000Z",
        daysRemaining: 2,
        eligible: true,
      },
      replacement: {
        deadlineAt: "2026-07-20T10:00:00.000Z",
        daysRemaining: 5,
        eligible: true,
      },
    });
  });

  it("validates selected items and free text limits without exposing internal notes", () => {
    expect(validateReturnForm({ note: "", reason: "", selection: {} })).toBe("validationNoItems");
    expect(validateReturnForm({ note: "", reason: "", selection: { item_1: 1 } })).toBe("validationReason");
    expect(validateReturnForm({ note: "", reason: "Damaged", selection: { item_1: 1, item_2: 0 } })).toBeNull();
    expect(selectedReturnItems({ item_1: 2, item_2: 0 })).toEqual([{ orderItemId: "item_1", quantity: 2 }]);
    expect(customerSafeReturnDetail({ note: "Customer note", reason: "Damaged" })).toEqual({
      note: "Customer note",
      reason: "Damaged",
    });
  });

  it("caps product windows by global rules and enforces resolution-specific policies", () => {
    const order = {
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-10T10:00:00.000Z",
      shipments: [
        {
          id: "shipment_1",
          status: "DELIVERED",
          packages: [{ id: "package_1", deliveredAt: "2026-07-10T10:00:00.000Z" }],
        },
      ],
    };
    const item = {
      id: "item_1",
      productNameSnapshot: "Replacement product",
      quantity: 1,
      unitPricePaise: 1000,
      lineTotalPaise: 1000,
      returnPolicySnapshot: {
        returnEligibility: "Replacement only",
        returnAllowed: false,
        replacementAllowed: true,
        returnWindowDays: 0,
        replacementWindowDays: 30,
        returnReasons: ["Damaged on arrival"],
      },
    };

    expect(mobileItemReturnPolicy(item)).toMatchObject({
      returnAllowed: false,
      replacementAllowed: true,
    });
    expect(
      itemReturnPolicyState(
        order,
        item,
        { returnWindowDays: 14, replacementWindowDays: 7 },
        "REPLACEMENT",
        new Date("2026-07-16T10:00:00.000Z"),
      ),
    ).toMatchObject({ eligible: true, windowDays: 7 });
    expect(
      itemReturnPolicyState(
        order,
        item,
        { returnWindowDays: 14, replacementWindowDays: 7 },
        "REFUND",
        new Date("2026-07-10T10:00:00.000Z"),
      ),
    ).toMatchObject({ eligible: false, windowDays: 0 });
  });

  it("uses only reasons accepted by every selected product", () => {
    const item = (id: string, returnReasons: string[]) => ({
      id,
      productNameSnapshot: id,
      quantity: 1,
      unitPricePaise: 1000,
      lineTotalPaise: 1000,
      returnPolicySnapshot: {
        returnEligibility: "Return and replacement",
        returnReasons,
      },
    });

    expect(
      acceptedReturnReasonsForSelection(
        [
          item("item_1", ["Damaged on arrival", "Wrong item received"]),
          item("item_2", ["Damaged on arrival"]),
        ],
        { item_1: 1, item_2: 1 },
      ),
    ).toEqual(["Damaged on arrival"]);
  });
});
