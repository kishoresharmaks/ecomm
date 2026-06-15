# 1HandIndia Scope Change - Seller Subscription Plans

**Date:** 2026-05-25  
**Status:** User-approved product addition  
**Area:** Seller onboarding, seller center, admin operations

## Requested Change

Add seller subscription plan management for 1HandIndia sellers.

## Included In This Change

- Admin can create and update seller subscription plans.
- Admin can mark one active plan as the default seller onboarding plan.
- Seller registration shows active plans and preselects the current default plan.
- Seller onboarding stores the selected plan, or the default plan if none is selected.
- Seller center shows the seller's current subscription plan and status.
- Admin seller operations can review a seller's plan and manually change the seller's current plan/status.
- Subscription plan and assignment changes are audit logged.

## Selectable Related Full Implementations

These related areas are not excluded as generic future scope. If selected, each must be implemented as a complete production workflow:

- Online recurring payment collection.
- Payment gateway subscription API integration.
- Automatic billing retries, invoices, or renewal jobs.
- Plan-based hard limits that block product creation or B2B enquiries.

## Implementation Note

Seller subscriptions currently work as an admin-managed operational control. Payment collection can be connected through Razorpay or another provider after the client confirms commercial terms and provider account readiness, and should be implemented end to end when selected.
