# 1HandIndia Seller Mobile App

Expo React Native seller workspace for seller registration, seller dashboard, products, orders, finance, and profile management.

## Validation

```powershell
pnpm.cmd --filter @indihub/mobile-seller typecheck
pnpm.cmd --filter @indihub/mobile-seller lint
pnpm.cmd --filter @indihub/mobile-seller test
```

The app uses Clerk mobile auth and the same backend API as the seller web center. Public product/profile images upload through `/api/storage/public-image/upload-request` and submit only returned portable asset keys.

EAS production builds use Expo Continuous Native Generation. The local
`android` directory is kept for development diagnostics but is ignored from
cloud build uploads, so EAS Prebuild applies the current `app.config.js`
permissions, notification resources, Firebase config, icons, and versioning.

## Production Release

Use [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) as the single source of truth for environments, GitHub/EAS builds, Google Play declarations, signed-AAB inspection, device QA, push notifications, Sentry, rollout, rollback, and release approval.
