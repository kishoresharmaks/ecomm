# 1HandIndia Render + Neon Test Deployment

**Purpose:** temporary hosted QA deployment for 1HandIndia Phase 1.  
**Target:** Render web services for `apps/api` and `apps/web`, with PostgreSQL hosted on Neon.

This is a testing deployment guide, not the final production handoff. Keep real provider activation, live payments, custom domain, backups, and final launch monitoring as separate production tasks.

## 1. Prepared In This Workspace

- `render.yaml` defines two Render Node web services:
  - `indihub-api` for the NestJS API.
  - `indihub-web` for the Next.js web portal.
- The API now reads Render's `PORT` variable and binds to `0.0.0.0`.
- Prisma CLI commands now prefer `DIRECT_URL`, while runtime uses `DATABASE_URL`.
- `.env.example` documents pooled and direct Neon URLs.
- The web app has `start:render` so Render can start Next.js on its assigned port.

## 2. Neon Database Setup

Create a Neon project and copy two connection strings:

| Variable | Use | Neon URL |
|---|---|---|
| `DATABASE_URL` | Runtime app/API traffic | Pooled connection string with `-pooler` in hostname |
| `DIRECT_URL` | Prisma CLI schema commands | Direct non-pooled connection string |

Recommended values:

```env
DATABASE_URL="postgresql://neondb_owner:<password>@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:<password>@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

For the first test database schema load, run this from the project root after setting `DIRECT_URL` and `DATABASE_URL` locally:

```powershell
pnpm.cmd db:generate
pnpm.cmd db:push
pnpm.cmd db:seed:system
```

Use `pnpm.cmd db:seed:bootstrap` only for local/demo bootstrap rows. It is blocked in production-like mode unless `INDIHUB_ALLOW_PRODUCTION_SEED=true` is explicitly set for an approved one-time operation.

## 3. Render Services

Connect the Git repository to Render and deploy from the root `render.yaml` Blueprint.

Expected service URLs if the names are available:

```text
API: https://indihub-api.onrender.com
Web: https://indihub-web.onrender.com
API health: https://indihub-api.onrender.com/api/health
```

If Render assigns different service names or URLs, update these environment variables in both services:

```env
NEXT_PUBLIC_WEB_URL="https://your-web-service.onrender.com"
NEXT_PUBLIC_API_URL="https://your-api-service.onrender.com"
API_CORS_ORIGINS="https://your-web-service.onrender.com"
CLERK_AUTHORIZED_PARTIES="https://your-web-service.onrender.com"
```

## 4. Required Render Environment Values

Set these in `indihub-api`:

```env
DATABASE_URL="<Neon pooled URL>"
DIRECT_URL="<Neon direct URL>"
API_CORS_ORIGINS="https://indihub-web.onrender.com"
CLERK_SECRET_KEY="<test Clerk secret key>"
CLERK_JWT_KEY="<same Clerk app JWT public key PEM>"
CLERK_WEBHOOK_SECRET="<Clerk webhook secret, if webhook sync is enabled>"
CLERK_AUTHORIZED_PARTIES="https://indihub-web.onrender.com"
INDIHUB_FIRST_ADMIN_EMAIL="<first admin email>"
INDIHUB_FIRST_ADMIN_PASSWORD="<strong temporary password>"
INDIHUB_AUTH_SYNC_SECRET="<random secret>"
INDIHUB_BOOTSTRAP_SECRET="<random secret>"
```

Set these in `indihub-web`:

```env
NEXT_PUBLIC_WEB_URL="https://indihub-web.onrender.com"
NEXT_PUBLIC_API_URL="https://indihub-api.onrender.com"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="<test Clerk publishable key>"
```

Optional testing values:

```env
REDIS_URL="<Render Key Value / Upstash Redis URL if queued email jobs are tested>"
BREVO_API_KEY="<Brevo test key if email delivery is tested>"
RESEND_API_KEY="<Resend test key if email delivery is tested>"
SENDGRID_API_KEY="<SendGrid test key if email delivery is tested>"
PUBLIC_IMAGE_BASE_URL="<ImageKit or S3 public base URL if hosted images are tested>"
RAZORPAY_KEY_ID="<Razorpay test key id>"
RAZORPAY_KEY_SECRET="<Razorpay test key secret>"
RAZORPAY_WEBHOOK_SECRET="<Razorpay test webhook secret>"
```

Do not set local-dev auth flags on public Render URLs unless the URL is access-restricted and this is only a short internal smoke test.

## 5. Render Build Commands

The Blueprint uses:

```text
API build: corepack enable && pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @indihub/api build
API start: pnpm --filter @indihub/api start

Web build: corepack enable && pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @indihub/web build
Web start: pnpm --filter @indihub/web start:render
```

Schema push is intentionally not in the Render build command. Apply schema to Neon deliberately with `pnpm.cmd db:push` before deployment so a normal web deploy cannot change the database by surprise.

## 6. Post-Deploy Smoke Test

After both services are live:

```powershell
Invoke-WebRequest "https://indihub-api.onrender.com/api/health"
Invoke-WebRequest "https://indihub-web.onrender.com"
```

Then check these flows in the browser:

- Admin standalone login at `/admin`.
- Storefront homepage loads CMS banners/sections.
- Customer sign-in/sign-up uses the test Clerk app.
- Seller registration and pending/approved states.
- Cart and checkout with COD/manual test settings.
- Seller orders, admin orders, delivery partner routes, and finance routes if seeded data exists.

## 7. Testing Caveats

- This workspace currently has no Prisma migration folder, so Neon test schema setup uses `prisma db push`.
- Render free web services can sleep after inactivity, so the first request can be slow.
- A real Clerk test application is strongly recommended for customer/seller/B2B auth testing.
- Razorpay, email, storage, Redis, and custom domain setup remain provider/account tasks outside development cost.

Reference docs checked on 2026-05-30:

- Render Blueprint YAML: https://render.com/docs/blueprint-spec
- Render web service port binding: https://render.com/docs/web-services#port-binding
- Render Node version selection: https://render.com/docs/node-version
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- Prisma with Neon: https://docs.prisma.io/docs/v6/orm/overview/databases/neon
