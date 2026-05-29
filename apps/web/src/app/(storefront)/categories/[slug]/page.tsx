import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductListingClient } from "@/components/storefront/product-listing-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, categorySeoData } from "@/lib/seo";

type CategoryProductsPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CategoryProductsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category, seo } = await categorySeoData(slug);
  return metadataFromSeo(seo, {
    title: category ? `${category.name} Products` : "Category Products",
    description: category?.description ?? "Browse category products from verified sellers and nearby stores on 1HandIndia.",
    path: `/categories/${slug}`,
    imageUrl: category?.imageUrl
  });
}

export default async function CategoryProductsPage({ params }: CategoryProductsPageProps) {
  const { slug } = await params;
  const { category } = await categorySeoData(slug);

  return (
    <>
      {category ? (
        <JsonLd
          data={buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Categories", path: "/categories" },
            { name: category.name, path: `/categories/${category.slug}` }
          ])}
        />
      ) : null}
      <ProductListingClient mode="category" categorySlug={slug} />
    </>
  );
}
