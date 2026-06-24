"use client";

import type { Cell, Row, Workbook, Worksheet } from "exceljs";
import { resolveImageSource } from "./image-url";

export type AdminSellerExportRecord = {
  id: string;
  storeName: string;
  slug: string;
  sellerType: string;
  status: string;
  approvalStatus: string;
  subscriptionStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    status?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  profile?: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    businessLegalName?: string | null;
    businessType?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  subscriptionPlan?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    pricePaise?: number | null;
    currency?: string | null;
    isDefault?: boolean | null;
  } | null;
  subscriptions?: Array<{
    id?: string;
    status?: string | null;
    isCurrent?: boolean | null;
    startsAt?: string | null;
    currentPeriodEnd?: string | null;
    plan?: { name?: string | null; code?: string | null; pricePaise?: number | null; currency?: string | null } | null;
  }>;
  documents?: Array<{
    id: string;
    sellerId?: string | null;
    documentType: string;
    fileUrl: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  addresses?: Array<{
    id?: string;
    line1?: string | null;
    line2?: string | null;
    area?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    countryCode?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    locationSource?: string | null;
    accuracyMeters?: number | string | null;
    locationConfidenceScore?: number | string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    approvalStatus: string;
    listingMode?: string | null;
    attributes?: Record<string, unknown> | null;
    hsnCode?: string | null;
    gstRatePercent?: number | string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    category?: { name?: string | null; slug?: string | null } | null;
    images?: Array<{
      id?: string;
      url: string;
      altText?: string | null;
      isPrimary?: boolean | null;
      sortOrder?: number | null;
      createdAt?: string | null;
    }>;
    variants?: Array<{
      id?: string;
      sku?: string | null;
      variantName?: string | null;
      pricePaise: number;
      mrpPaise?: number | null;
      currency?: string | null;
      stockQuantity: number;
      packageWeightGrams?: number | null;
      packageLengthCm?: number | null;
      packageBreadthCm?: number | null;
      packageHeightCm?: number | null;
      status: string;
      attributes?: Record<string, unknown> | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
  }>;
  orderSplits?: Array<{
    id: string;
    sellerStatus?: string | null;
    sellerSubtotalPaise?: number | null;
    commissionPaise?: number | null;
    gstOnCommissionPaise?: number | null;
    tdsPaise?: number | null;
    tcsPaise?: number | null;
    platformFeePaise?: number | null;
    couponDiscountPaise?: number | null;
    refundAdjustmentPaise?: number | null;
    netPayablePaise?: number | null;
    settlementStatus?: string | null;
    settlementEligibleAt?: string | null;
    settledAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    order?: {
      id?: string;
      orderNumber?: string | null;
      orderStatus?: string | null;
      paymentStatus?: string | null;
      deliveryStatus?: string | null;
      totalPaise?: number | null;
      currency?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    } | null;
  }>;
  notes?: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    createdAt?: string | null;
    actor?: {
      id?: string | null;
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
  _count?: {
    products?: number;
    orderSplits?: number;
    b2bEnquiries?: number;
    documents?: number;
    addresses?: number;
  };
};

type SellerWorkbookOptions = {
  generatedBy?: string | null;
  generatedAt?: Date;
  sourceUrl?: string;
};

type SecureDocumentReference = {
  sellerId: string;
  documentId: string;
  label: string;
};

type SheetRowValue = string | number | boolean | null | undefined | { text: string; hyperlink: string; tooltip?: string };

const navyColor = "FF163B5C";
const inkColor = "FF1F2933";
const borderColor = "FFD8E2EA";
const mutedFill = "FFF8FAFC";
const headerFill = "FFFFF0EC";

export async function downloadSellerAuditWorkbook(
  seller: AdminSellerExportRecord,
  options: SellerWorkbookOptions = {},
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const generatedAt = options.generatedAt ?? new Date();

  workbook.creator = "1HandIndia Admin";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.subject = `Seller audit export for ${seller.storeName}`;
  workbook.title = `1HandIndia Seller Audit - ${seller.storeName}`;

  const summary = workbook.addWorksheet("Seller Summary", {
    views: [{ state: "frozen", ySplit: 6 }],
    properties: { defaultRowHeight: 20 },
  });
  buildSummarySheet(workbook, summary, seller, {
    ...options,
    generatedAt,
  });

  buildDocumentsSheet(workbook.addWorksheet("Documents"), seller.id, seller.documents ?? []);
  buildAddressesSheet(workbook.addWorksheet("Addresses"), seller.addresses ?? []);
  buildProductsSheet(workbook.addWorksheet("Products"), seller.products ?? []);
  buildVariantsSheet(workbook.addWorksheet("Product Variants"), seller.products ?? []);
  buildUploadedFilesSheet(workbook.addWorksheet("Uploaded Files"), seller);
  buildOrderSplitsSheet(workbook.addWorksheet("Order Splits"), seller.orderSplits ?? []);
  buildNotesSheet(workbook.addWorksheet("Export Notes"), seller, generatedAt, options);

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };
      });
    });
  });

  await addWorkbookImages(workbook, summary, seller);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    safeFilename(`1handindia-seller-audit-${seller.storeName || seller.slug}-${dateStamp(generatedAt)}.xlsx`),
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

function buildSummarySheet(
  workbook: Workbook,
  worksheet: Worksheet,
  seller: AdminSellerExportRecord,
  options: Required<Pick<SellerWorkbookOptions, "generatedAt">> & SellerWorkbookOptions,
) {
  worksheet.columns = [
    { key: "field", width: 28 },
    { key: "value", width: 45 },
    { key: "field2", width: 24 },
    { key: "value2", width: 34 },
    { key: "field3", width: 20 },
    { key: "value3", width: 30 },
  ];
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 26;
  worksheet.getRow(3).height = 24;
  worksheet.getRow(4).height = 24;
  worksheet.mergeCells("A1:B4");
  worksheet.mergeCells("C1:F1");
  worksheet.mergeCells("C2:F2");
  worksheet.mergeCells("C3:F3");
  worksheet.mergeCells("C4:F4");

  const titleCell = worksheet.getCell("C1");
  titleCell.value = "1HandIndia Seller Audit Export";
  titleCell.font = { bold: true, size: 18, color: { argb: navyColor } };

  worksheet.getCell("C2").value = seller.storeName;
  worksheet.getCell("C2").font = { bold: true, size: 15, color: { argb: inkColor } };
  worksheet.getCell("C3").value = `Generated ${formatDateTime(options.generatedAt)}${options.generatedBy ? ` by ${options.generatedBy}` : ""}`;
  worksheet.getCell("C4").value = options.sourceUrl
    ? { text: "Open seller in admin", hyperlink: options.sourceUrl, tooltip: "Open this seller in the 1HandIndia admin panel" }
    : "Generated from 1HandIndia admin seller operations.";
  styleLinkCell(worksheet.getCell("C4"));

  addSummarySection(worksheet, "Seller identity", [
    ["Seller ID", seller.id],
    ["Store name", seller.storeName],
    ["Slug", seller.slug],
    ["Seller type", humanize(seller.sellerType)],
    ["Seller status", humanize(seller.status)],
    ["Approval status", humanize(seller.approvalStatus)],
    ["Created", formatDateTime(seller.createdAt)],
    ["Updated", formatDateTime(seller.updatedAt)],
  ]);

  addSummarySection(worksheet, "Business verification", [
    ["Legal business name", seller.profile?.businessLegalName],
    ["Business type", humanize(seller.profile?.businessType)],
    ["GST number", seller.profile?.gstNumber],
    ["PAN number", seller.profile?.panNumber],
    ["Documents uploaded", seller.documents?.length ?? 0],
    ["Documents verified", (seller.documents ?? []).filter((document) => document.status === "APPROVED").length],
  ]);

  addSummarySection(worksheet, "Contact and account", [
    ["Contact name", seller.profile?.contactName ?? seller.user?.fullName],
    ["Contact email", seller.profile?.contactEmail ?? seller.user?.email],
    ["Contact phone", seller.profile?.contactPhone ?? seller.user?.phone],
    ["User status", humanize(seller.user?.status)],
    ["User ID", seller.user?.id],
    ["User created", formatDateTime(seller.user?.createdAt)],
  ]);

  addSummarySection(worksheet, "Marketplace activity", [
    ["Products", seller._count?.products ?? seller.products?.length ?? 0],
    ["Order splits", seller._count?.orderSplits ?? seller.orderSplits?.length ?? 0],
    ["B2B enquiries", seller._count?.b2bEnquiries ?? 0],
    ["Addresses", seller.addresses?.length ?? 0],
  ]);

  addSummarySection(worksheet, "Subscription", [
    ["Plan", seller.subscriptionPlan?.name],
    ["Plan code", seller.subscriptionPlan?.code],
    ["Plan amount", formatPaise(seller.subscriptionPlan?.pricePaise, seller.subscriptionPlan?.currency ?? "INR")],
    ["Subscription status", humanize(seller.subscriptionStatus)],
    ["Default plan", seller.subscriptionPlan?.isDefault === undefined ? null : seller.subscriptionPlan.isDefault ? "Yes" : "No"],
  ]);

  addSummarySection(worksheet, "Profile assets", [
    ["Seller logo", seller.profile?.logoUrl ? publicImageLink("Open seller logo", seller.profile.logoUrl) : null],
    ["Seller banner", seller.profile?.bannerUrl ? publicImageLink("Open seller banner", seller.profile.bannerUrl) : null],
  ]);

  if (seller.profile?.description) {
    addSummarySection(worksheet, "Store description", [["Description", seller.profile.description]]);
  }

  workbook.definedNames.add("Seller Summary!$A$1:$F$4", "SellerAuditHeader");
}

function buildDocumentsSheet(
  worksheet: Worksheet,
  sellerId: string,
  documents: NonNullable<AdminSellerExportRecord["documents"]>,
) {
  setColumns(worksheet, [
    ["Document Type", 28],
    ["Verification Status", 22],
    ["Uploaded At", 22],
    ["Updated At", 22],
    ["Named Secure Link", 36],
    ["Document ID", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  documents.forEach((document) => {
    const row = worksheet.addRow([
      humanize(document.documentType),
      humanize(document.status),
      formatDateTime(document.createdAt),
      formatDateTime(document.updatedAt),
      secureDocumentLink({
        sellerId: document.sellerId ?? sellerId,
        documentId: document.id,
        label: documentLinkLabel(document.documentType),
      }),
      document.id,
    ]);
    styleStatusCell(row.getCell(2), document.status);
    styleLinkCell(row.getCell(5));
  });
  finishTableSheet(worksheet, documents.length);
}

function buildAddressesSheet(
  worksheet: Worksheet,
  addresses: NonNullable<AdminSellerExportRecord["addresses"]>,
) {
  setColumns(worksheet, [
    ["#", 8],
    ["Line 1", 34],
    ["Line 2", 28],
    ["Area", 24],
    ["City", 22],
    ["State", 22],
    ["Pincode", 14],
    ["Country", 18],
    ["GPS Latitude", 16],
    ["GPS Longitude", 16],
    ["Location Source", 20],
    ["Accuracy Meters", 18],
    ["Confidence Score", 18],
    ["Created At", 22],
    ["Updated At", 22],
    ["Address ID", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  addresses.forEach((address, index) => {
    worksheet.addRow([
      index + 1,
      address.line1,
      address.line2,
      address.area,
      address.city,
      address.state,
      address.pincode,
      address.country ?? address.countryCode,
      address.latitude,
      address.longitude,
      humanize(address.locationSource),
      address.accuracyMeters,
      address.locationConfidenceScore,
      formatDateTime(address.createdAt),
      formatDateTime(address.updatedAt),
      address.id,
    ]);
  });
  finishTableSheet(worksheet, addresses.length);
}

function buildProductsSheet(
  worksheet: Worksheet,
  products: NonNullable<AdminSellerExportRecord["products"]>,
) {
  setColumns(worksheet, [
    ["Product Name", 38],
    ["SKU", 26],
    ["Brand", 22],
    ["Slug", 32],
    ["Category", 24],
    ["Variant", 24],
    ["Price", 16],
    ["Status", 18],
    ["Approval", 20],
    ["Listing Mode", 22],
    ["HSN", 16],
    ["GST %", 12],
    ["Variants", 12],
    ["Total Stock", 14],
    ["Lowest Price", 16],
    ["Images", 12],
    ["Primary Image", 34],
    ["Attributes", 54],
    ["Created At", 22],
    ["Updated At", 22],
    ["Product ID", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  products.forEach((product) => {
    const variants = product.variants ?? [];
    const firstVariant = variants[0];
    const images = product.images ?? [];
    const primaryImage = images.find((image) => image.isPrimary) ?? images[0];
    const row = worksheet.addRow([
      product.name,
      firstVariant?.sku,
      attributeText(product.attributes, ["brand", "Brand"]),
      product.slug,
      product.category?.name,
      firstVariant?.variantName,
      formatPaise(firstVariant?.pricePaise, firstVariant?.currency ?? "INR"),
      humanize(product.status),
      humanize(product.approvalStatus),
      humanize(product.listingMode),
      product.hsnCode,
      product.gstRatePercent ?? "",
      variants.length,
      variants.reduce((total, variant) => total + (variant.stockQuantity ?? 0), 0),
      formatPaise(minPaise(variants.map((variant) => variant.pricePaise)), variants[0]?.currency ?? "INR"),
      images.length,
      primaryImage ? publicImageLink("Open primary image", primaryImage.url) : null,
      jsonText(product.attributes),
      formatDateTime(product.createdAt),
      formatDateTime(product.updatedAt),
      product.id,
    ]);
    styleStatusCell(row.getCell(7), product.status);
    styleStatusCell(row.getCell(8), product.approvalStatus);
    styleLinkCell(row.getCell(16));
  });
  finishTableSheet(worksheet, products.length);
}

function buildVariantsSheet(
  worksheet: Worksheet,
  products: NonNullable<AdminSellerExportRecord["products"]>,
) {
  setColumns(worksheet, [
    ["Product", 38],
    ["SKU", 26],
    ["Variant Name", 24],
    ["Status", 18],
    ["Price", 16],
    ["MRP", 16],
    ["Stock", 12],
    ["Weight g", 12],
    ["Dimensions cm", 20],
    ["Attributes", 50],
    ["Created At", 22],
    ["Updated At", 22],
    ["Variant ID", 42],
    ["Product ID", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  products.forEach((product) => {
    (product.variants ?? []).forEach((variant) => {
      const row = worksheet.addRow([
        product.name,
        variant.sku,
        variant.variantName,
        humanize(variant.status),
        formatPaise(variant.pricePaise, variant.currency ?? "INR"),
        formatPaise(variant.mrpPaise, variant.currency ?? "INR"),
        variant.stockQuantity,
        variant.packageWeightGrams,
        [variant.packageLengthCm, variant.packageBreadthCm, variant.packageHeightCm]
          .filter((value) => value !== null && value !== undefined)
          .join(" x "),
        jsonText(variant.attributes),
        formatDateTime(variant.createdAt),
        formatDateTime(variant.updatedAt),
        variant.id,
        product.id,
      ]);
      styleStatusCell(row.getCell(4), variant.status);
    });
  });
  finishTableSheet(worksheet, products.reduce((total, product) => total + (product.variants?.length ?? 0), 0));
}

function buildUploadedFilesSheet(worksheet: Worksheet, seller: AdminSellerExportRecord) {
  setColumns(worksheet, [
    ["File Group", 24],
    ["Name", 36],
    ["Status", 18],
    ["Named Link", 36],
    ["Related Record", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  if (seller.profile?.logoUrl) {
    addUploadedFileRow(worksheet, "Seller profile", "Seller logo", "Public", publicImageLink("Open seller logo", seller.profile.logoUrl), seller.id);
  }
  if (seller.profile?.bannerUrl) {
    addUploadedFileRow(worksheet, "Seller profile", "Seller banner", "Public", publicImageLink("Open seller banner", seller.profile.bannerUrl), seller.id);
  }

  (seller.documents ?? []).forEach((document) => {
    addUploadedFileRow(
      worksheet,
      "Verification document",
      humanize(document.documentType),
      humanize(document.status),
      secureDocumentLink({
        sellerId: seller.id,
        documentId: document.id,
        label: documentLinkLabel(document.documentType),
      }),
      document.id,
    );
  });

  (seller.products ?? []).forEach((product) => {
    (product.images ?? []).forEach((image, index) => {
      addUploadedFileRow(
        worksheet,
        "Product image",
        `${product.name} image ${index + 1}${image.isPrimary ? " (primary)" : ""}`,
        "Public",
        publicImageLink(`Open ${product.name} image ${index + 1}`, image.url),
        product.id,
      );
    });
  });

  finishTableSheet(worksheet, Math.max(worksheet.rowCount - 1, 0));
}

function buildOrderSplitsSheet(
  worksheet: Worksheet,
  splits: NonNullable<AdminSellerExportRecord["orderSplits"]>,
) {
  setColumns(worksheet, [
    ["Order ID", 42],
    ["Split ID", 42],
    ["Status", 18],
    ["Amount", 18],
    ["Created Date", 22],
    ["Order Number", 24],
    ["Order Status", 18],
    ["Payment Status", 18],
    ["Delivery Status", 18],
    ["Seller Status", 18],
    ["Seller Subtotal", 18],
    ["Commission", 16],
    ["GST on Commission", 18],
    ["TDS", 14],
    ["TCS", 14],
    ["Platform Fee", 16],
    ["Coupon Discount", 18],
    ["Refund Adjustment", 20],
    ["Net Payable", 18],
    ["Settlement Status", 22],
    ["Eligible At", 22],
    ["Settled At", 22],
    ["Order Created", 22],
    ["Split Updated", 22],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  splits.forEach((split) => {
    const currency = split.order?.currency ?? "INR";
    const row = worksheet.addRow([
      split.order?.id,
      split.id,
      humanize(split.sellerStatus),
      formatPaise(split.netPayablePaise ?? split.sellerSubtotalPaise, currency),
      formatDateTime(split.createdAt),
      split.order?.orderNumber,
      humanize(split.order?.orderStatus),
      humanize(split.order?.paymentStatus),
      humanize(split.order?.deliveryStatus),
      humanize(split.sellerStatus),
      formatPaise(split.sellerSubtotalPaise, currency),
      formatPaise(split.commissionPaise, currency),
      formatPaise(split.gstOnCommissionPaise, currency),
      formatPaise(split.tdsPaise, currency),
      formatPaise(split.tcsPaise, currency),
      formatPaise(split.platformFeePaise, currency),
      formatPaise(split.couponDiscountPaise, currency),
      formatPaise(split.refundAdjustmentPaise, currency),
      formatPaise(split.netPayablePaise, currency),
      humanize(split.settlementStatus),
      formatDateTime(split.settlementEligibleAt),
      formatDateTime(split.settledAt),
      formatDateTime(split.order?.createdAt),
      formatDateTime(split.updatedAt),
    ]);
    styleStatusCell(row.getCell(3), split.sellerStatus);
    styleStatusCell(row.getCell(7), split.order?.orderStatus);
    styleStatusCell(row.getCell(8), split.order?.paymentStatus);
    styleStatusCell(row.getCell(9), split.order?.deliveryStatus);
    styleStatusCell(row.getCell(10), split.sellerStatus);
    styleStatusCell(row.getCell(20), split.settlementStatus);
  });
  finishTableSheet(worksheet, splits.length);
}

function buildNotesSheet(
  worksheet: Worksheet,
  seller: AdminSellerExportRecord,
  generatedAt: Date,
  options: SellerWorkbookOptions,
) {
  setColumns(worksheet, [
    ["Topic", 28],
    ["Action", 28],
    ["Details", 62],
    ["Actor", 34],
    ["Created At", 22],
    ["Related Record", 42],
  ]);
  styleHeaderRow(worksheet.getRow(1));

  [
    ["Export Metadata", "generated_at", formatDateTime(generatedAt), options.generatedBy ?? "Admin user", formatDateTime(generatedAt), seller.id],
    ["Export Metadata", "seller", `${seller.storeName} (${seller.id})`, "", "", seller.id],
    ["Document Security", "secure_links", "Private document links open a secure admin viewer. The admin must be signed in; raw S3/private storage URLs are not written into this file.", "", "", seller.id],
    ["Export Scope", "audit_scope", "Seller profile, business verification, addresses, documents, uploaded file references, products, variants, seller order split records, and seller audit notes returned by the admin export endpoint.", "", "", seller.id],
  ].forEach((row) => worksheet.addRow(row));

  (seller.notes ?? []).forEach((note) => {
    const detail = noteDetail(note);
    const row = worksheet.addRow([
      noteTopic(note),
      humanize(note.action),
      detail || jsonText(note.newValue),
      note.actor?.email ?? note.actor?.fullName ?? note.actor?.id ?? "System",
      formatDateTime(note.createdAt),
      note.entityId ?? "",
    ]);
    styleStatusCell(row.getCell(2), note.action);
  });
  finishTableSheet(worksheet, worksheet.rowCount - 1);
}

function addSummarySection(worksheet: Worksheet, title: string, rows: Array<[string, SheetRowValue]>) {
  const startRow = worksheet.rowCount + 2;
  worksheet.mergeCells(`A${startRow}:F${startRow}`);
  const titleCell = worksheet.getCell(`A${startRow}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 12, color: { argb: navyColor } };
  titleCell.fill = solidFill(headerFill);
  titleCell.border = allBorder();

  rows.forEach(([label, value]) => {
    const row = worksheet.addRow([label, normalizeCellValue(value), "", "", "", ""]);
    worksheet.mergeCells(`B${row.number}:F${row.number}`);
    styleLabelCell(row.getCell(1));
    styleValueCell(row.getCell(2));
    if (isHyperlinkValue(value)) {
      styleLinkCell(row.getCell(2));
    }
  });
}

function addUploadedFileRow(
  worksheet: Worksheet,
  group: string,
  name: string,
  status: string,
  link: SheetRowValue,
  recordId?: string | null,
) {
  const row = worksheet.addRow([group, name, status, normalizeCellValue(link), recordId ?? ""]);
  styleStatusCell(row.getCell(3), status);
  styleLinkCell(row.getCell(4));
}

async function addWorkbookImages(
  workbook: Workbook,
  summary: Worksheet,
  seller: AdminSellerExportRecord,
) {
  await addImageToSheet(workbook, summary, "/brand/1handindia_logo.png", {
    col: 0.25,
    row: 0.25,
    width: 190,
    height: 70,
  });

  if (seller.profile?.logoUrl) {
    const sellerLogoUrl = resolveImageSource(seller.profile.logoUrl);
    if (sellerLogoUrl) {
      await addImageToSheet(workbook, summary, sellerLogoUrl, {
        col: 4.2,
        row: 0.25,
        width: 120,
        height: 70,
      });
    }
  }
}

async function addImageToSheet(
  workbook: Workbook,
  worksheet: Worksheet,
  src: string,
  position: { col: number; row: number; width: number; height: number },
) {
  try {
    const image = await imageDataUrl(src);
    if (!image) {
      return;
    }

    const imageId = workbook.addImage({
      base64: image.base64,
      extension: image.extension,
    });
    worksheet.addImage(imageId, {
      tl: { col: position.col, row: position.row },
      ext: { width: position.width, height: position.height },
    });
  } catch {
    // Image embedding is best-effort; workbook links still preserve the source asset.
  }
}

async function imageDataUrl(src: string) {
  const response = await fetch(src);
  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = contentType.includes("jpeg") || src.toLowerCase().match(/\.jpe?g(\?|$)/)
    ? "jpeg"
    : "png";
  const blob = await response.blob();
  const base64 = await blobToDataUrl(blob);

  return {
    base64,
    extension: extension as "jpeg" | "png",
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
    reader.readAsDataURL(blob);
  });
}

function setColumns(worksheet: Worksheet, columns: Array<[string, number]>) {
  worksheet.columns = columns.map(([header, width], index) => ({
    header,
    key: `c${index}`,
    width,
  }));
}

function finishTableSheet(worksheet: Worksheet, dataRows: number) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, dataRows + 1), column: worksheet.columnCount },
  };
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = allBorder();
    });
  });
}

function styleHeaderRow(row: Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: navyColor } };
    cell.fill = solidFill(headerFill);
    cell.border = allBorder();
  });
}

function styleLabelCell(cell: Cell) {
  cell.font = { bold: true, color: { argb: navyColor } };
  cell.fill = solidFill(mutedFill);
  cell.border = allBorder();
}

function styleValueCell(cell: Cell) {
  cell.font = { color: { argb: inkColor } };
  cell.border = allBorder();
}

function styleLinkCell(cell: Cell) {
  const value = cell.value;
  if (!value || typeof value !== "object" || !("hyperlink" in value)) {
    return;
  }

  cell.font = { color: { argb: "FF175CD3" }, underline: true };
}

function styleStatusCell(cell: Cell, status?: string | null) {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("approved") || normalized.includes("verified") || normalized.includes("paid") || normalized.includes("delivered") || normalized.includes("active")) {
    cell.fill = solidFill("FFECFDF3");
    cell.font = { bold: true, color: { argb: "FF0F8A5F" } };
    return;
  }

  if (normalized.includes("reject") || normalized.includes("cancel") || normalized.includes("failed") || normalized.includes("suspend")) {
    cell.fill = solidFill("FFFFF0F0");
    cell.font = { bold: true, color: { argb: "FFB42318" } };
    return;
  }

  if (normalized.includes("pending") || normalized.includes("draft") || normalized.includes("review")) {
    cell.fill = solidFill("FFFFF8E5");
    cell.font = { bold: true, color: { argb: "FFB54708" } };
  }
}

function secureDocumentLink(reference: SecureDocumentReference) {
  const params = new URLSearchParams({
    sellerId: reference.sellerId,
    documentId: reference.documentId,
    label: reference.label,
  });

  return {
    text: reference.label,
    hyperlink: `${window.location.origin}/admin/storage/private-document?${params.toString()}`,
    tooltip: "Open in the secure admin document viewer",
  };
}

function documentLinkLabel(documentType: string) {
  switch (documentType) {
    case "GST_CERTIFICATE":
      return "View GST Certificate";
    case "PAN_CARD":
      return "View PAN Card";
    case "BANK_PROOF":
      return "View Cancelled Cheque";
    case "BUSINESS_REGISTRATION":
      return "View Trade License";
    default:
      return `View ${humanize(documentType)} document`;
  }
}

function publicImageLink(text: string, assetKeyOrUrl: string) {
  const src = resolveImageSource(assetKeyOrUrl);
  if (!src) {
    return null;
  }

  return {
    text,
    hyperlink: absoluteUrl(src),
    tooltip: text,
  };
}

function normalizeCellValue(value: SheetRowValue) {
  if (isHyperlinkValue(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  return value;
}

function isHyperlinkValue(value: SheetRowValue): value is { text: string; hyperlink: string; tooltip?: string } {
  return Boolean(value && typeof value === "object" && "hyperlink" in value);
}

function solidFill(argb: string) {
  return {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb },
  };
}

function allBorder() {
  return {
    top: { style: "thin" as const, color: { argb: borderColor } },
    left: { style: "thin" as const, color: { argb: borderColor } },
    bottom: { style: "thin" as const, color: { argb: borderColor } },
    right: { style: "thin" as const, color: { argb: borderColor } },
  };
}

function humanize(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPaise(value?: number | null, currency = "INR") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function minPaise(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.min(...valid) : null;
}

function jsonText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function attributeText(attributes: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!attributes) {
    return "";
  }

  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function noteTopic(note: NonNullable<AdminSellerExportRecord["notes"]>[number]) {
  if (note.action.includes("document")) {
    return "Verification Remarks";
  }

  if (note.action.includes("rejected") || note.action.includes("suspended")) {
    return "Rejection Reasons";
  }

  if (note.action.includes("approved") || note.action.includes("unsuspended")) {
    return "Approval Notes";
  }

  return "Admin Notes";
}

function noteDetail(note: NonNullable<AdminSellerExportRecord["notes"]>[number]) {
  const newValue = jsonObject(note.newValue);
  const oldValue = jsonObject(note.oldValue);
  const storedNote = stringValue(newValue.note);
  const statusChange = [stringValue(oldValue.status), stringValue(newValue.status)]
    .filter(Boolean)
    .join(" -> ");
  const approvalChange = [stringValue(oldValue.approvalStatus), stringValue(newValue.approvalStatus)]
    .filter(Boolean)
    .join(" -> ");
  const documentType = stringValue(newValue.documentType ?? oldValue.documentType);
  const parts = [
    documentType ? `Document: ${humanize(documentType)}` : "",
    statusChange ? `Status: ${humanize(statusChange)}` : "",
    approvalChange ? `Approval: ${humanize(approvalChange)}` : "",
    storedNote ? `Note: ${storedNote}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function absoluteUrl(src: string) {
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
