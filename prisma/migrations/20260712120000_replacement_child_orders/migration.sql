-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('STANDARD', 'REPLACEMENT');

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "order_kind" "OrderKind" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "parent_order_id" UUID,
  ADD COLUMN "replacement_return_request_id" UUID;

-- AlterTable
ALTER TABLE "order_items"
  ADD COLUMN "replacement_source_order_item_id" UUID,
  ADD COLUMN "replacement_source_return_item_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "orders_replacement_return_request_id_key"
  ON "orders"("replacement_return_request_id");

-- CreateIndex
CREATE INDEX "orders_order_kind_created_at_idx"
  ON "orders"("order_kind", "created_at");

-- CreateIndex
CREATE INDEX "orders_parent_order_id_idx"
  ON "orders"("parent_order_id");

-- CreateIndex
CREATE INDEX "order_items_replacement_source_order_item_id_idx"
  ON "order_items"("replacement_source_order_item_id");

-- CreateIndex
CREATE INDEX "order_items_replacement_source_return_item_id_idx"
  ON "order_items"("replacement_source_return_item_id");

-- AddForeignKey
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_parent_order_id_fkey"
  FOREIGN KEY ("parent_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_replacement_return_request_id_fkey"
  FOREIGN KEY ("replacement_return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_replacement_source_order_item_id_fkey"
  FOREIGN KEY ("replacement_source_order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_replacement_source_return_item_id_fkey"
  FOREIGN KEY ("replacement_source_return_item_id") REFERENCES "return_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
