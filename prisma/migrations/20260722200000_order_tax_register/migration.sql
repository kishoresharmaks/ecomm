ALTER TYPE "GstReportExportType" ADD VALUE 'ORDER_TAX_REGISTER';

ALTER TABLE "tax_document_lines"
  ADD COLUMN "source_record_type" TEXT,
  ADD COLUMN "source_record_id" UUID;

UPDATE "tax_document_lines"
SET
  "source_record_type" = 'ORDER_ITEM',
  "source_record_id" = "order_item_id"
WHERE "order_item_id" IS NOT NULL;

CREATE INDEX "tax_document_lines_source_record_type_source_record_id_idx"
  ON "tax_document_lines"("source_record_type", "source_record_id");
