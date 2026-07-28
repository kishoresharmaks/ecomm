"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  Children,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  RotateCcw,
  Search,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { listCustomerOrders } from "@/lib/account-api";
import { getCart, type CartSummary, type OrderSummary, type ProductSummary } from "@/lib/storefront-api";
import { readRecentProducts, type RecentProductSnapshot } from "@/lib/recent-products";
import { useStorefrontLocation } from "./storefront-location-context";
import {
  storefrontLocationCookieName,
  storefrontLocationCookieValue,
  storefrontLocationFingerprint,
} from "./storefront-location-utils";
import { StorefrontImage } from "./storefront-image";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

const heroIntervalMs = 5000;
const swipeThresholdPx = 16;
const railDragThresholdPx = 5;

export type HomePersonalizedProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  categoryName: string;
  sellerName: string;
  pricePaise: number | null;
  mrpPaise: number | null;
  badge?: string;
};

export function HomeLocationRefreshBridge({
  serverFingerprint,
}: {
  serverFingerprint: string;
}) {
  const router = useRouter();
  const location = useStorefrontLocation();
  const lastRefreshedFingerprint = useRef(serverFingerprint);
  const activeFingerprint = storefrontLocationFingerprint(location.activeLocation);

  useEffect(() => {
    if (!location.isReady) {
      return;
    }

    const cookieValue = storefrontLocationCookieValue(location.activeLocation);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";

    if (cookieValue) {
      document.cookie = `${storefrontLocationCookieName}=${cookieValue}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
    } else {
      document.cookie = `${storefrontLocationCookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    }

    if (lastRefreshedFingerprint.current === activeFingerprint) {
      return;
    }

    lastRefreshedFingerprint.current = activeFingerprint;
    startTransition(() => router.refresh());
  }, [activeFingerprint, location.activeLocation, location.isReady, router]);

  return null;
}

export function HomeSearchForm({
  className,
  inputClassName,
  compact = false,
}: {
  className?: string;
  inputClassName?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push((trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search") as Route);
  }

  return (
    <form onSubmit={submitSearch} className={cn("relative", className)}>
      <label htmlFor={compact ? "mobile-home-search" : "home-search"} className="sr-only">
        Search products, stores, or brands
      </label>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ED3500]"
        aria-hidden="true"
      />
      <input
        id={compact ? "mobile-home-search" : "home-search"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={compact ? "Search products, stores, brands..." : "Search marketplace"}
        className={cn(
          "h-12 w-full rounded-full border border-[#FFE0D6] bg-white pl-11 pr-24 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10",
          inputClassName,
        )}
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1.5 h-9 rounded-full bg-[#ED3500] px-4 text-xs font-black text-white shadow-[0_12px_22px_rgba(237,53,0,0.22)]"
      >
        Search
      </button>
    </form>
  );
}

export function HomeHeroCarousel({
  children,
  ariaLabel = "Homepage promotions",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const slides = Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<{
    x: number;
    y: number;
    pointerId: number;
    captured: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const hasMultipleSlides = slides.length > 1;
  const normalizedIndex = slides.length ? activeIndex % slides.length : 0;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (!hasMultipleSlides || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setTimeout(
      () => setActiveIndex((current) => (current + 1) % slides.length),
      heroIntervalMs,
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, hasMultipleSlides, paused, slides.length]);

  function move(direction: -1 | 1) {
    if (!slides.length) {
      return;
    }
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!hasMultipleSlides) {
      return;
    }
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      captured: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId || start.captured) {
      return;
    }

    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) < swipeThresholdPx || Math.abs(x) <= Math.abs(y)) {
      return;
    }

    start.captured = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) {
      return;
    }

    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) >= swipeThresholdPx && Math.abs(x) > Math.abs(y)) {
      suppressClickRef.current = true;
      move(x < 0 ? 1 : -1);
    }
    if (start.captured && event.currentTarget.hasPointerCapture?.(start.pointerId)) {
      event.currentTarget.releasePointerCapture(start.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  if (!slides.length) {
    return null;
  }

  return (
    <section
      aria-label={ariaLabel}
      aria-roledescription={hasMultipleSlides ? "carousel" : undefined}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {slides.map((slide, index) => (
        <div key={index} hidden={index !== normalizedIndex} aria-hidden={index !== normalizedIndex}>
          {slide}
        </div>
      ))}

      {hasMultipleSlides ? (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous homepage banner"
            className="absolute bottom-4 left-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-[#FFE0D6] bg-white/95 text-[#ED3500] shadow-md lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next homepage banner"
            className="absolute bottom-4 right-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-[#FFE0D6] bg-white/95 text-[#ED3500] shadow-md lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/95 px-2.5 py-2 shadow-md">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show banner ${index + 1}`}
                aria-current={index === normalizedIndex ? "true" : undefined}
                className={cn(
                  "h-2 rounded-full transition",
                  index === normalizedIndex ? "w-6 bg-[#ED3500]" : "w-2 bg-[#F2B8A7]",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function HomeScrollableRail({
  children,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function update() {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    update();
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      rail.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    scrollToNearestRailItem(
      rail,
      rail.scrollLeft + direction * rail.clientWidth * 0.85,
      "smooth",
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail || event.pointerType !== "mouse" || event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
      moved: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < railDragThresholdPx) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      rail.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    event.preventDefault();
    rail.scrollLeft = drag.startScrollLeft - distance;
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag || drag.pointerId !== event.pointerId) {
      return;
    }

    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setIsDragging(false);
    if (rail.hasPointerCapture?.(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }
    update();
    if (drag.moved) {
      window.requestAnimationFrame(() => {
        scrollToNearestRailItem(rail, rail.scrollLeft, "smooth");
      });
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <div className={cn("relative min-w-0 max-w-full", className)}>
      <div
        ref={railRef}
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className={cn(
          "indihub-scroll-rail flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isDragging ? "is-dragging cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-x-1 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-between sm:flex"
        aria-label={`${ariaLabel} controls`}
      >
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={!canScrollLeft}
          aria-label={`Scroll ${ariaLabel} left`}
          title={`Scroll ${ariaLabel} left`}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-[#FFD8CC] bg-white/95 text-[#ED3500] shadow-[0_10px_28px_rgba(17,24,39,0.14)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-[#FFF7F3] disabled:pointer-events-none disabled:opacity-0 motion-reduce:transform-none"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={!canScrollRight}
          aria-label={`Scroll ${ariaLabel} right`}
          title={`Scroll ${ariaLabel} right`}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-[#FFD8CC] bg-white/95 text-[#ED3500] shadow-[0_10px_28px_rgba(17,24,39,0.14)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-[#FFF7F3] disabled:pointer-events-none disabled:opacity-0 motion-reduce:transform-none"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function scrollToNearestRailItem(
  rail: HTMLDivElement,
  targetLeft: number,
  behavior: ScrollBehavior,
) {
  const railRect = rail.getBoundingClientRect();
  const itemOffsets = Array.from(rail.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((child) => child.getBoundingClientRect().left - railRect.left + rail.scrollLeft);

  if (!itemOffsets.length) {
    return;
  }

  const nearestLeft = itemOffsets.reduce((nearest, itemLeft) =>
    Math.abs(itemLeft - targetLeft) < Math.abs(nearest - targetLeft) ? itemLeft : nearest,
  );
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);

  rail.scrollTo({
    left: Math.min(Math.max(0, nearestLeft), maxScrollLeft),
    behavior,
  });
}

export function HomeWishlistButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const wishlist = useStorefrontWishlist();
  const isWishlisted = wishlist.hasWishlistProduct(productId);
  const isPending = wishlist.isPendingProductId === productId;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void wishlist.toggleWishlist(productId).catch(() => undefined);
      }}
      disabled={isPending}
      aria-label={isWishlisted ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        "absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-white text-[#ED3500] shadow-md",
        isWishlisted && "bg-[#FFF0EC]",
        isPending && "cursor-wait opacity-60",
      )}
    >
      <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} aria-hidden="true" />
    </button>
  );
}

export function HomePrice({
  amountPaise,
  className,
}: {
  amountPaise: number | null | undefined;
  className?: string;
}) {
  const market = useMarket();
  return <span className={className}>{amountPaise == null ? "View price" : market.format(amountPaise)}</span>;
}

export function HomeDealCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Date.parse(endsAt) - now);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return null;
  }

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EC] px-3 py-1.5 text-xs font-black text-[#ED3500]">
      Ends in {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  );
}

export function PersonalizedHomeClient() {
  const customerAuth = useCustomerAuth();
  const [recentProducts, setRecentProducts] = useState<RecentProductSnapshot[]>([]);
  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
    staleTime: 30_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["account-orders", customerAuth.authKey, "home-personalized"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, { limit: 8 }),
    enabled: customerAuth.enabled,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    function refresh() {
      setRecentProducts(readRecentProducts());
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const cartProducts = useMemo(() => productsFromCart(cartQuery.data), [cartQuery.data]);
  const orderProducts = useMemo(
    () => productsFromOrders(ordersQuery.data?.items ?? []),
    [ordersQuery.data?.items],
  );
  const viewedProducts = useMemo(
    () => recentProducts.map(productFromRecentSnapshot),
    [recentProducts],
  );
  const hasCart = (cartQuery.data?.items.length ?? 0) > 0;
  const hasContent = hasCart || cartProducts.length || orderProducts.length || viewedProducts.length;

  if (!hasContent && !cartQuery.isLoading && !ordersQuery.isLoading) {
    return null;
  }

  return (
    <section
      className="bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF7F3_100%)] py-7 lg:py-10"
      aria-label="Personalized shopping"
    >
      <div className="mx-auto max-w-[1360px] space-y-6 px-4 sm:px-6 lg:px-10">
        {hasCart ? <CartReminder cart={cartQuery.data} /> : null}
        <PersonalizedRail
          title="Continue shopping"
          description="Pick up items still in your cart."
          href="/cart"
          icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
          products={cartProducts}
          loading={cartQuery.isLoading && customerAuth.enabled}
        />
        <PersonalizedRail
          title="Recently viewed"
          description="Products you checked on this device."
          href="/search"
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
          products={viewedProducts}
          loading={false}
          showViewAll={false}
        />
        <PersonalizedRail
          title="Buy again"
          description="Open products from your recent orders."
          href="/account/orders"
          icon={<RotateCcw className="h-5 w-5" aria-hidden="true" />}
          products={orderProducts}
          loading={ordersQuery.isLoading && customerAuth.enabled}
        />
      </div>
    </section>
  );
}

function CartReminder({ cart }: { cart: CartSummary | undefined }) {
  const market = useMarket();
  const items = cart?.items ?? [];
  const itemCount = items.reduce((total, item) => total + Math.max(0, item.quantity), 0);
  const subtotal = items.reduce(
    (total, item) => total + Math.max(0, item.quantity) * Math.max(0, item.unitPricePaise ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#FFE0D6] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-black text-[#111827]">Cart reminder</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {itemCount} item{itemCount === 1 ? "" : "s"} waiting in your cart
          {subtotal > 0 ? ` · ${market.format(subtotal)}` : ""}.
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/cart" className="rounded-full border border-[#FFE0D6] px-4 py-2 text-sm font-black text-[#ED3500]">
          View cart
        </Link>
        <Link href="/checkout" className="rounded-full bg-[#ED3500] px-4 py-2 text-sm font-black text-white">
          Checkout
        </Link>
      </div>
    </div>
  );
}

function PersonalizedRail({
  title,
  description,
  href,
  icon,
  products,
  loading,
  showViewAll = true,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  products: HomePersonalizedProduct[];
  loading: boolean;
  showViewAll?: boolean;
}) {
  if (!loading && !products.length) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-[#111827]">{title}</h2>
            <p className="hidden text-sm font-semibold text-[#667085] sm:block">{description}</p>
          </div>
        </div>
        {showViewAll ? (
          <Link href={href as Route} className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-[#ED3500]">
            View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <HomeScrollableRail ariaLabel={title}>
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[330px] w-[174px] shrink-0 animate-pulse rounded-[16px] border border-[#E3E8EF] bg-white sm:w-[188px]"
              />
            ))
          : products
              .slice(0, 8)
              .map((product) => <PersonalizedProductCard key={`${title}-${product.id}`} product={product} />)}
      </HomeScrollableRail>
    </div>
  );
}

function PersonalizedProductCard({ product }: { product: HomePersonalizedProduct }) {
  const discount =
    product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise
      ? Math.round(((product.mrpPaise - product.pricePaise) / product.mrpPaise) * 100)
      : null;

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className="group flex h-[330px] w-[174px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-[#E3E8EF] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#FFB9A5] hover:shadow-[0_16px_36px_rgba(17,24,39,0.12)] motion-reduce:transform-none sm:w-[188px]"
    >
      <span className="relative h-[160px] shrink-0 bg-[#FFF8F5] p-3">
        {product.badge ? (
          <span className="absolute left-3 top-3 z-10 max-w-[118px] truncate rounded-full bg-[#ED3500] px-2 py-1 text-[9px] font-black text-white">
            {product.badge}
          </span>
        ) : null}
        <span className="absolute inset-3 overflow-hidden rounded-[13px] border border-[#FFF0EA] bg-white">
          <StorefrontImage
            src={product.imageUrl}
            alt={product.name}
            sizes="164px"
            fallbackLabel={product.categoryName}
            allowExternalRemote
            className="object-contain p-2 transition group-hover:scale-105"
          />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col px-3 pb-4 pt-3">
        <span className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-[#111827]">{product.name}</span>
        <span className="mt-1 truncate text-xs font-semibold text-[#98A2B3]">{product.sellerName}</span>
        <span className="mt-2 flex min-w-0 items-baseline gap-2 overflow-hidden">
          <HomePrice amountPaise={product.pricePaise} className="block min-w-0 truncate font-black text-[#111827]" />
          {product.mrpPaise && product.mrpPaise > (product.pricePaise ?? 0) ? (
            <HomePrice
              amountPaise={product.mrpPaise}
              className="block max-w-16 shrink-0 truncate text-xs font-semibold text-[#98A2B3] line-through"
            />
          ) : null}
        </span>
        {discount ? <span className="mt-1 text-[10px] font-black text-[#ED3500]">{discount}% OFF</span> : null}
        <span className="mt-auto w-fit max-w-full truncate rounded-full bg-[#FFF0EC] px-2.5 py-1 text-[11px] font-black text-[#C4320A]">
          {product.categoryName}
        </span>
      </span>
    </Link>
  );
}

function productsFromCart(cart: CartSummary | undefined) {
  return uniqueProducts(
    (cart?.items ?? []).flatMap((item) =>
      item.productVariant?.product
        ? [productFromSummary(item.productVariant.product, "In cart", item.unitPricePaise)]
        : [],
    ),
  );
}

function productsFromOrders(orders: OrderSummary[]) {
  return uniqueProducts(
    orders.flatMap((order) =>
      order.items.flatMap((item) => {
        const product = productFromOrderItem(item);
        return product ? [product] : [];
      }),
    ),
  );
}

function productFromOrderItem(
  item: OrderSummary["items"][number],
): HomePersonalizedProduct | null {
  const product = item.product;
  if (!product?.slug) {
    return null;
  }

  const images = Array.isArray(product.images) ? product.images : [];
  const image =
    images.find((entry) => entry.isPrimary)?.url ??
    [...images].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))[0]?.url ??
    null;

  return {
    id: product.id,
    name: product.name?.trim() || item.productNameSnapshot,
    slug: product.slug,
    imageUrl: image,
    categoryName: product.category?.name ?? "Marketplace",
    sellerName: item.seller?.storeName ?? product.seller?.storeName ?? "1HandIndia seller",
    pricePaise: item.unitPricePaise ?? null,
    mrpPaise: item.originalUnitPricePaise ?? null,
    badge: "Ordered",
  };
}

function productFromSummary(
  product: ProductSummary,
  badge: string,
  priceOverride?: number | null,
): HomePersonalizedProduct {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) ? product.images : [];
  const variant = variants[0];
  const image =
    images.find((item) => item.isPrimary)?.url ??
    [...images].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))[0]?.url ??
    null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: image,
    categoryName: product.category?.name ?? "Marketplace",
    sellerName: product.seller?.storeName ?? "1HandIndia seller",
    pricePaise: priceOverride ?? variant?.pricePaise ?? null,
    mrpPaise: variant?.mrpPaise ?? null,
    badge,
  };
}

function productFromRecentSnapshot(product: RecentProductSnapshot): HomePersonalizedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    categoryName: product.categoryName ?? "Marketplace",
    sellerName: product.sellerName ?? "1HandIndia seller",
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    badge: "Viewed",
  };
}

function uniqueProducts(products: HomePersonalizedProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

export function HomeAuthNotice() {
  const auth = useCustomerAuth();
  if (auth.enabled) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10">
      <CustomerAuthNotice />
    </section>
  );
}

export function HomeRetryButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      className="mt-4 rounded-full bg-[#ED3500] px-5 py-2.5 text-sm font-black text-white"
    >
      Try again
    </button>
  );
}
