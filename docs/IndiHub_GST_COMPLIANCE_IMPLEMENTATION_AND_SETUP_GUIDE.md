# 1HandIndia GST Compliance Implementation and Setup Guide

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document type:** Architecture, operations, setup, verification, and go-live guide  
**Last updated:** 20-07-2026  
**Implementation status:** Core GST documents, reports, filing controls, and UI implemented in code  
**Production status:** Not production-ready until migrations, provider integration, and end-to-end validation are completed

## 1. Purpose

This document explains:

- What GST functionality exists in 1HandIndia.
- How GST values are calculated and preserved.
- How tax invoices, credit notes, and debit notes work.
- Which GST reports are available.
- How sellers, administrators, finance staff, and buyers use the GST workflows.
- How to configure the platform for manual compliance operation.
- How e-invoice and e-way bill credentials must be onboarded.
- What is still required for live provider submission.
- How to migrate, test, verify, and deploy the GST implementation safely.

This is an implementation and operations guide. It is not tax or legal advice. A qualified
GST practitioner must approve HSN codes, GST rates, place-of-supply treatment, return data,
e-invoice applicability, e-way bill applicability, and production filing procedures.

## 2. Executive Status

### 2.1 Implemented

The following capabilities are implemented:

- Immutable GST snapshots on orders and order items.
- GST-inclusive tax extraction.
- Intrastate CGST and SGST allocation.
- Interstate IGST allocation.
- Explicit seller tax registration status: regular GST, not registered, or composition.
- Explicit product/supply tax classification: taxable, nil-rated, exempt, or non-GST.
- Seller GSTIN, buyer GSTIN, HSN, rate, and place-of-supply snapshots.
- Seller-scoped tax document numbering.
- Tax invoices, bills of supply, and commercial invoices.
- Refund and cancellation-linked credit notes.
- Manual debit notes linked to original invoices.
- B2B final tax invoices, bills of supply, or commercial invoices after fulfilment.
- Platform commission GST documents.
- GST document register.
- HSN summary.
- GSTR-1-oriented reports.
- GSTR-3B outward-liability summary.
- Marketplace TCS and GSTR-8-oriented statements.
- Rate-wise, state-wise, and GSTIN-wise summaries.
- Invoice document-series controls.
- GST reconciliation checks.
- Filing-period locking, hashing, filing status, and audit history.
- E-invoice and e-way bill status metadata.
- Seller and administrator GST interfaces.
- Authenticated CSV and JSON downloads.
- Authenticated customer PDF downloads for issued seller purchase documents.
- Checkout fields for a registered buyer requesting a GST invoice.

### 2.2 Implemented but not live-provider connected

The following capabilities track readiness and results, but do not currently call a live
government or GSP/ASP provider API:

- E-invoice provider readiness.
- E-way bill provider readiness.
- IRN storage.
- Acknowledgement number and date storage.
- Signed QR code storage.
- E-way bill number, generation time, and validity storage.
- Provider reference and error storage.
- Manual recording of provider results.

Adding client credentials currently marks the integration as provider-ready. It does not
authenticate with an IRP, generate an IRN, generate an e-way bill, cancel a document, or
synchronize provider status.

### 2.3 Still required before production

- Apply all GST migrations to a disposable local database.
- Validate migration backfills and immutability triggers.
- Configure platform GST identity and registered address.
- Validate seller GST information and product HSN/rate data.
- Complete browser-level end-to-end GST testing.
- Validate the GSTR-1 JSON against the current GST portal offline utility.
- Select and onboard an approved e-invoice/e-way provider.
- Implement the selected provider adapter.
- Implement secure per-seller GSTIN authorization.
- Complete sandbox certification and production provider activation.
- Prepare a production backup, migration, rollback, and reconciliation procedure.
- Obtain final review from the business accountant or GST practitioner.

## 3. Main Code Locations

| Area | File |
|---|---|
| GST and tax document calculations | `apps/api/src/tax/tax-documents.service.ts` |
| Customer tax-document PDF template | `apps/api/src/tax/tax-document-pdf.ts` |
| Customer tax-document endpoints | `apps/api/src/orders/customer-orders.controller.ts` |
| GST compliance reports and filing controls | `apps/api/src/reports/gst-compliance.service.ts` |
| GST API DTO validation | `apps/api/src/reports/dto/gst-compliance.dto.ts` |
| Admin GST endpoints | `apps/api/src/reports/reports.controller.ts` |
| Seller GST endpoints | `apps/api/src/reports/seller-reports.controller.ts` |
| CSV generation | `apps/api/src/reports/gst-report-csv.ts` |
| Admin GST API client | `apps/web/src/lib/gst-report-api.ts` |
| Seller GST API client | `apps/web/src/lib/seller-api.ts` |
| Seller GST screen | `apps/web/src/components/seller/seller-tax-report-client.tsx` |
| Admin GST screen | `apps/web/src/components/admin/admin-operations.tsx` |
| Dedicated Admin Finance GST workspace | `apps/web/src/components/admin/finance/gst-reports-client.tsx` |
| Checkout GST invoice fields | `apps/web/src/components/storefront/checkout-page-client.tsx` |
| Checkout GST validation | `apps/web/src/lib/gst-invoice.ts` |
| Customer purchase-document UI | `apps/web/src/components/account/order-detail-client.tsx` |
| Customer purchase-document API client | `apps/web/src/lib/account-api.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Core GST migration | `prisma/migrations/20260720130000_gst_tax_documents/migration.sql` |
| Advanced compliance migration | `prisma/migrations/20260720190000_advanced_gst_compliance/migration.sql` |
| Seller/supply tax separation migration | `prisma/migrations/20260720203000_separate_seller_registration_and_supply_tax/migration.sql` |

## 4. GST Data Model

### 4.1 Order snapshots

The order stores buyer GST invoice identity:

- Buyer GSTIN snapshot.
- Registered buyer legal-name snapshot.

The order-item snapshot stores:

- HSN code.
- GST rate.
- Supplier tax-registration status.
- Product/supply tax classification.
- Inclusive or exclusive tax mode.
- Supply type.
- Place-of-supply state code.
- Supplier GSTIN.
- Buyer GSTIN.
- Gross consideration.
- Taxable value.
- CGST.
- SGST.
- IGST.
- Cess.
- Total tax.
- Structured tax snapshot JSON.

These values preserve the transaction as it existed during checkout. Later changes to the
product, category, seller profile, buyer profile, address, HSN, or rate do not rewrite the
historical tax record.

### 4.2 Seller registration and supply classification

Seller registration and product tax treatment are stored as separate dimensions.

`SellerProfile.taxRegistrationStatus` supports `GST_REGISTERED`, `NOT_REGISTERED`, and
`COMPOSITION`. Regular GST sellers require a valid GSTIN and state code and can collect GST
on taxable supplies. Not-registered sellers must not have a GSTIN, do not collect GST, and use
commercial invoices. Composition sellers require a valid GSTIN and state code, do not collect
regular GST from buyers, and use bills of supply. Non-regular sellers are retained in the
document register but are excluded from the regular seller GSTR filing workflow.

`Product.taxClassification` supports `TAXABLE`, `NIL_RATED`, `EXEMPT`, and `NON_GST`.
Taxable products require approved HSN and a positive GST rate; nil-rated products require HSN
and a zero rate; exempt and non-GST products use a zero rate. The classification is independent
of the seller registration status.

Both dimensions are copied into order-item, tax-document, and tax-document-line snapshots so
later seller-profile or product changes cannot alter issued transaction history.

### 4.3 Tax document sequence

`TaxDocumentSequence` allocates seller-scoped document numbers by:

- Seller.
- Financial year.
- Document type.

Current prefixes are:

| Document | Prefix |
|---|---|
| Tax invoice | `TI` |
| Bill of supply | `BS` |
| Commercial invoice | `CI` |
| Credit note | `CN` |
| Debit note | `DN` |

Example:

```text
TI/26-27/000001
CN/26-27/000001
```

The database uniqueness rule is seller plus document number. Different sellers can have
independent legal document series.

### 4.4 Tax document

`TaxDocument` contains the immutable document header:

- Document number, type, source, status, and financial year.
- Order, B2B order, seller split, return, refund, and original-document links.
- Seller legal name, tax-registration status, GSTIN, and registered-address snapshot.
- Buyer legal name, GSTIN, and address snapshot.
- Place of supply, supply type, and GSTR section.
- Reverse-charge indicator.
- Currency.
- Taxable value, CGST, SGST, IGST, cess, total tax, and invoice value.
- Issue information and adjustment reason.

### 4.5 Tax document lines

`TaxDocumentLine` contains:

- Product, shipping, or adjustment line type.
- Description, SKU, HSN/SAC, tax classification, quantity, and UQC.
- Unit price, gross value, discount, and taxable value.
- GST rate and component taxes.
- Final line value.
- Links to order, return, and refund items where applicable.

### 4.6 Compliance metadata

`TaxDocumentCompliance` stores:

- E-invoice status.
- IRN.
- Acknowledgement number and date.
- Signed QR code.
- E-invoice provider, provider reference, and provider error.
- E-way bill status.
- E-way bill number.
- Generation and validity dates.
- E-way bill provider, provider reference, and provider error.
- Last synchronization time.

### 4.7 Filing and audit models

`GstFilingPeriod` stores:

- Seller and return period.
- Financial year and date range.
- Open, locked, filed, or reopened status.
- Filing snapshot and SHA-256 hash.
- Lock and filing actors and dates.
- ARN or filing reference.

`GstReconciliationRun` stores:

- Book and filing snapshots.
- Errors, warnings, informational findings, and counts.
- Run hash.
- Filing-period and actor references.

`GstReportExport` stores:

- Export type.
- File name and content type.
- SHA-256 content hash.
- Row count.
- Seller, filing period, actor, and generation date.

## 5. Tax Calculation Rules in the Application

### 5.1 GST-inclusive prices

The current tax engine treats the configured selling consideration as GST-inclusive.

The taxable value is calculated as:

```text
Taxable value = Inclusive value x 100 / (100 + GST rate)
GST = Inclusive value - Taxable value
```

Amounts are stored in paise. Rounding occurs at paise level.

Example for an inclusive value of INR 1,180 at 18 percent:

```text
Inclusive value: INR 1,180
Taxable value:   INR 1,000
GST:             INR 180
```

### 5.2 Intrastate supply

When seller state and place-of-supply state match:

```text
CGST = half of total GST
SGST = remaining half of total GST
IGST = zero
```

The implementation allocates any one-paise rounding difference to SGST.

### 5.3 Interstate supply

When seller state and place-of-supply state differ:

```text
CGST = zero
SGST = zero
IGST = total GST
```

### 5.4 Outside India

The data model supports `OUTSIDE_INDIA` and export classification. Production export and
zero-rated/SEZ treatment must be reviewed against the actual transaction, LUT/payment-of-tax
method, shipping documents, and current GST filing rules.

### 5.5 Seller registration treatment

GSTIN presence is not used as the registration decision by itself. The explicit seller
registration status controls the workflow:

- `GST_REGISTERED`: requires a valid GSTIN and GST state code. Taxable supplies collect GST.
- `NOT_REGISTERED`: GSTIN must be empty, GST is not collected, and a commercial invoice is used.
- `COMPOSITION`: requires a valid GSTIN and GST state code, regular GST is not collected from
  the buyer, and a bill of supply is used.

Not-registered and composition sellers remain visible in the complete document register, but
their documents are excluded from regular seller GSTR-1/GSTR-3B filing summaries and filing
period lock, file, and reopen controls.

### 5.6 Product compliance requirements

Product tax classification is independent of seller registration:

- `TAXABLE` products require approved HSN and a GST rate greater than zero.
- `NIL_RATED` products require HSN and use a zero GST rate.
- `EXEMPT` and `NON_GST` products use a zero GST rate.
- A positive GST rate is rejected for nil-rated, exempt, or non-GST supplies.
- Missing tax data blocks taxable checkout.
- GST rate must be between 0 and 100.
- GSTIN values are normalized to uppercase and validated with the GSTIN structure pattern.

Category GST and HSN defaults can assist seller product configuration, but the final
classification remains a business compliance responsibility.

## 6. GSTR Classification

The implementation supports:

| Section | Application meaning |
|---|---|
| `B2B` | Registered recipient supplies |
| `B2CL` | Large interstate unregistered-recipient invoices |
| `B2CS` | Other unregistered-recipient supplies |
| `CDNR` | Credit/debit notes for registered recipients |
| `CDNUR` | Credit/debit notes for unregistered recipients |
| `EXPORT` | Outside-India supplies |
| `SEZ` | SEZ-oriented classification |
| `NIL_EXEMPT_NON_GST` | Nil-rated, exempt, or non-GST supplies of a regular GST-registered seller |

The B2CL threshold is controlled by:

```env
GST_B2CL_THRESHOLD_PAISE="10000000"
```

The current default is INR 100,000. This is an application configuration and must be checked
against the return period's current GST portal rules before production filing.

## 7. Tax Document Lifecycle

### 7.1 Customer checkout

At checkout:

1. The buyer selects an address and payment method.
2. The server prices the order.
3. The server reads seller registration status, GSTIN, and state.
4. The server reads product tax classification, HSN, and GST rate.
5. The server determines place of supply from the buyer delivery/billing details.
6. The server calculates immutable item-level GST snapshots.
7. Optional buyer GSTIN and legal name are stored together.
8. A buyer GST invoice request is accepted only for India billing details.

The frontend validates:

- GSTIN structure.
- Registered legal name presence.
- Both buyer GST fields must be provided together.

### 7.2 Draft seller invoice

The application prepares seller tax documents from the immutable order snapshot. Each seller
split receives its own seller-owned invoice document.

### 7.3 Invoice issuance

Invoice issuance:

- Allocates the next seller-scoped number.
- Sets the issue date and issuing actor.
- Changes the document to `ISSUED`.
- Makes the document and its lines immutable at database level.

### 7.4 Bills of supply and commercial invoices

The outward document type is selected from immutable seller and product tax dimensions:

- Regular GST seller with any taxable line: tax invoice.
- Regular GST seller with only nil-rated, exempt, or non-GST lines: bill of supply.
- Composition seller: bill of supply.
- Not-registered seller: commercial invoice.

Credit and debit notes preserve the original seller registration status and line
classification instead of re-reading current seller or product data.

### 7.5 Cancellation before issuance

An order cancelled before invoice issuance can cancel or void the draft tax-document path
without creating a post-invoice adjustment.

### 7.6 Cancellation or refund after issuance

Once an invoice is issued, historical values are not edited. The system creates a linked
credit note using the original document snapshots and affected quantities/amounts.

### 7.7 Returns and partial refunds

Credit-note lines can link to return and refund request items. Tax values are proportioned
from the immutable order-item snapshot so partial quantities preserve the original tax basis.

### 7.8 Debit notes

Seller or admin workflows can issue a debit note:

- It must link to an original issued tax invoice, bill of supply, or commercial invoice.
- It requires at least one adjustment line.
- It uses GST-inclusive tax calculation.
- It rejects positive GST rates on nil-rated, exempt, or non-GST lines.
- It is blocked when the original return period is locked or filed.
- The filing period must be reopened before creating the adjustment.

### 7.9 B2B fulfilment

B2B flow supports:

- Buyer company and GST details.
- Proforma invoice before fulfilment.
- Final outward document after fulfilment.
- Seller and buyer GSTIN snapshots.
- Product and transport tax lines.
- Seller, buyer, and administrator invoice access.

A proforma invoice is not a tax document. The final document type follows the seller
registration status and product classification rules above.

### 7.10 Platform commission GST documents

The platform can generate GST documents for commission and platform services charged to a
seller. Generation occurs when a GST filing period is locked.

This requires complete platform GST configuration:

- Platform legal name.
- Valid platform GSTIN.
- Platform GST state code.
- Registered address.

Platform commission GST is separate from the GST collected on the seller's outward supply.

## 8. Reports Available

### 8.1 GST document register

Includes issued tax invoices, bills of supply, credit notes, and debit notes with signed
amounts, GST components, and the immutable recipient invoice-address snapshot. The detailed
GST-register CSV exports structured address columns without exposing unrelated customer profile
data.

### 8.2 HSN summary

Groups net quantity, taxable value, CGST, SGST, IGST, cess, and total GST by:

- HSN/SAC.
- GST rate.
- UQC.

### 8.3 GSTR-1-oriented CSV

Exports outward-supply document and rate rows for review and preparation.

This is not a claim of direct GST portal upload compatibility.

### 8.4 GSTR-1 JSON

The application creates a filing-oriented JSON package with:

- GSTIN and return period.
- B2B.
- B2CL.
- B2CS.
- CDNR.
- CDNUR.
- Export.
- SEZ.
- Nil/exempt/non-GST.
- HSN.
- Document series.

The package explicitly contains:

```json
{
  "uploadReady": false
}
```

It must be validated against the current GST portal/offline utility schema before upload.

### 8.5 GSTR-3B summary

Provides an outward-liability-oriented summary for review. It does not submit GSTR-3B.

### 8.6 Marketplace TCS and seller credit statement

Provides seller-wise:

- Gross supplies.
- Returns.
- Net supplies.
- IGST TCS.
- CGST TCS.
- SGST TCS.

This is separate from seller outward-supply GST.

The marketplace/operator uses this data for GSTR-8 where applicable. The seller-facing
download is presented as a TCS credit statement and does not imply that the seller files GSTR-8.

### 8.7 Document series

Summarizes document counts and number ranges by tax-document type.

### 8.8 Rate liability

Groups taxable value and GST components by GST rate.

### 8.9 State liability

Groups tax liability by place-of-supply state.

### 8.10 GSTIN summary

Groups B2B supplies by recipient GSTIN.

### 8.11 Reconciliation

Checks include invalid GSTINs, missing HSN/rates, tax-total differences, classification
differences, document-series concerns, and report-versus-book differences.

Errors block filing-period locking. Warnings remain visible for review.

### 8.12 E-invoice and e-way bill status registers

These reports show readiness, submission/generation status, provider, identifiers, validity,
and provider errors. They do not perform provider submission.

## 9. User Interfaces

### 9.1 Customer checkout

Route:

```text
/checkout
```

The optional **Business GST invoice** section collects:

- Buyer GSTIN.
- Registered legal name.

Issued seller documents are available from:

```text
/account/orders/:orderNumber
```

The **Purchase documents** section lists every issued seller document linked to the order.
The generated PDF uses the immutable tax-document snapshot and supports tax invoices, bills
of supply, commercial invoices, credit notes, and debit notes. Multi-seller orders can
therefore contain multiple independently numbered seller documents.

### 9.2 Seller workspace

Route:

```text
/seller/reports/tax
```

The 1HandIndia Seller Hub GST workspace includes:

- GST summary metrics.
- Server-paginated document register with search and compliance filters.
- Recipient invoice-address details.
- Authenticated invoice, bill, credit-note, and debit-note PDF downloads.
- HSN summary.
- GSTR section summary.
- Reconciliation results.
- TCS credit statement.
- Filing-period records for returns filed outside 1HandIndia.
- GST and settlement deduction distinction.
- Authenticated exports.

Seller access is restricted to the seller's own data.
1HandIndia does not submit the seller's GST return from this workspace. The seller files through
the GST Portal or approved filing software and records the ARN/reference after completion.

Regular GST sellers can use the filing-period controls. Not-registered sellers see commercial
invoice records without regular GSTR filing actions. Composition sellers see bill-of-supply
records without the regular GSTR-1/GSTR-3B filing controls implemented for regular sellers.

### 9.3 Admin workspace

Route:

```text
/admin/reports
```

The **GST** tab includes:

- Marketplace document register.
- HSN summary.
- Liability summaries.
- Reconciliation findings.
- TCS statements.
- Read-only filing status for a selected seller.
- Authenticated exports.

Admin access requires standalone administrator authentication.

The dedicated finance workspace is available at:

```text
/admin/finance/gst-reports
```

It provides complete selected-period summaries, server-paginated GST documents, HSN and
liability tables, TCS and platform commission views, reconciliation, e-invoice/e-way status,
seller filing oversight, and authenticated exports.

## 10. API Reference

All routes below are mounted under the API `/api` prefix.

### 10.1 Customer purchase-document routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/account/orders/:orderNumber/tax-documents` | List the authenticated customer's issued order documents |
| `GET` | `/account/orders/:orderNumber/tax-documents/:documentId/download` | Download an authenticated seller document PDF |

Both routes verify order ownership. Draft, cancelled, and another customer's documents are
not returned. PDF responses use private no-store caching and an attachment filename.

### 10.2 Seller read and export routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/seller/reports/gst` | Read seller GST report |
| `GET` | `/seller/reports/gst/overview` | Read complete summaries without document rows |
| `GET` | `/seller/reports/gst-documents` | Paginated seller-owned document register |
| `GET` | `/seller/reports/gst-documents/:documentId/download` | Download seller-owned issued PDF |
| `GET` | `/seller/reports/export/gst-register` | GST register CSV |
| `GET` | `/seller/reports/export/hsn-summary` | HSN summary CSV |
| `GET` | `/seller/reports/export/gstr-1` | GSTR-1-oriented CSV |
| `GET` | `/seller/reports/export/gstr-1-json` | Filing-oriented JSON |
| `GET` | `/seller/reports/export/gstr-3b` | GSTR-3B summary CSV |
| `GET` | `/seller/reports/export/gstr-8` | Seller TCS credit statement CSV |
| `GET` | `/seller/reports/export/document-series` | Document-series CSV |
| `GET` | `/seller/reports/export/rate-liability` | Rate liability CSV |
| `GET` | `/seller/reports/export/state-liability` | State liability CSV |
| `GET` | `/seller/reports/export/gstin-summary` | GSTIN summary CSV |
| `GET` | `/seller/reports/export/reconciliation` | Reconciliation CSV |
| `GET` | `/seller/reports/export/platform-commission` | Platform GST CSV |
| `GET` | `/seller/reports/export/e-invoice` | E-invoice status CSV |
| `GET` | `/seller/reports/export/e-way-bill` | E-way status CSV |

### 10.3 Seller filing and adjustment routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/seller/reports/filing-periods` | Read seller filing periods |
| `POST` | `/seller/reports/filing-periods/lock` | Lock a period |
| `POST` | `/seller/reports/filing-periods/file` | Mark a locked period filed |
| `POST` | `/seller/reports/filing-periods/reopen` | Reopen an unfiled period |
| `POST` | `/seller/reports/debit-notes` | Create a debit note |
| `PATCH` | `/seller/reports/gst-documents/:documentId/compliance` | Record compliance result |

### 10.4 Admin routes

Admin routes mirror the reporting exports under:

```text
/admin/reports
```

Important routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/admin/reports/gst` | Marketplace GST report |
| `GET` | `/admin/reports/gst/overview` | Complete marketplace GST summaries |
| `GET` | `/admin/reports/gst/documents` | Paginated GST document register |
| `GET` | `/admin/reports/gst/documents/:documentId/download` | Download any issued seller document |
| `GET` | `/admin/reports/gst/overview` | Complete selected-period GST summaries |
| `GET` | `/admin/reports/gst/documents` | Paginated issued GST document register |
| `GET` | `/admin/reports/gst/provider-readiness` | Provider and platform readiness |
| `GET` | `/admin/reports/gst/filing-periods/:sellerId` | Seller filing periods |
| `POST` | `/admin/reports/gst/debit-notes` | Issue seller debit note |
| `PATCH` | `/admin/reports/gst/documents/:documentId/compliance` | Record compliance result |

Seller filing-period lock, reopen, and filed-record actions are intentionally not exposed to
administrators. The admin view is for oversight unless 1HandIndia separately introduces an
authorized managed GST filing service.

Seller PDF access is restricted to the authenticated seller's issued documents. Admin PDF access
is restricted to standalone administrators. Missing, draft, and unauthorized document requests
return `404` to avoid document enumeration.

### 10.5 Authenticated downloads

The web application downloads protected files with:

1. An authenticated `fetch` request.
2. Authorization headers.
3. A response `Blob`.
4. A temporary object URL.
5. A programmatically clicked temporary anchor.
6. Object URL cleanup.

Do not replace this with a normal authenticated `<a href>` download. A normal browser anchor
does not send the application's bearer authorization header.

## 11. Filing-Period Workflow

### 11.1 Return period format

The return period uses:

```text
MMYYYY
```

Example:

```text
072026
```

### 11.2 Review

Before locking:

1. Select the seller and date range.
2. Review the GST register.
3. Review HSN and rate summaries.
4. Review GSTR classifications.
5. Review credit and debit notes.
6. Resolve reconciliation errors.
7. Confirm platform commission GST configuration.
8. Export working files for accountant review.

### 11.3 Lock

Locking:

- Generates missing platform commission documents.
- Rebuilds the complete GST report.
- Refuses to lock when reconciliation has errors.
- Stores an immutable filing snapshot.
- Stores a SHA-256 hash.
- Records the actor and audit event.

### 11.4 File

After the return is filed externally:

1. Enter the GST filing ARN/reference.
2. Mark the locked period as filed.
3. The application stores the filing actor and date.

### 11.5 Reopen

An unfiled locked period can be reopened. A filed period cannot be reopened through the
current workflow.

Never enter a false ARN or mark a period filed before receiving filing confirmation.

## 12. Initial Platform Configuration

Administrators configure these values from:

```text
Admin Control Center -> Settings -> Tax & GST
/admin/settings/tax-gst
```

The page saves the platform identity, manual e-invoice workflow, and manual e-way bill
workflow atomically through:

```text
GET /api/admin/settings/gst
PUT /api/admin/settings/gst
```

The generic single-setting API remains available for operational recovery, but it is not the
normal administration path.

### 12.1 Required platform settings

| Key | Type | Example purpose |
|---|---|---|
| `gst.platform.legal_name` | String | Platform registered legal name |
| `gst.platform.gstin` | String | Valid platform GSTIN |
| `gst.platform.state_code` | String | Two-digit GST state code |
| `gst.platform.address` | JSON | Registered address |
| `gst.einvoice.enabled` | Boolean | Enable e-invoice readiness |
| `gst.einvoice.provider` | String | `MANUAL` or provider code |
| `gst.eway.enabled` | Boolean | Enable e-way readiness |
| `gst.eway.provider` | String | `MANUAL` or provider code |
| `gst.eway.threshold_paise` | Number | Application readiness threshold |

The default e-way readiness threshold is:

```text
5000000 paise = INR 50,000
```

This threshold alone is not a complete e-way bill legal decision engine. Transaction type,
goods, movement, exemptions, consignor/consignee responsibility, state rules, and current
notifications must also be considered.

### 12.2 Atomic GST settings API

The normal configuration request uses:

```text
PUT /api/admin/settings/gst
```

All platform and workflow values are validated and committed together with one audit record.
The existing values remain active when validation fails.

### 12.3 Generic setting API format

Settings use:

```text
PUT /api/admin/settings/:key
```

Example request body:

```json
{
  "group": "gst",
  "valueType": "BOOLEAN",
  "value": true
}
```

Supported `valueType` values are:

```text
STRING
NUMBER
BOOLEAN
JSON
```

### 12.4 PowerShell recovery example

Use an authenticated standalone admin session token:

```powershell
$api = "http://localhost:4000/api"
$adminToken = "REPLACE_WITH_ADMIN_SESSION_TOKEN"
$headers = @{
  Authorization = "Bearer $adminToken"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Method Put `
  -Uri "$api/admin/settings/gst.einvoice.enabled" `
  -Headers $headers `
  -Body (@{
    group = "gst"
    valueType = "BOOLEAN"
    value = $true
  } | ConvertTo-Json)
```

Do not place provider passwords or client secrets in generic `Setting` records. Generic
settings are not an encrypted provider credential vault.

## 13. Manual E-Invoice and E-Way Operation

Manual mode is the supported operating mode until a provider adapter is completed. Admins
enable it from `/admin/settings/tax-gst`; no direct database edit is required.

### 13.1 Configure manual mode

Use:

```text
gst.einvoice.provider = MANUAL
gst.eway.provider = MANUAL
```

Enable only the workflows the business has approved:

```text
gst.einvoice.enabled = true or false
gst.eway.enabled = true or false
```

### 13.2 E-invoice manual flow

1. Find documents with e-invoice status `READY`.
2. Review the seller GSTIN, buyer GSTIN, invoice number, date, HSN, rate, and tax totals.
3. Generate the e-invoice through the approved IRP/provider portal.
4. Capture:
   - IRN.
   - Acknowledgement number.
   - Acknowledgement date.
   - Signed QR code.
   - Provider reference.
5. Open `/admin/finance/gst-reports` as an administrator or `/finance/gst-reports` as a Finance Manager, select the e-invoice/e-way status register, and use the record/edit IRN action on the issued document.
6. Enter the IRN, acknowledgement number and date, and signed QR payload. Saving marks the e-invoice `GENERATED`, records `MANUAL` as the provider, clears any previous provider error, and writes an audit event.
7. Export the e-invoice status register and confirm no required invoice remains unresolved.

The application rejects a `GENERATED` e-invoice result unless all four required values are present. This protects B2B dispatch controls from treating an incomplete IRN result as ready.

Example compliance update:

```json
{
  "eInvoiceStatus": "GENERATED",
  "irn": "IRN_FROM_APPROVED_PROVIDER",
  "acknowledgementNumber": "ACK_NUMBER",
  "acknowledgementDate": "2026-07-20T10:30:00.000Z",
  "signedQrCode": "SIGNED_QR_DATA",
  "eInvoiceProvider": "MANUAL",
  "eInvoiceProviderRef": "PORTAL_REFERENCE",
  "eInvoiceError": ""
}
```

### 13.3 E-way bill manual flow

1. Find documents with e-way bill status `READY`.
2. Confirm that an e-way bill is legally required.
3. Confirm dispatch, transporter, vehicle, distance, document, and consignment data.
4. Generate the e-way bill through the approved portal/provider.
5. Capture:
   - E-way bill number.
   - Generation time.
   - Valid-until time.
   - Provider reference.
6. Record the result in 1HandIndia.

Example:

```json
{
  "eWayBillStatus": "GENERATED",
  "eWayBillNumber": "EWAY_BILL_NUMBER",
  "eWayBillGeneratedAt": "2026-07-20T10:35:00.000Z",
  "eWayBillValidUntil": "2026-07-22T23:59:59.000Z",
  "eWayBillProvider": "MANUAL",
  "eWayBillProviderRef": "PORTAL_REFERENCE",
  "eWayBillError": ""
}
```

## 14. Provider Credential Setup

### 14.1 Recommended integration route

For a multi-vendor marketplace, use an approved GSP/ASP or IRP provider that supports:

- E-invoice.
- E-way bill.
- Sandbox and production environments.
- Multiple taxpayer GSTIN authorizations.
- IRN generation, cancellation, and lookup.
- E-way bill generation, cancellation, and vehicle updates.
- Signed QR and acknowledgement response fields.
- Audit/reference identifiers.
- Production support and published API version changes.

Direct government API onboarding may require eligibility review, KYC, sandbox testing,
test reports, and static Indian IP whitelisting. Provider requirements can change.

### 14.2 Credentials commonly required

Provider onboarding may issue:

- Client ID.
- Client secret.
- IRP username and password.
- E-way bill username and password.
- Seller/taxpayer GSTIN.
- API base URL.
- Encryption/public-key information.
- Static-IP approval.
- Webhook or callback secret.
- Sandbox and production credentials.

The exact credential contract depends on the selected provider.

### 14.3 Current environment contract

Manual mode does not use provider credentials or provider environment variables. Do not add
credential placeholders until a provider is selected and its adapter contract is implemented.

Do not paste real credential values into:

- Source files.
- Git commits.
- Documentation.
- Browser code.
- Screenshots.
- Support tickets.
- Chat messages.

### 14.4 What manual readiness does

Manual readiness only classifies applicable documents and allows audited provider results to
be recorded. It does not generate or cancel IRNs or e-way bills, authenticate with a provider,
or synchronize provider statuses.

### 14.5 Marketplace seller authorization requirement

1HandIndia is a multi-vendor marketplace. E-invoices are seller tax documents, not one
central marketplace outward invoice.

A production integration must therefore support:

- A global provider application/client credential owned by 1HandIndia or its integration
  partner.
- Authorization for each participating seller GSTIN.
- Per-seller provider username or authorization reference where required.
- Seller authorization status and expiry/revocation state.
- GSTIN-specific API requests.
- Strict seller data isolation.

One global client ID and secret must not be treated as automatic authority to issue documents
for every marketplace seller.

## 15. Provider Integration Still to Build

The selected provider cannot be implemented correctly until its API specification and
sandbox credentials are available.

### 15.1 Secure credential storage

Add an encrypted provider configuration instead of storing secrets in generic settings.

Recommended global fields:

- Provider code.
- Sandbox/live mode.
- E-invoice and e-way base URLs.
- Encrypted client ID and secret.
- Encryption/public-key version.
- Webhook secret.
- Verified-at date.
- Verification status.

Recommended per-seller fields:

- Seller ID and GSTIN.
- Provider authorization type.
- Encrypted username/password or provider authorization reference.
- Authorization status.
- Verified-at date.
- Expiry/revocation date.
- Last authentication/synchronization error.

Use a backend-only encryption key such as:

```env
GST_PROVIDER_CREDENTIAL_ENCRYPTION_KEY=""
```

The encryption key must be random, backed up securely, and available to API instances. Losing
it can make stored provider credentials unrecoverable.

### 15.2 Provider adapter interface

Implement provider-neutral methods such as:

```text
verifyCredentials
authenticateSeller
generateEInvoice
cancelEInvoice
getEInvoice
generateEWayBill
cancelEWayBill
updateVehicle
extendEWayBill
getEWayBill
```

### 15.3 Submission behavior

The live workflow needs:

- Idempotency per document and provider operation.
- Provider request and response references.
- Token caching with expiry.
- Safe retries for transport failures.
- No duplicate IRN or e-way generation.
- Permanent-versus-retryable error classification.
- Status transitions.
- Audit logs without secrets or full sensitive payloads.
- Reconciliation between provider and local records.
- Cancellation time-limit checks.
- Alerting for unresolved required documents.

### 15.4 Background execution

The current VPS mode does not require Redis. Provider submission must work with:

- Synchronous submission for immediate operations.
- Database-backed retry/polling when asynchronous processing is needed.
- Silent synchronous or database fallback when `REDIS_URL` is unavailable.

### 15.5 Admin settings UI

Add a dedicated **GST Provider Settings** interface containing:

- Provider selector.
- Sandbox/live segmented control.
- E-invoice enable toggle.
- E-way enable toggle.
- Threshold input with INR helper text.
- Client credential inputs.
- Credential configured indicators.
- Verify credentials action.
- Platform GST identity and address.
- Seller authorization status register.
- Provider health and last-sync status.
- Masked secret readback.
- Audit history.

Seller users should see authorization status and required actions, not raw credentials.

## 16. Database Migration Procedure

### 16.1 Safety rule

Do not apply GST migrations to the currently connected remote, staging, or production
database from the development workspace.

Do not run DB-writing integration tests against that database.

### 16.2 Required migrations

The GST implementation includes:

```text
20260628190000_b2b_tax_invoice_fields
20260720130000_gst_tax_documents
20260720190000_advanced_gst_compliance
20260720203000_separate_seller_registration_and_supply_tax
```

The core migration:

- Adds GST enums and snapshot columns.
- Adds tax document tables, indexes, and foreign keys.
- Converts B2B invoice-number uniqueness to seller-aware behavior.
- Backfills legacy order-item tax snapshots.
- Adds order-item and issued-document immutability triggers.

The advanced migration:

- Adds filing, reconciliation, export, provider-status, and platform-invoice models.
- Adds advanced indexes and foreign keys.
- Adds locked filing-snapshot immutability.
- Adds issued platform-document immutability.

The seller/supply tax separation migration:

- Adds explicit seller registration and product tax-classification enums.
- Adds commercial invoices to the tax-document series.
- Backfills seller registration from structurally valid legacy GSTIN values.
- Backfills zero-rate legacy products and lines as `NIL_RATED` and positive-rate rows as
  `TAXABLE`.
- Adds immutable order-item snapshots for both new dimensions.
- Adds report-filter indexes for seller registration and supply classification.

The zero-rate backfill cannot reliably distinguish historical nil-rated, exempt, and non-GST
supplies because the legacy model did not store that distinction. Review those rows and correct
current seller/product master data before production use. Issued historical documents must not
be directly rewritten.

### 16.3 Disposable local database

Use a local PostgreSQL database whose name clearly contains `test`, `e2e`, or `integration`
when running DB-writing integration tests.

Example:

```powershell
$env:DATABASE_URL = "postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:5432/indihub_gst_integration?schema=public"
$env:DATABASE_DIRECT_URL = $env:DATABASE_URL
$env:INDIHUB_ALLOW_INTEGRATION_TEST_DB = "true"
```

Verify the value before any migration:

```powershell
$env:DATABASE_URL
```

The database name must be visibly disposable.

### 16.4 Validate and apply locally

Run:

```powershell
pnpm.cmd db:validate
pnpm.cmd db:generate
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma
```

Do not use `db:push` as the production migration procedure.

### 16.5 Migration validation

Confirm:

- All migrations are applied.
- Legacy order items have tax snapshots.
- Tax totals equal component totals.
- Seller-scoped document uniqueness works.
- Required foreign-key indexes exist.
- Issued tax documents reject direct edits.
- Issued tax document lines reject direct edits.
- Order-item tax snapshots reject direct edits.
- Locked GST snapshots reject edits.
- Issued marketplace commission documents reject edits.

## 17. Test and Verification Procedure

### 17.1 Automated checks

Run only after pointing database-writing tests to the disposable database:

```powershell
pnpm.cmd db:validate
pnpm.cmd db:generate

pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api test
pnpm.cmd --filter @indihub/api build

pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web test
pnpm.cmd --filter @indihub/web build
```

The latest code verification recorded:

- API tests: 391 passed and 30 skipped.
- Web tests: 134 passed.
- Prisma validate and generate passed.
- API typecheck, lint, and build passed.
- Web typecheck, lint, and build passed.

These results do not replace migration testing or browser-level workflow testing.

### 17.2 Focused test files

```text
apps/api/src/tax/tax-documents.service.test.ts
apps/api/src/reports/gst-compliance.service.test.ts
apps/api/src/reports/gst-report-csv.test.ts
apps/web/src/lib/gst-invoice.test.ts
apps/web/src/lib/seller-api.test.ts
```

### 17.3 Browser test scenarios

Test each scenario with real UI roles.

#### Intrastate B2C

- Seller and buyer in the same state.
- CGST and SGST are populated.
- IGST is zero.
- B2CS/B2CL classification is reviewed.

#### Interstate B2C

- Seller and buyer in different states.
- IGST is populated.
- CGST and SGST are zero.

#### Business GST invoice

- Buyer selects GST invoice.
- Invalid GSTIN is rejected.
- Missing legal name is rejected.
- GSTIN and legal name appear in the immutable invoice.
- Registered-recipient supply is classified as B2B.

#### Non-GST seller

- Seller registration status is `NOT_REGISTERED`.
- GSTIN is absent.
- No GST is charged.
- A commercial invoice is created.
- The document remains outside regular seller GSTR sections and filing controls.

#### Composition seller

- Seller registration status is `COMPOSITION`.
- Valid GSTIN and state code are present.
- No regular GST is charged to the buyer.
- A bill of supply is created.
- Regular GSTR-1/GSTR-3B filing controls are unavailable.

#### Registered nil-rated or exempt supply

- Seller registration status remains `GST_REGISTERED`.
- Product classification is `NIL_RATED`, `EXEMPT`, or `NON_GST`.
- No GST is charged.
- The supply remains distinct from a not-registered seller.
- The document is classified under the regular seller's nil/exempt/non-GST reporting section.

#### Fulfilment

- Draft invoice is created.
- Fulfilment issues the invoice once.
- Repeated fulfilment does not create a duplicate.
- Document number is seller-scoped.

#### Cancellation before issuance

- No invalid post-issue edit occurs.
- Draft document handling is correct.

#### Refund after issuance

- Credit note links to the original invoice.
- Partial quantity and tax values are proportional.
- CDNR/CDNUR classification is correct.

#### Debit note

- Debit note links to an issued original document.
- Empty lines are rejected.
- Locked-period adjustment is rejected.

#### B2B

- Proforma is clearly not a tax invoice.
- Final invoice is unavailable before fulfilment.
- Final B2B document type matches the seller registration and product tax classification.
- GST-registered taxable supplies contain product and transport tax snapshots.

#### Reports

- Register totals match documents.
- HSN totals match lines.
- GSTR sections match recipient and supply type.
- Credit notes reduce signed totals.
- Exports download with authentication.
- Export audit records and hashes are created.

#### Filing

- Reconciliation errors block locking.
- Successful lock creates a snapshot hash.
- Repeated lock is idempotent.
- Filing requires a reference.
- Filed period cannot be reopened.

#### Manual provider status

- IRN and e-way number save correctly.
- Duplicate IRN/e-way numbers are rejected.
- Errors appear in status exports.

## 18. Production Rollout

### 18.1 Before migration

- Confirm the release version.
- Freeze GST schema changes.
- Review migration SQL.
- Take and verify a PostgreSQL backup.
- Record migration start time and operator.
- Confirm maintenance window.
- Confirm rollback decision owner.
- Confirm accountant/GST practitioner approval.

### 18.2 Migration

- Set the production direct database URL only in the approved deployment environment.
- Run `prisma migrate deploy`.
- Capture output.
- Verify migration status.
- Do not run bootstrap seed or location imports.

### 18.3 Post-migration validation

- Check counts and null rates for new snapshot columns.
- Review legacy backfill samples.
- Verify indexes and triggers.
- Verify seller and admin GST routes.
- Verify one controlled checkout.
- Verify one controlled fulfilment.
- Verify report totals.
- Confirm no provider submission is attempted unless live integration is approved.

### 18.4 Provider activation

Activate in this order:

1. Provider sandbox.
2. Internal test seller.
3. Selected pilot sellers.
4. Production credentials.
5. Production credential verification.
6. Controlled invoice generation.
7. Provider-versus-local reconciliation.
8. Wider seller rollout.

Maintain a manual fallback until the live adapter has completed a stable production period.

## 19. Operational Responsibilities

### Seller

- Maintain legal business name.
- Maintain GSTIN and registered address.
- Maintain state code.
- Provide GST certificate where required.
- Use correct product HSN/SAC and GST rate.
- Review invoices and reports.
- Authorize the selected e-invoice/e-way provider.
- Inform 1HandIndia when GST registration changes or is cancelled.

### Administrator

- Validate seller onboarding data.
- Maintain category defaults as assistance, not legal determination.
- Monitor missing HSN/rates and reconciliation errors.
- Monitor seller filing-period status without changing seller filing records.
- Maintain platform GST identity.
- Control provider configuration and seller authorization status.
- Preserve audit logs.

### Finance/compliance team

- Review seller outward supply separately from marketplace commission GST.
- Review marketplace GSTR-8 data and seller TCS credit statements.
- Review credit/debit note treatment.
- Confirm filing exports against books and portal data.
- Enter filing references only after successful filing.

### Development/operations team

- Keep credentials backend-only and encrypted.
- Maintain API compatibility with the selected provider.
- Monitor failures and retries.
- Prevent duplicate provider submissions.
- Preserve immutable document history.
- Back up before migrations.
- Never run write tests against production or staging.

## 20. Security Requirements

- Do not expose secrets to the browser.
- Do not log client secrets, passwords, tokens, signed payloads, or complete sensitive
  provider responses.
- Encrypt stored provider credentials.
- Mask configured secrets in admin readback.
- Audit credential changes without secret values.
- Use separate sandbox and production credentials.
- Rotate credentials after exposure or staff/vendor access changes.
- Restrict provider settings to authorized administrators.
- Restrict seller authorization records to the owning seller and administrators.
- Validate provider callbacks or webhooks with signatures.
- Use HTTPS only in production.
- Apply idempotency to every provider mutation.

Credential file paths visible in an IDE are not proof of credential exposure. If an actual
credential value has been displayed, committed, logged, or shared, rotate it through the
corresponding provider dashboard.

## 21. Known Limitations

- GSTR-1 JSON is filing-oriented and has `uploadReady: false`.
- No current GST portal/offline-utility schema certification has been completed.
- E-invoice and e-way bill integrations do not perform live submission.
- Provider credentials currently affect readiness status only.
- Provider configuration is environment-based and not a complete encrypted admin workflow.
- Per-seller GSTIN provider authorization is not yet modeled.
- Legacy zero-rate rows are backfilled as `NIL_RATED`; historical exempt and non-GST rows require
  professional review because the old schema did not preserve that distinction.
- E-way readiness uses a monetary threshold and is not a complete statutory applicability
  engine.
- Export, SEZ, reverse-charge, exempt, composition, and special-case tax treatment require
  professional confirmation and additional rules where the business uses them.
- Browser/manual end-to-end GST QA remains pending.
- GST migrations have not been applied to the connected remote database.

## 22. Troubleshooting

### Taxable checkout says HSN/GST data is missing

Check:

- Seller has a valid GSTIN.
- Seller has a GST state code.
- Product has approved HSN.
- Product has an approved GST rate.

### Buyer GST invoice is rejected

Check:

- Billing country is India.
- GSTIN is 15 characters and structurally valid.
- Legal name is entered.
- GSTIN and legal name are sent together.

### Filing period will not lock

Check the reconciliation error list. Errors must be resolved before locking.

### Platform commission documents are not generated

Check:

- Platform legal name.
- Platform GSTIN.
- Platform state code.
- Platform registered address JSON.
- Seller has relevant commission/settlement activity in the period.

### Manual readiness is enabled but no IRN is generated

This is expected in the current implementation. Readiness does not perform provider calls.
Generate the document through the approved external process and record its result, or implement
the selected provider adapter as a separate production integration.

### GST report download returns unauthorized

Confirm the frontend uses authenticated `fetch` and not a normal download link. Refresh the
seller or admin session and retry.

### Direct edits fail in PostgreSQL

Immutability triggers intentionally reject:

- Order-item GST snapshot changes.
- Issued tax-document changes.
- Issued tax-document line changes.
- Locked filing-snapshot changes.
- Issued platform commission document changes.

Create a credit note, debit note, or approved lifecycle action instead of editing history.

## 23. Go-Live Acceptance Checklist

- [ ] GST migrations tested on a disposable PostgreSQL database.
- [ ] Legacy backfill reviewed.
- [ ] Immutability triggers verified.
- [ ] Platform GST identity configured.
- [ ] Seller registration status, GSTIN, and state-code combinations reviewed.
- [ ] Product tax classification, HSN, and GST rates approved.
- [ ] Not-registered commercial-invoice flow tested.
- [ ] Composition bill-of-supply flow tested.
- [ ] Registered nil-rated, exempt, and non-GST supply flows tested.
- [ ] Customer GST invoice checkout tested.
- [ ] B2C intrastate and interstate scenarios tested.
- [ ] B2B tax invoice, bill of supply, and commercial invoice outcomes tested.
- [ ] Cancellation, return, refund, credit note, and debit note tested.
- [ ] GST register and HSN totals reconciled.
- [ ] GSTR-1 CSV reviewed.
- [ ] GSTR-1 JSON validated against the current utility.
- [ ] GSTR-3B summary reviewed.
- [ ] TCS/GSTR-8-oriented report reviewed.
- [ ] Filing lock, reopen, and file lifecycle tested.
- [ ] Authenticated exports tested.
- [ ] Export hashes and audit logs verified.
- [ ] Provider selected and contract approved.
- [ ] Seller GSTIN authorization process approved.
- [ ] Provider sandbox integration completed.
- [ ] Provider production credentials verified.
- [ ] Manual fallback procedure documented.
- [ ] Production backup and rollback procedure approved.
- [ ] Accountant/GST practitioner provides final sign-off.

## 24. Required Next Actions

### Immediate

1. Create a disposable local PostgreSQL GST integration database.
2. Apply the four GST-related migrations locally.
3. Verify backfills, indexes, foreign keys, and immutability triggers.
4. Configure platform GST identity in the local database.
5. Start API and web servers.
6. Complete the browser GST test scenarios in this guide.
7. Validate all report totals with controlled sample orders.

### Provider decision

1. Choose an approved GSP/ASP or direct IRP route.
2. Obtain the provider API specification and sandbox account.
3. Confirm multi-GSTIN seller authorization support.
4. Confirm e-invoice and e-way bill API coverage.
5. Confirm sandbox, production, IP, encryption, webhook, and support requirements.

### Development after provider selection

1. Add encrypted global provider settings.
2. Add per-seller GSTIN authorization records.
3. Build the provider adapter.
4. Add admin and seller authorization interfaces.
5. Add sandbox integration tests.
6. Add provider reconciliation and status polling.
7. Add production monitoring and manual fallback.

### Production

1. Obtain tax practitioner approval.
2. Validate the current GST portal schemas and rules.
3. Back up production.
4. Apply reviewed migrations.
5. Run controlled smoke tests.
6. Activate provider integration through a pilot seller rollout.

## 25. Official Verification Sources

Before production onboarding or filing, verify the latest requirements using:

- GST portal: `gst.gov.in`
- E-invoice portal/IRP documentation: `einvoice6.gst.gov.in`
- E-way bill portal: `ewaybillgst.gov.in`
- E-way API documentation: `docs.ewaybillgst.gov.in`
- Current CBIC/GST Council notifications and circulars.
- The selected GSP/ASP provider's current API specification.

Official documentation reviewed for this guide confirms that provider onboarding can include
client credentials, taxpayer/GSTIN authorization, IRP or e-way usernames and passwords,
sandbox testing, KYC, and static-IP requirements depending on the integration route.

Because GST rules, thresholds, schemas, portal behavior, and provider contracts can change,
repeat this verification immediately before production activation.
