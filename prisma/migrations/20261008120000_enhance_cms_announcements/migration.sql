-- AlterTable
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "primary_cta_label" TEXT;
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "secondary_link_url" TEXT;
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "secondary_cta_label" TEXT;
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "target_audience" TEXT NOT NULL DEFAULT 'STOREFRONT';
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "tone" TEXT NOT NULL DEFAULT 'INFO';
ALTER TABLE "cms_announcements" ADD COLUMN IF NOT EXISTS "is_dismissible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cms_announcements_target_audience_status_idx" ON "cms_announcements"("target_audience", "status");
