import type { MobileCategory, MobileProduct, MobileStore } from "./mobile-home";

export type LocationArea = {
  id: string;
  code: string;
  name: string;
  postalCode?: string | null;
  city: {
    id: string;
    code: string;
    name: string;
    subdivision: {
      id: string;
      code: string;
      name: string;
      country: {
        id: string;
        code: string;
        name: string;
      };
    };
  };
};

export type SelectedLocation = {
  label: string;
  pincode?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
};

export type SearchSuggestion = {
  id: string;
  type: "product" | "store" | "category";
  title: string;
  subtitle?: string | null;
  href: string;
  imageUrl?: string | null;
};

export type StorefrontSearchItem =
  | { type: "product"; score: number; product: MobileProduct }
  | { type: "store"; score: number; store: MobileStore }
  | { type: "category"; score: number; category: MobileCategory };

export type StorefrontSearchResponse = {
  query: string;
  limit: number;
  items: StorefrontSearchItem[];
  products: MobileProduct[];
  stores: MobileStore[];
  categories: MobileCategory[];
  pageInfo: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

export type StorefrontSuggestionsResponse = {
  query: string;
  suggestions: SearchSuggestion[];
  products: SearchSuggestion[];
  stores: SearchSuggestion[];
  categories: SearchSuggestion[];
  limit: number;
};

export type ProductImage = {
  id?: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type ProductVariant = {
  id: string;
  sku: string;
  variantName?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  currency: string;
  stockQuantity: number;
  status: string;
  originalPricePaise?: number | null;
  dealPricePaise?: number | null;
  dealDiscountBps?: number | null;
  dealDiscountPaise?: number | null;
  activeDeal?: {
    dealId: string;
    title: string;
    discountBps: number;
    startsAt: string;
    endsAt: string;
  } | null;
  attributes?: Record<string, unknown> | null;
};

export type ProductSummary = {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  approvalStatus: string;
  listingMode?: "CART" | "ENQUIRY_ONLY" | "CART_AND_ENQUIRY";
  attributes?: Record<string, unknown> | null;
  category?: MobileCategory & {
    parent?: MobileCategory | null;
  };
  seller?: {
    id?: string;
    storeName: string;
    slug?: string;
    sellerType?: string;
    profile?: {
      logoUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    } | null;
  };
  images: ProductImage[];
  variants: ProductVariant[];
  reviewSummary?: {
    averageRating: number | null;
    reviewCount: number;
  };
  activeDeal?: ProductVariant["activeDeal"];
  campaignBadge?: string | null;
  campaignLabel?: string | null;
  campaignDescription?: string | null;
  campaignImageUrl?: string | null;
  campaignLinkUrl?: string | null;
  createdAt?: string;
};
