import { afterEach, describe, expect, it, vi } from "vitest";
import { IndihubApiError, indihubFetch, userSessionExpiredMessage } from "./api";

describe("indihubFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes a Clerk bearer token once after an unauthorized response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Clerk session token is expired. Sign out and sign in again." }), {
          status: 401,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    const getBearerToken = vi.fn(async (options?: { skipCache?: boolean }) => (options?.skipCache ? "fresh-token" : "old-token"));

    await expect(indihubFetch<{ ok: boolean }>("/api/session-check", undefined, { getBearerToken })).resolves.toEqual({ ok: true });

    expect(getBearerToken).toHaveBeenNthCalledWith(1, { skipCache: false });
    expect(getBearerToken).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("authorization")).toBe("Bearer old-token");
    expect(new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("authorization")).toBe("Bearer fresh-token");
  });

  it("keeps raw Clerk token errors out of user-facing API failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Clerk session token is expired. Sign out and sign in again." }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(indihubFetch("/api/session-check")).rejects.toMatchObject({
      message: userSessionExpiredMessage,
      status: 401
    } satisfies Partial<IndihubApiError>);
  });
});
