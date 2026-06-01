# 1HandIndia Email Notification Tracking

Last updated: 2026-05-28

This document tracks every Phase 1 application email that the 1HandIndia backend sends, where it is triggered, who receives it, and how admins can audit delivery.

## How Email Sending Works

All app-owned transactional emails go through `NotificationsService`.

Flow:

1. A customer, seller, B2B, support, order, or payment service dispatches a fixed app event through `notifications.notifyEvent(...)` or `notifications.notifyAdminEvent(...)`.
2. The backend resolves the matching `EmailTriggerRule` from the predefined event catalog.
3. If the trigger is disabled, missing a published email template, or uses unsupported variables, the backend creates a `SKIPPED` log for traceability.
4. The backend loads the selected published `NotificationTemplate` by the trigger rule.
5. The backend renders `subject` and `body` using the provided variables.
6. The backend applies the selected email theme and any per-template style overrides. Templates without a selected theme use the current published default 1HandIndia theme.
7. The backend wraps the rendered body in email-safe HTML and inlines safe styles before delivery.
8. A `NotificationLog` row is created with recipient, event code, recipient type, trigger rule, template code, status, rendered subject/body HTML, variables, and schedule metadata.
9. Transactional action emails are sent immediately by the API after the action creates the `NotificationLog`; trigger-rule delay values are normalised to `0` and ignored for new action sends.
10. Redis/BullMQ email workers remain as a safety path for any legacy queued jobs, but new order, seller, product, payment, B2B, and support action emails do not wait for a scheduled worker time.
11. If delivery fails, the same log is marked `FAILED` for admin review and explicit retry.
12. Before a provider call, the sender atomically claims the `NotificationLog` row with a temporary delivery lock. Only one API or worker process can claim a pending log.
13. Immediately after provider success, the same locked row is marked `SENT` with `sentAt` and the provider message id. Duplicate jobs see the existing lock/provider id and skip delivery.
14. The worker re-checks the `NotificationLog` row and current email setting before delivery. If sending was disabled after the job was queued, or if the job is older than `EMAIL_QUEUE_SEND_WINDOW_MINUTES` minutes, the log is marked `SKIPPED` instead of sending late.
15. Queue jobs use one delivery attempt and store no provider secret payload. Failed delivery remains visible in logs for an explicit admin retry.
16. Stale delivery locks are failed after `EMAIL_DELIVERY_LOCK_STALE_MINUTES` minutes, so admins can investigate provider logs before retrying.
17. Delivery is handled by `EmailDeliveryService`.
18. Admins manage templates, themes, triggers, settings, overview health, and logs from `/admin/email`.
19. The admin overview reads a single optimized `/api/admin/email/overview` summary instead of making several separate log-list calls for health counts.

Supported delivery providers:

- `brevo`, using the admin-saved Brevo API key.
- `resend`, using the admin-saved Resend API key.
- `sendgrid`, using the admin-saved SendGrid API key.
- `smtp`, using admin-saved SMTP host/port/username/password/TLS settings, or an admin-saved SMTP bridge URL.
- Local dev SMTP logging when no live SMTP host or bridge is configured.

Provider credentials, SMTP host details, sender identity, enable/disable state, and admin alert recipients are managed from `/admin/email` -> Settings. The API stores provider keys and SMTP secrets in `EmailSetting.providerConfig`, returns only masked configured/not-configured flags to the admin UI, and writes audit logs without secret values. Environment variables remain a compatibility fallback for older deployments, but normal admin operation should use the settings form.

Tracked per email:

- recipient email
- channel
- event code
- recipient type
- trigger rule id
- template code
- template category
- rendered subject
- rendered body
- context variables
- status: `PENDING`, `SENT`, `FAILED`, or `SKIPPED`
- provider message id
- error message
- scheduled time
- sent time
- created time
- linked user, when the notification is user-specific

## Admin Tracking Screen

Primary path: `/admin/email`

Compatibility path: `/admin/notifications`

Admins can:

- review email health from the Overview tab
- see provider readiness, immediate-delivery mode, recent sent volume, open issues, missing trigger templates, and last sent/pending timestamps from the Overview tab
- review pending, skipped, and failed delivery states from the Overview tab
- manage transactional templates from the Templates tab
- manage reusable guided email themes from the Themes tab
- map safe app events to templates and enabled/disabled state from the Triggers tab
- manage provider/sender settings from the Settings tab
- filter logs by template, category, event, recipient type, recipient email, and status
- search by recipient email
- see the template code and channel
- see rendered subject and body preview
- see context variables such as order number, payment status, product name, enquiry id, support subject, seller name, and note
- see provider id or failure reason
- retry failed or skipped logs

Database/query optimization:

- `/api/admin/email/logs` returns a lean email-log projection for table and preview use instead of loading full user records.
- Email log indexes are compound for the common admin filters plus newest-first ordering: status, template code, event code, recipient type, trigger rule, channel, and created time.
- Trigger health avoids per-trigger log queries by aggregating recent failure counts and last sent timestamps in grouped database queries.

Retry behavior:

- The retry keeps the same `NotificationLog` row.
- It re-renders the current published template using the original stored variables.
- It applies the selected published theme, or the current default 1HandIndia theme when no published theme is selected.
- It resets the log to `PENDING`, clears provider id/error, and sends/queues again.
- Retries are blocked for logs older than `EMAIL_RETRY_SEND_WINDOW_MINUTES` minutes and for logs skipped while email sending was disabled, so old transactional emails cannot suddenly go out after settings are enabled.
- Pending logs protected by a fresh delivery lock are not retried; stale delivery locks are surfaced for admin investigation before any manual retry.

Theme behavior:

- Theme codes are reusable identifiers and are not used as trigger codes.
- Admins edit guided tokens only: logo URL, colors, button style, footer text, border radius, and safe font choice.
- Template trigger codes and channels remain read-only.
- Per-template overrides can adjust key style values without changing the global theme.
- A standalone `http://` or `https://` line in the rendered body is displayed as a themed email button.

Template category behavior:

- Supported categories are `CUSTOMER`, `SELLER`, `B2B`, `ORDER`, `PAYMENT`, `PRODUCT`, `SUPPORT`, `ADMIN`, and `SYSTEM`.
- Admin-created templates always use channel `EMAIL`.
- New template codes are generated by the backend and remain read-only.
- Admins can edit only safe template fields: name, category, subject, body, status, theme, and style overrides.

Trigger behavior:

- Trigger rules are seeded from the fixed transactional event catalog and are not arbitrary code.
- Admins can enable or disable a trigger and select a template. Transactional trigger delays are disabled so action emails send immediately.
- Enabled trigger rules require a published email template.
- Unknown placeholders are blocked for trigger-enabled templates when those placeholders are not supported by the selected event.
- Draft and archived templates are never used for live sending.

## Event Matrix

| Event code                             | Category   | Default template               | Recipient type   | Trigger                                                                      | Source                                                                                                                                   |
| -------------------------------------- | ---------- | ------------------------------ | ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CUSTOMER_REGISTERED`                  | `CUSTOMER` | `CUSTOMER_ACCOUNT_CREATED`     | Customer         | New customer app user is synced                                              | `apps/api/src/auth/auth-users.service.ts`                                                                                                |
| `SELLER_REGISTRATION_SUBMITTED_SELLER` | `SELLER`   | `SELLER_REGISTRATION_RECEIVED` | Seller           | Seller submits registration                                                  | `apps/api/src/sellers/sellers.service.ts`                                                                                                |
| `SELLER_REGISTRATION_SUBMITTED_ADMIN`  | `SELLER`   | `SELLER_REGISTRATION_RECEIVED` | Admin recipients | Seller submits registration                                                  | `apps/api/src/sellers/sellers.service.ts`                                                                                                |
| `SELLER_APPROVED`                      | `SELLER`   | `SELLER_APPROVED`              | Seller           | Admin approves or reactivates seller                                         | `apps/api/src/admin/sellers/admin-sellers.service.ts`                                                                                    |
| `SELLER_REJECTED`                      | `SELLER`   | `SELLER_REJECTED`              | Seller           | Admin rejects or suspends seller                                             | `apps/api/src/admin/sellers/admin-sellers.service.ts`                                                                                    |
| `PRODUCT_SUBMITTED_SELLER`             | `PRODUCT`  | `PRODUCT_SUBMITTED`            | Seller           | Seller creates or updates a product for approval                             | `apps/api/src/products/products.service.ts`                                                                                              |
| `PRODUCT_SUBMITTED_ADMIN`              | `PRODUCT`  | `PRODUCT_SUBMITTED`            | Admin recipients | Seller creates or updates a product for approval                             | `apps/api/src/products/products.service.ts`                                                                                              |
| `PRODUCT_APPROVED`                     | `PRODUCT`  | `PRODUCT_APPROVED`             | Seller           | Admin approves product                                                       | `apps/api/src/products/products.service.ts`                                                                                              |
| `PRODUCT_REJECTED`                     | `PRODUCT`  | `PRODUCT_REJECTED`             | Seller           | Admin rejects product                                                        | `apps/api/src/products/products.service.ts`                                                                                              |
| `ORDER_PLACED_CUSTOMER`                | `ORDER`    | `ORDER_PLACED_CUSTOMER`        | Customer         | Customer checkout creates an order                                           | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_RECEIVED_SELLER`                | `ORDER`    | `ORDER_RECEIVED_SELLER`        | Seller           | Customer checkout creates an order                                           | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_PLACED_ADMIN`                   | `ORDER`    | `ORDER_ALERT_ADMIN`            | Admin recipients | Customer checkout creates an order                                           | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_CONFIRMED`                      | `ORDER`    | `ORDER_CONFIRMED`              | Customer         | Admin/seller workflow confirms order                                         | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_PROCESSING`                     | `ORDER`    | `ORDER_PROCESSING`             | Customer         | Admin/seller workflow moves order to processing                              | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_DISPATCHED`                     | `ORDER`    | `ORDER_DISPATCHED`             | Customer         | Seller/admin/delivery workflow dispatches or ships order                     | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_DELIVERED`                      | `ORDER`    | `ORDER_DELIVERED`              | Customer         | Seller/admin/delivery workflow marks order delivered                         | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `ORDER_CANCELLED`                      | `ORDER`    | `ORDER_CANCELLED`              | Customer         | Customer/admin cancels order                                                 | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `PAYMENT_PENDING`                      | `PAYMENT`  | `PAYMENT_PENDING`              | Customer         | Payment stays pending or is manually set pending                             | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `PAYMENT_SUCCESS`                      | `PAYMENT`  | `PAYMENT_SUCCESS`              | Customer         | Razorpay verify/webhook or admin COD/offline verification marks payment paid | `apps/api/src/payments/payments.service.ts`, `apps/api/src/orders/orders.service.ts`, `apps/api/src/finance/finance-payments.service.ts` |
| `PAYMENT_FAILED`                       | `PAYMENT`  | `PAYMENT_FAILED`               | Customer         | Razorpay verify/webhook or admin update marks payment failed                 | `apps/api/src/payments/payments.service.ts`, `apps/api/src/orders/orders.service.ts`, `apps/api/src/finance/finance-payments.service.ts` |
| `DELIVERY_ASSIGNED_PARTNER`            | `ORDER`    | `DELIVERY_ASSIGNED_PARTNER`    | Delivery partner | Admin/manual automation assigns a packed order to a delivery partner         | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `DELIVERY_ASSIGNMENT_ACCEPTED_ADMIN`   | `ORDER`    | `DELIVERY_ASSIGNMENT_ACCEPTED_ADMIN` | Admin recipients | Delivery partner accepts an assigned order                                   | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `DELIVERY_ASSIGNMENT_REJECTED_ADMIN`   | `ORDER`    | `DELIVERY_ASSIGNMENT_REJECTED_ADMIN` | Admin recipients | Delivery partner rejects an assigned order and returns it to queue           | `apps/api/src/orders/orders.service.ts`                                                                                                  |
| `DELIVERY_COD_COLLECTED_ADMIN`         | `PAYMENT`  | `DELIVERY_COD_COLLECTED_ADMIN` | Admin recipients | Delivery partner records COD cash collected before admin/finance verification | `apps/api/src/orders/orders.service.ts`                                                                                                 |
| `B2B_ENQUIRY_SUBMITTED_BUYER`          | `B2B`      | `B2B_ENQUIRY_SUBMITTED`        | Business buyer   | Buyer submits B2B enquiry                                                    | `apps/api/src/b2b/b2b.service.ts`                                                                                                        |
| `B2B_ENQUIRY_SUBMITTED_SELLER`         | `B2B`      | `B2B_ENQUIRY_ALERT`            | Seller           | Buyer submits seller-targeted B2B enquiry                                    | `apps/api/src/b2b/b2b.service.ts`                                                                                                        |
| `B2B_ENQUIRY_SUBMITTED_ADMIN`          | `B2B`      | `B2B_ENQUIRY_ALERT`            | Admin recipients | Buyer submits B2B enquiry                                                    | `apps/api/src/b2b/b2b.service.ts`                                                                                                        |
| `B2B_ENQUIRY_RESPONSE_BUYER`           | `B2B`      | `B2B_ENQUIRY_RESPONSE`         | Business buyer   | Seller/admin adds quotation response                                         | `apps/api/src/b2b/b2b.service.ts`                                                                                                        |
| `SUPPORT_REQUEST_RECEIVED`             | `SUPPORT`  | `SUPPORT_REQUEST_RECEIVED`     | Submitter        | Customer/public user submits support request                                 | `apps/api/src/support/support.service.ts`                                                                                                |
| `SUPPORT_REQUEST_ADMIN_ALERT`          | `SUPPORT`  | `SUPPORT_REQUEST_ALERT`        | Admin recipients | Customer/public user submits support request                                 | `apps/api/src/support/support.service.ts`                                                                                                |

## What Is Not App-Tracked

These may still send emails outside the marketplace app, but they do not create `NotificationLog` rows:

- Clerk sign-in, sign-up, password reset, OTP, and account security emails.
- Razorpay provider-side receipts or payment emails.
- Manual emails sent directly by admin staff outside the app.
- Future SMS, WhatsApp, push, marketing, abandoned cart, newsletter, refund automation, and advanced campaign emails.

## Operational Checklist

Before production launch:

1. Enable email settings from `/admin/email` -> Settings.
2. Configure the chosen live provider credentials or SMTP host details from `/admin/email` -> Settings.
3. Configure admin alert recipients in `/admin/email` -> Settings, or keep active admin users available as the fallback.
4. Review or update the default 1HandIndia theme from `/admin/email` -> Themes.
5. Review trigger mappings and immediate-send state from `/admin/email` -> Triggers.
6. Send test emails through real flows: account, seller registration, product submission, checkout, payment success/failure, B2B enquiry, and support.
7. Confirm `/admin/email` -> Logs shows rendered subject/body/context, event code, recipient type, schedule metadata, and provider ids.
8. Confirm `/admin/email` -> Overview shows pending, skipped, and failed counts clearly.
9. Confirm failed/skipped retry works after fixing settings, template status, theme status, or trigger configuration.
10. Keep Clerk and Razorpay provider-side emails documented separately because they are outside the app notification log.
