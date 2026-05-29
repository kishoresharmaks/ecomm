import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductDetailClient } from "@/components/storefront/product-detail-client";
import { buildBreadcrumbJsonLd, buildProductJsonLd, metadataFromSeo, productSeoData, productSeoFallbackDescription, productSeoFallbackTitle } from "@/lib/seo";

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { product, seo } = await productSeoData(slug);
  return metadataFromSeo(seo, {
    title: product ? productSeoFallbackTitle(product) : "Product Details",
    description: product ? productSeoFallbackDescription(product) : "View product price, availability, seller information, and delivery options on 1HandIndia.",
    path: `/products/${slug}`,
    imageUrl: product?.images?.[0]?.url
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const { product } = await productSeoData(slug);

  return (
    <>
      {product ? (
        <JsonLd
          data={[
            buildProductJsonLd(product),
            buildBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: product.category.name, path: `/categories/${product.category.slug}` },
              { name: product.name, path: `/products/${product.slug}` }
            ])
          ]}
        />
      ) : null}
      <ProductDetailClient slug={slug} />
    </>
  );
}
