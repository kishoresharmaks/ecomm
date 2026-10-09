import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductDetailClient } from "@/components/storefront/product-detail-client";
import { buildBreadcrumbJsonLd, buildProductJsonLd, metadataFromSeo, productSeoData, productSeoFallbackDescription, productSeoFallbackTitle } from "@/lib/seo";
import { primaryImage } from "@/lib/storefront-api";

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { product, seo } = await productSeoData(slug);
  if (!product) {
    return {
      title: "Product Not Found | 1HandIndia",
      description: "The requested product is not available on 1HandIndia.",
      robots: { index: false, follow: false },
    };
  }

  return metadataFromSeo(seo, {
    title: productSeoFallbackTitle(product),
    description: productSeoFallbackDescription(product),
    path: `/products/${slug}`,
    imageUrl: primaryImage(product)
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
      <ProductDetailClient slug={slug} initialProduct={product} />
    </>
  );
}
