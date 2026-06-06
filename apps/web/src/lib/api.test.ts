import { afterEach, describe, expect, it, vi } from "vitest";
import { IndihubApiError, indihubFetch, requestTimedOutMessage, userFacingApiErrorMessage, userSessionExpiredMessage } from "./api";

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

    await expect(indihubFetch<{ ok: boolean }>("/api/session-check", undefined, { clerkUserId: "clerk_1", getBearerToken })).resolves.toEqual({ ok: true });

    expect(getBearerToken).toHaveBeenNthCalledWith(1, { skipCache: false });
    expect(getBearerToken).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("authorization")).toBe("Bearer old-token");
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("x-clerk-user-id")).toBeNull();
    expect(new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("authorization")).toBe("Bearer fresh-token");
    expect(new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("x-clerk-user-id")).toBeNull();
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

  it("keeps raw abort errors out of user-facing API failures", () => {
    const abortError = new Error("signal is aborted without reason");
    abortError.name = "AbortError";

    expect(userFacingApiErrorMessage(abortError)).toBe(requestTimedOutMessage);
    expect(userFacingApiErrorMessage("signal is aborted without reason")).toBe(requestTimedOutMessage);
  });

  it("decrypts encrypted bearer-token responses", async () => {
    const envelope = await encryptedEnvelope("session-token", { synced: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(indihubFetch<{ synced: true }>("/api/auth/sync-current-user", undefined, { bearerToken: "session-token" })).resolves.toEqual({
      synced: true
    });
  });
});

async function encryptedEnvelope(bearerToken: string, payload: unknown) {
  const keyBytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`indihub-response-v1:${bearerToken}`));
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    )
  );

  return {
    encrypted: true,
    alg: "A256GCM",
    iv: bytesToBase64(iv),
    tag: bytesToBase64(encrypted.slice(-16)),
    data: bytesToBase64(encrypted.slice(0, -16))
  };
}

function bytesToBase64(bytes: Uint8Array) {
  return globalThis.btoa(String.fromCharCode(...bytes));
}
