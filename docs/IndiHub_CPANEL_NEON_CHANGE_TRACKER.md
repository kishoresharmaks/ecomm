# cPanel + Neon Hosting Change Tracker

**Project:** 1HandIndia / IndiHub marketplace  
**Created:** 2026-05-30  
**Purpose:** track temporary cPanel hosting changes for `1handindia.nexusnation.in`, `sync.nexusnation.in`, and Neon.

## Changed Files

| File | Change | Why |
|---|---|---|
| `apps/api/src/main.ts` | API now reads `PORT` before `API_PORT`. | cPanel Passenger-style Node apps usually assign the runtime port. |
| `apps/api/app.js` | Added cPanel startup wrapper for the NestJS API. | cPanel startup file is `app.js`. |
| `apps/web/app.js` | Added cPanel startup wrapper for the Next.js web app. | cPanel startup file is `app.js`. |
| `apps/web/package.json` | Added `build:cpanel` using `next build --webpack`. | cPanel shared hosting failed the default Turbopack build with `ERR_WORKER_INIT_FAILED` / `EAGAIN`. |
| `docs/IndiHub_CPANEL_NEON_DEPLOYMENT.md` | Added cPanel + Neon setup guide. | Gives repeatable deployment steps. |
| `docs/IndiHub_CPANEL_NEON_CHANGE_TRACKER.md` | Added this tracker. | Keeps rollback instructions in one place. |

## Rollback After cPanel Testing

If cPanel hosting is abandoned, undo these changes:

1. Remove:

```text
apps/api/app.js
apps/web/app.js
docs/IndiHub_CPANEL_NEON_DEPLOYMENT.md
docs/IndiHub_CPANEL_NEON_CHANGE_TRACKER.md
```

2. Remove `build:cpanel` from `apps/web/package.json`.

3. Restore API port logic in `apps/api/src/main.ts`:

```ts
const port = Number(process.env.API_PORT ?? 4000);
```

4. Run verification:

```powershell
pnpm.cmd db:validate
pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/web typecheck
```

## Secret Handling

Neon, Clerk, Razorpay, Redis, and email provider secrets must stay only in cPanel environment variables or ignored local `.env` files.
