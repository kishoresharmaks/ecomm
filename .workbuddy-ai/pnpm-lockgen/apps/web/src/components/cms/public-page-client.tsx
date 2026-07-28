"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import {
  StorefrontPageHeader,
  StorefrontPanel,
  StorefrontSection,
  StorefrontSkeleton,
} from "@/components/storefront/storefront-ui";
import { IndihubApiError } from "@/lib/api";
import { getCmsPage } from "@/lib/storefront-api";

export function PublicPageClient({
  slug,
  fallbackTitle,
  fallbackDescription
}: {
  slug: string;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const pageQuery = useQuery({
    queryKey: ["cms-page", slug],
    queryFn: () => getCmsPage(slug),
    retry: false
  });
  const page = pageQuery.data;

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <StorefrontPageHeader
          badge="1HandIndia policy"
          title={page?.title ?? fallbackTitle}
          description={fallbackDescription}
          narrow
        />

        <StorefrontSection narrow>
          {pageQuery.isLoading ? <StorefrontSkeleton className="h-72 bg-white" /> : null}

          {page ? (
            <StorefrontPanel as="article" className="rounded-lg p-6">
              <div className="prose max-w-none">
                {page.content
                  .split(/\n{2,}/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block) => (
                    <p key={block} className="mb-4 text-sm font-semibold leading-7 text-[#4B5563] last:mb-0">
                      {block}
                    </p>
                  ))}
              </div>
              <p className="mt-6 border-t border-[#E5E7EB] pt-4 text-xs font-semibold text-[#667085]">
                Last updated: {page.updatedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(page.updatedAt)) : "Pending"}
              </p>
            </StorefrontPanel>
          ) : null}

          {pageQuery.error ? (
            <StorefrontPanel className="rounded-lg p-6">
              <SectionHeading
                title="Content pending"
                description={pageQuery.error instanceof IndihubApiError ? pageQuery.error.message : "This page content is not published yet."}
              />
              <p className="mt-4 text-sm leading-7 text-[#667085]">
                The CMS route is ready. Final client-approved content can be published from the admin CMS panel when that admin screen is built.
              </p>
              <Button asChild className="mt-5" variant="outline">
                <Link href="/contact">Contact support</Link>
              </Button>
            </StorefrontPanel>
          ) : null}
        </StorefrontSection>
      </main>
    </StorefrontFrame>
  );
}
