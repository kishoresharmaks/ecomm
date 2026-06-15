export type MobileBanner = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
  linkUrl?: string | null;
};

export type MobileCategory = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  children?: MobileCategory[];
  parent?: MobileCategory | null;
  _count?: {
    products?: number;
    children?: number;
  };
};

export type MobileProduct = {
  categoryId?: string | null;
  id: string;
  name: string;
  slug: string;
  images?: Array<{ url: string; altText?: string | null }>;
  variants?: Array<{
    pricePaise: number;
    mrpPaise?: number | null;
    currency?: string | null;
    status?: string | null;
    stockQuantity?: number | null;
  }>;
  sellerId?: string | null;
  category?: MobileCategory & {
    parent?: MobileCategory | null;
  };
  seller?: {
    id?: string | null;
    storeName: string;
    slug?: string;
  };
  reviewSummary?: {
    averageRating: number | null;
    reviewCount: number;
  };
};

export type MobileStoreAddress = {
  area?: string | null;
  city: string;
  state: string;
  country?: string | null;
  countryCode?: string | null;
};

export type MobileStore = {
  id: string;
  storeName: string;
  slug: string;
  sellerType?: string;
  createdAt?: string;
  profile?: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    createdAt?: string;
  } | null;
  addresses?: MobileStoreAddress[];
  locationMatchLevel?: "LOCAL_AREA" | "CITY" | "STATE" | "COUNTRY" | "NONE";
  reviewSummary?: {
    averageRating: number | null;
    reviewCount: number;
    distribution?: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  distanceMeters?: number | null;
  _count?: {
    products?: number;
  };
};

export type MobileHomepageSectionItem = {
  sourceType?: string;
  sourceId?: string;
  slug?: string;
  label?: string;
  title?: string;
  name?: string;
  description?: string;
  subtitle?: string;
  imageUrl?: string;
  image?: string;
  linkUrl?: string;
  href?: string;
  url?: string;
  badge?: string;
};

export type MobileHomepageSection = {
  id: string;
  title: string;
  sectionType: string;
  config?: {
    eyebrow?: string;
    subtitle?: string;
    description?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    ctaHref?: string;
    startsAt?: string;
    endsAt?: string;
    timerEndsAt?: string;
    items?: MobileHomepageSectionItem[];
    [key: string]: unknown;
  } | null;
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

export type MobileHome = {
  banners: MobileBanner[];
  categories: MobileCategory[];
  sections: MobileHomepageSection[];
  productRails: {
    featured: MobileProduct[];
    latest: MobileProduct[];
    deals: MobileProduct[];
  };
  storesNearYou: MobileStore[];
  supportConfig: Record<string, unknown>;
  generatedAt: string;
};
