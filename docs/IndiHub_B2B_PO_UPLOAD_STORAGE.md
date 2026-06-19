# 1HandIndia Private Document Storage

## Storage Model

Private seller/KYC documents and B2B purchase order files are stored outside the database. The database stores only portable file keys such as `SellerDocument.fileUrl` and `B2BOrder.purchaseOrderFileKey`.

Private storage mode is selected by `storage.private.provider` or `INDIHUB_PRIVATE_STORAGE_PROVIDER`:

- `AUTO`: use S3 when the private S3 settings are complete; otherwise use local fallback.
- `S3`: use a private S3-compatible bucket with signed upload/download URLs.
- `LOCAL`: receive multipart uploads through the API and store them below `INDIHUB_PRIVATE_UPLOAD_ROOT` or `storage/private`.

Portable keys use this shape:

```text
indihub/sellers/{sellerActorId}/documents/{documentType}-{safeFileName}-{timestamp}-{random8hex}.{ext}
indihub/b2b/purchase-orders/{businessBuyerId}/{orderNumber}/{timestamp}-{safeFileName}.{ext}
```

## Validation And Access

The API validates every seller document and B2B PO upload intent plus every local upload server-side:

- MIME type: PDF, JPG, PNG, or WebP.
- Max size: 10 MB.
- Filename: lowercase ASCII, path separators removed, spaces/special characters collapsed to hyphens, max 80 base-name characters before extension.
- Local upload file bytes must match the declared PDF/JPG/PNG/WebP type.
- Buyer ownership and editable B2B order status.
- Seller document keys are limited to `indihub/sellers/{actorId}/documents/` for seller access; admins may view seller document keys for review.

Final PO submission rechecks buyer ownership and order status. This blocks stale browser tabs after an admin moves the order beyond `PROFORMA_ISSUED` or `PO_SUBMITTED`.

## Seller Document Upload Contract

Seller KYC/private document uploads first call `POST /api/storage/private-document/upload-request` with `documentType`, `fileName`, `contentType`, and required `sizeBytes`.

- S3 mode returns `provider: "s3"`, `method: "PUT"`, a signed `uploadUrl`, `assetKey`, upload headers, max size, allowed content types, and expiry.
- Local mode returns `provider: "local"`, `method: "POST"`, `uploadPath: "/api/storage/private-document/upload"`, max size, and allowed content types.

Local seller document upload uses authenticated multipart form data at `POST /api/storage/private-document/upload` with `documentType` and `file`. The API writes only below the configured private root and returns the portable `assetKey`; seller registration/profile payloads continue storing that key in `SellerDocument.fileUrl`.

## Delivery

Sellers can upload their own private/KYC documents during registration and profile updates. Buyers can view their own PO. Assigned sellers can view, not replace, B2B PO files. Admins can view seller documents and B2B PO files for review.

S3-backed files are opened with signed GET URLs that expire after 5 minutes. Local files stream only through authenticated API routes with `Cache-Control: private, max-age=0, no-store`. Seller/KYC documents are served as attachments with sanitized filenames.

## Replacement And Audit

Buyers may replace a PO only while the order is `PROFORMA_ISSUED` or `PO_SUBMITTED`. Replacement creates a new timestamped key and never overwrites the old file.

B2B order events store the previous key, new key, and `scanStatus: "NOT_SCANNED"` for v1 audit traceability. Malware scanning is intentionally non-blocking in v1; a future scanner can persist queryable scan state in a dedicated table or field.

Uploaded keys older than 24 hours with no linked seller document or B2B order are tracked in `private_uploads` and removed by the worker private-upload cleanup poller. Tune with `PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED`, `PRIVATE_UPLOAD_ORPHAN_RETENTION_HOURS`, `PRIVATE_UPLOAD_CLEANUP_INTERVAL_MS`, and `PRIVATE_UPLOAD_CLEANUP_BATCH_SIZE`.

## Local Backup Guidance

For VPS/local fallback mode, back up `INDIHUB_PRIVATE_UPLOAD_ROOT` and the PostgreSQL database together. A safe baseline is a daily volume snapshot or `rsync` job for the private upload root plus a matching database backup. Restore the DB and private files from the same backup window so stored keys and files remain consistent.
