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
pnpm locations:import:india
```

If the API is rate-limited, download an approved Department of Posts CSV and import from file:

```powershell
pnpm locations:import:india -- --file data/location-imports/all_india_pin_code.csv --source-url "https://data.gov.in/sites/default/files/all_india_pin_code.csv"
```

This importer reads the OGD pincode resource and maps the source hierarchy as:

```text
State/UT -> district as city node -> post office as local area -> pincode
```

The India pincode source does not provide a separate canonical city field, so districts are stored in the current `LocationCity` layer until a separate official city/locality source is added.

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
