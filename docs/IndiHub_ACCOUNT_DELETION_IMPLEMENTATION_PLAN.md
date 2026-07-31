# 1HandIndia Account Deletion Implementation Plan

**Document date:** 31-07-2026  
**Status:** Implementation-ready production plan  
**Applies to:** Customer, seller, business buyer, delivery partner, and shared multi-role identities  
**Governance:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`  
**Locked stack:** Turborepo, Next.js App Router, NestJS REST/OpenAPI, PostgreSQL, Prisma, Clerk, PostgreSQL-backed workers, Pino, Vitest/Supertest/Playwright

## 1. Executive Summary

The current account-deletion path is a support-request intake flow, not an account-erasure system. Closing a `SupportRequest` does not revoke access, inspect obligations, cancel provider subscriptions, delete the Clerk identity, remove personal data, clean stored files, or preserve regulated records under controlled retention.

Implement one dedicated, user-level privacy workflow. It must cover every marketplace role attached to the shared `User` identity and execute as a durable, idempotent saga:

1. Accept and verify the request.
2. Evaluate obligations across every assigned role.
3. Require an explicit admin decision.
4. Schedule approved requests for the existing PostgreSQL-backed worker.
5. Disable local access in a PostgreSQL transaction.
6. Revoke Clerk sessions and cancel active provider subscriptions.
7. Delete or anonymize eligible application data.
8. Delete eligible storage objects.
9. Delete the Clerk identity only after mandatory internal cleanup succeeds.
10. Preserve restricted statutory, financial, fraud, legal-hold, and audit records.
11. Send a final completion notice without making email delivery a rollback condition.

A single ACID transaction cannot span PostgreSQL, Clerk, Razorpay, email, and object storage. “Atomic deletion” therefore means **local access is blocked first, every irreversible step is checkpointed, external calls are idempotent, retries resume from the last completed checkpoint, and access is never automatically restored after destructive processing starts**.

## 2. Goals and Non-Goals

### Goals

- Support authenticated and public deletion requests.
- Verify ownership without enabling account enumeration.
- Apply one request to the complete shared platform identity and all roles.
- Prevent approval and processing while obligations or compliance holds remain.
- Disable platform access before external or destructive operations.
- Revoke Clerk sessions, delete Clerk identity, and cancel recurring provider subscriptions.
- Delete, anonymize, archive, or retain every relevant data surface according to an approved policy.
- Preserve relational integrity through a non-login anonymized `User` tombstone.
- Release the original email for clean re-registration after completion.
- Execute asynchronously without Redis and tolerate duplicate delivery, worker restart, and partial external failure.
- Provide clear customer-facing status, admin controls, auditability, metrics, alerts, and an operations runbook.

### Non-goals

- Store closure without deleting the shared user identity.
- B2B company closure while retaining the same user account.
- Delivery-partner deactivation without identity deletion.
- Admin/support/finance/courier-manager self-service deletion.
- A generic privacy workflow engine or configurable rule-language.
- A new Redis/BullMQ dependency.
- Physical deletion of the central `User` row.
- Automatic conversion of historical support tickets.

Store closure, role removal, staff offboarding, and organization ownership transfer remain separate domain operations.

## 3. Current-State Root Cause

The existing implementation models account deletion as an ordinary support topic:

- `apps/mobile-seller/src/features/seller/seller-api.ts` posts a hard-coded seller message to `/support-requests/authenticated`.
- `apps/mobile-seller/app/account-privacy.tsx` keeps only local submitted state and cannot recover persistent request status after restart.
- `apps/web/src/app/(storefront)/account-deletion/page.tsx` links to the generic contact form.
- `apps/web/src/components/cms/contact-page-client.tsx` forces `requesterType = SELLER` for the deletion query even though the public page advertises customer, seller, B2B, and delivery support.
- `apps/api/src/support/support.service.ts` updates ticket status and response fields only.

The support service is working as designed; the domain model is wrong for erasure. Existing support requests must remain historical support records. During rollout, operations may manually link a legacy ticket to a newly created deletion request, but ticket closure must never imply deletion completion.

## 4. Architecture Decision

### Options

| Option | Integrity | Operational clarity | Complexity | Decision |
|---|---:|---:|---:|---|
| Add deletion side effects to `SupportRequest` | Low | Low | Initially low, then fragile | Reject |
| Dedicated privacy module using existing platform services and worker patterns | High | High | Proportionate | **Select** |
| Generic workflow/retention engine with a new queue system | High | Medium | Unnecessary | Reject |

### Selected boundaries

Use a feature-first NestJS module:

```text
apps/api/src/privacy/
  privacy.module.ts
  account-deletion.controller.ts
  public-account-deletion.controller.ts
  admin-account-deletion.controller.ts
  internal-account-deletion.controller.ts
  account-deletion.service.ts
  account-deletion-blocker.service.ts
  account-deletion-processor.service.ts
  account-deletion-data.service.ts
  account-deletion-storage.service.ts
  compliance-hold.service.ts
  dto/
  *.spec.ts
```

Responsibilities:

- **Controllers:** authentication, DTO validation, response mapping, command routing only.
- **AccountDeletionService:** intake, verification, cancellation, review, approval, queries, and transitions.
- **AccountDeletionBlockerService:** read-only cross-domain obligation evaluation.
- **AccountDeletionProcessorService:** saga orchestration and checkpoints.
- **AccountDeletionDataService:** transactional relational cleanup/anonymization.
- **AccountDeletionStorageService:** retention-aware object-key collection and idempotent deletion.
- **ComplianceHoldService:** user-level legal/fraud/regulatory holds.
- **Existing adapters/services:** `ClerkAuthService`, `SellerSubscriptionsService`, `StorageService`, notification infrastructure, `AuditService`, Prisma.

### Runtime ownership

Use the existing `apps/worker` process and PostgreSQL claim pattern. The worker finds `SCHEDULED` or retryable `PROCESSING_FAILED` requests whose `nextAttemptAt` is due, claims one with conditional `updateMany`, then calls a protected internal NestJS command. NestJS owns domain and provider integrations; the worker owns polling, claim recovery, retry timing, and process lifecycle.

This mirrors the existing outbox and internal-API worker patterns and introduces no Redis requirement.

## 5. Product Rules

1. A request applies to the entire shared `User`, not only the role from which it was submitted.
2. Authenticated ownership is accepted only after the platform user has been resolved through the current valid Clerk session and local user mapping.
3. Public requests require verification of the registered email before an account is linked or exposed.
4. Public responses remain generic before and after verification when no eligible account exists.
5. Only one non-terminal request may exist per user.
6. Back-office identities (`ADMIN`, `SUPPORT_STAFF`, `CHAT_SUPPORT`, `FINANCE`, `COURIER_MANAGER`) cannot use marketplace self-service deletion. Operations must first remove or transfer privileged responsibilities through a separate controlled process.
7. Users may cancel only before approval. Admin may cancel before scheduling if no destructive checkpoint has started.
8. Approval requires verified identity, zero hard blockers, no active compliance hold, a policy version, and an explicit admin confirmation.
9. Approval does not run erasure in the HTTP request; it schedules the worker.
10. Local disablement is the authoritative first access barrier. The existing auth guard rejects `UserStatus.DISABLED`, including requests carrying an older Clerk token.
11. Once `accessDisabledAt` is set, processing failure never re-enables access automatically.
12. Every external operation must treat “already absent/cancelled/revoked” as success.
13. The central `User` is retained as a disabled tombstone to preserve actor and commerce relations.
14. The completed tombstone uses a unique synthetic email and has no `clerkUserId`, phone, or name.
15. The original email may create a new account after completion and must never reconnect to the tombstone.
16. Retention is allow-listed. Data is not retained merely because deletion is difficult.
17. Approved retention periods, request SLA, grace period, and customer-facing legal text are launch blockers requiring legal/operations sign-off.

## 6. Lifecycle and Transition Rules

### Status enum

```prisma
enum AccountDeletionRequestStatus {
  REQUESTED
  IDENTITY_VERIFICATION
  IN_REVIEW
  BLOCKED_BY_OBLIGATIONS
  APPROVED
  SCHEDULED
  PROCESSING
  PROCESSING_FAILED
  COMPLETED
  REJECTED
  CANCELLED
}
```

`REQUESTED` is a short-lived intake state used while the request is persisted and the initial verification/receipt notification is staged. Authenticated requests normally transition to `IN_REVIEW` in the creation transaction. Public requests transition to `IDENTITY_VERIFICATION`.

### State diagram

```text
Authenticated: REQUESTED -> IN_REVIEW
Public:        REQUESTED -> IDENTITY_VERIFICATION -> IN_REVIEW

IN_REVIEW <---------------------- BLOCKED_BY_OBLIGATIONS
    |                                      ^
    | approve (zero blockers)              | blocker discovered/recomputed
    v                                      |
 APPROVED -> SCHEDULED -> PROCESSING -------+
                              |
                  +-----------+-----------+
                  |                       |
                  v                       v
               COMPLETED          PROCESSING_FAILED
                                       |
                                       +---- retry -> SCHEDULED

IDENTITY_VERIFICATION / IN_REVIEW / BLOCKED_BY_OBLIGATIONS -> CANCELLED
IN_REVIEW / BLOCKED_BY_OBLIGATIONS -> REJECTED
```

### Transition table

| From | Command/event | To | Required checks |
|---|---|---|---|
| `REQUESTED` | Authenticated intake committed | `IN_REVIEW` | Eligible user, active-request uniqueness. |
| `REQUESTED` | Public intake committed | `IDENTITY_VERIFICATION` | Generic response, token hash and expiry stored. |
| `IDENTITY_VERIFICATION` | Valid token and account match | `IN_REVIEW` | Hash match, expiry, eligible account, no duplicate active user request. |
| `IDENTITY_VERIFICATION` | Expired/no account/invalidated | `REJECTED` internally | External response remains generic. |
| `IN_REVIEW` | Blocker evaluation finds blockers | `BLOCKED_BY_OBLIGATIONS` | Persist sanitized snapshot. |
| `BLOCKED_BY_OBLIGATIONS` | Recheck returns zero blockers | `IN_REVIEW` | Hold also absent. |
| `IN_REVIEW` | Admin approves | `APPROVED` | Verified, zero fresh blockers, policy version, note/confirmation. |
| `APPROVED` | Schedule transaction | `SCHEDULED` | `scheduledAt` set; no long-running work in request. |
| `SCHEDULED` | Conditional worker claim | `PROCESSING` | Due time, claim succeeds exactly once. |
| `PROCESSING` | New obligation before disablement | `BLOCKED_BY_OBLIGATIONS` | Only if `accessDisabledAt` is null. |
| `PROCESSING` | Mandatory step fails | `PROCESSING_FAILED` | Persist safe error and retry time; access remains disabled if already disabled. |
| `PROCESSING_FAILED` | Auto/admin retry | `SCHEDULED` | Retryable or explicit privileged override after cause resolved. |
| `PROCESSING` | All mandatory checkpoints complete | `COMPLETED` | Internal data, storage, provider, Clerk, and finalization checkpoints satisfied. |
| Eligible pre-approval states | User/admin cancel | `CANCELLED` | No approval/destructive checkpoint. |
| Review/blocker state | Admin rejects | `REJECTED` | Required customer-safe reason. |

No generic “set status” endpoint is allowed. Domain commands enforce transitions with conditional writes.

## 7. Persistence Design

### 7.1 Account deletion request

The request row is both the lifecycle record and the durable saga checkpoint. A separate generic job/event table is unnecessary.

```prisma
model AccountDeletionRequest {
  id                         String                       @id @default(uuid()) @db.Uuid
  userId                     String?                      @map("user_id") @db.Uuid
  requestedEmail             String?                      @map("requested_email")
  requestedEmailHash         String                       @map("requested_email_hash")
  requesterType              ChatRequesterType            @map("requester_type")
  source                     AccountDeletionRequestSource
  status                     AccountDeletionRequestStatus @default(REQUESTED)
  reason                     String?

  verificationTokenHash      String?                      @map("verification_token_hash")
  verificationExpiresAt      DateTime?                    @map("verification_expires_at")
  verificationSentAt         DateTime?                    @map("verification_sent_at")
  verificationResendCount    Int                          @default(0) @map("verification_resend_count")
  identityVerifiedAt         DateTime?                    @map("identity_verified_at")

  blockerSnapshot            Json?                        @map("blocker_snapshot")
  blockersCheckedAt          DateTime?                    @map("blockers_checked_at")
  retentionPolicyVersion     String?                      @map("retention_policy_version")
  reviewedById               String?                      @map("reviewed_by_id") @db.Uuid
  reviewedAt                 DateTime?                    @map("reviewed_at")
  decisionNote               String?                      @map("decision_note")
  approvedAt                 DateTime?                    @map("approved_at")
  rejectedAt                 DateTime?                    @map("rejected_at")
  cancelledAt                DateTime?                    @map("cancelled_at")

  scheduledAt                DateTime?                    @map("scheduled_at")
  nextAttemptAt              DateTime?                    @map("next_attempt_at")
  claimedAt                  DateTime?                    @map("claimed_at")
  claimedBy                  String?                      @map("claimed_by")
  attemptCount               Int                          @default(0) @map("attempt_count")
  lastErrorCode              String?                      @map("last_error_code")
  lastErrorMessage           String?                      @map("last_error_message")
  processingStartedAt        DateTime?                    @map("processing_started_at")

  accessDisabledAt           DateTime?                    @map("access_disabled_at")
  clerkSessionsRevokedAt     DateTime?                    @map("clerk_sessions_revoked_at")
  providerSubscriptionsEndedAt DateTime?                  @map("provider_subscriptions_ended_at")
  providerIdentityRefEncrypted String?                     @map("provider_identity_ref_encrypted")
  relationalDataProcessedAt  DateTime?                    @map("relational_data_processed_at")
  storageDeletionManifest    Json?                        @map("storage_deletion_manifest")
  storageCleanedAt           DateTime?                    @map("storage_cleaned_at")
  clerkIdentityDeletedAt     DateTime?                    @map("clerk_identity_deleted_at")
  completionNoticeStagedAt   DateTime?                    @map("completion_notice_staged_at")
  completionNoticeSentAt     DateTime?                    @map("completion_notice_sent_at")
  completedAt                DateTime?                    @map("completed_at")

  createdAt                  DateTime                     @default(now()) @map("created_at")
  updatedAt                  DateTime                     @updatedAt @map("updated_at")

  user                       User?                        @relation(fields: [userId], references: [id], onDelete: Restrict)
  reviewedBy                 User?                        @relation("AccountDeletionReviewedBy", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([status, nextAttemptAt, scheduledAt])
  @@index([requestedEmailHash, status])
  @@index([userId, createdAt])
  @@index([claimedAt])
  @@map("account_deletion_requests")
}
```

The schema snippet is a target contract; relation names must be added to `User` when implementing.

### 7.2 Source enum

```prisma
enum AccountDeletionRequestSource {
  CUSTOMER_WEB
  CUSTOMER_MOBILE
  SELLER_WEB
  SELLER_MOBILE
  B2B_WEB
  DELIVERY_WEB
  DELIVERY_MOBILE
  PUBLIC_WEB
  ADMIN
}
```

### 7.3 Verification-token decision

Keep one active verification hash on the request row. Resend replaces the previous hash and expiry in one transaction. A separate token table adds no current business value because token history is neither needed nor safe to retain. Lifecycle audit records only “verification sent/resend/verified,” never the token or hash.

### 7.4 User-level compliance hold

The schema currently has chat-level `FRAUD_REVIEW` and `LEGAL_HOLD` sensitivity, but no general user-level hold. Add the smallest reusable compliance primitive:

```prisma
enum PrivacyComplianceHoldType {
  LEGAL
  FRAUD_REVIEW
  REGULATORY
  TAX
  PAYMENT_DISPUTE
}

model PrivacyComplianceHold {
  id              String                    @id @default(uuid()) @db.Uuid
  userId          String                    @map("user_id") @db.Uuid
  type            PrivacyComplianceHoldType
  reasonCode      String                    @map("reason_code")
  internalNote    String?                   @map("internal_note")
  active          Boolean                   @default(true)
  expiresAt       DateTime?                 @map("expires_at")
  placedById      String                    @map("placed_by_id") @db.Uuid
  releasedById    String?                   @map("released_by_id") @db.Uuid
  releasedAt      DateTime?                 @map("released_at")
  releaseNote     String?                   @map("release_note")
  createdAt       DateTime                  @default(now()) @map("created_at")
  updatedAt       DateTime                  @updatedAt @map("updated_at")

  @@index([userId, active])
  @@index([active, expiresAt])
  @@map("privacy_compliance_holds")
}
```

Only authorized compliance/admin roles may place or release a hold. An expiry timestamp does not silently release a hold unless policy explicitly permits it; the service computes effective activity and records any release. User responses say only “A compliance review must be completed,” never the hold type or note.

### 7.5 Database constraints

Prisma cannot express the required partial unique indexes directly. Add reviewed SQL in the migration:

```sql
CREATE UNIQUE INDEX account_deletion_one_active_per_user
ON account_deletion_requests (user_id)
WHERE user_id IS NOT NULL
  AND status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED');

CREATE UNIQUE INDEX account_deletion_one_unverified_per_email
ON account_deletion_requests (requested_email_hash)
WHERE user_id IS NULL
  AND status IN ('REQUESTED', 'IDENTITY_VERIFICATION');
```

Also add check constraints where practical:

- `completed_at` is present only with `COMPLETED`.
- `claimed_at` and `claimed_by` are both null or both non-null.
- `attempt_count >= 0`.
- Terminal statuses cannot have an active claim.

Review generated migration SQL and test both forward deployment and rollback in a disposable database.

## 8. API Contract

All endpoints use DTO validation, OpenAPI schemas, consistent error envelopes, request IDs, and typed shared responses. Raw provider errors, internal IDs, and policy notes are never returned to users.

### Authenticated user endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| `POST` | `/api/privacy/account-deletion-requests` | Creates or returns the existing active request for the authenticated shared user. |
| `GET` | `/api/privacy/account-deletion-requests/me` | Returns current/most recent request, sanitized blockers, and allowed actions. |
| `POST` | `/api/privacy/account-deletion-requests/:id/cancel` | Cancels an owned request in an eligible pre-approval state. |

The request body contains only requester context and optional reason; `userId`, email, roles, and verified state are server-derived.

### Public endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| `POST` | `/api/privacy/account-deletion-requests/public` | Accepts email, requester type, name for correspondence, and optional reason; always returns a generic accepted response. |
| `POST` | `/api/privacy/account-deletion-requests/public/resend` | Replaces the active token subject to email-hash/IP throttles. |
| `POST` | `/api/privacy/account-deletion-requests/verify` | Verifies the token and links an eligible account without exposing non-existence. |

Use `node:crypto` for random token generation and SHA-256 hashing. Normalize email using the same canonicalization used by account sync; do not invent provider-specific transformations that could merge distinct addresses.

### Admin endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| `GET` | `/api/admin/privacy/account-deletion-requests` | Paginated list with status/source/type/age filters and restricted search. |
| `GET` | `/api/admin/privacy/account-deletion-requests/:id` | Detail, roles, sanitized lifecycle, blockers, retention summary, and checkpoints. |
| `POST` | `/api/admin/privacy/account-deletion-requests/:id/recheck` | Recomputes blockers and transitions between review/blocked states. |
| `POST` | `/api/admin/privacy/account-deletion-requests/:id/approve` | Approves and schedules after fresh checks. |
| `POST` | `/api/admin/privacy/account-deletion-requests/:id/reject` | Requires a customer-safe reason. |
| `POST` | `/api/admin/privacy/account-deletion-requests/:id/cancel` | Cancels only before destructive processing. |
| `POST` | `/api/admin/privacy/account-deletion-requests/:id/retry` | Schedules a failed request after validation. |
| `POST` | `/api/admin/privacy/compliance-holds` | Places an auditable user hold. |
| `POST` | `/api/admin/privacy/compliance-holds/:id/release` | Releases a hold with reason and audit. |

Approval and retry require reauthentication/confirmation through the existing admin interaction pattern. Do not expose a direct “process now” endpoint to normal admin UI.

### Internal endpoint

`POST /api/internal/privacy/account-deletion/process`

Body:

```json
{ "requestId": "uuid", "claimOwner": "worker-instance-id" }
```

The endpoint verifies the shared internal secret through a centralized internal-auth guard using constant-time comparison, verifies that the caller owns the current non-stale claim, and calls the processor. It returns only a small processing outcome. The API never trusts worker-supplied status or checkpoint values.

## 9. Identity Verification and Abuse Controls

- Generate at least 32 random bytes and send the URL-safe token only in email.
- Store only SHA-256 hash, expiry, send time, and resend count.
- Compare fixed-length hash buffers with `crypto.timingSafeEqual` after validating length.
- Default token TTL: configuration value pending policy approval; suggested operational starting point is 30 minutes.
- Invalidate the old hash on every resend and after successful verification.
- Apply per-IP and per-email-hash request/resend/verification limits using the platform’s existing Redis-optional rate-limit pattern. If Redis is unavailable, the API must remain functional with local in-memory fallback as required by workspace rules.
- Never include email, token, token hash, Clerk ID, phone, or verification URL in logs.
- Public submit and verification return the same customer-facing response whether the account exists, is ineligible, is already deleted, or has a privileged role.
- Notification templates must not identify attached roles before verification.
- Authenticated creation derives ownership from the resolved local `User`, not request body fields.

## 10. Obligation and Blocker Evaluation

`AccountDeletionBlockerService` evaluates the shared user across all roles in one read-only operation. It returns stable blocker codes, count, internal evidence references for admins, and a separate customer-safe label. It does not mutate commerce records.

Recompute:

- after identity verification,
- when admin opens/rechecks the request,
- inside approval immediately before scheduling,
- when the processor starts before local disablement,
- before any admin retry where access has not yet been disabled.

After `accessDisabledAt` is set, a newly discovered retention obligation may pause data cleanup but must not restore login access.

### Blocker matrix

| Domain | Hard blocker examples aligned to current models/statuses | Customer-safe label |
|---|---|---|
| Customer order | `Order.status` not `DELIVERED`/`CANCELLED`; replacement child still active; payment remains `PENDING`; unresolved cancellation workflow. | An order is still being completed. |
| Returns/reverse logistics | `ReturnRequest.status` outside `RESOLVED`/`REJECTED`/`CANCELLED`; return items not closed; `ReverseShipment.status` outside `RECEIVED`/`CANCELLED`; active replacement. | A return or replacement is still open. |
| Refunds | `RefundRequest.status` in `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `INITIATED`, `PROCESSING`, `FAILED`, or `RETRY_PENDING`; provider transaction not terminal. | A refund is still being processed. |
| Seller fulfilment | `OrderSellerSplit.sellerStatus` outside `DELIVERED`/`CANCELLED`; related shipment not `DELIVERED`/`CANCELLED`. | Seller fulfilment is still active. |
| Seller settlement/payout | Split settlement not terminal under finance policy; payout in `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, or `HELD`; unsettled ledger/receivable balance. | Seller earnings or payouts are unresolved. |
| Seller subscription | Subscription `TRIALING`, `ACTIVE`, or `PENDING_PAYMENT`; provider subscription still recurring; pending subscription payment/provider webhook. | A recurring seller plan must be closed. |
| Service booking | `ServiceBooking.status` remains in request, quote, scheduled, progress, completion-submitted, or disputed stages. | A service booking is still active. |
| Service money/dispute | Service payment pending; cash collection not verified/resolved; seller receivable not settled/waived/reversed/offset; dispute unresolved; service refund not terminal. | A service payment or dispute is unresolved. |
| B2B order | `B2BOrder.status` outside `CLOSED`/`FULFILLED`/`CANCELLED`, including delivery dispute, payment overdue, on-hold, or review-required states. | A business order is still open. |
| B2B finance | Payment `PENDING`, `SUBMITTED_FOR_VERIFICATION`, `PARTIALLY_PAID`, or `OVERDUE`; receivable `OPEN`, `PARTIALLY_PAID`, `OVERDUE`, or `DISPUTED`; uncleared payment record. | A business payment is unresolved. |
| B2B operations | Enquiry still negotiating/confirmed; collection task `OPEN`, `PROMISED`, or `ESCALATED`; support case not `RESOLVED`/`CLOSED`/`CANCELLED`; amendment `REQUESTED`; dispute unresolved; reconciliation `EXCEPTION`. | A business account obligation is still open. |
| Delivery assignment | Shipment assigned/accepted and not `DELIVERED`/`CANCELLED`; active reverse pickup assignment. | A delivery assignment is still active. |
| Delivery COD/wallet/payout | COD `COLLECTED` but not `VERIFIED`/resolved; remittance pending/disputed; non-zero wallet/deposit balance; payout `REQUESTED` or `APPROVED`. | Delivery cash or payout reconciliation is pending. |
| Compliance | Active `PrivacyComplianceHold`; fraud/legal-hold chat/evidence; unresolved tax exception or payment dispute. | A compliance review must be completed. |
| Privileged identity | Back-office role or active admin credential requiring controlled offboarding. | This account requires assisted closure. |

During implementation, convert each row into named constants beside the relevant query and unit-test every enum member. Do not infer terminality from string names at runtime.

### Non-blocking cleanup

- carts and cart items,
- wishlists,
- saved addresses that are not statutory snapshots,
- draft/expired checkout sessions,
- push tokens,
- marketing/deal-alert preferences,
- customer notification inbox rows,
- expired verification token data,
- non-retained profile and onboarding files.

### Response contract

```json
{
  "code": "SELLER_PAYOUT_PENDING",
  "label": "Seller earnings or payouts are unresolved.",
  "count": 1
}
```

User endpoints never expose entity IDs, money amounts, legal/fraud details, internal notes, or investigation existence. Admin evidence references remain permission-restricted.

## 11. Retention and Data-Action Matrix

Before production activation, legal/operations must approve a versioned retention schedule. The processor records the version applied to each request. This plan defines technical actions; it does not invent statutory durations.

### Action definitions

- **Delete:** remove the row/object because no required relation or retention purpose remains.
- **Anonymize:** keep relational/business structure but irreversibly remove or replace identity fields.
- **Archive/disable:** retain operational object but prevent use or public exposure.
- **Retain restricted:** retain only for an approved purpose and remove non-required fields.
- **Retain until expiry:** keep under restricted access, then process through a separate retention-expiry cleanup operation.

### Identity and role data

| Models/data | Action | Required handling |
|---|---|---|
| `User` | Anonymize tombstone | `status=DISABLED`; email=`deleted+<request-id>@privacy.invalid`; phone/name null; `clerkUserId` null; roles retained only where actor relations require them and excluded from auth/menu resolution. |
| `Customer` | Anonymize/disable | Clear browsing city/area/pincode; disable deal alerts and marketing; status disabled; remove display/profile PII. |
| `CustomerAddress` | Delete | Delete after blockers clear; issued order/tax snapshots are separate retained records. |
| Customer/seller/delivery push tokens | Delete or revoke then delete | Set disabled/revoked in access transaction; delete token rows during cleanup after notification targeting is stopped. |
| `Wishlist`, items, `Cart`, items | Delete | Cascade in cleanup transaction. |
| `CheckoutSession` | Delete/anonymize | Delete drafts/expired/unused sessions; retain only if linked record integrity requires it and remove transient PII. |
| `Seller`, `SellerProfile`, `SellerAddress` | Archive + anonymize | Disable/suspend seller, unpublish store, clear owner/contact/profile address PII; retain stable seller ID and legally required registered identity only in restricted statutory records. |
| `SellerPayoutProfile` | Delete sensitive credentials where permitted | Clear encrypted account/IFSC/UPI values, hints, legacy plaintext migration fields, holder name, and bank name after payout/retention obligations close. Never copy these values into audit. |
| `BusinessBuyer` | Disable + anonymize | Clear contact name/phone; company/GST identity retained only where required for issued documents or organization records. |
| `BusinessBuyerAddress` | Delete | Preserve only issued B2B/tax document snapshots under retention. |
| `DeliveryPartnerProfile` | Disable + anonymize | `isAvailable=false`; clear phone, vehicle number when not retained, base coordinates, service areas, notes, provider customer/virtual-account contact identifiers when safe. Preserve financial references only where required. |
| `DeliveryPartnerApplication` | Delete/anonymize | Remove contact, address, coordinates, licence number, notes, and rejected/draft documents unless a hold or approved onboarding retention applies. |

### Commerce, finance, and tax

| Models/data | Action | Required handling |
|---|---|---|
| `Order`, `OrderItem`, seller splits, shipments | Retain restricted | Preserve order numbers, values, item/tax facts, lifecycle, settlement, and provider references. Minimize `shippingAddressSnapshot` after fulfilment/retention rules permit; never blindly erase tax-required buyer legal/GST snapshots. |
| Returns, reverse shipments, refund requests/transactions | Retain restricted | Preserve amounts, reasons needed for dispute/accounting, provider references, and lifecycle. Remove free-text/evidence PII when no longer required. |
| `Payment` and provider events | Retain restricted | Keep financial reconciliation identifiers; redact unnecessary provider payload PII and never add raw payloads to deletion audit. |
| Seller payouts, settlements, ledger, receivables | Retain restricted | Preserve accounting/tax facts and anonymized seller reference. Remove payout destination credentials after allowed expiry. |
| Seller subscription/payment/provider events | Cancel + retain restricted | Cancel recurrence; retain invoices/payment facts and minimal provider references; redact provider snapshots according to policy. |
| Service booking/payment/settlement/refund/dispute | Retain restricted | Preserve transaction and tax snapshots. Remove visit notes, coordinates, contact data, completion/evidence files after dispute/legal retention expires. |
| B2B order, invoice, PO, payment, receivable, collection, amendment, dispute, reconciliation | Retain restricted | Preserve organization/transaction/tax records. Remove individual contact data and free-text PII when not required. |
| Tax documents, GST filing/reconciliation, credit notes, marketplace tax records | Retain restricted until statutory expiry | Preserve required legal names, GSTINs, addresses, document numbers, values, and immutable snapshots only for the approved statutory period. Access is restricted and audited. |
| Delivery/COD/wallet/payout records | Retain restricted | Preserve reconciliation and proof facts; remove live location/contact data and expired evidence when permitted. |

### Communications, support, files, and analytics

| Models/data | Action | Required handling |
|---|---|---|
| `SupportRequest` | Anonymize or retain restricted | Existing tickets remain history; remove requester contact/message PII when no active dispute/hold/retention purpose exists. Do not convert ticket status into deletion status. |
| `ChatConversation`, `ChatMessage` | Delete/anonymize/retain by sensitivity | Normal chats can be deleted or anonymized; dispute/fraud/legal-hold conversations remain restricted until release/expiry. Remove attachments independently. |
| `CustomerNotification` | Delete | Delete inbox notifications after access disablement unless a specific record is needed for an active obligation. |
| `NotificationLog` | Redact/delete rendered PII | `recipient`, subject, body, variables, device references, and rendered content are PII. Keep only minimal event/status/provider delivery facts when operational retention applies. |
| Reviews/content authored by user | Anonymize attribution or delete | Apply published-content policy; remove avatar/name/profile link and moderate content containing PII. Do not silently retain identity linkage. |
| `PrivateUpload` and object storage | Delete or retain until expiry | Classify by `uploadKind` and owning domain. Delete object idempotently, then set `deletedAt`. `actorUserId` is polymorphic and may contain `User.id` or `BusinessBuyer.id`; query both relevant identifiers. |
| Public profile/store assets | Delete/unpublish | Remove eligible logos, banners, avatars, and draft documents; retain only evidence under approved hold/retention. |
| Search indexes/caches/exports | Purge/rebuild | Remove searchable personal documents and invalidate cached profile/session data. Expire or delete generated exports containing the user’s PII. Redis absence must not block cleanup. |
| `AuditLog` | Retain immutable/minimized | Keep event code, request ID, actor tombstone/admin ID, timestamps, policy version, and sanitized outcome. Do not retain raw PII, tokens, bank data, storage URLs, or provider payloads. |

### Retention expiry

Account deletion completion may coexist with records retained until a future legal expiry. Such records are restricted and no longer power account access, personalization, or marketing. A later retention-expiry job may be added only when approved durations and affected models are finalized; it is not required to block the initial erasure workflow if the restricted retention state is correctly enforced and documented.

## 12. Distributed Saga and Processing Sequence

### Mandatory ordering

1. Claim and revalidate.
2. Disable local access and communication targeting.
3. Revoke Clerk sessions.
4. Cancel recurring provider subscriptions.
5. Collect retention-classified storage keys and stage the completion recipient.
6. Process relational data and establish the tombstone.
7. Delete eligible storage objects.
8. Delete the Clerk identity.
9. Finalize completion and stage/send notice.

Deleting Clerk first is unsafe because it can strand an active local account or remove the only provider identifier before sessions are revoked. Deleting the identity occurs only after mandatory internal data and storage checkpoints pass.

### Step A: Worker claim

The worker selects requests where:

- `status` is `SCHEDULED`, or `PROCESSING_FAILED` with `nextAttemptAt <= now`,
- `scheduledAt <= now`,
- or `status=PROCESSING` with `claimedAt` older than the stale-claim threshold.

It claims with conditional `updateMany`, sets `PROCESSING`, `claimedAt`, `claimedBy`, increments `attemptCount`, and clears the prior safe error. Exactly one worker proceeds. Use `createPollingGuard()`, `retryDelayMs()`, `safeJobError()`, and graceful shutdown patterns from `apps/worker/src/runtime/job-runtime.ts`.

### Step B: Fresh blocker check

If access is not yet disabled, recompute blockers. A blocker returns the request to `BLOCKED_BY_OBLIGATIONS` and clears the claim. If access is already disabled, a newly discovered retention obligation pauses only the affected cleanup and sends the request to `PROCESSING_FAILED`/manual review; it does not re-enable the account.

### Step C: Local access barrier

In one Prisma transaction:

- set `User.status=DISABLED`,
- disable `Customer` and `BusinessBuyer` status,
- mark seller unavailable/suspended using existing status semantics,
- set delivery partner unavailable and deactivate service areas,
- revoke all customer/seller/delivery push tokens,
- set marketing/deal-alert preferences false,
- revoke unexpected active `AdminSession` rows,
- archive/unpublish seller products and service listings using existing domain operations,
- write `privacy.account_deletion.access_disabled`,
- set `accessDisabledAt`.

The checkpoint update and local disable changes commit together. All methods are idempotent.

### Step D: Clerk session revocation

Extend `ClerkAuthService` rather than constructing a Clerk client in privacy code:

- `revokeUserSessions(clerkUserId)` lists/revokes active sessions or uses the current supported Clerk backend API.
- Missing user/session is success.
- Provider timeout/429/5xx is retryable and mapped to a safe code.
- Authentication/secrets are never logged.
- Set `clerkSessionsRevokedAt` only after success.

Local disabled status remains authoritative if Clerk is unavailable.

### Step E: Provider subscription cancellation

Refactor `SellerSubscriptionsService` to expose an internal idempotent method that accepts seller/request context rather than an authenticated user controller context. It must:

- cancel active Razorpay recurrence immediately under the approved policy,
- treat already cancelled/missing provider subscription as success,
- synchronize local subscription status,
- preserve payment/invoice records under retention,
- avoid duplicate cancellation calls on retry,
- set `providerSubscriptionsEndedAt` only when every applicable role-level recurrence is ended.

Any future recurring provider tied to customer, B2B, or delivery roles must implement the same adapter contract before that product launches.

### Step F: Stage storage and completion data

Before anonymizing live identifiers:

- compute eligible object keys plus retained-until dates/reasons,
- persist only the object key references necessary for retry, not signed URLs,
- stage the verified completion recipient in the existing notification system so the privacy request does not need to retain plaintext email after completion,
- ensure the notification record has a strict short-lived delivery purpose and redaction/expiry path.

If the notification system cannot safely stage the address, send the completion email immediately before final email anonymization and record failure independently. Do not add reversible PII to `AuditLog`.

### Step G: Relational processing

Run one bounded Prisma transaction using set-based `deleteMany`/`updateMany` operations where safe. Do not hold a database transaction open during Clerk, Razorpay, storage, or email calls.

The transaction:

- deletes non-retained child data,
- anonymizes role/profile fields,
- clears payout credentials and transient provider payload PII where permitted,
- disables/archives operational records,
- minimizes retained communications and snapshots according to policy,
- sets the unique synthetic tombstone email,
- nulls `User.clerkUserId`, phone, and name,
- writes a minimized audit event,
- sets `relationalDataProcessedAt`.

Use `deleted+<request-id>@privacy.invalid`; never hash and reuse the original email as a public identifier. Because `User.email` is unique, this releases the original email for re-registration.

### Step H: Storage cleanup

`StorageService` currently lacks a reusable delete-object operation. Add an idempotent adapter:

```ts
removeObject(assetKey: string): Promise<"deleted" | "already_missing">;
```

Implement for configured S3-compatible storage and local-file storage. Validate keys against allowed prefixes and never accept arbitrary filesystem paths from request payloads. For each eligible object:

1. delete or accept already missing,
2. mark matching `PrivateUpload.deletedAt`,
3. clear the owning model’s asset key/reference,
4. retain failure state for remaining keys only.

Do not delete tax, payout, dispute, delivery-proof, fraud, or legal-hold assets before policy expiry.

### Step I: Clerk identity deletion

After relational and required storage cleanup succeeds:

- use an idempotent `ClerkAuthService.deleteUser(clerkUserId)` operation with the provider ID captured before it was nulled locally,
- treat 404/already deleted as success,
- classify timeout/429/5xx as retryable,
- set `clerkIdentityDeletedAt`.

The provider ID may be held in processor memory for the current attempt or in a restricted encrypted checkpoint field if retries require it after local anonymization. Preferred implementation: preserve a restricted `providerIdentityRefEncrypted` on the deletion request until Clerk deletion, then null it immediately. Never put it in audit or logs.

### Step J: Finalization

In a final transaction:

- verify all mandatory checkpoints,
- set `status=COMPLETED`, `completedAt`, and clear claim/retry/error/token fields,
- null/anonymize `requestedEmail`,
- keep `requestedEmailHash` only if policy requires duplicate/abuse control; otherwise replace it with a request-scoped tombstone hash after completion,
- write `privacy.account_deletion.completed` with policy version and checkpoint booleans only.

Send or complete the staged final notice. Notification failure updates `completionNotice` fields/notification status and alerts operations, but does not roll back erasure or change `COMPLETED` to a state that implies account access exists.

## 13. Idempotency, Retry, and Dead-Letter Semantics

- Every step starts with “checkpoint already set => return success.”
- Database writes use conditional state/checkpoint predicates.
- External adapters map already-absent state to success.
- Store safe error code and redacted message only; cap message length.
- Use bounded exponential backoff with jitter through existing worker utilities.
- Suggested defaults pending operations tuning: poll 15 seconds, batch 10, stale claim 15 minutes, base retry 60 seconds, max retry 24 hours, max automatic attempts 8.
- `PROCESSING_FAILED` represents both retryable waiting and exhausted/manual-intervention cases; `nextAttemptAt` distinguishes them. It is included in due polling only when `nextAttemptAt` is non-null and due.
- After max attempts or a non-retryable invariant failure, keep `PROCESSING_FAILED`, clear claim, set `nextAttemptAt = null`, and alert operations.
- Admin retry requires cause acknowledgement and reruns only incomplete checkpoints.
- A crashed worker leaves a stale claim recoverable by another worker.
- Never use in-memory state as the source of truth.
- Never automatically compensate by restoring PII, provider subscriptions, sessions, or account access.

## 14. Audit Integrity

Reuse `AuditService` and `AuditLog`; do not create a duplicate lifecycle-event table.

Standard events:

```text
privacy.account_deletion.requested
privacy.account_deletion.verification_sent
privacy.account_deletion.verified
privacy.account_deletion.blockers_checked
privacy.account_deletion.blocked
privacy.account_deletion.approved
privacy.account_deletion.scheduled
privacy.account_deletion.processing_started
privacy.account_deletion.access_disabled
privacy.account_deletion.clerk_sessions_revoked
privacy.account_deletion.provider_subscriptions_cancelled
privacy.account_deletion.relational_data_processed
privacy.account_deletion.storage_cleaned
privacy.account_deletion.clerk_identity_deleted
privacy.account_deletion.processing_failed
privacy.account_deletion.retry_scheduled
privacy.account_deletion.cancelled
privacy.account_deletion.rejected
privacy.account_deletion.completed
privacy.compliance_hold.placed
privacy.compliance_hold.released
```

Payload rules:

- include request ID, transition, policy version, actor ID, safe blocker codes/counts, checkpoint names, attempt, and correlation/request ID;
- exclude email, phone, name, token/hash, Clerk ID, provider payload, bank/payment credentials, message body, object URL, and raw error;
- actor deletion does not delete audit rows; actor relation points to the tombstone or is set according to existing relation semantics.

“Immutable audit” requires database enforcement, not convention alone. Production database roles used by the application must have `INSERT`/`SELECT` but no ordinary `UPDATE`/`DELETE` privilege on `audit_logs`, or an equivalent trigger must reject mutation except through an audited break-glass maintenance role. Migration, backup, and legal purge procedures remain separately controlled.

## 15. Notifications

Reuse existing email/notification infrastructure and add narrowly scoped event codes:

- `ACCOUNT_DELETION_VERIFICATION`
- `ACCOUNT_DELETION_REQUEST_RECEIVED`
- `ACCOUNT_DELETION_BLOCKED`
- `ACCOUNT_DELETION_APPROVED`
- `ACCOUNT_DELETION_REJECTED`
- `ACCOUNT_DELETION_CANCELLED`
- `ACCOUNT_DELETION_COMPLETED`
- internal `ACCOUNT_DELETION_PROCESSING_FAILED`

Rules:

- never send raw blocker entity IDs, amounts, legal/fraud details, tokens in logs, or internal errors;
- verification links carry the raw token only in the URL delivered to the registered email;
- admin alerts use existing admin notification routing;
- block repeated blocker emails unless the blocker set materially changes or a configured reminder interval passes;
- redaction/expiry of `NotificationLog.recipient`, subject, body, and variables is part of deletion processing;
- final email failure is operationally visible but cannot resurrect or roll back the account.

## 16. User and Admin Interfaces

All new interfaces must use the locked brand palette (`#ED3500`, `#FFFCFB`), accessible confirmation patterns, responsive layouts, and production-facing wording. Do not add an unapproved dark structural theme.

### Public web

Replace the generic contact redirect on `/account-deletion` with a dedicated flow:

- requester type: customer, seller, business buyer, delivery partner;
- email, name for correspondence, optional reason;
- generic submitted state;
- verification-sent, verified, expired-link, resend-throttled, and generic unavailable states;
- no forced seller defaults;
- no account-existence disclosure.

Remove deletion-specific branching from `contact-page-client.tsx`; the contact form remains a support form.

### Customer web and mobile

- Add Account deletion under account privacy/settings.
- Show implications for all attached roles.
- Show persistent status, submitted/verified timestamps, sanitized blockers, next action, and cancellation when allowed.
- Poll status through TanStack Query/mobile API while non-terminal; no WebSocket/SSE is required.

### 1HandIndia Seller Hub web and seller mobile

- Replace `requestSellerAccountDeletion()` support posting with the dedicated endpoint and typed response.
- Replace local-only `submitted` state with server status query.
- Explain open orders, returns, settlements, payouts, recurring plan, and retained tax records.
- Preserve app confirmation UX but update copy from “Support will verify” to the real lifecycle.

### B2B portal

- Add deletion under company/account privacy settings.
- Make clear that the request deletes the shared login identity; organization records and required invoices may remain restricted.
- Block where company ownership must first be transferred or financial obligations remain.

### Delivery portal/mobile

- Add deletion under account/privacy.
- Explain active assignments, COD remittance, wallet balance, and payout blockers.
- Show the same persistent lifecycle and cancellation rules.

### Admin portal

Route: `/admin/privacy/account-deletions`

List:

- status tabs, requester type/source, age/SLA, blocker count, failed checkpoint, retry due time;
- restricted search by request ID and normalized identity fields;
- pagination and export only if export follows authenticated blob-download rules and privacy access auditing.

Detail:

- verified identity and attached roles,
- blocker summary and restricted internal evidence links,
- retention-policy version/summary,
- audit timeline,
- all saga checkpoints and attempts,
- sanitized errors,
- approve/reject/cancel/recheck/retry commands,
- compliance hold summary for authorized roles.

Do not expose a generic status dropdown or allow administrators to mark a request completed manually.

## 17. Configuration

Add centralized, validated configuration with safe defaults where policy permits:

```text
ACCOUNT_DELETION_ENABLED=false
ACCOUNT_DELETION_PUBLIC_INTAKE_ENABLED=false
ACCOUNT_DELETION_VERIFICATION_TTL_MINUTES=<approved>
ACCOUNT_DELETION_VERIFICATION_RESEND_MINUTES=<approved>
ACCOUNT_DELETION_GRACE_PERIOD_HOURS=<approved; 0 if no grace period>
ACCOUNT_DELETION_POLL_INTERVAL_MS=15000
ACCOUNT_DELETION_BATCH_SIZE=10
ACCOUNT_DELETION_STALE_CLAIM_MINUTES=15
ACCOUNT_DELETION_MAX_ATTEMPTS=8
ACCOUNT_DELETION_RETRY_BASE_MS=60000
ACCOUNT_DELETION_RETENTION_POLICY_VERSION=<required when enabled>
INTERNAL_API_SECRET=<existing required secret>
INTERNAL_API_URL=<existing internal API base>
```

Launch must fail closed for processing if enabled but policy version, Clerk credentials, storage configuration, or internal worker authentication is invalid. Public intake can remain disabled independently while admin/API processing is deployed.

## 18. Observability and Operations

### Structured logs

Log at lifecycle boundaries with:

- request ID,
- safe user tombstone/internal ID where permitted,
- status and checkpoint,
- attempt and claim owner,
- duration,
- safe error code and retryable flag,
- request/correlation ID.

Never log PII, tokens, credentials, provider payloads, private object keys in public logs, or message bodies.

### Metrics

- requests created by source/type/status,
- verification success/expiry/resend rate,
- time in verification/review/blocked/scheduled/processing,
- blocker counts by safe code,
- processing success/failure/retry/dead-letter count,
- checkpoint duration and failure rate,
- stale-claim recovery count,
- Clerk/provider/storage failure rate,
- completion-notice failure count,
- requests approaching/breaching policy SLA.

### Alerts

Alert operations when:

- any request reaches maximum attempts,
- processing remains claimed beyond stale threshold repeatedly,
- access is disabled but completion is stalled beyond the approved threshold,
- Clerk deletion/provider cancellation/storage cleanup failure rate exceeds baseline,
- completion notice fails repeatedly,
- request SLA is near breach,
- worker has not completed a successful poll within the health threshold.

### Runbook

Document:

1. How to inspect a request without reading unnecessary PII.
2. How to distinguish blockers from processing failure.
3. How to verify local disablement, Clerk status, subscription status, storage cleanup, and tombstone state.
4. How to resolve each safe error code and schedule retry.
5. Why access must not be manually restored after destructive checkpoints.
6. How to use the audited break-glass path for incorrect legal holds or provider incidents.
7. How to confirm completion-notice delivery separately from erasure completion.
8. How to report SLA and retained-record rationale to the requester.

## 19. Security Requirements

- Boundary validation on every DTO.
- RBAC and ownership checks on every query/command.
- Standalone admin authentication only for admin routes; do not accept Clerk/local-dev marketplace headers for admin decisions.
- Central constant-time internal-secret guard for worker endpoints.
- HTTPS-only verification URLs; no token in analytics/referrer capture.
- Rate limits with required Redis-transparent fallback.
- CSRF protection where cookie-based admin/customer calls require it.
- No raw PII in audit, structured logs, metrics labels, or exception text.
- Storage key prefix validation and no arbitrary local path deletion.
- Provider requests have bounded timeouts and safe retry classification.
- Completion tombstone cannot authenticate or be relinked by Clerk sync.
- Search/index/cache invalidation is required so deleted profile data does not remain discoverable.
- Backups follow the approved retention/deletion policy; deletion from active systems must not imply immediate physical removal from immutable backups, but restoration procedures must reapply tombstones/deletion manifests.
- Audit table mutation is blocked at database privilege/trigger level.
- Compliance hold details are restricted to authorized admin/compliance roles.

## 20. Failure Semantics

| Failure | Required behavior |
|---|---|
| Duplicate authenticated request | Return existing active request idempotently. |
| Duplicate public request | Replace/resend token within throttle policy; generic response. |
| Token expired | Invalidate hash and allow rate-limited resend. |
| No account matches | Terminalize internally; keep external response generic. |
| Obligation appears after approval but before disable | Move to blocked and clear claim. |
| Obligation found after access disable | Keep disabled; pause affected cleanup and require operations review. |
| Two workers/admins race | One conditional claim/transition succeeds; others return conflict/no-op. |
| Worker crashes | Stale claim is recovered and incomplete checkpoints resume. |
| Clerk unavailable | Keep local access disabled; retry; no PII restoration. |
| Clerk user/session already absent | Treat as success. |
| Razorpay subscription already cancelled/missing | Treat as success after local state reconciliation. |
| Relational transaction fails | Roll back that transaction; retain prior external checkpoints; retry safely. |
| Storage partly fails | Persist remaining work, retry only incomplete keys, do not repeat completed deletion. |
| Audit write fails inside required local transaction | Roll back that local transaction/checkpoint. |
| Completion email fails | Keep request completed; retry/alert notification independently. |
| Re-registration uses original email | Create a new user; never attach to tombstone. |
| Non-retryable invariant failure | Stop automatic retry, alert, require audited admin resolution. |

## 21. Implementation Map

### Database/shared packages

- `prisma/schema.prisma`: enums, request model, compliance hold, relations, indexes.
- `prisma/migrations/<timestamp>_account_deletion_workflow/migration.sql`: partial unique/check constraints and audit immutability controls where managed here.
- `packages/database`: regenerate Prisma client and exports.
- Existing shared API/type package: add request status, source, blocker, command, and response contracts; avoid duplicated web/mobile string unions.

### NestJS API

- `apps/api/src/privacy/**`: new feature module and tests.
- `apps/api/src/app.module.ts`: register privacy module.
- `apps/api/src/auth/clerk-auth.service.ts`: idempotent session revocation and identity deletion methods.
- `apps/api/src/auth/guards/auth.guard.ts`: verify tombstoned/disabled semantics remain enforced; no deletion-specific bypass.
- `apps/api/src/sellers/seller-subscriptions.service.ts`: internal idempotent provider cancellation method.
- `apps/api/src/storage/storage.service.ts`: idempotent S3/local delete-object adapter.
- `apps/api/src/audit/audit.service.ts`: standardized privacy event helpers or constants without a second event store.
- Notification template/trigger services: lifecycle templates and safe staging/redaction.
- Shared internal-auth guard: centralize and harden `INTERNAL_API_SECRET` comparison for privacy and existing internal routes where practical.

### Worker

- `apps/worker/src/account-deletion-worker.ts`: PostgreSQL polling, claims, internal API call, retry/dead-letter behavior.
- `apps/worker/src/account-deletion-worker.test.ts`: due selection, duplicate claims, stale recovery, retry and terminal failure.
- `apps/worker/src/index.ts`: start polling and register shutdown.
- Reuse `apps/worker/src/runtime/job-runtime.ts`; do not fork retry/sanitization utilities.

### Web

- `apps/web/src/app/(storefront)/account-deletion/page.tsx`: dedicated public flow.
- `apps/web/src/components/cms/contact-page-client.tsx`: remove forced seller deletion branch.
- `apps/web/src/app/(account)/account/privacy/account-deletion/page.tsx`: customer status/request/cancel flow.
- Seller Hub account settings route/component: dedicated request/status flow with distinct Seller Hub identity.
- B2B account settings route/component: shared identity and company-obligation messaging.
- Delivery account settings route/component: assignment/COD/payout messaging.
- `apps/web/src/app/(admin)/admin/privacy/account-deletions/**`: list/detail/command UI.
- Existing typed API client/hooks: TanStack Query queries/mutations and polling.

### Mobile

- `apps/mobile-seller/src/features/seller/seller-api.ts`: replace support endpoint and response type.
- `apps/mobile-seller/app/account-privacy.tsx`: persistent status, blocker, cancellation, retry-safe UI.
- Equivalent customer and delivery mobile privacy routes/API modules where product navigation exists; create only the required screen files, not a new navigation framework.

### Documentation

- Privacy policy/account deletion public wording.
- Support and operations runbook.
- App Store/Play Store data deletion URL and instructions.
- Environment/deployment configuration.
- Retention matrix with legal approval metadata.

## 22. Testing Strategy

### Unit tests

- all lifecycle transitions and invalid transitions,
- authenticated ownership and privileged-role rejection,
- token generation/hash/expiry/resend/timing-safe comparison,
- enumeration-safe public responses,
- every enum value in blocker classifiers,
- role-combined blocker aggregation,
- compliance hold placement/release/effective activity,
- each data-action function and tombstone values,
- checkpoint idempotency,
- provider error classification and already-missing success,
- audit payload redaction,
- storage key validation.

### API integration/Supertest

- authenticated create/get/cancel,
- public request/verify/resend with identical external responses for match/no-match,
- duplicate concurrency against partial unique indexes,
- admin list/detail/RBAC/approve/reject/recheck/retry,
- internal endpoint secret/claim-owner checks,
- approval race with new obligation,
- disabled user denied by `AuthGuard`,
- completion releases original email and preserves tombstone relations.

### Worker tests

- due scheduling and batch limits,
- conditional claim exactly once,
- stale-claim recovery,
- no overlapping poll,
- transient retry backoff/jitter,
- maximum-attempt/manual-intervention state,
- safe error redaction,
- graceful shutdown.

### Disposable PostgreSQL end-to-end scenarios

1. Customer-only clean deletion.
2. Shared customer + seller with open payout blocker, then resolved and completed.
3. Seller with active Razorpay subscription cancellation.
4. B2B buyer with overdue receivable and later resolution.
5. Delivery partner with active assignment/COD blocker.
6. Public request with valid account.
7. Public request with no account and indistinguishable response.
8. Legal hold prevents approval and release permits review.
9. Clerk failure after local disable and successful retry.
10. Partial storage failure and remaining-key retry.
11. Worker crash after each checkpoint and safe resume.
12. Completion email failure without account restoration.
13. Re-register original email as a completely new identity.
14. Retained orders/tax/payout/audit records remain queryable only by authorized back-office roles.
15. Search/cache/export copies no longer expose deleted profile data.

### UI/Playwright/mobile interaction tests

- public multi-role form and no seller default,
- confirmation, loading, error, empty, blocked, scheduled, processing, completed, rejected, cancelled states,
- cancellation hidden after approval,
- admin cannot approve with blockers/hold,
- admin confirmation and retry behavior,
- seller mobile state survives restart/refetch,
- accessibility: keyboard, focus, labels, error association, contrast, reduced motion,
- responsive behavior across supported viewports.

### Release gates

- Prisma validation/generation and migration test pass.
- API, web, worker, and mobile type checks pass.
- Unit/integration/Playwright suites pass.
- Security and privacy review signs off token, RBAC, audit, storage, provider, and tombstone behavior.
- Legal/operations approves retention version, SLA, grace period, and customer copy.
- Staging test verifies PostgreSQL, Clerk sandbox, Razorpay sandbox, email, object storage, and search/cache cleanup.
- Restore-from-backup drill confirms deletion manifests/tombstones are reapplied.

## 23. Rollout and Legacy Migration

1. Approve retention policy and operational ownership.
2. Deploy schema, API, worker, templates, and admin pages with all public/user intake flags off.
3. Run backfill/inventory report for support tickets whose subject indicates deletion; do not auto-create requests or infer consent.
4. Allow authorized admin to create a dedicated request from a verified legacy ticket, linking the ticket ID only as restricted context.
5. Test full workflow in staging with non-production Clerk/Razorpay/storage accounts.
6. Enable admin-created requests and worker processing for an internal pilot.
7. Enable authenticated customer and Seller Hub entry points.
8. Enable B2B and delivery entry points after role-specific QA.
9. Enable public intake last, with rate limits and monitoring.
10. Remove the old seller support submission and deletion-specific contact query.
11. Monitor SLA, blockers, failures, stale claims, provider/storage errors, and completion notices.
12. Keep rollback limited to disabling new intake/claims. Do not reverse already completed destructive checkpoints.

## 24. Delivery Phases and Effort

| Phase | Scope | Estimate |
|---|---|---:|
| 1. Policy, schema, contracts | Retention approval, models, migrations, shared types, configuration | 14-18h |
| 2. Intake and verification | Auth/public request, token/resend, status/cancel, notifications | 18-24h |
| 3. Blockers and compliance holds | Cross-role evaluators, exact enum tests, hold admin APIs | 24-32h |
| 4. Admin workflow | List/detail/timeline/commands/confirmation/permissions | 18-24h |
| 5. Processor and worker | Claims, saga/checkpoints, retry, internal endpoint, audit | 22-30h |
| 6. Provider/data/storage cleanup | Clerk, Razorpay, relational actions, storage adapter, tombstone | 34-46h |
| 7. User surfaces | Public, customer, Seller Hub, B2B, delivery, mobile | 28-38h |
| 8. Verification and rollout | Unit/integration/E2E, security review, runbook, staged rollout | 28-38h |

**Expected engineering effort:** approximately **186-250 hours**, excluding legal response time and unexpected cleanup discovered by the final PII inventory. A 120-hour estimate is not credible for complete production coverage across four portals, two mobile apps, providers, storage, audit controls, and failure/retry testing.

Parallelization is possible after schema/API contracts stabilize, but blocker evaluation, processor correctness, and data inventory remain the critical path.

## 25. Acceptance Criteria

The feature is complete only when all of the following are true:

- Authenticated and public requests use the dedicated privacy domain, not support tickets.
- Public responses do not reveal account existence.
- One active request per shared user is enforced at database level.
- Shared customer/seller/B2B/delivery roles are evaluated together.
- Every current obligation enum is explicitly classified and tested.
- Active compliance holds prevent approval without exposing sensitive details.
- Approval performs a fresh blocker check and schedules asynchronous work.
- The PostgreSQL worker is duplicate-safe, restart-safe, retry-safe, and Redis-independent.
- Local account access is disabled before external/destructive work.
- Clerk sessions are revoked and the Clerk identity is deleted idempotently.
- Recurring provider subscriptions are cancelled idempotently.
- Push targeting and marketing preferences are disabled immediately.
- Eligible relational PII, communications, files, indexes, caches, and exports are removed or anonymized.
- Statutory records remain restricted, valid, minimized, and tied only to an anonymized tombstone where permitted.
- Audit records are append-only at database permission/trigger level and contain no unnecessary PII.
- The original email can register as a new identity without reconnecting to the tombstone.
- Completion-email failure does not restore access or roll back deletion.
- Customer, Seller Hub, B2B, delivery, public, mobile, and admin surfaces show accurate lifecycle states.
- `/account-deletion` no longer forces seller defaults.
- Legacy support tickets are not silently treated as deletion completion.
- Metrics, alerts, runbook, retention policy, privacy copy, and app-store instructions are deployed.
- All release gates and role-by-role staging scenarios pass.

## 26. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Deleting legally required records | High | Approved versioned allow-list retention matrix and hold checks. |
| Retaining unnecessary PII in JSON/free text/logs | High | Field-level inventory, redaction tests, restricted retention, integration assertions. |
| External success followed by local failure | High | Durable saga checkpoints and idempotent provider adapters. |
| Partial shared-role deletion | High | One user-level request and cross-role cleanup plan. |
| Concurrent approval/worker processing | High | Partial unique indexes, conditional transitions, claim ownership. |
| Account discovery via public form | High | Generic responses, verified email, throttling, no pre-verification role disclosure. |
| Clerk deletion before platform lockout | High | Local disablement first; Clerk session revocation then final identity deletion. |
| Recurring charges after deletion | High | Mandatory provider cancellation checkpoint before completion. |
| Storage deletion removes evidence | High | Retention classification, key allow-list, legal hold, retry manifest. |
| Tombstone relink during re-registration | High | Null Clerk ID, synthetic unique email, auth-sync tests. |
| Email/log rows preserve erased PII | High | Notification redaction/expiry and no raw PII in audit/logs. |
| Worker stalls silently | High | Health metric, stale claim recovery, SLA/dead-letter alerts. |
| Backup restore reintroduces PII | High | Reapply deletion manifest/tombstone during restore procedure. |

## 27. Final Ponytail and Correctness Review

### Ponytail findings

- `delete:` Extending `SupportRequest` with deletion side effects. It conflates support correspondence with an irreversible privacy lifecycle.
- `delete:` Redis/BullMQ or a new queue framework. Existing PostgreSQL polling, claims, retry utilities, and internal API patterns are sufficient.
- `delete:` Separate deletion tables/services per portal. One shared `User` request with role-specific evaluators is smaller and correct.
- `delete:` A second lifecycle event table. `AuditLog` is sufficient when made append-only and PII-minimized.
- `delete:` A generic retention-rule DSL. Use one legally approved, versioned data-action matrix in code and documentation.
- `stdlib:` Use `node:crypto` for random tokens, SHA-256, and timing-safe comparison.
- `native:` Use PostgreSQL partial unique/check indexes and conditional updates rather than application-only locks.
- `shrink:` Keep one active verification hash on the request row; resend replaces it. No token-history table.
- `shrink:` Keep the central `User` as a disabled tombstone rather than attempting cascading physical deletion across `Restrict` and actor relations.
- `yagni:` No real-time socket layer. TanStack Query/mobile polling is sufficient for low-frequency status changes.

`net: -6 speculative subsystems; +1 necessary compliance-hold model; +1 durable request/saga model.`

### Correctness review

- Cross-system “atomicity” is correctly represented as a durable saga, not a false global transaction.
- Local access is disabled before Clerk/provider operations, and destructive failure never restores access.
- Clerk sessions are revoked before final Clerk identity deletion.
- Provider subscriptions are a mandatory checkpoint, preventing post-deletion recurring charges.
- Worker scheduling is production-safe without Redis and reuses current claim/retry practices.
- Public intake is enumeration-safe and token material is not stored raw.
- The data plan distinguishes active-profile erasure from statutory commerce/tax retention.
- Tombstoning preserves relational integrity and allows clean re-registration.
- File cleanup covers both S3-compatible and local storage and recognizes polymorphic `PrivateUpload.actorUserId`.
- Notification rendered content and audit immutability are treated as privacy/security concerns, not incidental logs.
- Completion notification failure is operationally retried without misrepresenting erasure status.

## 28. Immediate Implementation Order

1. Obtain legal/operations approval for retention version, SLA, grace period, and customer copy.
2. Implement schema, partial indexes, compliance holds, shared contracts, and feature flags.
3. Implement intake/verification/status/cancellation and safe notifications.
4. Implement and exhaustively test blocker classifications.
5. Implement admin review/approval/retry and audit timeline.
6. Implement worker claim/retry and internal processing boundary.
7. Implement local disablement, Clerk, provider cancellation, data/tombstone, storage, and finalization checkpoints.
8. Implement public and authenticated portal/mobile surfaces; remove support-form deletion branching.
9. Complete disposable-database, provider-sandbox, security, accessibility, and restore-path verification.
10. Roll out behind flags in the staged order defined above.
