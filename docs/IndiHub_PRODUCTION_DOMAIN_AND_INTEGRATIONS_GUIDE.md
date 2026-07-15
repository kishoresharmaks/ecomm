# 1HandIndia Production Domain And Integration Guide

This guide lists the production URL, environment, mobile build, and third-party integration changes needed before running 1HandIndia on a live domain.

Use this with real production values. Do not commit production secrets.

## 1. Decide Production URLs

Choose the final public URLs first.

Recommended setup:

```txt
Web: https://1handindia.com
Web alias: https://www.1handindia.com
API: https://api.1handindia.com/api
```

Same-domain setup is also valid:

```txt
Web: https://1handindia.com
API: https://1handindia.com/api
```

For the current split-domain deployment, provider webhooks must use `https://api.1handindia.com/api/...`. Do not use `https://1handindia.com/api/...` unless the web server is explicitly routing `/api` traffic to the NestJS API.

Before mobile or provider setup, verify the API URL from a browser or terminal:

```powershell
curl https://api.1handindia.com/api/health
```

## 2. Root Environment

File for local/server root runtime:

```txt
.env
```

Set production values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
DATABASE_DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

API_CORS_ORIGINS="https://1handindia.com,https://www.1handindia.com"

NEXT_PUBLIC_APP_ENV="production"
NEXT_PUBLIC_WEB_URL="https://1handindia.com"
NEXT_PUBLIC_API_URL="https://api.1handindia.com"
NEXT_PUBLIC_API_TIMEOUT_MS="30000"

NEXT_PUBLIC_GA_MEASUREMENT_ID=""
NEXT_PUBLIC_GTM_ID=""
NEXT_PUBLIC_GOOGLE_ADS_ID=""
NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN=""

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_replace_me"
CLERK_SECRET_KEY="sk_live_replace_me"
CLERK_JWT_KEY="replace_me"
CLERK_AUTHORIZED_PARTIES="https://1handindia.com,https://www.1handindia.com"
CLERK_WEBHOOK_SECRET="replace_me"
CLERK_JWT_CLOCK_SKEW_MS="120000"

INDIHUB_FIRST_ADMIN_EMAIL="admin@1handindia.com"
INDIHUB_FIRST_ADMIN_PASSWORD="replace_me_once_then_rotate"
ADMIN_SESSION_TTL_HOURS="12"

RAZORPAY_KEY_ID="rzp_live_replace_me"
RAZORPAY_KEY_SECRET="replace_me"
RAZORPAY_WEBHOOK_SECRET="replace_me"

PUBLIC_IMAGE_PROVIDER="IMAGEKIT"
PUBLIC_IMAGE_BASE_URL="https://ik.imagekit.io/your_imagekit_id"

BREVO_API_KEY=""
RESEND_API_KEY=""
SENDGRID_API_KEY=""
SMTP_BRIDGE_URL=""

SENTRY_DSN="replace_me"
NEXT_PUBLIC_SENTRY_DSN="replace_me"
EXPO_PUBLIC_SENTRY_DSN="replace_me"
EXPO_PUBLIC_SENTRY_TUNNEL_URL=""
SENTRY_ENVIRONMENT="production"
SENTRY_ORG="replace_me"
SENTRY_PROJECT="replace_me"
SENTRY_AUTH_TOKEN="replace_me"
```

Use only one email provider in production unless failover is intentionally configured.

## 2A. Security Headers, Consent, And WAF

The web app emits production security headers from `apps/web/src/proxy.ts`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- nonce-based `Content-Security-Policy`
- `Report-To` and `Reporting-Endpoints` for `/security/csp-report`
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`

Production checks after deployment:

```powershell
curl -I https://1handindia.com
curl -i https://1handindia.com/security/csp-report
```

Expected result:

- `strict-transport-security` is present on HTTPS responses.
- `content-security-policy` does not contain `unsafe-eval`.
- `script-src` uses a `nonce-...` value and `strict-dynamic`.
- Google Ads measurement endpoints under `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, and `ad.doubleclick.net` are allowed by `connect-src`.
- `report-to` or `reporting-endpoints` is present.
- `/security/csp-report` returns JSON for `GET` and accepts browser CSP reports through `POST`.

Cookie and analytics rule:

- Published Google Tag Manager container `GTM-WFXLFC8X` is installed once in the root document head, with the required noscript iframe immediately after the opening body tag.
- The GTM container owns the Google Ads destination `AW-18165667075` and GA4 destination `G-MR1H66G0DZ`. Application code must not also emit direct `gtag('config', ...)` calls for these destinations because that would duplicate measurement.
- Use `/admin/settings/seo` for Search Console verification and installed-integration visibility. Keep `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, and `NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN` empty unless an environment fallback is intentionally required.
- The storefront shows a privacy-choice banner.
- Consent Mode defaults are queued before GTM loads. Cookie-backed measurement is enabled only after the visitor selects `Allow analytics`.
- Essential marketplace storage for sign-in, cart, checkout, and preferences remains available without analytics consent.

Verify the rendered tag after deployment:

```bash
curl -sL --compressed https://www.1handindia.com | grep -o "https://www.googletagmanager.com/gtm.js?id="
curl -sL --compressed https://www.1handindia.com | grep -o "GTM-WFXLFC8X"
curl -sL --compressed https://www.1handindia.com | grep -o "https://www.googletagmanager.com/ns.html?id=GTM-WFXLFC8X"
```

PCI Requirement 6.4 cannot be satisfied by application code alone. Put the production domain behind a real WAF before launch. Approved options:

- Cloudflare WAF in front of `1handindia.com`, `www.1handindia.com`, and `api.1handindia.com`.
- AWS WAF or an equivalent managed CDN WAF if the deployment is moved to that stack.
- Nginx ModSecurity with OWASP Core Rule Set if the VPS is responsible for edge protection.

Minimum WAF launch checklist:

- Managed OWASP/common web attack rules enabled.
- Bot and rate-limit rules enabled for auth, checkout, payment callback, support, and admin login paths.
- API webhook paths allow only required provider traffic where practical.
- WAF logs are retained and reviewed during launch week.
- Scanner re-test shows WAF detection or documented compensating evidence from the provider dashboard.

DNSSEC is also outside the app deployment. Enable DNSSEC at the authoritative DNS provider or registrar for `1handindia.com`, publish the DS record at the registrar, then verify:

```powershell
dig +dnssec 1handindia.com A
dig DS 1handindia.com
```

Expected result: the DNS response includes DNSSEC records and the parent zone returns a DS record.

## 3. Web App Environment

File for local web app runtime:

```txt
apps/web/.env
```

Set:

```env
NEXT_PUBLIC_APP_ENV="production"
NEXT_PUBLIC_WEB_URL="https://1handindia.com"
NEXT_PUBLIC_API_URL="https://api.1handindia.com"
NEXT_PUBLIC_API_TIMEOUT_MS="30000"

NEXT_PUBLIC_GA_MEASUREMENT_ID=""
NEXT_PUBLIC_GTM_ID=""
NEXT_PUBLIC_GOOGLE_ADS_ID=""
NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN=""

API_CORS_ORIGINS="https://1handindia.com,https://www.1handindia.com"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_replace_me"
CLERK_SECRET_KEY="sk_live_replace_me"
CLERK_JWT_KEY="replace_me"
CLERK_AUTHORIZED_PARTIES="https://1handindia.com,https://www.1handindia.com"
CLERK_WEBHOOK_SECRET="replace_me"

SENTRY_DSN="replace_me"
NEXT_PUBLIC_SENTRY_DSN="replace_me"
SENTRY_ENVIRONMENT="production"
SENTRY_ORG="replace_me"
SENTRY_PROJECT="replace_me"
SENTRY_AUTH_TOKEN="replace_me"
```

On hosted platforms, set these as platform environment variables instead of relying on local `.env`.

## 4. API And Worker Environment

The API and worker need the same production backend values:

```env
DATABASE_URL="production_database_url"
DATABASE_DIRECT_URL="production_direct_database_url"
API_CORS_ORIGINS="https://1handindia.com,https://www.1handindia.com"

CLERK_SECRET_KEY="sk_live_replace_me"
CLERK_JWT_KEY="replace_me"
CLERK_AUTHORIZED_PARTIES="https://1handindia.com,https://www.1handindia.com"
CLERK_WEBHOOK_SECRET="replace_me"

RAZORPAY_KEY_ID="rzp_live_replace_me"
RAZORPAY_KEY_SECRET="replace_me"
RAZORPAY_WEBHOOK_SECRET="replace_me"

PUBLIC_IMAGE_PROVIDER="IMAGEKIT"
PUBLIC_IMAGE_BASE_URL="https://ik.imagekit.io/your_imagekit_id"

BREVO_API_KEY="replace_me_if_using_brevo"
RESEND_API_KEY="replace_me_if_using_resend"
SENDGRID_API_KEY="replace_me_if_using_sendgrid"
SMTP_BRIDGE_URL="replace_me_if_using_smtp_bridge"

SENTRY_DSN="replace_me"
SENTRY_ENVIRONMENT="production"
```

The worker must run in production for background jobs such as notification campaigns and email delivery.

## 5. Customer Mobile Environment

Local mobile environment file:

```txt
apps/mobile-customer/.env
```

Set:

```env
EXPO_PUBLIC_API_URL="https://api.1handindia.com/api"
EXPO_PUBLIC_APP_ENV="production"
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_replace_me"
EXPO_PUBLIC_RAZORPAY_KEY_ID="rzp_live_replace_me"
EXPO_PUBLIC_SENTRY_DSN="replace_me"
EXPO_PUBLIC_SENTRY_TUNNEL_URL=""
EXPO_PUBLIC_ENABLE_SENTRY_EXAMPLE="false"
```

Production EAS profile:

```txt
apps/mobile-customer/eas.json
```

Add production public values, or set them in the EAS dashboard:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.1handindia.com/api",
        "EXPO_PUBLIC_APP_ENV": "production",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_replace_me",
        "EXPO_PUBLIC_RAZORPAY_KEY_ID": "rzp_live_replace_me",
        "EXPO_PUBLIC_SENTRY_DSN": "replace_me"
      }
    }
  }
}
```

`EXPO_PUBLIC_*` values are bundled into the app. Do not put secrets there.

## 6. Seller Mobile Environment

Local mobile environment file:

```txt
apps/mobile-seller/.env
```

Set:

```env
EXPO_PUBLIC_API_URL="https://api.1handindia.com/api"
EXPO_PUBLIC_APP_ENV="production"
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_replace_me"
EXPO_PUBLIC_SENTRY_DSN="replace_me"
EXPO_PUBLIC_SENTRY_TUNNEL_URL=""
```

Production EAS profile:

```txt
apps/mobile-seller/eas.json
```

Recommended production env:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.1handindia.com/api",
        "EXPO_PUBLIC_APP_ENV": "production",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_replace_me",
        "EXPO_PUBLIC_SENTRY_DSN": "replace_me"
      }
    }
  }
}
```

## 7. Mobile App Config

Customer app:

```txt
apps/mobile-customer/app.json
```

Verify:

```txt
expo.scheme = onehandindia
expo.android.package = com.onehandindia.customer
expo.ios.bundleIdentifier = com.onehandindia.customer
expo.extra.eas.projectId = real EAS project ID
expo.owner = correct Expo account
```

Verify Android intent filters and iOS associated domains include:

```txt
1handindia.com
www.1handindia.com
```

Seller app:

```txt
apps/mobile-seller/app.config.js
```

Verify:

```txt
scheme
android.package
ios.bundleIdentifier
extra.eas.projectId
owner
```

## 8. Clerk Production Setup

In Clerk dashboard:

1. Create or switch to production instance.
2. Add allowed origins:

```txt
https://1handindia.com
https://www.1handindia.com
```

3. Add redirect URLs for sign-in and sign-up flows.
4. Configure webhook URL:

```txt
https://api.1handindia.com/api/auth/clerk/webhook
```

5. Copy production keys:

```txt
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_JWT_KEY
CLERK_WEBHOOK_SECRET
```

6. Update API authorized parties:

```env
CLERK_AUTHORIZED_PARTIES="https://1handindia.com,https://www.1handindia.com"
```

## 9. Razorpay Production Setup

In Razorpay dashboard:

1. Activate live account.
2. Copy live key ID and key secret.
3. Set backend environment:

```env
RAZORPAY_KEY_ID="rzp_live_replace_me"
RAZORPAY_KEY_SECRET="replace_me"
RAZORPAY_WEBHOOK_SECRET="replace_me"
```

4. Set mobile public key ID only:

```env
EXPO_PUBLIC_RAZORPAY_KEY_ID="rzp_live_replace_me"
```

5. Configure webhook URL:

```txt
https://api.1handindia.com/api/payments/razorpay/webhook
```

6. Confirm the webhook URL reaches the API before enabling live webhooks:

```powershell
curl -i -X POST https://api.1handindia.com/api/payments/razorpay/webhook `
  -H "Content-Type: application/json" `
  -H "x-razorpay-signature: test" `
  --data '{"event":"payment.failed","payload":{}}'
```

Expected result is JSON `401 Unauthorized` for the invalid test signature. A `404` HTML page means the URL is hitting the Next.js web app and Razorpay will disable delivery after repeated failures.

7. Enable required payment/refund events.
8. Never put `RAZORPAY_KEY_SECRET` in web or mobile public env.

## 10. Sentry Production Setup

Create separate Sentry projects for:

- Web
- API
- Mobile customer
- Mobile seller

Set:

```env
SENTRY_DSN="server_or_api_dsn"
NEXT_PUBLIC_SENTRY_DSN="web_browser_dsn"
EXPO_PUBLIC_SENTRY_DSN="mobile_dsn"
SENTRY_ENVIRONMENT="production"
SENTRY_ORG="real_org"
SENTRY_PROJECT="real_project"
SENTRY_AUTH_TOKEN="real_auth_token"
```

In mobile app config, replace demo Sentry organization/project values before production release.

## 11. Storage And Public Images

Production image URLs must use managed public storage.

Set one provider:

```env
PUBLIC_IMAGE_PROVIDER="IMAGEKIT"
PUBLIC_IMAGE_BASE_URL="https://ik.imagekit.io/your_imagekit_id"
```

If using S3/CDN, configure:

```env
PUBLIC_IMAGE_PROVIDER="S3"
PUBLIC_IMAGE_BASE_URL="https://cdn.1handindia.com"
```

Then set S3 endpoint, region, bucket, access key, and secret through admin storage settings or secure backend env.

Do not allow arbitrary HTTPS image URLs for campaigns.

## 12. Email Provider

Choose one production provider:

```env
BREVO_API_KEY="replace_me"
```

or:

```env
RESEND_API_KEY="replace_me"
```

or:

```env
SENDGRID_API_KEY="replace_me"
```

or:

```env
SMTP_BRIDGE_URL="https://mail-bridge.example.com/send"
```

In the provider dashboard, configure:

- Verified sender domain
- SPF
- DKIM
- DMARC
- Bounce handling if supported

Also configure sender identity and templates in Admin Email Settings.

## 13. Deep Links And App Links

Production web must serve:

```txt
https://1handindia.com/.well-known/assetlinks.json
https://1handindia.com/.well-known/apple-app-site-association
```

Verify:

```powershell
curl https://1handindia.com/.well-known/assetlinks.json
curl https://1handindia.com/.well-known/apple-app-site-association
```

Android and iOS deep links should cover:

```txt
/stores
/store
/product
/products
/category
/categories
/orders
/checkout/success
/track-order
```

## 14. Expo And Push Notifications

For production push notifications:

1. Use EAS production builds, not Expo Go.
2. Configure Android FCM credentials in EAS/Expo.
3. Configure iOS push credentials if releasing iOS.
4. Ensure the API is reachable from device builds:

```env
EXPO_PUBLIC_API_URL="https://api.1handindia.com/api"
```

5. Verify customer push flow:

- Login on real device.
- Grant notification permission.
- Confirm token registration in backend.
- Send deal/order/campaign notification.
- Confirm push appears.
- Confirm inbox item appears.
- Tap push and verify deep link.
- Sign out and confirm token revoke.

## 15. Production Deployment Checklist

Before deploy:

```powershell
pnpm db:validate
pnpm db:generate
pnpm --filter @indihub/api typecheck
pnpm --filter @indihub/api lint
pnpm --filter @indihub/api test
pnpm --filter @indihub/web typecheck
pnpm --filter @indihub/web lint
pnpm --filter @indihub/web test
pnpm --filter @indihub/web build
pnpm --filter @indihub/mobile-customer typecheck
pnpm --filter @indihub/mobile-customer lint
pnpm --filter @indihub/mobile-customer test
pnpm --filter @indihub/mobile-seller typecheck
pnpm --filter @indihub/mobile-seller lint
pnpm --filter @indihub/mobile-seller test
```

Apply migrations:

```powershell
npx prisma migrate deploy
```

Start production processes:

```txt
web app
api app
worker app
```

The worker must be running for notification campaigns, email jobs, and other background tasks.

## 16. Quick Production URL Checklist

Change these first:

```env
NEXT_PUBLIC_WEB_URL="https://1handindia.com"
NEXT_PUBLIC_API_URL="https://api.1handindia.com"
API_CORS_ORIGINS="https://1handindia.com,https://www.1handindia.com"
CLERK_AUTHORIZED_PARTIES="https://1handindia.com,https://www.1handindia.com"
EXPO_PUBLIC_API_URL="https://api.1handindia.com/api"
```

Then update provider dashboards:

- Clerk origins, redirects, webhook
- Razorpay live keys and webhook
- Sentry org/project/DSNs
- ImageKit/S3/CDN storage
- Email provider DNS and sender identity
- EAS production env and push credentials

## 17. Common Mistakes To Avoid

- Do not use `http://192.168.1.3` in production builds.
- Do not put backend secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Do not use Expo Go for push or Razorpay native module testing.
- Do not forget `API_CORS_ORIGINS`; web login and checkout calls can fail.
- Do not forget `CLERK_AUTHORIZED_PARTIES`; API token verification can fail.
- Do not forget the production worker; campaigns and email delivery need it.
- Do not leave demo Sentry organization/project values in release builds.
- Do not allow arbitrary external campaign image URLs.
