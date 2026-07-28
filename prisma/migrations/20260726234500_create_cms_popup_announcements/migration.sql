CREATE TABLE "cms_popup_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "desktop_image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT,
    "image_alt" TEXT NOT NULL,
    "primary_link_url" TEXT,
    "primary_cta_label" TEXT,
    "secondary_link_url" TEXT,
    "secondary_cta_label" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_popup_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cms_popup_announcements_starts_at_idx" ON "cms_popup_announcements"("starts_at");
CREATE INDEX "cms_popup_announcements_ends_at_idx" ON "cms_popup_announcements"("ends_at");
CREATE INDEX "cms_popup_announcements_status_sort_order_idx" ON "cms_popup_announcements"("status", "sort_order");
