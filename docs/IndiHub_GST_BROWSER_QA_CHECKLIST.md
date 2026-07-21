# 1HandIndia GST Browser QA Checklist

**Last updated:** 21-07-2026

Use only a disposable local PostgreSQL database whose name contains `test`, `e2e`, or
`integration`. Never run this workflow against production, staging, or the currently connected
remote database.

## Test Data

- [ ] At least two approved sellers exist.
- [ ] Seller A has more than 25 issued documents.
- [ ] Seller B has at least one issued document that Seller A must not access.
- [ ] Retail and B2B tax invoices exist.
- [ ] Credit and debit notes exist and link to their original documents.
- [ ] One recipient address contains line, city, state, state code, postal code, and country.

## Seller Hub

- [ ] Sign in as Seller A and open `/seller/reports/tax`.
- [ ] Summary totals match the selected date range.
- [ ] Document search and type, GSTR-section, and supply-classification filters reset to page 1.
- [ ] Next and Previous load server pages without duplicate or missing rows.
- [ ] Only Seller A documents are visible.
- [ ] The details drawer shows the immutable buyer name, GSTIN, address, order/B2B reference,
      tax components, line data, and compliance references.
- [ ] Retail, B2B, bill-of-supply, commercial-invoice, credit-note, and debit-note PDFs download.
- [ ] A direct request for Seller B's document returns `404`.
- [ ] GST-register CSV contains structured recipient-address columns and reconciles to the UI.

## Admin Finance

- [ ] Sign in through standalone admin authentication and open
      `/admin/finance/gst-reports`.
- [ ] Seller, date, document, section, registration, classification, and compliance filters work.
- [ ] Admin can inspect and download issued documents for either seller.
- [ ] Draft and nonexistent document URLs return `404`.
- [ ] Recipient address and tax totals match the seller view and exported register.

## Responsive and Failure States

- [ ] Desktop and mobile layouts have no page-level horizontal overflow.
- [ ] Wide tables scroll inside their own container.
- [ ] Loading, empty, API-error, and PDF-download-error states are readable.
- [ ] Icon buttons have accessible names and visible hover/focus states.
- [ ] Stale bearer tokens retry once and failed downloads do not create empty files.

## Automated Run

Configure the opt-in `GST_E2E_*` variables described in `tests/e2e/gst-reports.spec.ts`, then
run:

```powershell
pnpm.cmd test:e2e:gst
```
