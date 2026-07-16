-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "link_url" TEXT,
    "background_color" TEXT,
    "text_color" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_announcements_starts_at_idx" ON "cms_announcements"("starts_at");

-- CreateIndex
CREATE INDEX "cms_announcements_ends_at_idx" ON "cms_announcements"("ends_at");

-- CreateIndex
CREATE INDEX "cms_announcements_status_sort_order_idx" ON "cms_announcements"("status", "sort_order");
