# PostHog Self-driving setup report

## Summary
PostHog Self-driving is configured for this marketplace. Session Replay and Error Tracking were already enabled; Support (Conversations), health checks, error responders, and support-ticket responders were enabled during this run. Fresh scout configurations and Replay Vision scanners will begin producing findings as data arrives; reports should start appearing within about 30 minutes in the [Self-driving inbox](https://us.posthog.com/project/617752/inbox).

## AI data processing
Approved by the wizard gate before this run.

## GitHub
GitHub is already connected through the PostHog GitHub App. No GitHub Issues responder was enabled because no external tool was selected in the connected-tools prompt.

## Products enabled

| Product | Result | Notes |
|---|---|---|
| Session Replay | Already enabled | The web `posthog.init` check is clean: it does not disable recording. No recordings have arrived yet. |
| Error Tracking | Already enabled | The web initialization explicitly enables exception capture. |
| Support / Conversations | Enabled | Connect an inbound email, inbox, or Slack channel in PostHog before tickets can arrive. |

## Signal sources

| Signal source | Action | Notes |
|---|---|---|
| `health_checks` / `health_issue` | Enabled | New source config `01a0ba42-303e-786c-b794-e48e612a6b93`. |
| `error_tracking` / `issue_created` | Enabled | New source config `01a0ba42-3048-7603-8ef9-457cd945064b`. |
| `error_tracking` / `issue_reopened` | Enabled | New source config `01a0ba42-30c8-7ec2-8f3b-b5b41c2ad0e1`. |
| `error_tracking` / `issue_spiking` | Enabled | New source config `01a0ba42-30aa-7003-bd04-8dde76dab3ce`. |
| `conversations` / `ticket` | Enabled | New source config `01a0ba42-30b1-7282-a7f6-cc3282976eb8`; it remains idle until a support channel is connected. |
| `signals_scout` / `cross_source_issue` | Left at default | Scout findings are enabled by default; no opt-out row exists. |
| Session replay source row | Deliberately skipped | Replay Vision scanners are the active route for recording findings. |

## Connected tools
The connected-tools selection was dismissed, which is treated as no tools selected. No external responder was enabled or warehouse source created. Sentry remains a detected codebase dependency only; it was not connected or enabled without confirmation.

## Scout troop

**Run budget:** 100 runs/day, 0 used today, 100 remaining. The current early-access banner says: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

**Enabled (8):**

| Scout | Why enabled |
|---|---|
| General | Watches cross-product relationships and gaps. |
| Product analytics | Watches marketplace funnels, retention, lifecycle, and path regressions. |
| Web analytics | Watches traffic, attribution, landing-page health, and bounce/404 changes. |
| Revenue analytics | Watches payment/revenue configuration and upstream collection regressions. |
| Customer analytics | Fits the B2B account-engagement and churn-risk surface. |
| Health checks | Prioritizes actionable PostHog setup-health findings. |
| Checkout-to-paid order reliability | Custom marketplace coverage; detailed below. |
| Fulfilment and COD settlement handoff | Custom marketplace coverage; detailed below. |

**Disabled (21):** AI observability, anomaly detection, APM, Conversations, CSP violations, data pipelines, data warehouse, Error tracking, Experiments, Feature flags, Inbox validation, Insight alerts, Logs, MCP tool calls, Observability gaps, Replay Vision, Session Replay, Skills store, Surveys, Tasks, and Web vitals. These are disabled because their product surface is not confirmed as a current priority, except Error Tracking and Session Replay: those are deliberately covered by their enabled native responder and Replay Vision scanners respectively. Any can be turned on later from the inbox if the product adopts that surface.

## Custom scouts

| Scout | What it watches | Discriminator | Why it is custom |
|---|---|---|---|
| `signals-scout-checkout-payment-reliability` | Checkout through order placement and verified payment. | Sustained checkout-to-order/paid completion drop or payment-verification failure-rate increase after normal payment delay. | The generic revenue scout does not specifically reconcile the marketplace’s checkout, Razorpay/COD, and verified-payment handoff. Evidence: `apps/web/src/components/storefront/checkout-page-client.tsx` and `apps/api/src/payments/payments.service.ts`. |
| `signals-scout-fulfilment-cod-settlement` | Delivery completion, COD verification, and settlement eligibility. | Aged, sustained increase in handoffs that do not reach their expected next operational state within the learned delay. | The built-in troop does not own this fulfilment-to-finance reconciliation surface. Evidence: `apps/api/src/orders/orders.service.ts` and `apps/api/src/finance/seller-settlements.service.ts`. |

Both were approved and created with daily schedules, emitting enabled. If either becomes noisy, set its `emit` setting to `false` in PostHog to make it dry-run without removing it.

Considered but not added: generic error bursts and replay friction are already routed through native Error Tracking and Replay Vision; support tickets require an inbound Conversations channel; surveys, flags, experiments, AI, logs, CSP, and data-pipeline surfaces are not confirmed in active use.

## Replay Vision scanners
A scanner is an LLM that watches individual session recordings on a schedule and pushes clear defects to the inbox. These are the only items in this setup that consume Replay Vision quota. Their findings arrive at half weight, so independent corroboration is required before promotion into a Self-driving report.

| Brief | Scanner | Status | Scope | Sampling | Estimated spend |
|---|---|---|---|---|---|
| Breakage monitor | Storefront checkout breakage | Created | Recordings whose current URL contains `/checkout`; this is the customer completion flow defined by `apps/web/src/app/(storefront)/checkout/page.tsx` and its checkout client. | 0.5 | 0 observations / 0 credits per month from the current seven-day sample. |
| Frustration monitor | Marketplace checkout frustration | Created | Recordings containing `$rageclick` only; no URL scope was added, preserving independent targeting. | 1.0 | 0 observations / 0 credits per month from the current seven-day sample. |

Replay Vision has 2,500 credits available for the current period, with 0 used and no enabled-scanner projection before this setup. There are no recordings yet, so both scanners are armed and begin working when recording data arrives.

## Follow-ups

- [ ] Connect an inbound Support/Conversations channel (email, inbox, or Slack) in PostHog so ticket findings can arrive.
- [ ] Generate real browser sessions in the storefront; Session Replay is enabled but the recent-recordings probe found none.
- [ ] Optionally connect Sentry, GitHub Issues, Linear, Jira, Zendesk, or another external tool from the project integrations when you want Self-driving to read its open records. No external tool was authorized in this run.
- [ ] Review the first scanner observations and rate them in Replay Vision; ratings produce configuration recommendations for review.

## Files modified or created

| File | Change |
|---|---|
| `posthog-self-driving-report.md` | Created this setup report. |

No application source files or environment files were modified.

## What happens next
The scout coordinator picks up fresh configurations within roughly 30 minutes. Scout runs draw from the verified 100-run daily budget, and findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/617752/inbox), where immediately actionable reports can begin coding tasks.
