ALTER TABLE "b2b_orders"
  ADD COLUMN "tax_invoice_number" TEXT,
  ADD COLUMN "tax_invoice_issued_at" TIMESTAMP(3),
  ADD COLUMN "tax_invoice_file_key" TEXT;

CREATE UNIQUE INDEX "b2b_orders_tax_invoice_number_key" ON "b2b_orders"("tax_invoice_number");
