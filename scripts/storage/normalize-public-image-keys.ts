import { Prisma, SettingValueType, prisma } from "@indihub/database";

type NormalizeResult = {
  value: string;
  cloudName: string;
} | null;

type Stats = {
  scanned: number;
  changed: number;
};

const stats: Record<string, Stats> = {};
const detectedClouds = new Set<string>();

async function main() {
  const apply = process.argv.includes("--apply");

  await normalizeSellerProfiles(apply);
  await normalizeCategories(apply);
  await normalizeProductImages(apply);
  await normalizeBanners(apply);
  await normalizeCmsMediaAssets(apply);
  await normalizeSeoEntries(apply);
  await normalizeHomepageSections(apply);
  await ensurePublicImageSettings(apply);

  console.log(`${apply ? "Applied" : "Dry run"} public image key normalization.`);
  for (const [label, item] of Object.entries(stats)) {
    console.log(`${label}: scanned=${item.scanned} changed=${item.changed}`);
  }

  if (!apply) {
    console.log("Run with --apply to write these changes.");
  }
}

async function normalizeSellerProfiles(apply: boolean) {
  const rows = await prisma.sellerProfile.findMany({
    select: { id: true, logoUrl: true, bannerUrl: true }
  });

  for (const row of rows) {
    count("sellerProfile");
    const logoUrl = normalizeCloudinaryUrl(row.logoUrl);
    const bannerUrl = normalizeCloudinaryUrl(row.bannerUrl);
    const data: { logoUrl?: string; bannerUrl?: string } = {};

    if (logoUrl) {
      data.logoUrl = logoUrl.value;
    }
    if (bannerUrl) {
      data.bannerUrl = bannerUrl.value;
    }

    if (Object.keys(data).length) {
      change("sellerProfile");
      if (apply) {
        await prisma.sellerProfile.update({ where: { id: row.id }, data });
      }
    }
  }
}

async function normalizeCategories(apply: boolean) {
  const rows = await prisma.category.findMany({
    select: { id: true, imageUrl: true }
  });

  for (const row of rows) {
    count("category");
    const imageUrl = normalizeCloudinaryUrl(row.imageUrl);
    if (imageUrl) {
      change("category");
      if (apply) {
        await prisma.category.update({ where: { id: row.id }, data: { imageUrl: imageUrl.value } });
      }
    }
  }
}

async function normalizeProductImages(apply: boolean) {
  const rows = await prisma.productImage.findMany({
    select: { id: true, url: true }
  });

  for (const row of rows) {
    count("productImage");
    const url = normalizeCloudinaryUrl(row.url);
    if (url) {
      change("productImage");
      if (apply) {
        await prisma.productImage.update({ where: { id: row.id }, data: { url: url.value } });
      }
    }
  }
}

async function normalizeBanners(apply: boolean) {
  const rows = await prisma.banner.findMany({
    select: { id: true, imageUrl: true }
  });

  for (const row of rows) {
    count("banner");
    const imageUrl = normalizeCloudinaryUrl(row.imageUrl);
    if (imageUrl) {
      change("banner");
      if (apply) {
        await prisma.banner.update({ where: { id: row.id }, data: { imageUrl: imageUrl.value } });
      }
    }
  }
}

async function normalizeCmsMediaAssets(apply: boolean) {
  const rows = await prisma.cmsMediaAsset.findMany({
    select: { id: true, url: true, publicId: true }
  });

  for (const row of rows) {
    count("cmsMediaAsset");
    const url = normalizeCloudinaryUrl(row.url);
    if (url) {
      change("cmsMediaAsset");
      if (apply) {
        await prisma.cmsMediaAsset.update({
          where: { id: row.id },
          data: {
            url: url.value,
            publicId: row.publicId ?? url.value
          }
        });
      }
    }
  }
}

async function normalizeSeoEntries(apply: boolean) {
  const rows = await prisma.seoEntry.findMany({
    select: { id: true, ogImageUrl: true, twitterImageUrl: true }
  });

  for (const row of rows) {
    count("seoEntry");
    const ogImageUrl = normalizeCloudinaryUrl(row.ogImageUrl);
    const twitterImageUrl = normalizeCloudinaryUrl(row.twitterImageUrl);
    const data: { ogImageUrl?: string; twitterImageUrl?: string } = {};

    if (ogImageUrl) {
      data.ogImageUrl = ogImageUrl.value;
    }
    if (twitterImageUrl) {
      data.twitterImageUrl = twitterImageUrl.value;
    }

    if (Object.keys(data).length) {
      change("seoEntry");
      if (apply) {
        await prisma.seoEntry.update({ where: { id: row.id }, data });
      }
    }
  }
}

async function normalizeHomepageSections(apply: boolean) {
  const rows = await prisma.homepageSection.findMany({
    select: { id: true, config: true }
  });

  for (const row of rows) {
    count("homepageSection");
    const normalized = normalizeJson(row.config);
    if (normalized.changed) {
      change("homepageSection");
      if (apply) {
        await prisma.homepageSection.update({
          where: { id: row.id },
          data: { config: normalized.value as Prisma.InputJsonValue }
        });
      }
    }
  }
}

async function ensurePublicImageSettings(apply: boolean) {
  const cloudName = [...detectedClouds][0];
  if (!cloudName) {
    return;
  }

  const baseUrl = `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload`;
  const [baseSetting, providerSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "storage.public_images.base_url" } }),
    prisma.setting.findUnique({ where: { key: "storage.public_images.provider" } })
  ]);

  if (!baseSetting?.value) {
    change("setting");
    if (apply) {
      await prisma.setting.upsert({
        where: { key: "storage.public_images.base_url" },
        update: { value: baseUrl, valueType: SettingValueType.STRING, group: "storage" },
        create: {
          key: "storage.public_images.base_url",
          value: baseUrl,
          valueType: SettingValueType.STRING,
          group: "storage"
        }
      });
    }
  }

  if (!providerSetting?.value) {
    change("setting");
    if (apply) {
      await prisma.setting.upsert({
        where: { key: "storage.public_images.provider" },
        update: { value: "CLOUDINARY", valueType: SettingValueType.STRING, group: "storage" },
        create: {
          key: "storage.public_images.provider",
          value: "CLOUDINARY",
          valueType: SettingValueType.STRING,
          group: "storage"
        }
      });
    }
  }
}

function normalizeJson(value: Prisma.JsonValue): { value: Prisma.JsonValue; changed: boolean } {
  if (typeof value === "string") {
    const normalized = normalizeCloudinaryUrl(value);
    return normalized ? { value: normalized.value, changed: true } : { value, changed: false };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const normalized = normalizeJson(item);
      changed ||= normalized.changed;
      return normalized.value;
    });

    return { value: next, changed };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, Prisma.JsonValue> = {};

    for (const [key, item] of Object.entries(value)) {
      const normalized = normalizeJson(item as Prisma.JsonValue);
      changed ||= normalized.changed;
      next[key] = normalized.value;
    }

    return { value: next, changed };
  }

  return { value, changed: false };
}

function normalizeCloudinaryUrl(value: string | null | undefined): NormalizeResult {
  if (!value) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[1] !== "image" || parts[2] !== "upload") {
    return null;
  }

  const cloudName = parts[0];
  const uploadParts = parts.slice(3);
  const versionIndex = uploadParts.findIndex((part) => /^v\d+$/i.test(part));
  const keyParts = versionIndex >= 0 ? uploadParts.slice(versionIndex + 1) : uploadParts;
  const key = keyParts.map((part) => decodeURIComponent(part)).join("/");

  if (!cloudName || !key || key.includes("..") || key.includes("://")) {
    return null;
  }

  detectedClouds.add(cloudName);
  return { value: key, cloudName };
}

function count(label: string) {
  stats[label] ??= { scanned: 0, changed: 0 };
  stats[label].scanned += 1;
}

function change(label: string) {
  stats[label] ??= { scanned: 0, changed: 0 };
  stats[label].changed += 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
