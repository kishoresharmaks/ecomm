import { describe, expect, it } from "vitest";
import {
  availableReturnQuantity,
  customerSafeReturnDetail,
  orderCanStartReturn,
  selectedReturnItems,
  validateReturnForm,
} from "./return-eligibility";

describe("mobile return eligibility helpers", () => {
  it("allows returns only for delivered paid or not-required payment orders", () => {
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "SHIPPED", paymentStatus: "PAID" })).toBe(true);
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "SHIPPED", paymentStatus: "NOT_REQUIRED" })).toBe(true);
    expect(orderCanStartReturn({ deliveryStatus: "IN_TRANSIT", orderStatus: "SHIPPED", paymentStatus: "PAID" })).toBe(false);
    expect(orderCanStartReturn({ deliveryStatus: "DELIVERED", orderStatus: "DELIVERED", paymentStatus: "PENDING" })).toBe(false);
  });

  it("deducts already returned quantity when deriving available quantity", () => {
    expect(availableReturnQuantity({ activeQuantity: 2, quantity: 3, returnedQuantity: 1 })).toBe(1);
    expect(availableReturnQuantity({ activeQuantity: null, quantity: 3, returnedQuantity: 1 })).toBe(2);
    expect(availableReturnQuantity({ activeQuantity: 1, quantity: 3, returnedQuantity: 3 })).toBe(0);
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
});
