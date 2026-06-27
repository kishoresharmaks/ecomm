import { describe, expect, it } from "vitest";
import { validatePOFile } from "./po-upload";

describe("po-upload validation helpers", () => {
  it("allows correct file formats within size bounds", () => {
    const validPdf = {
      uri: "file://test.pdf",
      mimeType: "application/pdf",
      name: "test.pdf",
      size: 5 * 1024 * 1024,
    };
    expect(validatePOFile(validPdf)).toBeNull();

    const validJpg = {
      uri: "file://test.jpg",
      mimeType: "image/jpeg",
      name: "test.jpg",
      size: 1024 * 1024,
    };
    expect(validatePOFile(validJpg)).toBeNull();
  });

  it("blocks unsupported mime types", () => {
    const invalidDoc = {
      uri: "file://test.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "test.docx",
      size: 1024 * 1024,
    };
    const err = validatePOFile(invalidDoc);
    expect(err).not.toBeNull();
    expect(err!.type).toBe("invalid-type");
    expect(err!.message).toContain("Selected file type is not supported");
  });

  it("blocks files exceeding 10 MB size limit", () => {
    const oversizePdf = {
      uri: "file://test.pdf",
      mimeType: "application/pdf",
      name: "test.pdf",
      size: 11 * 1024 * 1024,
    };
    const err = validatePOFile(oversizePdf);
    expect(err).not.toBeNull();
    expect(err!.type).toBe("oversize");
    expect(err!.message).toContain("smaller than 10 MB");
  });
});
