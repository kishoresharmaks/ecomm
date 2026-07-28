ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_SELLER_XLSX';
ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_ALL_SELLERS_ZIP';
ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_PLATFORM_XLSX';

ALTER TABLE "marketplace_tax_documents"
  ADD COLUMN "gstr_supply_section_snapshot" "GstrSupplySection",
  ADD COLUMN "tax_lines_snapshot" JSONB;
