# 1HandIndia Production Seeding Guide

Last updated: 2026-05-26

## Production Rule

`pnpm db:seed` is read-only by default.

It runs `prisma/seed.ts --mode schema`, verifies the database schema is reachable, and creates or updates no rows.

## Seed Modes

| Command | Mode | Writes data? | Use case |
|---|---:|---:|---|
| `pnpm db:seed` | `schema` | No | Production-safe schema reachability check. |
| `pnpm db:seed:system` | `system` | Yes | Approved RBAC system-reference setup only: roles, permissions, and role-permission links. |
| `pnpm db:seed:bootstrap` | `bootstrap` | Yes | Local/dev or one-time approved bootstrap for default CMS pages, starter categories, notification templates, settings, subscription plans, location bootstrap rows, email settings, and optional first admin. |

## Production Guard

In production-like environments, write modes are blocked unless this is set explicitly:

```env
INDIHUB_ALLOW_PRODUCTION_SEED=true
```

Production-like means one of these is true:

```env
NODE_ENV=production
VERCEL_ENV=production
INDIHUB_ENV=production
INDIHUB_PRODUCTION=true
```

Use the allow flag only for a planned one-time operation, then remove it immediately.

## What Not To Do

- Do not run bootstrap seed as part of every production deploy.
- Do not use seed to restore business data.
- Do not let seed overwrite admin-managed settings, payment settings, CMS content, categories, seller plans, or email configuration.
- Do not store provider secrets in seed data.
