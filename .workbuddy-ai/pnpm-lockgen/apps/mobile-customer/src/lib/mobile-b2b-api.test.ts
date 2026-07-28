import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createB2BEnquiry, uploadPOMultipart, upsertB2BProfile } from "./mobile-b2b-api";

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

  it("uses the standard API client for B2B profile upsert", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "buyer-1",
        companyName: "Acme Traders",
        contactName: "Buyer",
        contactPhone: "9876543210",
        status: "ACTIVE",
      }),
    );

    await upsertB2BProfile(
      {
        bearerToken: "old-token",
        getBearerToken: vi.fn().mockResolvedValue("fresh-token"),
      },
      {
        companyName: "Acme Traders",
        contactName: "Buyer",
        contactPhone: "9876543210",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/b2b/profile");
    expect(init).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        companyName: "Acme Traders",
        contactName: "Buyer",
        contactPhone: "9876543210",
      }),
      headers: expect.objectContaining({
        Authorization: "Bearer fresh-token",
        "Content-Type": "application/json",
      }),
    });
  });

  it("refreshes stale tokens before retrying multipart PO upload", async () => {
    const getBearerToken = vi.fn()
      .mockResolvedValueOnce("stale-token")
      .mockResolvedValueOnce("fresh-token");

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "Expired token" }, 401))
      .mockResolvedValueOnce(jsonResponse({ assetKey: "indihub/b2b/po.pdf" }));

    const result = await uploadPOMultipart(
      { bearerToken: "fallback-token", getBearerToken },
      "B2B/2026/001",
      "file:///cache/po.pdf",
      "application/pdf",
      "po.pdf",
    );

    expect(result.assetKey).toBe("indihub/b2b/po.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getBearerToken).toHaveBeenNthCalledWith(1, {});
    expect(getBearerToken).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer stale-token" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
