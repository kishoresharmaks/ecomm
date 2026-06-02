# 1HandIndia Location Data Import Guide

## Runtime Rule

Storefront, seller, checkout, customer, and B2B address forms must read location data only from 1HandIndia APIs. The frontend must not call GeoNames, Data.gov.in, OneMap, Royal Mail, Nominatim, or any other location provider directly.

## Seed vs Import

`prisma/seed.ts` is read-only by default. Country, currency, postal-code label, and registered import-source bootstrap rows are created only when running the explicit bootstrap seed mode:

```powershell
pnpm db:seed:bootstrap
```

State, city, local-area, and postal-code rows are loaded through:

```powershell
pnpm locations:import
pnpm locations:refresh
```

Without a `--file`, these commands load the small bundled baseline for the five approved markets. Full production coverage should be imported from approved normalized CSV or JSON source files.

For India pincode coverage, use the dedicated Department of Posts / data.gov.in importer:

```powershell
$env:DATAGOVINDIA_API_KEY="your-data-gov-in-api-key"
pnpm locations:import:india -- --dry-run
pnpm locations:import:india
```

Always run the dry run first for a new source pull. It builds the same hierarchy in memory, prints the quality report, and exits without writing database rows. Proceed with the real import only when the quality report is acceptable for operations.

If the API is rate-limited, download an approved Department of Posts CSV and import from file:

```powershell
pnpm locations:import:india -- --file data/location-imports/all_india_pin_code.csv --source-url "https://data.gov.in/sites/default/files/all_india_pin_code.csv"
```

This importer reads the OGD pincode resource and maps the source hierarchy as:

```text
State/UT -> district as city node -> post office as local area -> pincode
```

The India pincode source does not provide a separate canonical city field, so districts are stored in the current `LocationCity` layer until a separate official city/locality source is added.

The importer stores source quality metadata on the import run and postal metadata on each local area:

```text
Import run metadata -> accepted/skipped rows, invalid pincode rows, unknown states, duplicate source rows, unique pincodes, delivery/office-type counts
Local area metadata -> source office name, office type, delivery status, division, region, circle, taluk/block, source district/state
```

This keeps operational diagnostics inside PostgreSQL and avoids using Redis or an external cache for location coverage. Address selectors continue reading normalized data from the existing location APIs, while admin users can inspect the latest import run for source health.

Admins can review the India import status and lookup individual PIN codes from:

```text
/admin/locations/import
```

The PostalPin helper uses the backend-only route below for single-record verification. It does not bulk import and it does not write to the location tables:

```text
GET /api/admin/locations/india-postal-lookup?pincode=110001
GET /api/admin/locations/india-postal-lookup?postOffice=Connaught%20Place
```

Lookup responses include a database comparison summary when matching imported rows exist for the returned PIN codes:

```text
MATCHED -> PostalPin records and imported database rows align
PARTIAL -> some records match, some are missing or extra
NOT_IMPORTED -> PostalPin returned records but no matching database rows exist
DATABASE_ONLY -> imported database rows exist but PostalPin returned no records
NO_DATA -> neither source has matching rows
```

Do not crawl `api.postalpincode.in` for all PIN codes. Use the Department of Posts/data.gov.in bulk importer or approved CSV fallback for full India coverage.

## Serviceability Layer

Location import is only the master address dataset. A row in `LocationArea` means the place can appear in address forms; it does not automatically mean checkout should accept orders for that place.

Operational serviceability is checked separately from:

```text
Imported location -> known country/state/city/local area/pincode
Seller coverage -> approved sellers mapped to that country/state/city/pincode/local area
Delivery coverage -> delivery partners, courier provider country support, and routing rules
Shipping price -> active shipping rate cards or fallback shipping settings
Payment readiness -> enabled Razorpay/COD/bank-transfer/manual checkout options and COD limits
```

Admins can review this combined readiness from:

```text
/admin/locations/serviceability
GET /api/admin/locations/serviceability?countryCode=IN&pincode=110001&paymentMethod=COD&subtotalPaise=99900
```

The serviceability checker is read-only. It reuses the same delivery routing, payment settings, seller addresses, courier provider settings, and shipping rate cards used by checkout operations. This avoids duplicating location data and keeps the large India pincode import efficient inside PostgreSQL instead of adding Redis for basic coverage decisions.

Customer checkout enforces the delivery side of the same rule. If routing cannot find a serviceable local delivery or courier route for the selected delivery address, checkout summary and order placement return a clear "not serviceable yet" error instead of creating an order that operations cannot deliver. Payment method availability, including COD limits, remains enforced by the existing checkout payment settings.

## Normalized CSV Format

Use this command shape for full datasets after preparing a normalized CSV:

```powershell
pnpm locations:refresh -- --file data/location-imports/india-pincodes.csv --source-code INDIA_OGD_PINCODES --source-name "India OGD pincode directory" --provider "Department of Posts / data.gov.in" --source-type OGD_API --country-code IN --source-url "https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice"
```

Required columns:

```text
country_code,subdivision_code,city_code
```

Recommended columns:

```text
country_name,currency,locale,phone_code,postal_code_label,postal_code_pattern,subdivision_name,subdivision_type,city_name,area_code,area_name,postal_code
```

## Source Guardrails

- GeoNames dumps are suitable for country/state/city and broad postal/locality import.
- India pincode data should come from Department of Posts / data.gov.in.
- UK full address-level PAF data is licensing-controlled. Use open city/area data unless a proper PAF licence is purchased.
- Singapore OneMap should be used only from backend/admin import or lookup flows with approved token handling.
- UAE addresses should keep postal code optional because normal postcode coverage is not part of UAE addressing.
- Do not bulk-load from public OSM Nominatim. Use OSM planet/extract data if OSM coverage is needed.

## Admin Controls

Admins can view country coverage, latest source runs, and trigger the registered bundled baseline refresh from `/admin/locations`. Full external dataset imports should be run by operations through the CLI so source files, checksums, and licensing notes remain controlled.
