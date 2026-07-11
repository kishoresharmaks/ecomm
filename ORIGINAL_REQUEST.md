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

## Follow-up — 2026-07-11T08:40:53Z

Implement Distance-Based Shipping Pricing in the Admin Portal and integrate Google Maps API for driving distance calculation in the backend routing service.

Working directory: e:\PROJECT WORKS\Clients\ecomm
Integrity mode: benchmark

## Requirements

### R1. Admin UI for Distance Pricing
Add a 'Pricing Strategy' dropdown to the admin rate card form (`admin-operations.tsx`) that allows toggling between 'FLAT' and 'DISTANCE'. When 'DISTANCE' is selected, display fields for 'Included Distance (km)' and 'Per extra km fee (₹)'.

### R2. Google Maps API Integration
Implement backend routing logic in `delivery-routing.service.ts` to calculate the driving distance between the seller's pickup location and the customer's delivery address using the Google Maps Distance Matrix API (the API key is already managed in admin settings).

### R3. Fallback Mechanism
If the Google Maps API fails to calculate a route (e.g. invalid key, no driving route found, or network error), the system must fallback to treating the route distance as 0 km, effectively charging only the flat base charge.

## Acceptance Criteria

### Unit Testing
- [ ] A programmatic backend unit test is added that calls the routing service with mocked coordinates and verifies the distance math (e.g. base fee + extra distance calculation).

### UI Functionality
- [ ] The Admin rate card form successfully saves the `pricingType` ("DISTANCE") and `pricingConfig` JSON object when distance pricing is selected.
- [ ] The form successfully reloads and displays the saved distance configuration when editing an existing distance-based rate card.

### Distance Integration
- [ ] The backend calls the Google Maps Distance Matrix API and extracts the route distance correctly.
- [ ] Errors from the Google Maps API are caught gracefully without crashing the checkout process, falling back to a 0km route distance.
