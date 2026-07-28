# ADR-006: Financial Ledger and Reconciliation Invariants

## Status
Accepted

## Context
Marketplace payments, commissions, COD, refunds, settlements and payouts require explainable balances and correction history.

## Decision
Financial facts are append-oriented, currency-aware and idempotent. Posted ledger entries are not silently overwritten; corrections use compensating entries. Provider events are deduplicated, money uses integer minor units, and payouts require reconciliation and audit evidence.

## Consequences
Balances are reproducible and auditable. Corrections and reconciliation workflows are more explicit than mutable balance updates and require focused tests and operational review.
