import { ContentStatus, prisma } from "@indihub/database";

const imageUrl = "/cms/homepage-local-marketplace-hero.svg";

const bannerData = {
  title: "Discover Local Marketplace",
  subtitle: null,
  eyebrow: "Shop local, save smart",
  imageUrl,
  mobileImageUrl: imageUrl,
  imageAlt: "1HandIndia local marketplace shopping hero with trusted seller products",
  linkUrl: "/categories",
  ctaLabel: "Shop Now",
  secondaryCtaLabel: "Browse Stores",
  secondaryLinkUrl: "/stores",
  textPosition: "LEFT",
  status: ContentStatus.PUBLISHED,
  sortOrder: 1,
};

async function main() {
  const existing = await prisma.banner.findFirst({
    where: { imageUrl },
  });

  const banner = existing
    ? await prisma.banner.update({
        where: { id: existing.id },
        data: bannerData,
      })
    : await prisma.banner.create({
        data: bannerData,
      });

  const publishedCount = await prisma.banner.count({
    where: { status: ContentStatus.PUBLISHED },
  });

  console.log(
    JSON.stringify(
      {
        id: banner.id,
        title: banner.title,
        imageUrl: banner.imageUrl,
        status: banner.status,
        sortOrder: banner.sortOrder,
        publishedCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
