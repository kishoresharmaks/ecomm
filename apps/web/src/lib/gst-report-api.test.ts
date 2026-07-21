import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAuthenticatedFile } from "./gst-report-api";

describe("authenticated GST file downloads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries a stale bearer token and cleans up the object URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(new Blob(["%PDF-1.4"]), {
          status: 200,
          headers: {
            "content-disposition": 'attachment; filename="TI-26-27-000001.pdf"',
            "content-type": "application/pdf",
          },
        }),
      );
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const anchor = { href: "", download: "", click, remove };
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild },
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:gst-document");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const getBearerToken = vi.fn(
      async (options?: { skipCache?: boolean }) =>
        options?.skipCache ? "fresh-token" : "stale-token",
    );

    await downloadAuthenticatedFile(
      { getBearerToken },
      "/api/seller/reports/gst-documents/document-1/download",
      "gst-document.pdf",
      "Download failed.",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
        "authorization",
      ),
    ).toBe("Bearer fresh-token");
    expect(anchor.download).toBe("TI-26-27-000001.pdf");
    expect(anchor.href).toBe("blob:gst-document");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:gst-document");
  });

  it("returns the supplied safe message for failed downloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );

    await expect(
      downloadAuthenticatedFile(
        { bearerToken: "seller-token" },
        "/api/seller/reports/gst-documents/missing/download",
        "gst-document.pdf",
        "The tax document could not be downloaded.",
      ),
    ).rejects.toMatchObject({
      message: "The tax document could not be downloaded.",
      status: 404,
    });
  });
});
