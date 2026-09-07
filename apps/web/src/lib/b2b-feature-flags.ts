/**
 * Frontend feature flags for the B2B order-to-cash V2 cutover.
 *
 * `process.env.NEXT_PUBLIC_B2B_ORDER_TO_CASH_V2_ENABLED` is injected at build
 * time via `apps/web/next.config.mjs`, which defaults to the backend
 * `B2B_ORDER_TO_CASH_V2_ENABLED` value when the public override is unset.
 *
 * Because `NEXT_PUBLIC_*` env vars are inlined into the client bundle at build
 * time, changing the flag requires rebuilding the web app to take effect in
 * the browser. Server-rendered code can read the latest value at request time
 * from `process.env.B2B_ORDER_TO_CASH_V2_ENABLED` directly.
 */

export function isB2BV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_B2B_ORDER_TO_CASH_V2_ENABLED === "true";
}
