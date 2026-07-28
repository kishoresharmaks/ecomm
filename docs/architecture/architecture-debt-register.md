# Architecture Debt Register

The machine baseline in `../../config/architecture-boundaries.json` records current prohibited context-edge counts. This register explains the highest-risk exceptions. Counts cannot grow. Removal of an import requires tightening the baseline in the same change.

| ID | Area | Current exception | Risk | Owner | Removal condition | Review |
|---|---|---|---|---|---|---|
| AD-001 | Orders / Payments / Returns / Finance | Direct Nest module and service imports coordinate commerce transactions | Cycles, broad blast radius, difficult isolated tests | Commerce + Finance | Introduce narrow application contracts and publish durable completion events | Monthly |
| AD-002 | Shopping orchestration | Cart/checkout/storefront import several business contexts | Composition logic can leak into domain modules | Storefront | Move orchestration behind checkout application ports and immutable quote DTOs | Monthly |
| AD-003 | B2B | B2B module depends directly on identity, seller, finance, storage, tax and communications internals | Large context and unstable contracts | B2B | Export explicit buyer, seller eligibility, payment and tax ports | Monthly |
| AD-004 | Shared Prisma client | One global Prisma client gives every context technical write access | Ownership is documented but not database-enforced | Architecture | Add owned repositories/commands for high-risk models and static write checks | Quarterly |
| AD-005 | Worker data access | Worker jobs use the shared database package across contexts | Background process can bypass application invariants | Platform | Adopt owned job handlers and outbox event contracts per workload | Monthly |
| AD-006 | In-memory API rate limiting | Limits are process-local | Limits multiply with API replicas | Platform/Security | Enforce global limits at WAF/edge or shared Redis with fallback semantics | Before multi-replica launch |
| AD-007 | Single runtime composition | All API contexts share one failure and deployment unit | Operational isolation is limited | Platform | First deploy multiple stateless replicas; extract only with ADR-010 triggers | Quarterly |

## Exception process

A new exception is not added by editing only the JSON baseline. The pull request must:

1. Explain the business constraint and rejected alternatives.
2. Add an owner and removal condition here.
3. Include tests that constrain the exception.
4. Obtain architecture review.
5. Set a review date or measurable trigger.

Permanent exceptions should be converted into an explicit allowed dependency with an ADR rather than living indefinitely as anonymous debt.
