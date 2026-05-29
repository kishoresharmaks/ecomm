# Render + Neon Test Hosting Change Tracker

**Project:** 1HandIndia / IndiHub marketplace  
**Purpose:** track temporary source changes made to host the portal for testing on Render with a Neon database.  
**Created:** 2026-05-30  
**Status:** temporary testing support. Keep this file until Render + Neon testing is finished and rollback is no longer needed.

## Why These Changes Exist

The project needed hosted QA on:

- Render for the API and web services.
- Neon for PostgreSQL.

Render requires web services to bind to the public host/port it assigns. Neon works best with a pooled runtime database URL and a direct database URL for Prisma schema commands.

## Changed Files

| File | Change | Why |
|---|---|---|
| `apps/api/src/main.ts` | API now reads `PORT`, falls back to `API_PORT`, and binds to `API_HOST` / `0.0.0.0`. | Render web services need the app to listen on the assigned port and public host. |
| `prisma.config.ts` | Prisma CLI now prefers `DIRECT_URL`, then `DATABASE_URL`. | Neon schema commands should use the direct non-pooled connection. |
| `packages/config/src/index.ts` | Added `DIRECT_URL` and `API_HOST` to server env schema. | Keeps hosted env keys documented in typed config. |
| `apps/web/package.json` | Added `start:render`. | Lets Render start Next.js with its assigned `$PORT`. |
| `package.json` | Added upper bounds to `engines.node` and `engines.pnpm`. | Avoids Render drifting to a future unsupported Node/pnpm major version. |
| `.env.example` | Added Neon pooled/direct URL comments and `API_HOST`. | Shows correct hosted database/runtime setup without real secrets. |
| `apps/web/src/components/admin/admin-operations.tsx` | Added `DIRECT_URL`, `PORT`, and `API_HOST` to env-only configuration list. | Admin settings page can show the correct hosted env keys. |
| `.env` | Set local `DATABASE_URL` to the Neon pooled URL and added matching `DIRECT_URL`. Secret value intentionally omitted from this tracker. | Lets local Prisma/API commands target the Neon test database when testing deployment setup. |
| `apps/web/.env` | Set local `DATABASE_URL` to the Neon pooled URL and added matching `DIRECT_URL`. Secret value intentionally omitted from this tracker. | Prevents the web app's local env file from overriding the root Neon database URL during Next builds. |
| `render.yaml` | New file defining `indihub-api` and `indihub-web` Render services. | Allows Render Blueprint deployment from repo root. |
| `docs/IndiHub_RENDER_NEON_TEST_DEPLOYMENT.md` | New deployment guide. | Gives setup steps for Neon URLs, Render env vars, schema setup, and smoke testing. |
| `README.md` | Linked the Render + Neon testing deployment guide. | Makes the test deployment guide discoverable. |
| `AGENTS.md` | Added current status, verification, and recommended next-step notes for Render + Neon prep. | Helps future sessions understand that hosting prep was intentionally added. |
| `docs/IndiHub_RENDER_NEON_TEST_HOSTING_CHANGE_TRACKER.md` | New tracker file. | Keeps rollback notes in one place. |

## Verification Already Passed

These checks passed after the hosting prep:

```powershell
pnpm.cmd db:validate
pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api build
pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web build
```

## Latest Local Secret Update

On 2026-05-30, the user provided the Neon pooled PostgreSQL URL for testing.

Updated files:

```text
.env
apps/web/.env
```

Updated keys:

```text
DATABASE_URL = Neon pooled URL
DIRECT_URL = matching Neon direct URL
```

The password and full connection strings are intentionally not written in this tracker. Use the actual `.env` files or Render Dashboard secrets when needed.

## Rollback Plan After Testing

Do this only after Render + Neon testing is fully finished.

1. Delete temporary hosting files:

```text
render.yaml
docs/IndiHub_RENDER_NEON_TEST_DEPLOYMENT.md
```

Keep this tracker until rollback is complete. Delete it last if no longer needed.

2. Restore `apps/api/src/main.ts` startup to the previous local-only form:

```ts
const port = Number(process.env.API_PORT ?? 4000);
await app.listen(port);

console.log(`1HandIndia API listening on http://localhost:${port}/api`);
console.log(`1HandIndia API docs available on http://localhost:${port}/api/docs`);
```

3. Restore `prisma.config.ts` datasource URL:

```ts
url: process.env.DATABASE_URL ?? localDatabaseUrl
```

4. Remove these temporary env schema keys from `packages/config/src/index.ts`:

```ts
DIRECT_URL
API_HOST
```

5. Remove `start:render` from `apps/web/package.json`.

6. Restore root `package.json` engine ranges if strict hosted pinning is no longer wanted:

```json
"node": ">=22.0.0",
"pnpm": ">=10.0.0"
```

7. Remove the hosted Neon comments and `API_HOST` entry from `.env.example`.

8. Restore local `.env` and `apps/web/.env` database values to the local PostgreSQL test database, or remove `DIRECT_URL` if Neon is no longer used.

9. Remove these keys from the environment-only config list in `apps/web/src/components/admin/admin-operations.tsx`:

```text
DIRECT_URL
PORT
API_HOST
```

10. Remove the Render + Neon guide references from:

```text
README.md
AGENTS.md
```

11. Run the same verification gates again after rollback:

```powershell
pnpm.cmd db:validate
pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api build
pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web build
```

## Important Notes

- Do not print real Neon, Clerk, Razorpay, Redis, or email secrets in chat or docs.
- This workspace is not currently a git checkout, so this tracker is the manual rollback record.
- If the Render + Neon setup becomes the permanent deployment route, do not rollback these changes. Instead, rename this file into a permanent deployment history note.
