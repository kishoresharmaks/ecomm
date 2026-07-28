export type PersonalizedRankableProduct = {
  id?: string | null;
  slug?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  sellerSlug?: string | null;
  viewedAt?: string | null;
};

type PersonalizedRailInput<T extends PersonalizedRankableProduct> = {
  buyAgainProducts: T[];
  cartProducts: T[];
  now?: Date;
  recentlyViewedProducts: T[];
  recommendedProducts: T[];
};

export type PersonalizedRailResult<T extends PersonalizedRankableProduct> = {
  buyAgainProducts: T[];
  continueProducts: T[];
  recentlyViewedProducts: T[];
  recommendedProducts: T[];
};

// Seller and category caps match intentionally: repeat seller purchases are as strong as category preference.
const categoryAffinityCap = 12;
const sellerAffinityCap = 12;
const minRecommendedProducts = 2;

export function composePersonalizedHomeRails<T extends PersonalizedRankableProduct>({
  buyAgainProducts,
  cartProducts,
  now = new Date(),
  recentlyViewedProducts,
  recommendedProducts,
}: PersonalizedRailInput<T>): PersonalizedRailResult<T> {
  // Keep home rails distinct: cart > buy again > recent > recommended
  const continueProducts = uniqueRankableProducts(cartProducts);
  const blockedByCart = productIdentitySet(continueProducts);
  // Deduplicate by product identity and keep the latest ordered occurrence.
  const filteredBuyAgainProducts = excludeProducts(uniqueRankableProducts(buyAgainProducts), blockedByCart);
  const blockedByOrders = productIdentitySet([...continueProducts, ...filteredBuyAgainProducts]);
  const filteredRecentlyViewedProducts = excludeProducts(uniqueRankableProducts(recentlyViewedProducts), blockedByOrders);
  const blockedByPersonalized = productIdentitySet([
    ...continueProducts,
    ...filteredBuyAgainProducts,
    ...filteredRecentlyViewedProducts,
  ]);
  const filteredRecommendedProducts = excludeProducts(uniqueRankableProducts(recommendedProducts), blockedByPersonalized);
  const rankedRecommendedProducts = rankRecommendedProducts(filteredRecommendedProducts, {
    buyAgainProducts,
    cartProducts: continueProducts,
    now,
    recentlyViewedProducts: filteredRecentlyViewedProducts,
  });

  return {
    continueProducts,
    buyAgainProducts: filteredBuyAgainProducts,
    recentlyViewedProducts: filteredRecentlyViewedProducts,
    recommendedProducts:
      rankedRecommendedProducts.length >= minRecommendedProducts ? rankedRecommendedProducts : [],
  };
}

export function productIdentity(product: PersonalizedRankableProduct) {
  return normalizeKey(product.id) || normalizeKey(product.slug);
}

export function excludeProducts<T extends PersonalizedRankableProduct>(products: T[], blockedIds: Set<string>) {
  return products.filter((product) => {
    const identity = productIdentity(product);
    return !identity || !blockedIds.has(identity);
  });
}

function rankRecommendedProducts<T extends PersonalizedRankableProduct>(
  products: T[],
  signals: Pick<PersonalizedRailInput<T>, "buyAgainProducts" | "cartProducts" | "now" | "recentlyViewedProducts">,
) {
  const { categoryAffinity, sellerAffinity } = buildAffinityMaps(signals);

  return products
    .map((product, originalIndex) => {
      const categoryScore = categoryAffinity.get(categoryKey(product)) ?? 0;
      const sellerScore = sellerAffinity.get(sellerKey(product)) ?? 0;
      const score = categoryScore * 3 + sellerScore * 2 - originalIndex / 1000;

      return { product, originalIndex, score };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map((item) => item.product);
}

function buildAffinityMaps<T extends PersonalizedRankableProduct>({
  buyAgainProducts,
  cartProducts,
  now = new Date(),
  recentlyViewedProducts,
}: Pick<PersonalizedRailInput<T>, "buyAgainProducts" | "cartProducts" | "now" | "recentlyViewedProducts">) {
  const categoryAffinity = new Map<string, number>();
  const sellerAffinity = new Map<string, number>();
  const cartCategoryKeys = new Set<string>();
  const viewedCategoryKeys = new Set<string>();
  const buyAgainSellerCounts = new Map<string, number>();

  for (const product of cartProducts) {
    const productCategoryKey = categoryKey(product);
    const productSellerKey = sellerKey(product);
    addAffinity(categoryAffinity, productCategoryKey, 6, categoryAffinityCap);
    addAffinity(sellerAffinity, productSellerKey, 5, sellerAffinityCap);
    if (productCategoryKey) {
      cartCategoryKeys.add(productCategoryKey);
    }
  }

  for (const product of buyAgainProducts) {
    const productCategoryKey = categoryKey(product);
    const productSellerKey = sellerKey(product);
    addAffinity(categoryAffinity, productCategoryKey, 4, categoryAffinityCap);
    addAffinity(sellerAffinity, productSellerKey, 6, sellerAffinityCap);
    if (productSellerKey) {
      buyAgainSellerCounts.set(productSellerKey, (buyAgainSellerCounts.get(productSellerKey) ?? 0) + 1);
    }
  }

  for (const product of recentlyViewedProducts) {
    const productCategoryKey = categoryKey(product);
    const productSellerKey = sellerKey(product);
    const weight = recencyWeight(product.viewedAt, now);
    addAffinity(categoryAffinity, productCategoryKey, weight.category, categoryAffinityCap);
    addAffinity(sellerAffinity, productSellerKey, weight.seller, sellerAffinityCap);
    if (productCategoryKey) {
      viewedCategoryKeys.add(productCategoryKey);
    }
  }

  for (const category of viewedCategoryKeys) {
    addAffinity(categoryAffinity, category, cartCategoryKeys.has(category) ? 2 : 1, categoryAffinityCap);
  }

  for (const [seller, count] of buyAgainSellerCounts) {
    if (count >= 2) {
      addAffinity(sellerAffinity, seller, 2, sellerAffinityCap);
    }
  }

  return { categoryAffinity, sellerAffinity };
}

function addAffinity(map: Map<string, number>, key: string, value: number, cap: number) {
  if (!key) {
    return;
  }

  map.set(key, Math.min(cap, (map.get(key) ?? 0) + value));
}

function recencyWeight(viewedAt: string | null | undefined, now: Date) {
  const viewedAtMs = viewedAt ? Date.parse(viewedAt) : Number.NaN;
  const ageMs = Number.isFinite(viewedAtMs) ? Math.max(0, now.getTime() - viewedAtMs) : Number.POSITIVE_INFINITY;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  // Recency uses coarse buckets for predictable first-pass scoring.
  if (ageMs <= oneDayMs) {
    return { category: 3, seller: 2 };
  }

  if (ageMs <= sevenDaysMs) {
    return { category: 2, seller: 1.25 };
  }

  return { category: 1, seller: 0.75 };
}

function uniqueRankableProducts<T extends PersonalizedRankableProduct>(products: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const product of products) {
    const identity = productIdentity(product);
    if (identity && seen.has(identity)) {
      continue;
    }

    if (identity) {
      seen.add(identity);
    }
    unique.push(product);
  }

  return unique;
}

function productIdentitySet(products: PersonalizedRankableProduct[]) {
  const identities = new Set<string>();

  for (const product of products) {
    const identity = productIdentity(product);
    if (identity) {
      identities.add(identity);
    }
  }

  return identities;
}

function categoryKey(product: PersonalizedRankableProduct) {
  return (
    normalizeKey(product.categoryId) ||
    normalizeKey(product.categorySlug) ||
    normalizeKey(product.categoryName)
  );
}

function sellerKey(product: PersonalizedRankableProduct) {
  return normalizeKey(product.sellerId) || normalizeKey(product.sellerSlug) || normalizeKey(product.sellerName);
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") ?? "";
}
