import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadAsync = vi.fn();
const getInfoAsync = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  uploadAsync,
  getInfoAsync,
  FileSystemUploadType: { BINARY_CONTENT: "BINARY_CONTENT" },
}));

describe("mobile seller uploads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    uploadAsync.mockReset();
    getInfoAsync.mockReset();
    uploadAsync.mockResolvedValue({ status: 200, body: "" });
    getInfoAsync.mockResolvedValue({ exists: true, size: 2048 });
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api";
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it("sends document size metadata before uploading to S3", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/storage/private-document/upload-request")) {
        return jsonResponse({
          provider: "s3",
          method: "PUT",
          uploadUrl: "https://s3.example.com/private-doc",
          headers: { "Content-Type": "application/pdf" },
          assetKey: "1handindia/sellers/seller_1/documents/gst.pdf",
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { uploadSellerPrivateDocument } = await import("./mobile-upload");

    await uploadSellerPrivateDocument(
      { bearerToken: "token" },
      {
        uri: "file:///cache/gst.pdf",
        name: "gst.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
      "GST_CERTIFICATE",
    );

    const uploadRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(uploadRequest).toMatchObject({
      documentType: "GST_CERTIFICATE",
      fileName: "gst.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048,
    });
    expect(uploadAsync).toHaveBeenCalledWith("https://s3.example.com/private-doc", "file:///cache/gst.pdf", {
      httpMethod: "PUT",
      uploadType: "BINARY_CONTENT",
      headers: { "Content-Type": "application/pdf" },
    });
  });

  it("surfaces S3 upload rejection details", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/storage/private-document/upload-request")) {
        return jsonResponse({
          provider: "s3",
          method: "PUT",
          uploadUrl: "https://s3.example.com/private-doc",
          headers: { "Content-Type": "image/png" },
          assetKey: "1handindia/sellers/seller_1/documents/gst.png",
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        blob: async () => new Blob(["png"], { type: "image/png" }),
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);
    uploadAsync.mockResolvedValue({
      status: 403,
      body: "<Error><Code>AccessDenied</Code><Message>CORS is not enabled for this bucket</Message></Error>",
    });
    const { uploadSellerPrivateDocument } = await import("./mobile-upload");

    await expect(
      uploadSellerPrivateDocument(
        { bearerToken: "token" },
        {
          uri: "file:///cache/gst.png",
          name: "gst.png",
          mimeType: "image/png",
          sizeBytes: 2048,
        },
        "GST_CERTIFICATE",
      ),
    ).rejects.toThrow("Storage upload failed (HTTP 403): CORS is not enabled for this bucket");
  });

  it("reads document size with Expo FileSystem when picker metadata is missing", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/storage/private-document/upload-request")) {
        return jsonResponse({
          provider: "s3",
          method: "PUT",
          uploadUrl: "https://s3.example.com/private-doc",
          headers: { "Content-Type": "image/png" },
          assetKey: "1handindia/sellers/seller_1/documents/gst.png",
        });
      }

      throw new Error("unexpected fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    getInfoAsync.mockResolvedValue({ exists: true, size: 4096 });
    const { uploadSellerPrivateDocument } = await import("./mobile-upload");

    await uploadSellerPrivateDocument(
      { bearerToken: "token" },
      {
        uri: "file:///cache/gst.png",
        name: "gst.png",
        mimeType: "image/png",
      },
      "GST_CERTIFICATE",
    );

    const uploadRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(uploadRequest.sizeBytes).toBe(4096);
    expect(getInfoAsync).toHaveBeenCalledWith("file:///cache/gst.png");
  });
});

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}
