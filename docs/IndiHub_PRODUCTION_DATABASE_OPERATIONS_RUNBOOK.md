# 1HandIndia Production Database Operations Runbook

**Project:** 1HandIndia multi-vendor ecommerce marketplace  
**Document type:** Production database operations, scaling, backup, and live migration guide  
**Audience:** Developer, DevOps operator, production owner  
**Last updated:** 2026-07-14  
**Database:** PostgreSQL on NVMe SSD, Prisma application schema

## 1. Purpose

This runbook explains how to operate the 1HandIndia production PostgreSQL database safely as users, orders, sellers, products, reports, audit logs, and notifications grow.

Use this document for:

- Daily database care.
- Backup and restore setup.
- Slow query tracking.
- Table and index growth monitoring.
- Vacuum/analyze maintenance.
- Safe pagination and report-query rules.
- Long-term data archiving.
- Moving the live production database from one server to another without data loss.

## 2. Current Recommended Server Baseline

The current 6 vCPU, 12 GB RAM, 100 GB NVMe VPS can run the early production stack:

- Next.js web app.
- NestJS API.
- Worker app.
- PostgreSQL database.
- Nginx reverse proxy.

Use it for early production only if these rules are followed:

- Keep PostgreSQL data on NVMe SSD.
- Store product images and private files outside the VPS, such as ImageKit or S3-compatible storage.
- Push backups to external storage.
- Rotate logs.
- Monitor RAM, CPU, disk, database connections, and slow queries.

Plan to upgrade or split the database before the server becomes consistently busy.

## 3. Non-Negotiable Database Rules

- Keep DB on NVMe SSD.
- Take daily automated backups.
- Test restore regularly.
- Enable slow query logging.
- Monitor table and index growth.
- Add indexes based on actual query patterns.
- Vacuum/analyze regularly.
- Avoid unbounded report queries.
- Paginate all admin, seller, customer, finance, B2B, delivery, and support lists.
- Archive old audit, notification, export, and event data later.
- Move DB to a dedicated server before traffic gets heavy.

## 4. PostgreSQL Data Directory Must Be On NVMe

Check where PostgreSQL stores data:

```bash
sudo -u postgres psql -c "SHOW data_directory;"
```

Check disk type and mount:

```bash
lsblk -o NAME,TYPE,SIZE,MODEL,MOUNTPOINT
df -h
```

Production target:

- PostgreSQL data directory on NVMe.
- At least 30% disk free.
- No database data on slow network storage.

If the VPS provider gives a separate NVMe volume, mount it before creating the production database.

Example mount path:

```text
/var/lib/postgresql
```

Do not move PostgreSQL data directories manually without a planned maintenance window and verified backup.

## 5. PostgreSQL Starting Configuration For 12 GB RAM

Edit:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Use values close to these for the current 6 vCPU, 12 GB RAM VPS:

```conf
shared_buffers = 3GB
effective_cache_size = 8GB
maintenance_work_mem = 512MB
work_mem = 16MB
max_connections = 80
random_page_cost = 1.1
effective_io_concurrency = 200
checkpoint_completion_target = 0.9
wal_compression = on
```

Restart after changes:

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

If API and worker connection counts grow, add PgBouncer instead of raising `max_connections` too high.

## 6. Daily Automated Backups

### 6.1 Create Backup Directory

```bash
sudo mkdir -p /var/backups/indihub/postgres
sudo chown postgres:postgres /var/backups/indihub/postgres
sudo chmod 700 /var/backups/indihub/postgres
```

### 6.2 Create Backup Script

Create:

```bash
sudo nano /usr/local/bin/indihub-db-backup.sh
```

Script:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="indihub"
DB_NAME="indihub"
BACKUP_DIR="/var/backups/indihub/postgres"
DATE="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/${APP_NAME}-${DB_NAME}-${DATE}.dump"

mkdir -p "${BACKUP_DIR}"

pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --dbname="${DB_NAME}" \
  --file="${FILE}"

sha256sum "${FILE}" > "${FILE}.sha256"

# Keep only recent local backups. External storage should keep longer retention.
find "${BACKUP_DIR}" -type f -name "${APP_NAME}-${DB_NAME}-*.dump" -mtime +2 -delete
find "${BACKUP_DIR}" -type f -name "${APP_NAME}-${DB_NAME}-*.dump.sha256" -mtime +2 -delete

echo "Backup complete: ${FILE}"
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/indihub-db-backup.sh
```

Test:

```bash
sudo -u postgres /usr/local/bin/indihub-db-backup.sh
```

### 6.3 Schedule Daily Backup

```bash
sudo crontab -u postgres -e
```

Add:

```cron
15 2 * * * /usr/local/bin/indihub-db-backup.sh >> /var/log/indihub-db-backup.log 2>&1
```

### 6.4 Push Backups Outside The Server

Local backups are not enough. Push them to S3-compatible storage, another server, or a backup provider.

Example with `rclone`:

```bash
rclone copy /var/backups/indihub/postgres remote:indihub-db-backups/postgres --include "*.dump" --include "*.sha256"
```

Keep:

- 7 daily backups.
- 4 weekly backups.
- 6 monthly backups.

### 6.5 Restore Test

At least monthly, restore the latest backup into a disposable database:

```bash
createdb indihub_restore_test
pg_restore --dbname=indihub_restore_test --clean --if-exists /var/backups/indihub/postgres/LATEST.dump
psql indihub_restore_test -c "SELECT COUNT(*) FROM users;"
dropdb indihub_restore_test
```

Never restore into production unless a real incident is declared and the production owner approves it.

## 7. Enable Slow Query Logging

Edit:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Recommended starting values:

```conf
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_min_duration_statement = 500
log_checkpoints = on
log_connections = off
log_disconnections = off
log_lock_waits = on
deadlock_timeout = 1s
```

Restart:

```bash
sudo systemctl restart postgresql
```

Read slow queries:

```bash
sudo tail -n 200 /var/lib/postgresql/16/main/log/postgresql-$(date +%Y-%m-%d).log
```

If logs are too noisy, raise `log_min_duration_statement` to `1000`. For investigation, temporarily lower it to `200`.

## 8. Monitor Table And Index Growth

Run weekly:

```sql
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 30;
```

Monitor indexes:

```sql
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 30;
```

Interpretation:

- Large table with many dead rows needs vacuum attention.
- Large index with zero scans may be unnecessary later.
- High-growth tables need archiving or partition planning.

Important high-growth tables in this product:

- `orders`
- `order_items`
- `order_seller_splits`
- `payments`
- `audit_logs`
- `notification_logs`
- `seller_ledger_entries`
- `support_requests`
- `b2b_enquiries`
- `search_documents`

## 9. Add Indexes Based On Actual Query Patterns

Do not add random indexes. Each index speeds reads but slows writes.

Use slow query logs and `EXPLAIN ANALYZE`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...
```

Index rules for this workspace:

- Every foreign key must have an index.
- Do not add redundant single-column indexes if a composite index already starts with that column.
- Add composite indexes that match real filters and sort order.
- Use GIN indexes for full-text search vectors.
- Use trigram GIN indexes only where fuzzy search is actually used.

Example useful marketplace index patterns:

```prisma
@@index([sellerId, createdAt])
@@index([customerId, createdAt])
@@index([orderStatus, createdAt])
@@index([paymentStatus, createdAt])
@@index([sellerId, settlementStatus, payoutId])
```

After changing `schema.prisma`:

```bash
pnpm db:generate
pnpm db:validate
pnpm --filter @indihub/api typecheck
```

In production, apply with Prisma migrations. Do not use `db:push`.

## 10. Vacuum And Analyze Regularly

Autovacuum should remain enabled.

Check:

```sql
SHOW autovacuum;
```

Manual maintenance for normal production:

```bash
sudo -u postgres vacuumdb --analyze --dbname=indihub
```

Weekly cron:

```cron
30 3 * * 0 vacuumdb --analyze --dbname=indihub >> /var/log/indihub-db-maintenance.log 2>&1
```

Do not run `VACUUM FULL` during normal traffic. It locks tables and can block the app.

Use `VACUUM FULL` only during a planned maintenance window.

## 11. Avoid Unbounded Report Queries

Every report query must have at least one of these:

- Date range.
- Pagination.
- `take` limit.
- Cursor.
- Aggregation over indexed filters.

Bad pattern:

```ts
await prisma.order.findMany({ include: { items: true } });
```

Good pattern:

```ts
await prisma.order.findMany({
  where: { createdAt: { gte: dateFrom, lte: dateTo } },
  orderBy: { createdAt: "desc" },
  take: 50,
});
```

For heavy admin dashboards, prefer aggregate queries or precomputed summary tables.

## 12. Paginate Every List

All list pages must be paginated:

- Admin orders.
- Admin sellers.
- Admin customers.
- Admin audit logs.
- Admin notification logs.
- Seller orders.
- Seller products.
- Seller payouts.
- Customer orders.
- B2B enquiries.
- Finance reports.
- Delivery assigned orders.

Preferred API styles:

- Cursor pagination for high-churn tables.
- Page/limit only for small admin-controlled lists.

Never load all rows into memory for UI tables.

## 13. Archive Old Audit, Log, And Notification Data

Do not delete business records like orders, payments, payouts, settlements, ledgers, or tax data.

Archive lower-risk operational logs later:

- Old notification logs.
- Old audit log payloads after legal retention is decided.
- Old search index job records.
- Old temporary exports.
- Old webhook raw payloads after reconciliation windows.

Recommended first retention policy:

| Data | Keep hot | Archive after |
|---|---:|---:|
| Orders/payments/payouts/ledger | Always | Do not archive without legal approval |
| Audit logs | 12 months | 12-24 months |
| Notification logs | 6 months | 6-12 months |
| Webhook raw payloads | 90 days | 90-180 days |
| Temporary exports | 7 days | 7-30 days |

Archive to compressed files or archive tables before deleting from hot tables.

## 14. When To Move DB To A Dedicated Server

Move PostgreSQL before traffic becomes heavy, not after an outage.

Trigger points:

- RAM stays above 75-80%.
- CPU often above 70%.
- Disk usage above 70%.
- Database size reaches 40-50 GB on the 100 GB VPS.
- Checkout, seller reports, or admin reports become slow.
- Orders grow beyond early-launch volume.
- Backup and restore time becomes uncomfortable.

Recommended next topology:

```text
Server 1:
  - Nginx
  - Web app
  - API
  - Worker

Server 2:
  - PostgreSQL only
  - 8 vCPU or more
  - 16-32 GB RAM
  - 300-500 GB NVMe
```

## 15. Live Database Transfer Without Data Loss

There are two safe migration methods.

Use Method A for a small database and acceptable short downtime.
Use Method B for production with minimal downtime.

### Method A: Short Maintenance Window With pg_dump

This is simpler and safe if the database is small and you can pause the site briefly.

Steps:

1. Announce maintenance window.
2. Put the app in maintenance mode.
3. Stop web, API, and worker.
4. Take final backup from old server.
5. Restore on new server.
6. Update `DATABASE_URL`.
7. Run migrations status check.
8. Start API, worker, and web.
9. Verify checkout, admin, seller reports, and login.
10. Keep old DB read-only for rollback until verified.

Commands on old server:

```bash
sudo systemctl stop indihub-worker
sudo systemctl stop indihub-api
sudo systemctl stop indihub-web

sudo -u postgres pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --dbname=indihub \
  --file=/tmp/indihub-final.dump
```

Copy to new server:

```bash
scp /tmp/indihub-final.dump USER@NEW_DB_SERVER:/tmp/indihub-final.dump
```

Restore on new DB server:

```bash
createdb indihub
pg_restore --dbname=indihub --clean --if-exists /tmp/indihub-final.dump
```

Update app server `.env.production`:

```env
DATABASE_URL="postgresql://indihub_app:STRONG_PASSWORD@NEW_DB_PRIVATE_IP:5432/indihub?schema=public"
```

Restart:

```bash
sudo systemctl start indihub-api
sudo systemctl start indihub-worker
sudo systemctl start indihub-web
```

This method has downtime, but it has the least operational complexity.

### Method B: Minimal Downtime With Logical Replication

Use this when production is live and you want to avoid losing new orders during migration.

High-level plan:

1. Prepare new PostgreSQL server.
2. Allow private network access from old DB to new DB.
3. Create an initial consistent copy.
4. Start logical replication from old DB to new DB.
5. Let new DB catch up.
6. Put app in maintenance mode.
7. Stop web/API/worker.
8. Wait until replication lag is zero.
9. Disable writes to old DB.
10. Point app to new DB.
11. Start API, worker, and web.
12. Verify.
13. Keep old DB untouched for rollback.

#### 15.1 Configure Old DB For Logical Replication

On old DB server, edit:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Set:

```conf
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10
```

Edit `pg_hba.conf`:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Allow new DB server private IP:

```conf
host    replication     repl_user       NEW_DB_PRIVATE_IP/32       scram-sha-256
host    indihub         repl_user       NEW_DB_PRIVATE_IP/32       scram-sha-256
```

Restart old PostgreSQL:

```bash
sudo systemctl restart postgresql
```

Create replication user:

```sql
CREATE ROLE repl_user WITH LOGIN REPLICATION PASSWORD 'STRONG_REPLICATION_PASSWORD';
GRANT CONNECT ON DATABASE indihub TO repl_user;
GRANT USAGE ON SCHEMA public TO repl_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO repl_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO repl_user;
```

#### 15.2 Create Publication On Old DB

```sql
CREATE PUBLICATION indihub_publication FOR ALL TABLES;
```

#### 15.3 Prepare New DB

Install the same or newer PostgreSQL major version on the new server.

Create database and app user:

```sql
CREATE DATABASE indihub;
CREATE USER indihub_app WITH PASSWORD 'STRONG_APP_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE indihub TO indihub_app;
```

Restore schema and existing data first. For logical replication, the target tables must exist.

On old server:

```bash
sudo -u postgres pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --dbname=indihub \
  --file=/tmp/indihub-initial.dump
```

Copy and restore:

```bash
scp /tmp/indihub-initial.dump USER@NEW_DB_SERVER:/tmp/indihub-initial.dump
pg_restore --dbname=indihub --clean --if-exists /tmp/indihub-initial.dump
```

#### 15.4 Create Subscription On New DB

On new DB:

```sql
CREATE SUBSCRIPTION indihub_subscription
CONNECTION 'host=OLD_DB_PRIVATE_IP port=5432 dbname=indihub user=repl_user password=STRONG_REPLICATION_PASSWORD'
PUBLICATION indihub_publication
WITH (copy_data = false);
```

Use `copy_data = false` only because you already restored the initial dump.

#### 15.5 Monitor Replication Lag

On old DB:

```sql
SELECT
  application_name,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS bytes_lag
FROM pg_stat_replication;
```

On new DB:

```sql
SELECT
  subname,
  received_lsn,
  latest_end_lsn,
  last_msg_send_time,
  last_msg_receipt_time
FROM pg_stat_subscription;
```

Wait until lag is zero or near zero.

#### 15.6 Final Cutover

Put site in maintenance mode.

Stop apps:

```bash
sudo systemctl stop indihub-worker
sudo systemctl stop indihub-api
sudo systemctl stop indihub-web
```

Confirm no app connections remain on old DB:

```sql
SELECT pid, usename, application_name, state
FROM pg_stat_activity
WHERE datname = 'indihub';
```

Wait until replication catches up.

On old DB, block accidental writes:

```sql
ALTER DATABASE indihub SET default_transaction_read_only = on;
```

Update app `.env.production` to new DB host:

```env
DATABASE_URL="postgresql://indihub_app:STRONG_PASSWORD@NEW_DB_PRIVATE_IP:5432/indihub?schema=public"
```

Start apps:

```bash
sudo systemctl start indihub-api
sudo systemctl start indihub-worker
sudo systemctl start indihub-web
```

Verify:

- Web opens.
- API health works.
- Admin login works.
- Seller login works.
- Checkout summary works.
- Place one low-risk test order in test mode.
- Admin order list shows the new order.
- Seller report loads.
- Worker logs are clean.

#### 15.7 After Cutover

Do not delete the old DB immediately.

Keep old DB for at least 7 days:

- PostgreSQL stopped or read-only.
- Firewall restricted.
- Backups retained.

After confidence period:

```sql
DROP SUBSCRIPTION indihub_subscription;
```

On old DB:

```sql
DROP PUBLICATION indihub_publication;
```

Only decommission old DB after backup and business approval.

## 16. Migration Safety Checklist

Before migration:

- Latest backup exists.
- Restore test passes.
- New DB server has enough RAM and NVMe disk.
- PostgreSQL versions are compatible.
- Firewall allows only private IP access.
- App secrets are ready.
- Maintenance page is ready.
- Rollback plan is written.

During migration:

- Stop API, web, and worker before final cutover.
- Confirm replication lag is zero.
- Do not allow writes to both old and new databases.
- Update only one production environment file.
- Restart services in order: API, worker, web.

After migration:

- Verify writes land in new DB.
- Check order placement.
- Check seller reports.
- Check admin finance.
- Check worker logs.
- Check backup job on the new DB.
- Keep old DB untouched for rollback.

## 17. Rollback Plan

Rollback is only safe if no new writes have happened on the new DB after cutover.

If you must rollback:

1. Stop web/API/worker.
2. Point `DATABASE_URL` back to old DB.
3. Remove read-only mode from old DB if it was set:

```sql
ALTER DATABASE indihub RESET default_transaction_read_only;
```

4. Start API, worker, and web.
5. Investigate new DB issue offline.

If new writes already happened on the new DB, do not rollback blindly. You must reconcile data first.

## 18. Operational Schedule

Daily:

- Confirm backup completed.
- Check disk usage.
- Check app/API errors.

Weekly:

- Check table and index growth.
- Review slow query logs.
- Run `VACUUM ANALYZE`.
- Confirm external backup sync.

Monthly:

- Restore backup to test DB.
- Review biggest tables.
- Review unused indexes.
- Review archive candidates.
- Review whether DB should be split to a dedicated server.

## 19. Upgrade Recommendation

Current 6 vCPU, 12 GB RAM, 100 GB NVMe is acceptable for early production with careful monitoring.

Recommended next upgrade:

- 8 vCPU.
- 16 GB RAM.
- 200-300 GB NVMe.

Recommended serious-growth database server:

- PostgreSQL-only server.
- 8 vCPU or more.
- 32 GB RAM if reports and order volume grow.
- 500 GB NVMe or more.
- Private network access only.
