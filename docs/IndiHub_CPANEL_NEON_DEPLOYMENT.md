# 1HandIndia cPanel + Neon Deployment Guide

**Main website:** `https://1handindia.nexusnation.in`  
**API domain:** `https://sync.nexusnation.in`  
**Database:** Neon PostgreSQL

This guide is for the current cPanel test/hosting setup using two Node.js applications.

## 1. cPanel Node Apps

Create two applications in cPanel **Setup Node.js App** or **Application Manager**.

### Web App

```text
Node.js version: 20.20.2 or newer
Application mode: Production
Application root: indihub/apps/web
Application URL: 1handindia.nexusnation.in
Application startup file: app.js
```

### API App

```text
Node.js version: 20.20.2 or newer
Application mode: Production
Application root: indihub/apps/api
Application URL: sync.nexusnation.in
Application startup file: app.js
```

## 2. Install And Build From cPanel Terminal

Run from the repo root:

```bash
cd ~/indihub
node -v
npm -v
npx pnpm@10.20.0 install --frozen-lockfile
npx pnpm@10.20.0 db:generate
npx pnpm@10.20.0 --filter @indihub/api build
npx pnpm@10.20.0 --filter @indihub/web build
```

Use `npx pnpm@10.20.0` because this cPanel shell does not expose `corepack`.

## 3. API Environment Variables

Add these to the **API** Node app in cPanel:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled connection string>
API_CORS_ORIGINS=https://1handindia.nexusnation.in
NEXT_PUBLIC_WEB_URL=https://1handindia.nexusnation.in
NEXT_PUBLIC_API_URL=https://sync.nexusnation.in

CLERK_SECRET_KEY=<Clerk secret key>
CLERK_JWT_KEY=<Clerk JWT public key>
CLERK_AUTHORIZED_PARTIES=https://1handindia.nexusnation.in
INDIHUB_FIRST_ADMIN_EMAIL=<first admin email>
INDIHUB_FIRST_ADMIN_PASSWORD=<first admin password>
INDIHUB_AUTH_SYNC_SECRET=<random secret>
INDIHUB_BOOTSTRAP_SECRET=<random secret>
```

Optional later:

```text
REDIS_URL=<Redis URL if queued emails are enabled>
RAZORPAY_KEY_ID=<Razorpay test/live key id>
RAZORPAY_KEY_SECRET=<Razorpay key secret>
RAZORPAY_WEBHOOK_SECRET=<Razorpay webhook secret>
BREVO_API_KEY=<Brevo key>
RESEND_API_KEY=<Resend key>
SENDGRID_API_KEY=<SendGrid key>
```

## 4. Web Environment Variables

Add these to the **web** Node app in cPanel:

```text
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=1HandIndia
NEXT_PUBLIC_WEB_URL=https://1handindia.nexusnation.in
NEXT_PUBLIC_API_URL=https://sync.nexusnation.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
```

## 5. Neon Schema Setup

Use the Neon direct URL only when applying schema changes. For normal app runtime, use the pooled URL in `DATABASE_URL`.

From local machine or cPanel terminal, set `DATABASE_URL` to the Neon URL temporarily, then run:

```bash
npx pnpm@10.20.0 db:push
npx pnpm@10.20.0 db:seed:system
```

Do not run bootstrap seed on a public database unless you intentionally want demo/local rows.

## 6. Restart Apps

After env changes or builds, restart both Node apps from cPanel. If using terminal:

```bash
mkdir -p ~/indihub/apps/api/tmp ~/indihub/apps/web/tmp
touch ~/indihub/apps/api/tmp/restart.txt
touch ~/indihub/apps/web/tmp/restart.txt
```

## 7. Smoke Test

Open:

```text
https://sync.nexusnation.in/api/health
https://1handindia.nexusnation.in
```

Then test:

- Admin login at `https://1handindia.nexusnation.in/admin`
- Customer sign-in/sign-up
- Seller registration
- Storefront product/category pages
- Cart and checkout once test data exists

## 8. Notes

- Keep `.env` files out of Git.
- Do not paste secrets into source files.
- cPanel Node support depends on the hosting provider's Passenger/Application Manager setup.
- Node 22 is preferred by the project, but this cPanel shows Node 20.20.2. Continue with Node 20.20.2 for this hosting test unless the provider offers Node 22.
