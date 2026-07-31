"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@indihub/ui";
import { resolveImageSource } from "@/lib/image-url";
import { movePopupIndex, resolvePopupDestination } from "@/lib/popup-announcement";
import { listCmsPopupAnnouncements } from "@/lib/storefront-api";

const swipeThreshold = 48;
const POPUP_Z_INDEX = 200;

export function PromotionalPopup() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["cms-popup-announcements", "home"],
    queryFn: listCmsPopupAnnouncements,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const openedThisVisit = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const items = query.data ?? [];
  const active = items[activeIndex] ?? items[0];

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const first = items[0];
    const source = resolveImageSource(first?.desktopImageUrl);
    if (!first || !source || openedThisVisit.current) return;

    const image = new Image();
    image.onload = () => {
      if (!openedThisVisit.current) {
        openedThisVisit.current = true;
        setOpen(true);
      }
    };
    image.src = source;
    return () => {
      image.onload = null;
    };
  }, [items]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [activeIndex, items.length]);

  if (!active) return null;

  function move(direction: -1 | 1) {
    setActiveIndex((current) => movePopupIndex(current, direction, items.length));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (Math.abs(horizontal) >= swipeThreshold && Math.abs(horizontal) > Math.abs(vertical)) {
      move(horizontal < 0 ? 1 : -1);
    }
  }

  function follow(link: string | null) {
    const destination = resolvePopupDestination(link);
    if (!destination) return;
    setOpen(false);
    if (destination.type === "internal") router.push(destination.href as never);
    else window.location.assign(destination.url);
  }

  const dialog = (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      className="relative"
      style={{ zIndex: POPUP_Z_INDEX }}
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/60 backdrop-blur-[2px] transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto p-4 sm:p-8">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-[#FFFCFB] shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <DialogTitle className="sr-only">{active.title}</DialogTitle>
            <button
              type="button"
              aria-label="Close promotional popup"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-[#1F2933] shadow-lg transition hover:text-[#ED3500] focus:outline-none focus:ring-4 focus:ring-[#ED3500]/25"
            >
              <X className="h-5 w-5" />
            </button>

            <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
              <button
                type="button"
                disabled={!resolvePopupDestination(active.primaryLinkUrl)}
                onClick={() => follow(active.primaryLinkUrl)}
                className="block w-full disabled:cursor-default"
                aria-label={active.primaryLinkUrl ? `${active.title}: open promotion` : active.title}
              >
                <picture>
                  {active.mobileImageUrl ? <source media="(max-width: 639px)" srcSet={resolveImageSource(active.mobileImageUrl) ?? undefined} /> : null}
                  <img
                    src={resolveImageSource(active.desktopImageUrl) ?? ""}
                    alt={active.imageAlt}
                    className="aspect-video w-full bg-[#FFF2EE] object-cover"
                  />
                </picture>
              </button>

              {active.primaryCtaLabel || active.secondaryCtaLabel ? (
                <div className="flex flex-col gap-3 border-t border-[#FFE0D6] bg-[#FFFCFB] p-4 sm:flex-row sm:justify-center sm:p-5">
                  {active.primaryCtaLabel ? (
                    <button type="button" onClick={() => follow(active.primaryLinkUrl)} className="rounded-xl bg-[#ED3500] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(237,53,0,0.22)] focus:outline-none focus:ring-4 focus:ring-[#ED3500]/25">
                      {active.primaryCtaLabel}
                    </button>
                  ) : null}
                  {active.secondaryCtaLabel ? (
                    <button type="button" onClick={() => follow(active.secondaryLinkUrl)} className="rounded-xl border border-[#ED3500] bg-white px-5 py-3 text-sm font-black text-[#ED3500] focus:outline-none focus:ring-4 focus:ring-[#ED3500]/20">
                      {active.secondaryCtaLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {items.length > 1 ? (
              <>
                <button type="button" aria-label="Previous promotion" onClick={() => move(-1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#ED3500] shadow-lg focus:outline-none focus:ring-4 focus:ring-[#ED3500]/25">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Next promotion" onClick={() => move(1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#ED3500] shadow-lg focus:outline-none focus:ring-4 focus:ring-[#ED3500]/25">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="flex justify-center gap-1.5 border-t border-[#FFE0D6] bg-[#FFFCFB] px-3 py-3">
                  {items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Show promotion ${index + 1}`}
                      aria-current={index === activeIndex ? "true" : undefined}
                      onClick={() => setActiveIndex(index)}
                      className={cn("h-2 rounded-full transition-all", index === activeIndex ? "w-6 bg-[#ED3500]" : "w-2 bg-[#D0D5DD]")}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );

  if (!portalRoot) return null;
  return createPortal(dialog, portalRoot);
}
