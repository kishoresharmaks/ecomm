import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductListingClient } from "@/components/storefront/product-listing-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, categorySeoData } from "@/lib/seo";

type CategoryProductsPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CategoryProductsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category, seo } = await categorySeoData(slug);
  if (!category) {
    return {
      title: "Category Not Found | 1HandIndia",
      description: "The requested category is not available on 1HandIndia.",
      robots: { index: false, follow: false },
    };
  }

  return metadataFromSeo(seo, {
    title: `${category.name} Products | 1HandIndia`,
    description: category.description || `Browse quality ${category.name} from verified Indian merchants and sellers on 1HandIndia.`,
    path: `/categories/${slug}`,
    imageUrl: category.imageUrl
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
