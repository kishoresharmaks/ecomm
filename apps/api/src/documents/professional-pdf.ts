import PDFDocument from "pdfkit";
import { professionalPdfBrandLogo } from "./professional-pdf-logo";

export const professionalPdfTemplateVersion = "template-v2";

export function usesCurrentProfessionalPdfTemplate(assetKey: string | null | undefined) {
  return Boolean(assetKey?.replaceAll("\\", "/").includes(`/${professionalPdfTemplateVersion}/`));
}

export type PdfField = {
  label: string;
  value: string;
};

export type PdfParty = {
  label: string;
  name: string;
  lines?: string[];
};

export type PdfTableColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

export type PdfTableRow = Record<string, string>;

export type ProfessionalPdfSection =
  | {
      type: "fields";
      title: string;
      fields: PdfField[];
      columns?: 1 | 2;
    }
  | {
      type: "table";
      title: string;
      columns: PdfTableColumn[];
      rows: PdfTableRow[];
      emptyText?: string;
    }
  | {
      type: "totals";
      title?: string;
      rows: PdfField[];
      emphasizedLabel?: string;
    }
  | {
      type: "notes";
      title: string;
      lines: string[];
    };

export type ProfessionalPdfInput = {
  title: string;
  documentNumber?: string;
  status?: string;
  subtitle?: string;
  issuedBy: string;
  issuerCaption?: string;
  poweredByPlatform?: boolean;
  metadata?: PdfField[];
  parties?: PdfParty[];
  sections: ProfessionalPdfSection[];
  footerLines?: string[];
  fileTitle?: string;
};

const colors = {
  brand: "#ED3500",
  brandSoft: "#FFF1EC",
  ink: "#20242A",
  muted: "#667085",
  border: "#E4E7EC",
  panel: "#F8FAFC",
  white: "#FFFFFF",
} as const;

const page = {
  width: 595.28,
  height: 841.89,
  left: 42,
  right: 42,
  top: 36,
  bottom: 50,
} as const;

const contentWidth = page.width - page.left - page.right;

export async function renderProfessionalPdf(input: ProfessionalPdfInput) {
  const document = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: false,
    margins: { top: page.top, right: page.right, bottom: page.bottom, left: page.left },
    info: {
      Title: input.fileTitle ?? input.title,
      Author: "1HandIndia",
      Creator: "1HandIndia Marketplace",
      Producer: "1HandIndia Document Service",
    },
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  let y = 0;
  const addPage = () => {
    document.addPage({ size: "A4", margins: { top: 0, right: 0, bottom: 0, left: 0 } });
    y = drawHeader(document, input);
  };
  const ensureSpace = (height: number) => {
    if (y + height <= page.height - page.bottom) return;
    addPage();
  };

  addPage();
  if (input.subtitle) {
    const height = textHeight(document, input.subtitle, contentWidth, 9);
    ensureSpace(height + 12);
    document.font("Helvetica").fontSize(9).fillColor(colors.muted);
    document.text(input.subtitle, page.left, y, { width: contentWidth, lineGap: 2 });
    y += height + 12;
  }

  if (input.metadata?.length) {
    const height = fieldsHeight(document, input.metadata, 2);
    ensureSpace(height + 14);
    drawFieldsPanel(document, input.metadata, y, 2);
    y += height + 14;
  }

  if (input.parties?.length) {
    const parties = input.parties.slice(0, 2);
    const height = Math.max(...parties.map((party) => partyHeight(document, party)));
    ensureSpace(height + 16);
    drawParties(document, parties, y, height);
    y += height + 16;
  }

  for (const section of input.sections) {
    if (section.type === "fields") {
      const columns = section.columns ?? 2;
      const height = fieldsHeight(document, section.fields, columns);
      ensureSpace(height + 38);
      y = drawSectionTitle(document, section.title, y);
      drawFieldsPanel(document, section.fields, y, columns);
      y += height + 16;
      continue;
    }
    if (section.type === "notes") {
      const height = notesHeight(document, section.lines);
      ensureSpace(height + 38);
      y = drawSectionTitle(document, section.title, y);
      drawNotes(document, section.lines, y, height);
      y += height + 16;
      continue;
    }
    if (section.type === "totals") {
      const height = section.rows.length * 22 + 12;
      ensureSpace(height + (section.title ? 38 : 8));
      if (section.title) y = drawSectionTitle(document, section.title, y);
      drawTotals(document, section.rows, y, section.emphasizedLabel);
      y += height + 16;
      continue;
    }

    ensureSpace(64);
    y = drawSectionTitle(document, section.title, y);
    y = drawTable(document, section, y, addPage, () => y, (nextY) => { y = nextY; });
    y += 16;
  }

  if (input.footerLines?.length) {
    const height = notesHeight(document, input.footerLines);
    ensureSpace(height + 30);
    y = drawSectionTitle(document, "Important information", y);
    drawNotes(document, input.footerLines, y, height);
  }

  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    drawFooter(document, index - range.start + 1, range.count);
  }

  document.end();
  return complete;
}

function drawHeader(document: PDFKit.PDFDocument, input: ProfessionalPdfInput) {
  drawBrandLogo(document);
  document.font("Helvetica-Bold").fontSize(15).fillColor(colors.ink).text("1HandIndia", page.left + 40, page.top + 1);
  document.font("Helvetica").fontSize(7.5).fillColor(colors.muted).text(
    input.poweredByPlatform ? "Quality assured marketplace" : "Marketplace document service",
    page.left + 40,
    page.top + 21,
  );

  const titleWidth = 250;
  document.font("Helvetica-Bold").fontSize(17).fillColor(colors.ink).text(
    input.title,
    page.width - page.right - titleWidth,
    page.top,
    { width: titleWidth, align: "right" },
  );
  if (input.documentNumber) {
    document.font("Helvetica").fontSize(8).fillColor(colors.muted).text(
      input.documentNumber,
      page.width - page.right - titleWidth,
      page.top + 24,
      { width: titleWidth, align: "right" },
    );
  }

  document.moveTo(page.left, page.top + 46).lineTo(page.width - page.right, page.top + 46).lineWidth(2).strokeColor(colors.brand).stroke();
  document.font("Helvetica-Bold").fontSize(8).fillColor(colors.ink).text(input.issuedBy, page.left, page.top + 56, { width: 330 });
  if (input.issuerCaption) {
    document.font("Helvetica").fontSize(7.5).fillColor(colors.muted).text(input.issuerCaption, page.left, page.top + 69, { width: 330 });
  }
  if (input.status) {
    const width = Math.min(130, Math.max(62, document.widthOfString(input.status.toUpperCase()) + 22));
    const x = page.width - page.right - width;
    document.roundedRect(x, page.top + 54, width, 22, 11).fill(colors.brandSoft);
    document.font("Helvetica-Bold").fontSize(7.5).fillColor(colors.brand).text(input.status.toUpperCase(), x, page.top + 61, { width, align: "center" });
  }
  return page.top + 92;
}

function drawBrandLogo(document: PDFKit.PDFDocument) {
  try {
    document.image(professionalPdfBrandLogo, page.left, page.top - 2, { fit: [32, 36], align: "center", valign: "center" });
  } catch {
    document.roundedRect(page.left, page.top, 30, 30, 7).fill(colors.brand);
    document.font("Helvetica-Bold").fontSize(14).fillColor(colors.white).text("1H", page.left + 6, page.top + 8);
  }
}

function drawSectionTitle(document: PDFKit.PDFDocument, title: string, y: number) {
  document.font("Helvetica-Bold").fontSize(10).fillColor(colors.ink).text(title, page.left, y);
  document.moveTo(page.left, y + 15).lineTo(page.width - page.right, y + 15).lineWidth(0.7).strokeColor(colors.border).stroke();
  return y + 24;
}

function drawFieldsPanel(document: PDFKit.PDFDocument, fields: PdfField[], y: number, columns: 1 | 2) {
  const height = fieldsHeight(document, fields, columns);
  document.roundedRect(page.left, y, contentWidth, height, 6).fillAndStroke(colors.panel, colors.border);
  const gap = 14;
  const columnWidth = columns === 1 ? contentWidth - 24 : (contentWidth - 24 - gap) / 2;
  const rowCount = Math.ceil(fields.length / columns);
  for (let index = 0; index < fields.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = page.left + 12 + column * (columnWidth + gap);
    const rowY = y + 10 + row * 35;
    drawLabelValue(document, fields[index]!, x, rowY, columnWidth);
  }
  if (!rowCount) return;
}

function drawLabelValue(document: PDFKit.PDFDocument, field: PdfField, x: number, y: number, width: number) {
  document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.muted).text(field.label.toUpperCase(), x, y, { width });
  document.font("Helvetica").fontSize(8.6).fillColor(colors.ink).text(field.value || "-", x, y + 11, { width, height: 20, ellipsis: true });
}

function fieldsHeight(document: PDFKit.PDFDocument, fields: PdfField[], columns: 1 | 2) {
  void document;
  return Math.max(52, Math.ceil(fields.length / columns) * 35 + 14);
}

function partyHeight(document: PDFKit.PDFDocument, party: PdfParty) {
  const lines = [party.name, ...(party.lines ?? [])];
  return Math.max(84, 33 + lines.reduce((height, line, index) => height + textHeight(document, line, contentWidth / 2 - 38, index === 0 ? 9 : 7.5) + 3, 0));
}

function drawParties(document: PDFKit.PDFDocument, parties: PdfParty[], y: number, height: number) {
  const gap = 14;
  const width = (contentWidth - gap) / 2;
  parties.forEach((party, index) => {
    const x = page.left + index * (width + gap);
    document.roundedRect(x, y, width, height, 6).strokeColor(colors.border).lineWidth(0.8).stroke();
    document.font("Helvetica-Bold").fontSize(7).fillColor(colors.brand).text(party.label.toUpperCase(), x + 12, y + 11, { width: width - 24 });
    let lineY = y + 27;
    document.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(party.name, x + 12, lineY, { width: width - 24 });
    lineY += textHeight(document, party.name, width - 24, 9) + 5;
    for (const line of party.lines ?? []) {
      if (!line) continue;
      document.font("Helvetica").fontSize(7.5).fillColor(colors.muted).text(line, x + 12, lineY, { width: width - 24, lineGap: 1 });
      lineY += textHeight(document, line, width - 24, 7.5) + 3;
    }
  });
}

function notesHeight(document: PDFKit.PDFDocument, lines: string[]) {
  return Math.max(46, 18 + lines.reduce((height, line) => height + textHeight(document, line, contentWidth - 30, 8) + 7, 0));
}

function drawNotes(document: PDFKit.PDFDocument, lines: string[], y: number, height: number) {
  document.roundedRect(page.left, y, contentWidth, height, 6).fillAndStroke(colors.brandSoft, colors.border);
  let lineY = y + 12;
  for (const line of lines) {
    document.circle(page.left + 14, lineY + 4, 1.6).fill(colors.brand);
    document.font("Helvetica").fontSize(8).fillColor(colors.ink).text(line, page.left + 23, lineY, { width: contentWidth - 35, lineGap: 2 });
    lineY += textHeight(document, line, contentWidth - 35, 8) + 7;
  }
}

function drawTotals(document: PDFKit.PDFDocument, rows: PdfField[], y: number, emphasizedLabel?: string) {
  const width = 270;
  const x = page.width - page.right - width;
  const height = rows.length * 22 + 12;
  document.roundedRect(x, y, width, height, 6).fillAndStroke(colors.panel, colors.border);
  rows.forEach((row, index) => {
    const rowY = y + 8 + index * 22;
    const emphasized = row.label === emphasizedLabel || index === rows.length - 1;
    if (emphasized) document.rect(x + 1, rowY - 3, width - 2, 22).fill(colors.brandSoft);
    document.font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(emphasized ? 9 : 8).fillColor(emphasized ? colors.ink : colors.muted).text(row.label, x + 12, rowY, { width: 135 });
    document.font("Helvetica-Bold").fontSize(emphasized ? 9 : 8).fillColor(emphasized ? colors.brand : colors.ink).text(row.value, x + 147, rowY, { width: 110, align: "right" });
  });
}

function drawTable(
  document: PDFKit.PDFDocument,
  section: Extract<ProfessionalPdfSection, { type: "table" }>,
  initialY: number,
  addPage: () => void,
  currentY: () => number,
  setY: (value: number) => void,
) {
  let y = initialY;
  const columns = normalizeColumns(section.columns);
  const drawHeader = () => {
    document.rect(page.left, y, contentWidth, 24).fill(colors.ink);
    let x = page.left;
    for (const column of columns) {
      document.font("Helvetica-Bold").fontSize(6.8).fillColor(colors.white).text(column.label.toUpperCase(), x + 6, y + 8, { width: column.width - 12, align: column.align ?? "left", height: 10, ellipsis: true });
      x += column.width;
    }
    y += 24;
    setY(y);
  };
  drawHeader();

  const rows = section.rows.length ? section.rows : [{ [columns[0]!.key]: section.emptyText ?? "No records available." }];
  rows.forEach((row, rowIndex) => {
    const heights = columns.map((column) => textHeight(document, row[column.key] ?? "-", column.width - 12, 7.4));
    const rowHeight = Math.max(27, Math.max(...heights) + 14);
    if (y + rowHeight > page.height - page.bottom) {
      addPage();
      y = currentY();
      document.font("Helvetica-Bold").fontSize(9).fillColor(colors.muted).text(`${section.title} (continued)`, page.left, y);
      y += 18;
      setY(y);
      drawHeader();
    }
    if (rowIndex % 2 === 1) document.rect(page.left, y, contentWidth, rowHeight).fill(colors.panel);
    document.rect(page.left, y, contentWidth, rowHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
    let x = page.left;
    for (const column of columns) {
      document.font("Helvetica").fontSize(7.4).fillColor(colors.ink).text(row[column.key] ?? "-", x + 6, y + 7, { width: column.width - 12, align: column.align ?? "left", lineGap: 1 });
      x += column.width;
      if (x < page.width - page.right) document.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(colors.border).lineWidth(0.4).stroke();
    }
    y += rowHeight;
    setY(y);
  });
  return y;
}

function normalizeColumns(columns: PdfTableColumn[]) {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  if (!total) return columns;
  const scale = contentWidth / total;
  return columns.map((column) => ({ ...column, width: column.width * scale }));
}

function drawFooter(document: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  const y = page.height - 34;
  document.moveTo(page.left, y - 7).lineTo(page.width - page.right, y - 7).strokeColor(colors.border).lineWidth(0.6).stroke();
  document.font("Helvetica").fontSize(6.8).fillColor(colors.muted).text("Computer-generated by 1HandIndia; no physical signature is required. Verify values against the associated order record.", page.left, y, { width: contentWidth - 90 });
  document.text(`Page ${pageNumber} of ${pageCount}`, page.width - page.right - 80, y, { width: 80, align: "right" });
}

function textHeight(document: PDFKit.PDFDocument, value: string, width: number, fontSize: number) {
  document.font("Helvetica").fontSize(fontSize);
  return document.heightOfString(value || "-", { width, lineGap: 1 });
}
