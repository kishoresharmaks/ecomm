# 1HandIndia Scope Change - Multi-Country Locations and Currency Conversion

Date: 2026-05-24

## Summary

The original scope was India-first with INR as the active platform currency. This note records the approved expansion to prepare 1HandIndia for a small set of overseas markets while keeping INR as the seller and accounting base currency. As of 08-06-2026, selected market/currency features follow the full implementation governance rule.

## Approved Change

- Enable normalized country, state/province, city, and local-area data for India, UAE, United States, United Kingdom, and Singapore.
- Let sellers keep entering product prices in INR.
- Let buyers select a market country and see buyer-facing converted prices.
- Use Frankfurter as the free reference-rate provider.
- Cache FX rates in the backend and store the exact checkout FX snapshot on each order.

## Guardrails

- Seller reports, product pricing, and settlement-facing totals remain INR-first.
- Buyer currency checkout is enabled only for admin-approved markets and payment methods.
- Free FX rates are reference rates, not tick-by-tick forex prices.
- The frontend must read currency data from the 1HandIndia API, not directly from the FX provider.
- Location hierarchy data is database-backed. Full state, city, local-area, and postal-code coverage is imported through controlled backend/CLI import runs rather than hardcoded in frontend components or the Prisma seed file.
