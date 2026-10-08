---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, design systems, and crafting production-grade marketplace interfaces that avoid generic AI templates.
---

# Frontend Design Skill

This skill enforces intentional, distinctive visual design across 1HandIndia web and mobile frontends, preventing generic "AI slop" and ensuring a polished, enterprise-grade marketplace experience.

## Ground your designs in the subject matter

For **1HandIndia Seller Hub**:
- **Subject**: A high-efficiency, multi-vendor B2B/B2C marketplace seller operations center. Sellers manage real inventory, fulfil customer orders, track payouts, monitor logistics, and review compliance (GST, TDS, TCS).
- **Audience**: Indian merchants, manufacturers, and direct sellers managing daily business operations. They need instant clarity, high information density without clutter, actionable alerts, and absolute transparency in numbers.
- **Primary Job**: Deliver an operational command center where sellers can immediately answer:
  1. *What requires my attention right now?* (New orders to dispatch, low stock items, pending pickups)
  2. *How is my business performing?* (Gross sales, net payouts, orders completed, return rates)
  3. *Where is my money?* (Clear breakdown of Gross Sales, Net Sales after statutory deductions, pending settlements, and wallet payouts)

## Design Principles

1. **Brand Identity & Strict Color Discipline**:
   - Primary Accent: `#ED3500` (1HandIndia signature vermilion orange).
   - Secondary / Surface Tint: `#FFFCFB` (warm white canvas).
   - Enterprise Grays & Slate: Deep slate text `#101828` / `#1E293B`, muted body `#475467` / `#64748B`, light borders `#E4E7EC` / `#E2E8F0`, subtle background panels `#F8FAFC`.
   - Semantic Status Tones: Emerald `#027A48` / `#ECFDF3` for success/paid, Amber `#B54708` / `#FFFAEB` for pending/action required, Rose `#B42318` / `#FEF3F2` for alerts/cancelled, Brand `#ED3500` / `#FFF4F0` for primary highlights.
   - Do NOT introduce unapproved dark modes or random neon colors into large UI surfaces.

2. **Distinct Portal Identity**:
   - Strictly use the distinct, approved seller portal name: **1HandIndia Seller Hub** (never generic marketplace naming alone).
   - Maintain a clear boundary between the B2C customer storefront and the seller partner workspace.

3. **Avoid Generic "AI Slop" Defaults**:
   - Avoid the SaaS-card kit where everything is identical generic rounded boxes with faint gray shadows.
   - Avoid tracked-out ALL CAPS eyebrows on every header (`ORDER DETAILS`, `SUMMARY`). Use natural sentence case with intentional typographic weight.
   - Avoid meaningless decorative gradients or floating shapes that add noise without conveying data.
   - Structural devices (borders, dividers, subtle fills) must encode meaningful relationships and hierarchy.

4. **Information Architecture & Density**:
   - **Hero Operations Band**: Clear welcome header with active seller verification badge, store switch/quick links, and immediate operational pulse.
   - **Executive Metric Grid**: Structured KPI cards with clear primary numbers, secondary context (e.g. Net sales with clear Gross vs Net explanation, order count, pending dispatch count, wallet balance).
   - **Urgent Action / Needs Attention Section**: Directly surfaced pending orders, out-of-stock items, or dispatch alerts so sellers don't have to hunt.
   - **Interactive Performance Analytics**: Clear visual breakdown of revenue, sales trends, and order status splits.
   - **Recent Activity Table**: Tabular order list with rich metadata (Order ID, Date, Buyer destination, Items, Subtotal, Status badge, Quick action button).
   - **Seller Growth & Quick Tools**: Fast links to Add Product, Manage Orders, Request Payout, Download Tax Invoices, and Seller Support.

5. **Financial Transparency & Clarity**:
   - Clearly explain Gross Sales vs Net Sales. When displaying Net Sales, provide transparent micro-copy or helper tooltips showing that Net Sales reflects statutory deductions (1% TDS + 1% TCS) and commission, while Buyer Checkout Platform Fees are strictly paid by customers to the marketplace and not deducted from seller earnings.

6. **Accessibility & Responsive Craft**:
   - High contrast text on all backgrounds.
   - Responsive layouts that fluidly stack on mobile (cards) and expand to dense, readable grids/tables on desktop.
   - Focus states, accessible button roles, and semantic HTML elements.
