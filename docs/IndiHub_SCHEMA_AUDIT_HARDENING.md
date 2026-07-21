# 1HandIndia Schema Audit Hardening

**Date:** 21-07-2026  
**Scope:** Confirmed correctness, integrity, security, and migration-safety findings from the
201-model Prisma audit.

## Implemented

- Normalized `DeliveryMode.THIRD_PARTY_COURIER` so the database no longer stores the misleading
  `MANUAL_COURIER` value.
- Removed the duplicate manual-transport paise column and backfilled the generalized minor-unit
  column.
- Split seller commission storage into `commissionValueBps` and `commissionFixedPaise`.
- Added the `CheckoutSession` customer relation and linked newly created marketplace orders to
  their checkout session.
- Normalized `RazorpayWebhookEvent` to UUID ids, a real status enum, snake-case table/columns, and
  no redundant provider/event index.
- Added typed CMS actor relations and indexes.
- Preserved polymorphic upload subjects intentionally; `PrivateUpload.actorUserId` may refer to a
  `User` or a `BusinessBuyer` and is documented rather than given an incorrect foreign key.
- Added a typed optional actor relation to AI usage summaries while preserving their original
  subject key.
- Added encrypted seller payout fields, masked display hints, legacy read compatibility, and a
  guarded backfill script.
- Added immutable seller-split shipment assignment history captured by a database trigger.
  `DeliveryAssignmentAttempt` remains the order-level offer/acceptance history.
- Added database triggers preventing a B2B fulfilment plan from receiving both procurement and
  production children, requiring the child to match the plan source, serializing child creation,
  and blocking incompatible source changes after a child exists.
- Added private object-storage persistence for new B2B ERP exports, with legacy database-byte
  readback during migration.
- Consolidated legacy email settings into the application singleton, enforced one enabled email
  configuration at the database boundary, and changed readers to use the singleton id.
- Added schema comments for intentional legacy aggregates and polymorphic references.

## Intentionally Not Changed

- `DeliveryDetail` remains the order-level compatibility aggregate. `OrderShipment` is the
  seller-split operational record; existing services synchronize both representations.
- `CourierShipment`, `CourierConsignment`, and package records remain because current booking and
  webhook code reconciles them. Their canonical roles are documented in the schema.
- Product-level `weightKg` remains as a fallback. Variant-level `packageWeightGrams` is the
  shipping calculation source when present, with an explicit kilograms-to-grams conversion.
- Sequence counters were not changed because the current invoice, GST, and tracking paths already
  use atomic increment/upsert operations.
- Cosmetic index ordering was not churned.

## Migration

Migration file:

`prisma/migrations/20260721160000_schema_audit_hardening/migration.sql`

Do not apply it to the connected protected database without a backup and a disposable-database
rehearsal. The migration intentionally stages payout encryption because PostgreSQL cannot encrypt
existing application secrets without receiving the application encryption key.

### Existing database using `db push`

An existing database can still contain the historical PostgreSQL enum value `MANUAL_COURIER`.
Prisma cannot replace that enum while rows still use the old value. Run the idempotent preflight
before retrying `db push`:

```powershell
npm run db:prepare-schema-audit
npm run db:push
```

The preflight reads the datasource from `prisma.config.ts`; Prisma 7 `db execute` does not accept
the old `--schema` option. It renames the enum value when only the legacy value exists, or updates
all `DeliveryMode` columns when a partially changed database contains both labels.

Do not use `--force-reset`. The remaining unique-constraint messages from `db push` are warnings;
Prisma will fail without applying the constraint if actual duplicate rows exist.

After configuring `SELLER_PAYOUT_DATA_ENCRYPTION_KEY`, inspect first:

```powershell
pnpm finance:payout-encryption:dry
```

After backup and approval, run:

```powershell
$env:INDIHUB_ALLOW_SELLER_PAYOUT_BACKFILL="true"
pnpm finance:payout-encryption:apply
```

The backfill resets payout verification so finance must re-verify the migrated payout details.

## Verification

Safe local gates:

```powershell
pnpm db:validate
pnpm db:generate
pnpm --filter @indihub/api lint
```

Database migration verification must use a disposable PostgreSQL database whose name contains
`test`, `e2e`, or `integration`. Do not use `db push --force-reset` against staging or production.
