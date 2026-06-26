"use client";

import { forwardRef, useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Globe } from "lucide-react";
import { cn } from "@indihub/ui";
import { useMarket } from "@/components/market/market-context";
import { useFloatingHeaderDropdown } from "@/components/storefront/use-floating-header-dropdown";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "ar", label: "Arabic (العربية)" },
];

const MARKETS = [
  { code: "IN", currency: "INR", name: "India" },
  { code: "US", currency: "USD", name: "United States" },
  { code: "GB", currency: "GBP", name: "United Kingdom" },
  { code: "AE", currency: "AED", name: "United Arab Emirates" },
  { code: "SG", currency: "SGD", name: "Singapore" },
];

type StorefrontLocalePickerProps = {
  mobile?: boolean;
  className?: string;
};

export function StorefrontLocalePicker({ mobile = false, className }: StorefrontLocalePickerProps) {
  const market = useMarket();
  const [open, setOpen] = useState(false);
  
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  
  const closePanel = useCallback(() => setOpen(false), []);
  const useFloatingPanel = !mobile;
  
  const { portalRoot, floatingStyle, updatePosition } = useFloatingHeaderDropdown({
    open: useFloatingPanel && open,
    onClose: closePanel,
    triggerRef,
    panelRef,
    align: "end",
    minWidth: 280,
    maxWidth: 320,
  });

  const activeLanguage = LANGUAGES.find((l) => l.code === market.language) ?? LANGUAGES[0];
  const triggerLabel = `${activeLanguage?.code.toUpperCase()} · ${market.market.currency}`;

  const triggerToneClass = mobile
    ? "w-full justify-between rounded-[22px] border border-[#D8E2EA] bg-[#F8FAFC] px-4 py-3 text-left shadow-sm mt-2"
    : "inline-flex items-center gap-1.5 rounded-full border border-[#D8E2EA] bg-white/85 py-1.5 px-3 text-[13px] font-bold text-[#344054] shadow-sm transition hover:bg-[#F8FAFC] hover:text-[#163B5C]";

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            updatePosition();
          }
          setOpen((current) => !current);
        }}
        className={cn(triggerToneClass)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
          <span className="flex-1 text-left">{triggerLabel}</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[#667085] transition", open ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>

      {open && (!useFloatingPanel || !portalRoot || !floatingStyle) ? (
        <LocaleDropdownPanel
          ref={panelRef}
          id={panelId}
          mobile={mobile}
          closePanel={closePanel}
        />
      ) : null}

      {open && useFloatingPanel && portalRoot && floatingStyle
        ? createPortal(
            <LocaleDropdownPanel
              ref={panelRef}
              id={panelId}
              floating
              style={floatingStyle}
              mobile={mobile}
              closePanel={closePanel}
            />,
            portalRoot,
          )
        : null}
    </div>
  );
}

const LocaleDropdownPanel = forwardRef<
  HTMLDivElement,
  {
    id: string;
    mobile: boolean;
    closePanel: () => void;
    floating?: boolean;
    style?: React.CSSProperties;
  }
>(function LocaleDropdownPanel({ id, mobile, closePanel, floating = false, style }, ref) {
  const market = useMarket();

  return (
    <div
      ref={ref}
      id={id}
      style={style}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-[#D8E2EA] bg-white shadow-2xl",
        floating ? "fixed z-[140]" : "absolute z-50 mt-2 w-full",
        !floating && mobile ? "left-0 min-w-0" : !floating ? "right-0 min-w-[280px]" : "",
      )}
    >
      <div className="p-4">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#ED3500]">
          Language
        </h3>
        <div className="mt-3 grid gap-1">
          {LANGUAGES.map((lang) => {
            const isActive = market.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  market.setLanguage(lang.code);
                  closePanel();
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-[#FFF0EC] font-bold text-[#ED3500]"
                    : "font-semibold text-[#425466] hover:bg-[#F8FAFC]",
                )}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="border-t border-[#E5E7EB] p-4">
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#ED3500]">
          Currency
        </h3>
        <div className="mt-3 grid gap-1">
          {MARKETS.map((m) => {
            const isActive = market.countryCode === m.code;
            return (
              <button
                key={m.code}
                onClick={() => {
                  market.setCountryCode(m.code);
                  closePanel();
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-[#FFF0EC] font-bold text-[#ED3500]"
                    : "font-semibold text-[#425466] hover:bg-[#F8FAFC]",
                )}
              >
                <span>
                  {m.currency} <span className="ml-1 text-xs opacity-75">({m.name})</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
