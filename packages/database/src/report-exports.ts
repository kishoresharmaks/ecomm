import {
  Prisma,
  ReportExportType,
  type PrismaClient,
} from "./generated/prisma/client";

export type ReportExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  provider?: string;
  paymentStatus?: string;
};

export type ReportExportRow = Record<string, unknown>;

type ReportDefinition = {
  fileName: string;
  headers: string[];
  query: (filters: ReportExportFilters, sellerId?: string | null) => Prisma.Sql;
};

const definitions: Record<ReportExportType, ReportDefinition> = {
  [ReportExportType.ADMIN_SALES]: {
    fileName: "1handindia-admin-sales.csv",
    headers: [
      "Order Number",
      "Order ID",
      "Parent Order ID",
      "Order Type",
      "Order Date",
      "Order Status",
      "Payment Status",
      "Delivery Status",
      "Customer Name",
      "Customer Email",
      "Buyer GSTIN",
      "Seller",
      "Seller ID",
      "Seller Order Status",
      "Settlement Status",
      "Payout ID",
      "Product",
      "SKU",
      "HSN",
      "Tax Classification",
      "GST Rate %",
      "Quantity",
      "Unit Price",
      "Line Total",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "Cess",
      "Tax Total",
      "Invoice Number",
      "Invoice Date",
      "Payment Provider",
      "Provider Payment ID",
      "Provider Order ID",
      "Order Subtotal",
      "Shipping",
      "Platform Fee",
      "Coupon Discount",
      "Order Total",
      "Currency",
    ],
    query: adminSalesQuery,
  },
  [ReportExportType.ADMIN_SELLERS]: {
    fileName: "1handindia-admin-sellers.csv",
    headers: [
      "Seller ID",
      "Store Name",
      "Seller Type",
      "Status",
      "Approval Status",
      "Contact Name",
      "Email",
      "Phone",
      "Business Legal Name",
      "GST Registration",
      "GSTIN",
      "PAN",
      "Products",
      "Active Products",
      "Orders",
      "Gross Sales",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Net Payable",
      "Paid Payouts",
      "Pending Payouts",
      "Created At",
    ],
    query: adminSellersQuery,
  },
  [ReportExportType.ADMIN_PRODUCTS]: {
    fileName: "1handindia-admin-products.csv",
    headers: [
      "Product ID",
      "Variant ID",
      "Seller",
      "Seller ID",
      "Category",
      "Product",
      "SKU",
      "Variant",
      "Product Status",
      "Approval Status",
      "Variant Status",
      "HSN",
      "Tax Classification",
      "GST Rate %",
      "Price",
      "MRP",
      "Stock",
      "Units Sold",
      "Sales",
      "Returned Units",
      "Refunded Amount",
      "Currency",
      "Created At",
      "Updated At",
    ],
    query: adminProductsQuery,
  },
  [ReportExportType.ADMIN_ENQUIRIES]: {
    fileName: "1handindia-admin-enquiries-support.csv",
    headers: [
      "Record Type",
      "Reference ID",
      "Created At",
      "Status",
      "Requester",
      "Email",
      "Phone",
      "Seller",
      "Product or Topic",
      "Quantity",
      "Order Number",
      "Subject",
      "Message",
      "Response",
    ],
    query: adminEnquiriesQuery,
  },
  [ReportExportType.FINANCE_PAYMENTS]: {
    fileName: "1handindia-finance-payments.csv",
    headers: [
      "Payment ID",
      "Order Number",
      "Order Date",
      "Payment Date",
      "Provider",
      "Method",
      "Status",
      "Amount",
      "Currency",
      "Provider Order ID",
      "Provider Payment ID",
      "Customer Reference",
      "Customer Name",
      "Customer Email",
      "Order Status",
      "Order Payment Status",
      "Order Total",
    ],
    query: financePaymentsQuery,
  },
  [ReportExportType.FINANCE_COD_COLLECTIONS]: {
    fileName: "1handindia-finance-cod-collections.csv",
    headers: [
      "Order Number",
      "Order Date",
      "Delivery Mode",
      "Delivery Status",
      "Collection Status",
      "Collected Amount",
      "Collected At",
      "Collected By",
      "Verified At",
      "Verified By",
      "Collection Note",
      "Verification Note",
      "Order Total",
      "Payment Status",
      "Currency",
    ],
    query: financeCodQuery,
  },
  [ReportExportType.FINANCE_ORDER_SETTLEMENTS]: {
    fileName: "1handindia-finance-order-settlements.csv",
    headers: [
      "Split ID",
      "Order Number",
      "Order Date",
      "Seller",
      "Seller ID",
      "Settlement Status",
      "Settlement Eligible At",
      "Settled At",
      "Payout Number",
      "Seller Subtotal",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Coupon Adjustment",
      "Refund Adjustment",
      "Net Payable",
      "Currency",
    ],
    query: financeOrderSettlementsQuery,
  },
  [ReportExportType.FINANCE_SERVICE_SETTLEMENTS]: {
    fileName: "1handindia-finance-service-settlements.csv",
    headers: [
      "Settlement ID",
      "Booking Number",
      "Booking Date",
      "Seller",
      "Seller ID",
      "Status",
      "Payout Number",
      "Gross Amount",
      "Inspection Fee",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Refund Adjustment",
      "Net Payable",
      "Currency",
    ],
    query: financeServiceSettlementsQuery,
  },
  [ReportExportType.FINANCE_PAYOUTS]: {
    fileName: "1handindia-finance-payouts.csv",
    headers: [
      "Payout ID",
      "Payout Number",
      "Seller",
      "Seller ID",
      "Period From",
      "Period To",
      "Status",
      "Gross Sales",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Refund Adjustment",
      "Other Adjustment",
      "Net Payable",
      "Payment Mode",
      "Transaction Reference",
      "Approved At",
      "Paid At",
      "Currency",
      "Created At",
    ],
    query: financePayoutsQuery,
  },
  [ReportExportType.FINANCE_SERVICE_RECEIVABLES]: {
    fileName: "1handindia-finance-service-receivables.csv",
    headers: [
      "Receivable ID",
      "Receivable Number",
      "Booking Number",
      "Seller",
      "Seller ID",
      "Source",
      "Status",
      "Tax Accrual Status",
      "Offset Policy",
      "Waiver Status",
      "Gross Cash Collected",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Reversal",
      "Waived",
      "Settled",
      "Offset",
      "Amount Due",
      "Currency",
      "Verified At",
      "Disputed At",
      "Resolved At",
      "Created At",
    ],
    query: financeServiceReceivablesQuery,
  },
  [ReportExportType.SELLER_SALES]: {
    fileName: "1handindia-seller-sales.csv",
    headers: [
      "Channel",
      "Reference Number",
      "Date",
      "Status",
      "Payment Status",
      "Buyer",
      "Gross Amount",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Refund Adjustment",
      "Net Payable",
      "Currency",
    ],
    query: sellerSalesQuery,
  },
  [ReportExportType.SELLER_INVENTORY]: {
    fileName: "1handindia-seller-inventory.csv",
    headers: [
      "Product ID",
      "Variant ID",
      "Category",
      "Product",
      "SKU",
      "Variant",
      "Product Status",
      "Approval Status",
      "Variant Status",
      "HSN",
      "Tax Classification",
      "GST Rate %",
      "Price",
      "MRP",
      "Stock",
      "Units Sold",
      "Sales",
      "Currency",
      "Updated At",
    ],
    query: sellerInventoryQuery,
  },
  [ReportExportType.SELLER_FINANCE]: {
    fileName: "1handindia-seller-finance.csv",
    headers: [
      "Record Type",
      "Reference",
      "Date",
      "Status or Entry Type",
      "Description",
      "Debit",
      "Credit",
      "Gross",
      "Commission",
      "Net",
      "Balance",
      "Currency",
    ],
    query: sellerFinanceQuery,
  },
  [ReportExportType.SELLER_TAX]: {
    fileName: "1handindia-seller-tax-deductions.csv",
    headers: [
      "Order Number",
      "Order Date",
      "Seller Order Status",
      "Settlement Status",
      "Gross Sale",
      "Commission",
      "GST on Commission",
      "TDS",
      "TCS",
      "Platform Fee",
      "Coupon Discount",
      "Coupon Adjustment",
      "Refund Adjustment",
      "Net Payable",
      "Currency",
    ],
    query: sellerTaxQuery,
  },
  [ReportExportType.SELLER_RETURNS]: {
    fileName: "1handindia-seller-returns.csv",
    headers: [
      "Return Number",
      "Requested At",
      "Order Number",
      "Status",
      "Resolution",
      "Product",
      "SKU",
      "Quantity",
      "Reason",
      "Item Status",
      "Requested Refund",
      "Approved Refund",
      "Currency",
    ],
    query: sellerReturnsQuery,
  },
};

const moneyHeaders = new Set([
  "Unit Price",
  "Line Total",
  "Taxable Value",
  "CGST",
  "SGST",
  "IGST",
  "Cess",
  "Tax Total",
  "Order Subtotal",
  "Shipping",
  "Platform Fee",
  "Coupon Discount",
  "Order Total",
  "Gross Sales",
  "Commission",
  "GST on Commission",
  "TDS",
  "TCS",
  "Net Payable",
  "Paid Payouts",
  "Pending Payouts",
  "Price",
  "MRP",
  "Sales",
  "Refunded Amount",
  "Amount",
  "Collected Amount",
  "Seller Subtotal",
  "Coupon Adjustment",
  "Refund Adjustment",
  "Gross Amount",
  "Inspection Fee",
  "Other Adjustment",
  "Gross Cash Collected",
  "Reversal",
  "Waived",
  "Settled",
  "Offset",
  "Amount Due",
  "Debit",
  "Credit",
  "Gross",
  "Net",
  "Balance",
  "Gross Sale",
  "Requested Refund",
  "Approved Refund",
]);

export function reportExportFileName(exportType: ReportExportType) {
  return definitions[exportType].fileName;
}

export function reportExportHeaders(exportType: ReportExportType) {
  return definitions[exportType].headers;
}

export async function countReportExportRows(
  client: PrismaClient,
  exportType: ReportExportType,
  filters: ReportExportFilters,
  sellerId?: string | null,
) {
  const base = definitions[exportType].query(filters, sellerId);
  const rows = await client.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM (${base}) AS report_rows
  `;
  return Number(rows[0]?.count ?? 0n);
}

export async function reportExportTablePage(
  client: PrismaClient,
  exportType: ReportExportType,
  filters: ReportExportFilters,
  page = 1,
  limit = 50,
  sellerId?: string | null,
) {
  const safePage = Math.max(1, Math.trunc(page));
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const skip = (safePage - 1) * take;
  const base = definitions[exportType].query(filters, sellerId);
  const [countRows, rows] = await Promise.all([
    client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (${base}) AS report_rows
    `,
    client.$queryRaw<ReportExportRow[]>(Prisma.sql`
      SELECT *
      FROM (${base}) AS report_rows
      ORDER BY "_sortDate" DESC, "_id" DESC
      LIMIT ${take}
      OFFSET ${skip}
    `),
  ]);
  const total = Number(countRows[0]?.count ?? 0n);

  return {
    headers: definitions[exportType].headers,
    moneyHeaders: definitions[exportType].headers.filter((header) => moneyHeaders.has(header)),
    items: rows.map(reportTableRow),
    pageInfo: {
      page: safePage,
      limit: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

export async function* reportExportRows(
  client: PrismaClient,
  exportType: ReportExportType,
  filters: ReportExportFilters,
  sellerId?: string | null,
  batchSize = 1000,
) {
  const base = definitions[exportType].query(filters, sellerId);
  const take = Math.min(5000, Math.max(1, Math.trunc(batchSize)));
  let cursorDate: Date | null = null;
  let cursorId: string | null = null;

  while (true) {
    const cursor: Prisma.Sql = cursorDate && cursorId
      ? Prisma.sql`WHERE ("_sortDate", "_id") < (${cursorDate}, ${cursorId}::uuid)`
      : Prisma.empty;
    const rows: ReportExportRow[] = await client.$queryRaw<ReportExportRow[]>(Prisma.sql`
      SELECT *
      FROM (${base}) AS report_rows
      ${cursor}
      ORDER BY "_sortDate" DESC, "_id" DESC
      LIMIT ${take}
    `);

    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      const rawId = row["_id"];
      const rawDate = row["_sortDate"];
      const record = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "_id" && key !== "_sortDate"),
      );
      yield record;
      cursorId = String(rawId);
      cursorDate = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
    }

    if (rows.length < take) {
      return;
    }
  }
}

export function reportExportCsvHeader(exportType: ReportExportType) {
  return `${definitions[exportType].headers.map(csvCell).join(",")}\r\n`;
}

export function reportExportCsvRow(exportType: ReportExportType, row: ReportExportRow) {
  return `${definitions[exportType].headers
    .map((header) => csvCell(moneyHeaders.has(header) ? minorToMajor(row[header]) : row[header]))
    .join(",")}\r\n`;
}

function adminSalesQuery(filters: ReportExportFilters) {
  const conditions = [
    ...dateConditions("o.created_at", filters),
    ...statusCondition("o.order_status", filters.status),
    ...searchCondition(filters.search, [
      "o.order_number",
      "u.full_name",
      "u.email",
      "s.store_name",
      "oi.product_name_snapshot",
      "pv.sku",
    ]),
  ];
  return Prisma.sql`
    SELECT
      oi.id AS "_id",
      o.created_at AS "_sortDate",
      o.order_number AS "Order Number",
      o.id::text AS "Order ID",
      o.parent_order_id::text AS "Parent Order ID",
      o.order_kind::text AS "Order Type",
      o.created_at AS "Order Date",
      o.order_status::text AS "Order Status",
      o.payment_status::text AS "Payment Status",
      o.delivery_status::text AS "Delivery Status",
      COALESCE(u.full_name, 'Customer') AS "Customer Name",
      u.email AS "Customer Email",
      o.buyer_gstin_snapshot AS "Buyer GSTIN",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      oss.seller_status::text AS "Seller Order Status",
      oss.settlement_status::text AS "Settlement Status",
      oss.payout_id::text AS "Payout ID",
      oi.product_name_snapshot AS "Product",
      pv.sku AS "SKU",
      oi.hsn_code_snapshot AS "HSN",
      oi.product_tax_classification_snapshot::text AS "Tax Classification",
      oi.gst_rate_percent_snapshot AS "GST Rate %",
      oi.quantity AS "Quantity",
      (oi.unit_price_paise) AS "Unit Price",
      (oi.line_total_paise) AS "Line Total",
      (oi.taxable_value_paise) AS "Taxable Value",
      (oi.cgst_paise) AS "CGST",
      (oi.sgst_paise) AS "SGST",
      (oi.igst_paise) AS "IGST",
      (oi.cess_paise) AS "Cess",
      (oi.tax_total_paise) AS "Tax Total",
      td.document_number AS "Invoice Number",
      td.issue_date AS "Invoice Date",
      pay.provider::text AS "Payment Provider",
      pay.provider_payment_id AS "Provider Payment ID",
      pay.provider_order_id AS "Provider Order ID",
      (o.subtotal_paise) AS "Order Subtotal",
      (o.shipping_paise) AS "Shipping",
      (o.platform_fee_paise) AS "Platform Fee",
      (o.coupon_discount_paise) AS "Coupon Discount",
      (o.total_paise) AS "Order Total",
      o.currency AS "Currency"
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN customers c ON c.id = o.customer_id
    JOIN users u ON u.id = c.user_id
    JOIN sellers s ON s.id = oi.seller_id
    JOIN product_variants pv ON pv.id = oi.product_variant_id
    LEFT JOIN order_seller_splits oss ON oss.order_id = o.id AND oss.seller_id = oi.seller_id
    LEFT JOIN LATERAL (
      SELECT p.provider, p.provider_payment_id, p.provider_order_id
      FROM payments p
      WHERE p.order_id = o.id
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT 1
    ) pay ON TRUE
    LEFT JOIN LATERAL (
      SELECT d.document_number, d.issue_date
      FROM tax_documents d
      WHERE d.order_id = o.id AND d.seller_id = oi.seller_id AND d.status::text = 'ISSUED'
      ORDER BY d.issue_date DESC NULLS LAST, d.created_at DESC
      LIMIT 1
    ) td ON TRUE
    ${whereSql(conditions)}
  `;
}

function adminSellersQuery(filters: ReportExportFilters) {
  const salesDate = datePredicate("o.created_at", filters);
  const conditions = [
    Prisma.sql`s.deleted_at IS NULL`,
    ...statusCondition("s.status", filters.status),
    ...searchCondition(filters.search, [
      "s.store_name",
      "u.email",
      "sp.business_legal_name",
      "sp.gst_number",
    ]),
  ];
  return Prisma.sql`
    SELECT
      s.id AS "_id",
      s.created_at AS "_sortDate",
      s.id::text AS "Seller ID",
      s.store_name AS "Store Name",
      s.seller_type::text AS "Seller Type",
      s.status::text AS "Status",
      s.approval_status::text AS "Approval Status",
      sp.contact_name AS "Contact Name",
      COALESCE(sp.contact_email, u.email) AS "Email",
      COALESCE(sp.contact_phone, u.phone) AS "Phone",
      sp.business_legal_name AS "Business Legal Name",
      sp.tax_registration_status::text AS "GST Registration",
      sp.gst_number AS "GSTIN",
      sp.pan_number AS "PAN",
      COALESCE(prod.total_count, 0) AS "Products",
      COALESCE(prod.active_count, 0) AS "Active Products",
      COALESCE(sales.order_count, 0) AS "Orders",
      (COALESCE(sales.gross_paise, 0)) AS "Gross Sales",
      (COALESCE(sales.commission_paise, 0)) AS "Commission",
      (COALESCE(sales.gst_paise, 0)) AS "GST on Commission",
      (COALESCE(sales.tds_paise, 0)) AS "TDS",
      (COALESCE(sales.tcs_paise, 0)) AS "TCS",
      (COALESCE(sales.platform_fee_paise, 0)) AS "Platform Fee",
      (COALESCE(sales.net_paise, 0)) AS "Net Payable",
      (COALESCE(payouts.paid_paise, 0)) AS "Paid Payouts",
      (COALESCE(payouts.pending_paise, 0)) AS "Pending Payouts",
      s.created_at AS "Created At"
    FROM sellers s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN seller_profiles sp ON sp.seller_id = s.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE p.status::text = 'ACTIVE' AND p.approval_status::text = 'APPROVED')::int AS active_count
      FROM products p
      WHERE p.seller_id = s.id AND p.deleted_at IS NULL
    ) prod ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS order_count,
        COALESCE(SUM(oss.seller_subtotal_paise), 0)::bigint AS gross_paise,
        COALESCE(SUM(oss.commission_paise), 0)::bigint AS commission_paise,
        COALESCE(SUM(oss.gst_on_commission_paise), 0)::bigint AS gst_paise,
        COALESCE(SUM(oss.tds_paise), 0)::bigint AS tds_paise,
        COALESCE(SUM(oss.tcs_paise), 0)::bigint AS tcs_paise,
        COALESCE(SUM(oss.platform_fee_paise), 0)::bigint AS platform_fee_paise,
        COALESCE(SUM(oss.net_payable_paise), 0)::bigint AS net_paise
      FROM order_seller_splits oss
      JOIN orders o ON o.id = oss.order_id
      WHERE oss.seller_id = s.id AND o.order_status::text <> 'CANCELLED' ${salesDate}
    ) sales ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(spay.net_payable_paise) FILTER (WHERE spay.status::text = 'PAID'), 0)::bigint AS paid_paise,
        COALESCE(SUM(spay.net_payable_paise) FILTER (WHERE spay.status::text IN ('PENDING_APPROVAL', 'APPROVED')), 0)::bigint AS pending_paise
      FROM seller_payouts spay
      WHERE spay.seller_id = s.id
    ) payouts ON TRUE
    ${whereSql(conditions)}
  `;
}

function adminProductsQuery(filters: ReportExportFilters, sellerId?: string | null) {
  return productQuery(filters, sellerId);
}

function sellerInventoryQuery(filters: ReportExportFilters, sellerId?: string | null) {
  return productQuery(filters, requireSellerId(sellerId));
}

function productQuery(filters: ReportExportFilters, sellerId?: string | null) {
  const saleDate = datePredicate("o.created_at", filters);
  const conditions = [
    Prisma.sql`p.deleted_at IS NULL`,
    ...(sellerId ? [Prisma.sql`p.seller_id = ${sellerId}::uuid`] : []),
    ...statusCondition("p.status", filters.status),
    ...searchCondition(filters.search, [
      "p.name",
      "pv.sku",
      "pv.variant_name",
      "s.store_name",
      "cat.name",
      "p.hsn_code",
    ]),
  ];
  return Prisma.sql`
    SELECT
      pv.id AS "_id",
      pv.updated_at AS "_sortDate",
      p.id::text AS "Product ID",
      pv.id::text AS "Variant ID",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      cat.name AS "Category",
      p.name AS "Product",
      pv.sku AS "SKU",
      pv.variant_name AS "Variant",
      p.status::text AS "Product Status",
      p.approval_status::text AS "Approval Status",
      pv.status::text AS "Variant Status",
      p.hsn_code AS "HSN",
      p.tax_classification::text AS "Tax Classification",
      p.gst_rate_percent AS "GST Rate %",
      (pv.price_paise) AS "Price",
      (pv.mrp_paise) AS "MRP",
      pv.stock_quantity AS "Stock",
      COALESCE(sales.units_sold, 0) AS "Units Sold",
      (COALESCE(sales.sales_paise, 0)) AS "Sales",
      COALESCE(returns.returned_units, 0) AS "Returned Units",
      (COALESCE(returns.refunded_paise, 0)) AS "Refunded Amount",
      pv.currency AS "Currency",
      p.created_at AS "Created At",
      pv.updated_at AS "Updated At"
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    JOIN sellers s ON s.id = p.seller_id
    JOIN categories cat ON cat.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(oi.quantity), 0)::bigint AS units_sold,
        COALESCE(SUM(oi.line_total_paise), 0)::bigint AS sales_paise
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_variant_id = pv.id AND o.order_status::text <> 'CANCELLED' ${saleDate}
    ) sales ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(rri.quantity), 0)::bigint AS returned_units,
        COALESCE(SUM(rri.approved_refund_paise), 0)::bigint AS refunded_paise
      FROM return_request_items rri
      JOIN return_requests rr ON rr.id = rri.return_request_id
      WHERE rri.product_variant_id = pv.id ${datePredicate("rr.requested_at", filters)}
    ) returns ON TRUE
    ${whereSql(conditions)}
  `;
}

function adminEnquiriesQuery(filters: ReportExportFilters) {
  const b2bConditions = [
    ...dateConditions("e.created_at", filters),
    ...statusCondition("e.status", filters.status),
    ...searchCondition(filters.search, [
      "bb.company_name",
      "s.store_name",
      "p.name",
      "e.message",
    ]),
  ];
  const supportConditions = [
    ...dateConditions("sr.created_at", filters),
    ...statusCondition("sr.status", filters.status),
    ...searchCondition(filters.search, [
      "sr.name",
      "sr.email",
      "sr.subject",
      "sr.message",
      "sr.order_number",
    ]),
  ];
  return Prisma.sql`
    SELECT
      e.id AS "_id",
      e.created_at AS "_sortDate",
      'B2B_ENQUIRY' AS "Record Type",
      e.id::text AS "Reference ID",
      e.created_at AS "Created At",
      e.status::text AS "Status",
      bb.company_name AS "Requester",
      NULL::text AS "Email",
      NULL::text AS "Phone",
      s.store_name AS "Seller",
      p.name AS "Product or Topic",
      e.quantity AS "Quantity",
      NULL::text AS "Order Number",
      'B2B enquiry' AS "Subject",
      e.message AS "Message",
      response.message AS "Response"
    FROM b2b_enquiries e
    JOIN business_buyers bb ON bb.id = e.business_buyer_id
    LEFT JOIN sellers s ON s.id = e.seller_id
    LEFT JOIN products p ON p.id = e.product_id
    LEFT JOIN LATERAL (
      SELECT r.response_message AS message
      FROM b2b_enquiry_responses r
      WHERE r.enquiry_id = e.id
      ORDER BY r.created_at DESC
      LIMIT 1
    ) response ON TRUE
    ${whereSql(b2bConditions)}
    UNION ALL
    SELECT
      sr.id AS "_id",
      sr.created_at AS "_sortDate",
      'SUPPORT_REQUEST' AS "Record Type",
      sr.id::text AS "Reference ID",
      sr.created_at AS "Created At",
      sr.status::text AS "Status",
      sr.name AS "Requester",
      sr.email AS "Email",
      sr.phone AS "Phone",
      NULL::text AS "Seller",
      sr.topic::text AS "Product or Topic",
      NULL::integer AS "Quantity",
      sr.order_number AS "Order Number",
      sr.subject AS "Subject",
      sr.message AS "Message",
      sr.response_message AS "Response"
    FROM support_requests sr
    ${whereSql(supportConditions)}
  `;
}

function financePaymentsQuery(filters: ReportExportFilters) {
  const conditions = [
    ...dateConditions("p.created_at", filters),
    ...(filters.provider ? [Prisma.sql`p.provider::text = ${filters.provider}`] : []),
    ...(filters.paymentStatus ? [Prisma.sql`p.status::text = ${filters.paymentStatus}`] : []),
    ...statusCondition("p.status", filters.status),
    ...searchCondition(filters.search, [
      "o.order_number",
      "p.provider_payment_id",
      "p.provider_order_id",
      "u.full_name",
      "u.email",
    ]),
  ];
  return Prisma.sql`
    SELECT
      p.id AS "_id",
      p.created_at AS "_sortDate",
      p.id::text AS "Payment ID",
      o.order_number AS "Order Number",
      o.created_at AS "Order Date",
      p.created_at AS "Payment Date",
      p.provider::text AS "Provider",
      p.method AS "Method",
      p.status::text AS "Status",
      (p.amount_paise) AS "Amount",
      p.currency AS "Currency",
      p.provider_order_id AS "Provider Order ID",
      p.provider_payment_id AS "Provider Payment ID",
      COALESCE(p.raw_response->>'customerReference', p.raw_response->>'transactionReference') AS "Customer Reference",
      u.full_name AS "Customer Name",
      u.email AS "Customer Email",
      o.order_status::text AS "Order Status",
      o.payment_status::text AS "Order Payment Status",
      (o.total_paise) AS "Order Total"
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    JOIN customers c ON c.id = o.customer_id
    JOIN users u ON u.id = c.user_id
    ${whereSql(conditions)}
  `;
}

function financeCodQuery(filters: ReportExportFilters) {
  const conditions = [
    ...dateConditions("COALESCE(dd.cod_collected_at, o.created_at)", filters),
    ...statusCondition("dd.cod_collection_status", filters.status),
    ...searchCondition(filters.search, [
      "o.order_number",
      "collector.full_name",
      "verifier.full_name",
    ]),
  ];
  return Prisma.sql`
    SELECT
      dd.id AS "_id",
      COALESCE(dd.cod_collected_at, o.created_at) AS "_sortDate",
      o.order_number AS "Order Number",
      o.created_at AS "Order Date",
      dd.delivery_mode::text AS "Delivery Mode",
      dd.status::text AS "Delivery Status",
      dd.cod_collection_status::text AS "Collection Status",
      (dd.cod_collected_amount_paise) AS "Collected Amount",
      dd.cod_collected_at AS "Collected At",
      collector.full_name AS "Collected By",
      dd.cod_verified_at AS "Verified At",
      verifier.full_name AS "Verified By",
      dd.cod_collection_note AS "Collection Note",
      dd.cod_verification_note AS "Verification Note",
      (o.total_paise) AS "Order Total",
      o.payment_status::text AS "Payment Status",
      o.currency AS "Currency"
    FROM delivery_details dd
    JOIN orders o ON o.id = dd.order_id
    LEFT JOIN users collector ON collector.id = dd.cod_collected_by_id
    LEFT JOIN users verifier ON verifier.id = dd.cod_verified_by_id
    ${whereSql(conditions)}
  `;
}

function financeOrderSettlementsQuery(filters: ReportExportFilters) {
  const activityDate = "COALESCE(oss.settled_at, oss.settlement_eligible_at, oss.created_at)";
  const conditions = [
    ...dateConditions(activityDate, filters),
    ...statusCondition("oss.settlement_status", filters.status),
    ...searchCondition(filters.search, ["o.order_number", "s.store_name", "sp.payout_number"]),
  ];
  return Prisma.sql`
    SELECT
      oss.id AS "_id",
      ${Prisma.raw(activityDate)} AS "_sortDate",
      oss.id::text AS "Split ID",
      o.order_number AS "Order Number",
      o.created_at AS "Order Date",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      oss.settlement_status::text AS "Settlement Status",
      oss.settlement_eligible_at AS "Settlement Eligible At",
      oss.settled_at AS "Settled At",
      sp.payout_number AS "Payout Number",
      (oss.seller_subtotal_paise) AS "Seller Subtotal",
      (oss.commission_paise) AS "Commission",
      (oss.gst_on_commission_paise) AS "GST on Commission",
      (oss.tds_paise) AS "TDS",
      (oss.tcs_paise) AS "TCS",
      (oss.platform_fee_paise) AS "Platform Fee",
      (oss.coupon_adjustment_paise) AS "Coupon Adjustment",
      (oss.refund_adjustment_paise) AS "Refund Adjustment",
      (oss.net_payable_paise) AS "Net Payable",
      o.currency AS "Currency"
    FROM order_seller_splits oss
    JOIN orders o ON o.id = oss.order_id
    JOIN sellers s ON s.id = oss.seller_id
    LEFT JOIN seller_payouts sp ON sp.id = oss.payout_id
    ${whereSql(conditions)}
  `;
}

function financeServiceSettlementsQuery(filters: ReportExportFilters) {
  const conditions = [
    ...dateConditions("sbs.updated_at", filters),
    ...statusCondition("sbs.status", filters.status),
    ...searchCondition(filters.search, ["sb.booking_number", "s.store_name", "sp.payout_number"]),
  ];
  return Prisma.sql`
    SELECT
      sbs.id AS "_id",
      sbs.updated_at AS "_sortDate",
      sbs.id::text AS "Settlement ID",
      sb.booking_number AS "Booking Number",
      sb.created_at AS "Booking Date",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      sbs.status::text AS "Status",
      sp.payout_number AS "Payout Number",
      (sbs.gross_amount_paise) AS "Gross Amount",
      (sbs.inspection_fee_gross_paise) AS "Inspection Fee",
      (sbs.commission_paise) AS "Commission",
      (sbs.gst_on_commission_paise) AS "GST on Commission",
      (sbs.tds_paise) AS "TDS",
      (sbs.tcs_paise) AS "TCS",
      (sbs.platform_fee_paise) AS "Platform Fee",
      (sbs.refund_adjustment_paise) AS "Refund Adjustment",
      (sbs.net_payable_paise) AS "Net Payable",
      sbs.currency AS "Currency"
    FROM service_booking_settlements sbs
    JOIN service_bookings sb ON sb.id = sbs.booking_id
    JOIN sellers s ON s.id = sbs.seller_id
    LEFT JOIN seller_payouts sp ON sp.id = sbs.payout_id
    ${whereSql(conditions)}
  `;
}

function financePayoutsQuery(filters: ReportExportFilters) {
  const activityDate = "COALESCE(sp.paid_at, sp.approved_at, sp.created_at)";
  const conditions = [
    ...dateConditions(activityDate, filters),
    ...statusCondition("sp.status", filters.status),
    ...searchCondition(filters.search, [
      "sp.payout_number",
      "s.store_name",
      "sp.transaction_reference",
    ]),
  ];
  return Prisma.sql`
    SELECT
      sp.id AS "_id",
      ${Prisma.raw(activityDate)} AS "_sortDate",
      sp.id::text AS "Payout ID",
      sp.payout_number AS "Payout Number",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      sp.period_from AS "Period From",
      sp.period_to AS "Period To",
      sp.status::text AS "Status",
      (sp.gross_sales_paise) AS "Gross Sales",
      (sp.commission_paise) AS "Commission",
      (sp.gst_on_commission_paise) AS "GST on Commission",
      (sp.tds_paise) AS "TDS",
      (sp.tcs_paise) AS "TCS",
      (sp.platform_fee_paise) AS "Platform Fee",
      (sp.refund_adjustment_paise) AS "Refund Adjustment",
      (sp.adjustment_paise) AS "Other Adjustment",
      (sp.net_payable_paise) AS "Net Payable",
      sp.payment_mode AS "Payment Mode",
      sp.transaction_reference AS "Transaction Reference",
      sp.approved_at AS "Approved At",
      sp.paid_at AS "Paid At",
      sp.currency AS "Currency",
      sp.created_at AS "Created At"
    FROM seller_payouts sp
    JOIN sellers s ON s.id = sp.seller_id
    ${whereSql(conditions)}
  `;
}

function financeServiceReceivablesQuery(filters: ReportExportFilters) {
  const activityDate =
    "COALESCE(ssr.resolved_at, ssr.disputed_at, ssr.verified_at, ssr.created_at)";
  const conditions = [
    ...dateConditions(activityDate, filters),
    ...statusCondition("ssr.status", filters.status),
    ...searchCondition(filters.search, [
      "ssr.receivable_number",
      "sb.booking_number",
      "s.store_name",
    ]),
  ];
  return Prisma.sql`
    SELECT
      ssr.id AS "_id",
      ${Prisma.raw(activityDate)} AS "_sortDate",
      ssr.id::text AS "Receivable ID",
      ssr.receivable_number AS "Receivable Number",
      sb.booking_number AS "Booking Number",
      s.store_name AS "Seller",
      s.id::text AS "Seller ID",
      ssr.source::text AS "Source",
      ssr.status::text AS "Status",
      ssr.tax_accrual_status::text AS "Tax Accrual Status",
      ssr.offset_policy::text AS "Offset Policy",
      ssr.waiver_approval_status::text AS "Waiver Status",
      (ssr.gross_cash_collected_paise) AS "Gross Cash Collected",
      (ssr.commission_paise) AS "Commission",
      (ssr.gst_on_commission_paise) AS "GST on Commission",
      (ssr.tds_paise) AS "TDS",
      (ssr.tcs_paise) AS "TCS",
      (ssr.platform_fee_paise) AS "Platform Fee",
      (ssr.reversal_paise) AS "Reversal",
      (ssr.waived_paise) AS "Waived",
      (ssr.settled_paise) AS "Settled",
      (ssr.offset_paise) AS "Offset",
      (ssr.amount_due_to_platform_paise) AS "Amount Due",
      ssr.currency AS "Currency",
      ssr.verified_at AS "Verified At",
      ssr.disputed_at AS "Disputed At",
      ssr.resolved_at AS "Resolved At",
      ssr.created_at AS "Created At"
    FROM service_seller_receivables ssr
    JOIN service_bookings sb ON sb.id = ssr.booking_id
    JOIN sellers s ON s.id = ssr.seller_id
    ${whereSql(conditions)}
  `;
}

function sellerSalesQuery(filters: ReportExportFilters, sellerId?: string | null) {
  const id = requireSellerId(sellerId);
  const retailConditions = [
    Prisma.sql`oss.seller_id = ${id}::uuid`,
    Prisma.sql`o.order_status::text <> 'CANCELLED'`,
    ...dateConditions("o.created_at", filters),
    ...statusCondition("oss.seller_status", filters.status),
    ...searchCondition(filters.search, ["o.order_number", "u.full_name", "u.email"]),
  ];
  const b2bConditions = [
    Prisma.sql`bo.seller_id = ${id}::uuid`,
    Prisma.sql`bo.status::text <> 'CANCELLED'`,
    ...dateConditions("bo.created_at", filters),
    ...statusCondition("bo.status", filters.status),
    ...searchCondition(filters.search, ["bo.order_number", "bb.company_name"]),
  ];
  const serviceConditions = [
    Prisma.sql`sb.seller_id = ${id}::uuid`,
    ...dateConditions("sb.created_at", filters),
    ...statusCondition("sb.status", filters.status),
    ...searchCondition(filters.search, ["sb.booking_number", "u.full_name", "u.email"]),
  ];
  return Prisma.sql`
    SELECT
      oss.id AS "_id",
      o.created_at AS "_sortDate",
      'RETAIL' AS "Channel",
      o.order_number AS "Reference Number",
      o.created_at AS "Date",
      oss.seller_status::text AS "Status",
      o.payment_status::text AS "Payment Status",
      COALESCE(u.full_name, u.email) AS "Buyer",
      (oss.seller_subtotal_paise) AS "Gross Amount",
      (oss.commission_paise) AS "Commission",
      (oss.gst_on_commission_paise) AS "GST on Commission",
      (oss.tds_paise) AS "TDS",
      (oss.tcs_paise) AS "TCS",
      (oss.platform_fee_paise) AS "Platform Fee",
      (oss.refund_adjustment_paise) AS "Refund Adjustment",
      (oss.net_payable_paise) AS "Net Payable",
      o.currency AS "Currency"
    FROM order_seller_splits oss
    JOIN orders o ON o.id = oss.order_id
    JOIN customers c ON c.id = o.customer_id
    JOIN users u ON u.id = c.user_id
    ${whereSql(retailConditions)}
    UNION ALL
    SELECT
      bo.id AS "_id",
      bo.created_at AS "_sortDate",
      'B2B' AS "Channel",
      bo.order_number AS "Reference Number",
      bo.created_at AS "Date",
      bo.status::text AS "Status",
      bo.payment_status::text AS "Payment Status",
      bb.company_name AS "Buyer",
      (bo.buyer_payable_amount_paise) AS "Gross Amount",
      (bo.commission_amount_paise) AS "Commission",
      0::numeric AS "GST on Commission",
      0::numeric AS "TDS",
      0::numeric AS "TCS",
      0::numeric AS "Platform Fee",
      0::numeric AS "Refund Adjustment",
      (bo.seller_payout_amount_paise) AS "Net Payable",
      bo.currency AS "Currency"
    FROM b2b_orders bo
    JOIN business_buyers bb ON bb.id = bo.business_buyer_id
    ${whereSql(b2bConditions)}
    UNION ALL
    SELECT
      sb.id AS "_id",
      sb.created_at AS "_sortDate",
      'SERVICE' AS "Channel",
      sb.booking_number AS "Reference Number",
      sb.created_at AS "Date",
      sb.status::text AS "Status",
      CASE WHEN sb.paid_amount_paise >= sb.total_payable_paise AND sb.total_payable_paise > 0 THEN 'PAID' ELSE 'PENDING' END AS "Payment Status",
      COALESCE(u.full_name, u.email) AS "Buyer",
      (COALESCE(sbs.gross_amount_paise, sb.total_payable_paise)) AS "Gross Amount",
      (COALESCE(sbs.commission_paise, 0)) AS "Commission",
      (COALESCE(sbs.gst_on_commission_paise, 0)) AS "GST on Commission",
      (COALESCE(sbs.tds_paise, 0)) AS "TDS",
      (COALESCE(sbs.tcs_paise, 0)) AS "TCS",
      (COALESCE(sbs.platform_fee_paise, 0)) AS "Platform Fee",
      (COALESCE(sbs.refund_adjustment_paise, 0)) AS "Refund Adjustment",
      (COALESCE(sbs.net_payable_paise, sb.total_payable_paise)) AS "Net Payable",
      sb.currency AS "Currency"
    FROM service_bookings sb
    JOIN customers c ON c.id = sb.customer_id
    JOIN users u ON u.id = c.user_id
    LEFT JOIN service_booking_settlements sbs ON sbs.booking_id = sb.id
    ${whereSql(serviceConditions)}
  `;
}

function sellerFinanceQuery(filters: ReportExportFilters, sellerId?: string | null) {
  const id = requireSellerId(sellerId);
  const payoutConditions = [
    Prisma.sql`sp.seller_id = ${id}::uuid`,
    ...dateConditions("sp.created_at", filters),
    ...statusCondition("sp.status", filters.status),
    ...searchCondition(filters.search, ["sp.payout_number", "sp.transaction_reference"]),
  ];
  const ledgerConditions = [
    Prisma.sql`sle.seller_id = ${id}::uuid`,
    ...dateConditions("sle.created_at", filters),
    ...statusCondition("sle.entry_type", filters.status),
    ...searchCondition(filters.search, ["sle.description", "sle.reference_id"]),
  ];
  return Prisma.sql`
    SELECT
      sp.id AS "_id",
      sp.created_at AS "_sortDate",
      'PAYOUT' AS "Record Type",
      sp.payout_number AS "Reference",
      sp.created_at AS "Date",
      sp.status::text AS "Status or Entry Type",
      sp.note AS "Description",
      0::numeric AS "Debit",
      (sp.net_payable_paise) AS "Credit",
      (sp.gross_sales_paise) AS "Gross",
      (sp.commission_paise) AS "Commission",
      (sp.net_payable_paise) AS "Net",
      NULL::numeric AS "Balance",
      sp.currency AS "Currency"
    FROM seller_payouts sp
    ${whereSql(payoutConditions)}
    UNION ALL
    SELECT
      sle.id AS "_id",
      sle.created_at AS "_sortDate",
      'LEDGER' AS "Record Type",
      COALESCE(sle.reference_id, sle.id::text) AS "Reference",
      sle.created_at AS "Date",
      sle.entry_type::text AS "Status or Entry Type",
      sle.description AS "Description",
      (sle.debit_paise) AS "Debit",
      (sle.credit_paise) AS "Credit",
      NULL::numeric AS "Gross",
      NULL::numeric AS "Commission",
      (sle.credit_paise - sle.debit_paise) AS "Net",
      (sle.balance_after_paise) AS "Balance",
      sle.currency AS "Currency"
    FROM seller_ledger_entries sle
    ${whereSql(ledgerConditions)}
  `;
}

function sellerTaxQuery(filters: ReportExportFilters, sellerId?: string | null) {
  const id = requireSellerId(sellerId);
  const conditions = [
    Prisma.sql`oss.seller_id = ${id}::uuid`,
    Prisma.sql`o.order_status::text <> 'CANCELLED'`,
    ...dateConditions("o.created_at", filters),
    ...statusCondition("oss.settlement_status", filters.status),
    ...searchCondition(filters.search, ["o.order_number"]),
  ];
  return Prisma.sql`
    SELECT
      oss.id AS "_id",
      o.created_at AS "_sortDate",
      o.order_number AS "Order Number",
      o.created_at AS "Order Date",
      oss.seller_status::text AS "Seller Order Status",
      oss.settlement_status::text AS "Settlement Status",
      (oss.seller_subtotal_paise) AS "Gross Sale",
      (oss.commission_paise) AS "Commission",
      (oss.gst_on_commission_paise) AS "GST on Commission",
      (oss.tds_paise) AS "TDS",
      (oss.tcs_paise) AS "TCS",
      (oss.platform_fee_paise) AS "Platform Fee",
      (oss.coupon_seller_funded_discount_paise) AS "Coupon Discount",
      (oss.coupon_adjustment_paise) AS "Coupon Adjustment",
      (oss.refund_adjustment_paise) AS "Refund Adjustment",
      (oss.net_payable_paise) AS "Net Payable",
      o.currency AS "Currency"
    FROM order_seller_splits oss
    JOIN orders o ON o.id = oss.order_id
    ${whereSql(conditions)}
  `;
}

function sellerReturnsQuery(filters: ReportExportFilters, sellerId?: string | null) {
  const id = requireSellerId(sellerId);
  const conditions = [
    Prisma.sql`rri.seller_id = ${id}::uuid`,
    ...dateConditions("rr.requested_at", filters),
    ...statusCondition("rr.status", filters.status),
    ...searchCondition(filters.search, [
      "rr.request_number",
      "o.order_number",
      "p.name",
      "pv.sku",
      "rr.reason",
    ]),
  ];
  return Prisma.sql`
    SELECT
      rri.id AS "_id",
      rr.requested_at AS "_sortDate",
      rr.request_number AS "Return Number",
      rr.requested_at AS "Requested At",
      o.order_number AS "Order Number",
      rr.status::text AS "Status",
      rr.resolution::text AS "Resolution",
      p.name AS "Product",
      pv.sku AS "SKU",
      rri.quantity AS "Quantity",
      rri.reason AS "Reason",
      rri.status::text AS "Item Status",
      (rri.requested_refund_paise) AS "Requested Refund",
      (rri.approved_refund_paise) AS "Approved Refund",
      rr.currency AS "Currency"
    FROM return_request_items rri
    JOIN return_requests rr ON rr.id = rri.return_request_id
    JOIN orders o ON o.id = rr.order_id
    JOIN products p ON p.id = rri.product_id
    JOIN product_variants pv ON pv.id = rri.product_variant_id
    ${whereSql(conditions)}
  `;
}

function dateConditions(column: string, filters: ReportExportFilters) {
  const conditions: Prisma.Sql[] = [];
  const identifier = Prisma.raw(column);
  if (filters.dateFrom) {
    conditions.push(Prisma.sql`${identifier} >= ${new Date(filters.dateFrom)}`);
  }
  if (filters.dateTo) {
    conditions.push(Prisma.sql`${identifier} <= ${new Date(filters.dateTo)}`);
  }
  return conditions;
}

function datePredicate(column: string, filters: ReportExportFilters) {
  const conditions = dateConditions(column, filters);
  return conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

function statusCondition(column: string, status?: string) {
  return status ? [Prisma.sql`${Prisma.raw(column)}::text = ${status}`] : [];
}

function searchCondition(search: string | undefined, columns: string[]) {
  const value = search?.trim();
  if (!value) {
    return [];
  }
  const pattern = `%${value}%`;
  return [
    Prisma.sql`(${Prisma.join(
      columns.map((column) => Prisma.sql`${Prisma.raw(column)} ILIKE ${pattern}`),
      " OR ",
    )})`,
  ];
}

function whereSql(conditions: Prisma.Sql[]) {
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

function requireSellerId(sellerId?: string | null) {
  if (!sellerId) {
    throw new Error("sellerId is required for seller report exports.");
  }
  return sellerId;
}

function minorToMajor(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const amount = Number(String(value));
  return Number.isFinite(amount) ? (amount / 100).toFixed(2) : value;
}

function csvCell(value: unknown) {
  const normalized =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object" && "toString" in value
          ? String(value)
          : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function reportTableRow(row: ReportExportRow) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== "_id" && key !== "_sortDate")
      .map(([key, value]) => [key, moneyHeaders.has(key) ? minorToMajor(value) : tableValue(value)]),
  );
}

function tableValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}
