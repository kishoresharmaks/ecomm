import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";

type FloatingAlignment = "start" | "end";

type FloatingHeaderDropdownOptions<TTrigger extends HTMLElement, TPanel extends HTMLElement> = {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<TTrigger | null>;
  panelRef: RefObject<TPanel | null>;
  align?: FloatingAlignment;
  offset?: number;
  viewportMargin?: number;
  minWidth?: number;
  maxWidth?: number;
  matchTriggerWidth?: boolean;
};

const defaultOffset = 12;
const defaultViewportMargin = 20;
const defaultMinWidth = 280;
const defaultMaxWidth = 820;

export function useFloatingHeaderDropdown<
  TTrigger extends HTMLElement,
  TPanel extends HTMLElement,
>({
  open,
  onClose,
  triggerRef,
  panelRef,
  align = "start",
  offset = defaultOffset,
  viewportMargin = defaultViewportMargin,
  minWidth = defaultMinWidth,
  maxWidth = defaultMaxWidth,
  matchTriggerWidth = false,
}: FloatingHeaderDropdownOptions<TTrigger, TPanel>) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const availableWidth = Math.max(
      minWidth,
      viewportWidth - viewportMargin * 2,
    );
    const preferredWidth = matchTriggerWidth
      ? Math.max(rect.width, minWidth)
      : maxWidth;
    const width = Math.min(preferredWidth, maxWidth, availableWidth);
    const preferredLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportMargin),
      viewportWidth - width - viewportMargin,
    );

    setFloatingStyle({
      left,
      top: rect.bottom + offset,
      width,
    });
  }, [
    align,
    matchTriggerWidth,
    maxWidth,
    minWidth,
    offset,
    triggerRef,
    viewportMargin,
  ]);

  useEffect(() => {
    if (!open) {
      setFloatingStyle(null);
      return;
    }

    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let scrollFrame: number | null = null;

    function targetInsideActiveDropdown(target: EventTarget | null) {
      return (
        target instanceof Node &&
        (triggerRef.current?.contains(target) || panelRef.current?.contains(target))
      );
    }

    function closeOnPageScroll(event: Event) {
      if (targetInsideActiveDropdown(event.target)) {
        return;
      }

      if (scrollFrame !== null) {
        return;
      }

      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        onClose();
      });
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!targetInsideActiveDropdown(event.target)) {
        onClose();
      }
    }

    function closeOnWheel(event: WheelEvent) {
      if (!targetInsideActiveDropdown(event.target)) {
        onClose();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("scroll", closeOnPageScroll, { capture: true, passive: true });
    window.addEventListener("wheel", closeOnWheel, { passive: true });
    window.addEventListener("resize", onClose);
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }

      window.removeEventListener("scroll", closeOnPageScroll, true);
      window.removeEventListener("wheel", closeOnWheel);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open, panelRef, triggerRef]);

  return { portalRoot, floatingStyle, updatePosition };
}
