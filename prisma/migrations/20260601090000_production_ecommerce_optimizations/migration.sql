-- Production ecommerce hardening indexes for 1HandIndia.
-- These indexes target live storefront catalogue reads, large operational lists,
-- product search, and checkout/order reporting paths.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_public_active_created
ON products (created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_products_public_category_created
ON products (category_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_products_public_seller_created
ON products (seller_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_products_search_text_trgm
ON products USING GIN (search_text gin_trgm_ops)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_products_search_vector
ON products USING GIN (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(search_text, '')
  )
)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_sellers_public_approved_store
ON sellers (store_name, id)
WHERE deleted_at IS NULL
  AND status = 'APPROVED'
  AND approval_status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_orders_created_id_desc
ON orders (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_id_desc
ON orders (customer_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_open_fulfilment
ON orders (created_at DESC, id DESC)
WHERE order_status <> 'CANCELLED'
  AND delivery_status <> 'DELIVERED';

CREATE INDEX IF NOT EXISTS idx_order_items_seller_created
ON order_items (seller_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_enquiries_created_id_desc
ON b2b_enquiries (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_business_buyers_status_created_id_desc
ON business_buyers (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_seller_ledger_entries_seller_created_id_desc
ON seller_ledger_entries (seller_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_created_id_desc
ON seller_payouts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_seller_settlement_runs_created_id_desc
ON seller_settlement_runs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_seller_statements_generated_id_desc
ON seller_statements (generated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_payments_updated_id_desc
ON payments (updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_id_desc
ON audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status_created_id
ON notification_logs (status, created_at DESC, id DESC);
