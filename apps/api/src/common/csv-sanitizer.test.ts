import { describe, expect, it } from "vitest";
import { formatCsvRows, sanitizeCsvCell } from "./csv-sanitizer";

describe("CSV Sanitizer (CWE-1236 Formula Injection Defense)", () => {
  it("neutralizes leading equals sign (=) formula injection", () => {
    expect(sanitizeCsvCell("=1+2")).toBe("\"'=1+2\"");
    expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("\"'=SUM(A1:A10)\"");
    expect(sanitizeCsvCell("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
  });

  it("neutralizes leading at sign (@) formula injection", () => {
    expect(sanitizeCsvCell("@SUM(1,2)")).toBe("\"'@SUM(1,2)\"");
    expect(sanitizeCsvCell("@product_code")).toBe("\"'@product_code\"");
  });

  it("neutralizes leading plus and minus formula injection while preserving pure numbers", () => {
    // Formula payloads
    expect(sanitizeCsvCell("+cmd|'/C calc'!A0")).toBe("\"'+cmd|'/C calc'!A0\"");
    expect(sanitizeCsvCell("-1+2")).toBe("\"'-1+2\"");
    expect(sanitizeCsvCell("+1+2")).toBe("\"'+1+2\"");

    // Legitimate numeric strings
    expect(sanitizeCsvCell("-100")).toBe('"-100"');
    expect(sanitizeCsvCell("-50.25")).toBe('"-50.25"');
    expect(sanitizeCsvCell("+5")).toBe('"+5"');

    // Primitive numbers
    expect(sanitizeCsvCell(-100)).toBe('"-100"');
    expect(sanitizeCsvCell(250.5)).toBe('"250.5"');
  });

  it("neutralizes leading tab and carriage return characters", () => {
    expect(sanitizeCsvCell("\tpayload")).toBe("\"'\tpayload\"");
    expect(sanitizeCsvCell("\rpayload")).toBe("\"'\rpayload\"");
  });

  it("escapes embedded double quotes per RFC 4180", () => {
    expect(sanitizeCsvCell('Cotton "Premium" Shirt')).toBe('"Cotton ""Premium"" Shirt"');
    expect(sanitizeCsvCell('=Product "Dangerous"')).toBe("\"'=Product \"\"Dangerous\"\"\"");
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
    expect(sanitizeCsvCell("")).toBe('""');
  });

  it("formats 2D arrays into formula-safe CSV rows", () => {
    const rows = [
      ["Product Name", "SKU", "Price"],
      ["=Malicious Title", "SKU-001", 100],
      ["Normal Title", "@PAYLOAD", -50.5],
    ];

    const result = formatCsvRows(rows);
    const lines = result.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"Product Name","SKU","Price"');
    expect(lines[1]).toBe("\"'=Malicious Title\",\"SKU-001\",\"100\"");
    expect(lines[2]).toBe('"Normal Title","\'@PAYLOAD","-50.5"');
  });
});
