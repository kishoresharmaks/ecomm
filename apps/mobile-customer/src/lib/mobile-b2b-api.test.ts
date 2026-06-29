import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createB2BEnquiry } from "./mobile-b2b-api";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalFetch = globalThis.fetch;

describe("mobile B2B API helpers", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api";
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    globalThis.fetch = originalFetch;
  });

  it("sends idempotency keys when creating B2B enquiries", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "enquiry-1",
        businessBuyerId: "buyer-1",
        quantity: 10,
        message: "Need recurring monthly supply.",
        status: "SUBMITTED",
      }),
    );

    await createB2BEnquiry(
      { bearerToken: "customer-token" },
      {
        idempotencyKey: "mobile_b2b_product_abc123456789",
        productId: "product-1",
        quantity: 10,
        message: "Need recurring monthly supply.",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/b2b/enquiries");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "mobile_b2b_product_abc123456789",
        productId: "product-1",
        quantity: 10,
        message: "Need recurring monthly supply.",
      }),
      headers: expect.objectContaining({
        Authorization: "Bearer customer-token",
        "Content-Type": "application/json",
      }),
    });
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
