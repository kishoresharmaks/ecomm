# Image Upload Reference

Last verified: 2026-07-02
Scope: current web app upload surfaces under `apps/web`

This document lists the user-facing image upload fields in the web app, the supported file types, file size limits, and the expected ratios or dimension guidance from the current codebase.

## Shared public image rules

The shared public image uploader currently allows these MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

The shared file-size limit for public image uploads is `5 MB`.

Only seller/product images currently run a hard dimension check in the browser. Other public image uploads rely on the shared file-type and size validation plus the visual aspect ratio shown in the UI.

## Main image upload surfaces

| Area | Page / field | Supported types | Max size | Ratio / dimensions | Notes |
|---|---|---:|---:|---|---|
| Seller profile | Store logo | JPG, PNG, WebP, GIF | 5 MB | Square, `1:1` | Used on store cards, product seller details, and the public store page. |
| Seller profile | Store banner | JPG, PNG, WebP, GIF | 5 MB | Wide banner, `5:2` | Used on the public store profile. The UI expects a wide storefront-style image. |
| Seller services | Service cover image | JPG, PNG, WebP, GIF | 5 MB | `4:3` | Shown on service cards, store pages, and service detail pages. |
| Seller products | Product gallery images | JPG, PNG, WebP, GIF | 5 MB | Recommended `4:3`; best fit `1200 x 900 px` | Browser validation expects at least `400 x 300 px`, at most `2000 x 1500 px`, and warns when the aspect ratio drifts far from `4:3`. Up to 10 images can be uploaded per product. |
| Admin CMS / homepage banners | Desktop hero image | JPG, PNG, WebP, GIF | 5 MB | `16:9` | Used for desktop and tablet hero/banner content. The form also supports a separate mobile image URL field, but this upload control is the desktop banner asset. |
| Admin CMS / homepage banners | Mobile hero image | JPG, PNG, WebP, GIF | 5 MB | `4:5` | Optional portrait crop for phones. Desktop image is used when this is empty. |
| Admin categories | Category image | JPG, PNG, WebP, GIF | 5 MB | `5:3` | Shown on category cards and public category SEO previews. |
| Admin push campaigns | Campaign image asset | JPG, PNG, WebP | 5 MB | No fixed ratio enforced; max edge `4096 px` | File extension must match JPG, PNG, or WebP. The UI checks width and height and rejects images larger than `4096 px` on either edge. |

## Image-capable uploads that are not image-only

These fields accept images, but they are document uploads rather than dedicated image upload surfaces.

| Area | Page / field | Supported types | Max size | Ratio / dimensions | Notes |
|---|---|---:|---:|---|---|
| Seller verification | Verification documents | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Private seller document upload. |
| Seller services | Field proof files | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Used for service field-status evidence. |
| Seller services | Completion proof files | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Used when submitting service completion proof. |
| Customer account | Service booking dispute evidence | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Used when a customer raises a service dispute. |
| B2B orders | Purchase order upload | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Buyer purchase-order file upload. |
| B2B orders | Payment proof upload | PDF, JPG, PNG, WebP | 10 MB | No fixed ratio | Buyer payment-proof file upload. |

## Quick notes

- If you are preparing assets for seller or product imagery, treat `4:3` as the safest default.
- If you are preparing store branding, use a square logo and a wide banner.
- If you are preparing admin campaign assets, keep the image under `5 MB` and within `4096 px` on both edges.
- For mixed document uploads, image files are allowed, but the UX and backend treat them as documents rather than design assets.

## Source areas checked

- `apps/web/src/lib/public-image-upload.ts`
- `apps/web/src/components/seller/seller-profile-client.tsx`
- `apps/web/src/components/seller/seller-products-client.tsx`
- `apps/web/src/components/seller/seller-services-client.tsx`
- `apps/web/src/components/admin/admin-operations.tsx`
- `apps/web/src/components/admin/admin-push-campaigns-client.tsx`
- `apps/web/src/lib/push-campaigns-api.ts`
- `apps/web/src/lib/seller-document-upload.ts`
- `apps/web/src/lib/b2b-po-documents.ts`
- `apps/web/src/components/account/service-bookings-client.tsx`
