CREATE TABLE "product_delivery_modes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "delivery_mode" "DeliveryMode" NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_delivery_modes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_delivery_modes"
ADD CONSTRAINT "product_delivery_modes_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "product_delivery_modes_product_id_delivery_mode_key"
ON "product_delivery_modes"("product_id", "delivery_mode");

CREATE INDEX "product_delivery_modes_product_id_is_enabled_idx"
ON "product_delivery_modes"("product_id", "is_enabled");

CREATE INDEX "product_delivery_modes_delivery_mode_is_enabled_idx"
ON "product_delivery_modes"("delivery_mode", "is_enabled");

INSERT INTO "product_delivery_modes" ("product_id", "delivery_mode", "is_enabled")
SELECT product.id, modes.delivery_mode::"DeliveryMode", true
FROM "products" product
CROSS JOIN (
  VALUES
    ('STORE_PICKUP'),
    ('LOCAL_DELIVERY_PARTNER'),
    ('THIRD_PARTY_COURIER'),
    ('MANUAL_TRANSPORT')
) AS modes(delivery_mode)
ON CONFLICT ("product_id", "delivery_mode") DO NOTHING;
