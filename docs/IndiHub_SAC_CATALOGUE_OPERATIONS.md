# SAC Catalogue Operations

The SAC master is a classification catalogue only. GST rates remain seller-entered and admin-reviewed on service listings and quote lines.

## Source File

Prepare a normalized UTF-8 CSV:

```csv
sac_code,description
996511,Road transport services
998719,Maintenance and repair services
```

JSON is also supported as an array of `{ "sacCode": "998719", "description": "..." }`.

The default source provenance is the GST Council document:

`https://gstcouncil.gov.in/sites/default/files/2024-02/scheme_of_classification_of_services_amended.pdf`

The importer stores the source document, reference, version, optional effective date, SHA-256 catalogue checksum, and import timestamp.

## Catalogue Dry Run

```powershell
pnpm tax:sac:import:dry -- --file .\data\sac-master.csv --effectiveDate 2024-02-01 --deactivate-missing
```

This reads the current catalogue and reports inserts, updates, unchanged rows, and entries that would be deactivated. It performs no database writes.

## Catalogue Apply

After reviewing the dry-run counts:

```powershell
$env:INDIHUB_ALLOW_SAC_MASTER_IMPORT="true"
pnpm tax:sac:import -- --file .\data\sac-master.csv --effectiveDate 2024-02-01 --deactivate-missing
```

Omit `--deactivate-missing` for a partial additive import. Removed catalogue entries are marked inactive, never deleted, so historical references remain valid.

## Legacy Listing Review

Generate the affected-listing report:

```powershell
pnpm tax:sac:legacy-review:dry
```

The report includes active, approved service listings that have no SAC and were not already marked for tax review.

After the report is approved:

```powershell
$env:INDIHUB_ALLOW_SAC_LEGACY_REVIEW="true"
pnpm tax:sac:legacy-review:apply
```

Apply mode makes those listings inactive, returns them to pending approval, increments their tax configuration version, marks tax review required, and writes audit records. It does not delete listings or historical bookings.
