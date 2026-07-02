# Original User Request

## 2026-07-02T15:53:29Z

# Teamwork Project Prompt — Draft

Ensure the service booking payment flow handles partial manual payments correctly, such that any remaining balance due is accurately updated and subsequent online Razorpay orders reflect the correct remaining amount.

Working directory: e:\PROJECT WORKS\Clients\ecomm
Integrity mode: development

## Requirements

### R1. Handle partial manual payments
The payment flow must correctly handle edge cases where the seller manually records a partial cash collection against an advance amount (e.g., ₹100 cash paid for a ₹200 advance on a total service of ₹600). 

### R2. Accurately update balance and online orders
The system must correctly calculate the remaining balance due. Subsequent online Razorpay orders must reflect the exact newly calculated remaining balance due, rather than using stale amounts. The agent team can decide the exact implementation approach for handling obsolete pending Razorpay payments and generating new correct orders.

## Acceptance Criteria

### Verification Tests
- [ ] Programmatic unit/integration tests are written for the NestJS backend API.
- [ ] The tests simulate a scenario with a total service amount of ₹600 and an advance amount of ₹200.
- [ ] The tests simulate a manual cash payment of ₹100.
- [ ] The tests assert that the remaining balance due is exactly ₹500.
- [ ] The tests assert that a new online Razorpay payment intent/order can be created for the exact remaining balance.
