import { describe, expect, it } from "vitest";
import {
  professionalPdfTemplateVersion,
  renderProfessionalPdf,
  usesCurrentProfessionalPdfTemplate,
} from "./professional-pdf";

describe("renderProfessionalPdf", () => {
  it("renders branded multi-page tables with page footers", async () => {
    const pdf = await renderProfessionalPdf({
      title: "Production Export",
      documentNumber: "PDF-1001",
      status: "Ready",
      issuedBy: "1HandIndia Seller Finance",
      metadata: [
        { label: "Reference", value: "PDF-1001" },
        { label: "Currency", value: "INR" },
      ],
      sections: [
        {
          type: "table",
          title: "Transactions",
          columns: [
            { key: "reference", label: "Reference", width: 120 },
            { key: "description", label: "Description", width: 300 },
            { key: "amount", label: "Amount", width: 90, align: "right" },
          ],
          rows: Array.from({ length: 80 }, (_, index) => ({
            reference: `ROW-${String(index + 1).padStart(3, "0")}`,
            description: `Settlement transaction ${index + 1} with enough detail to verify wrapping and pagination.`,
            amount: `INR ${(index + 1).toFixed(2)}`,
          })),
        },
      ],
      footerLines: ["Generated for automated layout verification."],
    });
    const content = pdf.toString("latin1");

    expect(content.startsWith("%PDF-")).toBe(true);
    expect(content).toContain("Production Export");
    expect(content).toContain("/Subtype /Image");
    expect((content.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(content).toMatch(/\/Count [2-9]/);
  });

  it("detects versioned generated assets without treating legacy files as current", () => {
    expect(usesCurrentProfessionalPdfTemplate(`1handindia/b2b/tax-invoices/order/${professionalPdfTemplateVersion}/invoice.pdf`)).toBe(true);
    expect(usesCurrentProfessionalPdfTemplate("1handindia/b2b/tax-invoices/order/invoice.pdf")).toBe(false);
    expect(usesCurrentProfessionalPdfTemplate(null)).toBe(false);
  });
});
