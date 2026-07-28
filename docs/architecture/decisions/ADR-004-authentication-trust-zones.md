# ADR-004: Separate Customer and Back-Office Authentication Trust Zones

## Status
Accepted

## Context
Customer/seller/B2B identities use Clerk while administrators require a separately controlled back-office security boundary.

## Decision
Retain Clerk bearer verification for customer, seller, B2B and delivery sessions. Retain database-backed standalone admin credentials/sessions for back-office roles. Admin-only routes never accept Clerk or local-development identity headers.

## Consequences
A compromise in one identity plane does not automatically grant the other. Two authentication paths require separate rotation, audit, tests and incident procedures.
