"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Popover,
  PopoverButton,
  PopoverPanel,
  Switch,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels
} from "@headlessui/react";
import { Check, ChevronDown, Filter, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { ConfirmationDialog, type ConfirmationTone } from "@/components/shared/confirmation-dialog";

export type AdminSelectOption = {
  value: string;
  label: string;
  description?: string | undefined;
  disabled?: boolean | undefined;
};

export type AdminActionItem = {
  label: string;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
  disabled?: boolean | undefined;
  destructive?: boolean | undefined;
};

export function AdminPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function AdminStatusNotice({
  title,
  message,
  tone = "info",
  status,
  className
}: {
  title: string;
  message: string;
  tone?: StatusTone;
  status?: number | undefined;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 rounded-lg border border-[#E5E7EB] bg-white p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone}>{status ? `HTTP ${status}` : title}</StatusBadge>
        <p className="text-sm font-semibold text-[#1F2933]">{message}</p>
      </div>
    </div>
  );
}

export function AdminActionMenu({
  items,
  label = "Actions",
  align = "end",
  buttonClassName
}: {
  items: AdminActionItem[];
  label?: string | undefined;
  align?: "start" | "end";
  buttonClassName?: string;
}) {
  return (
    <Menu>
      <MenuButton
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:bg-[#FFFCFB] focus:outline-none data-focus:ring-2 data-focus:ring-[#ED3500]",
          buttonClassName
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </MenuButton>
      <MenuItems
        anchor={{ to: align === "end" ? "bottom end" : "bottom start", gap: "8px", padding: "12px" }}
        modal={false}
        portal
        transition
        className="z-50 w-64 origin-top-right rounded-lg border border-[#D8E2EA] bg-white p-1 shadow-xl outline-none transition duration-150 data-closed:scale-95 data-closed:opacity-0"
      >
        {items.map((item) => {
          const content = (
            <span className="flex min-w-0 items-start gap-3">
              {item.icon ? <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#F8FAFC]">{item.icon}</span> : null}
              <span className="min-w-0">
                <span className="block text-sm font-black">{item.label}</span>
                {item.description ? <span className="mt-0.5 block text-xs font-semibold text-[#667085]">{item.description}</span> : null}
              </span>
            </span>
          );

          return (
            <MenuItem key={`${item.label}-${item.href ?? ""}`} disabled={item.disabled ?? false}>
              {({ focus, disabled }) => {
                const classes = cn(
                  "block w-full rounded-md px-3 py-2 text-left transition",
                  item.destructive ? "text-[#B42318]" : "text-[#1F2933]",
                  focus && "bg-[#FFF0EC]",
                  disabled && "cursor-not-allowed opacity-45"
                );

                if (item.href) {
                  return (
                    <Link href={item.href} className={classes}>
                      {content}
                    </Link>
                  );
                }

                return (
                  <button type="button" className={classes} onClick={item.onSelect} disabled={disabled}>
                    {content}
                  </button>
                );
              }}
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}

export function AdminFilterPopover({
  children,
  label = "Filters",
  activeCount = 0
}: {
  children: ReactNode;
  label?: string;
  activeCount?: number;
}) {
  return (
    <Popover className="relative">
      <PopoverButton className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:bg-[#FFFCFB] focus:outline-none data-focus:ring-2 data-focus:ring-[#ED3500]">
        <Filter className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        {label}
        {activeCount > 0 ? <StatusBadge tone="warning">{activeCount}</StatusBadge> : null}
        <ChevronDown className="h-4 w-4 text-[#667085]" aria-hidden="true" />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: "bottom end", gap: "8px", padding: "12px" }}
        modal={false}
        portal
        transition
        className="z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-xl outline-none transition duration-150 data-closed:scale-95 data-closed:opacity-0"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#163B5C]">
          <SlidersHorizontal className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
          Admin filters
        </div>
        {children}
      </PopoverPanel>
    </Popover>
  );
}

export function AdminListbox({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled = false,
  required = false,
  compact = false,
  className,
  buttonClassName
}: {
  label?: string;
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
  buttonClassName?: string | undefined;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">
          {label}
          {required ? <span className="text-[#ED3500]"> *</span> : null}
        </span>
      ) : null}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <div className="relative">
            <ListboxButton
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-left text-sm font-semibold text-[#1F2933] outline-none transition hover:bg-white data-focus:border-[#ED3500] data-focus:bg-white data-disabled:cursor-not-allowed data-disabled:opacity-55",
                compact ? "h-9" : "h-11",
                buttonClassName
              )}
            >
              <span className={cn("truncate", !selectedOption && "text-[#667085]")}>
                {selectedOption?.label ?? placeholder}
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#667085] transition", open && "rotate-180")} aria-hidden="true" />
            </ListboxButton>
            <ListboxOptions
              anchor={{ to: "bottom start", gap: "6px", padding: "12px" }}
              modal={false}
              portal
              transition
              className="z-[70] max-h-56 w-[var(--button-width)] min-w-[var(--button-width)] overflow-y-auto rounded-md border border-[#D8E2EA] bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.18)] outline-none transition duration-150 data-closed:pointer-events-none data-closed:-translate-y-1 data-closed:scale-[0.98] data-closed:opacity-0 sm:min-w-[18rem]"
            >
              {options.map((option) => (
                <ListboxOption
                  key={`${option.value}-${option.label}`}
                  value={option.value}
                  disabled={option.disabled ?? false}
                  className={({ focus, disabled: optionDisabled }) =>
                    cn(
                      "flex min-h-10 cursor-pointer items-start justify-between gap-3 rounded-md px-3 py-2 text-sm text-[#1F2933]",
                      focus && "bg-[#FFF0EC]",
                      optionDisabled && "cursor-not-allowed opacity-45"
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className="min-w-0">
                        <span className="block truncate font-black">{option.label}</span>
                        {option.description ? <span className="mt-0.5 block text-xs font-semibold text-[#667085]">{option.description}</span> : null}
                      </span>
                      {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ED3500]" aria-hidden="true" /> : null}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        )}
      </Listbox>
    </div>
  );
}

export function AdminSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  description?: string | undefined;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-4">
      <div>
        <p className="font-black text-[#1F2933]">{label}</p>
        {description ? <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">{description}</p> : null}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[#CBD5E1] p-1 transition data-checked:bg-[#ED3500] data-disabled:cursor-not-allowed data-disabled:opacity-50"
      >
        <span className="sr-only">{label}</span>
        <span className="h-4 w-4 rounded-full bg-white shadow-sm transition group-data-checked:translate-x-5" />
      </Switch>
    </div>
  );
}

export function AdminTabs({
  tabs,
  className
}: {
  tabs: Array<{ key: string; label: string; badge?: string | number; panel: ReactNode }>;
  className?: string;
}) {
  return (
    <TabGroup className={className}>
      <TabList className="flex gap-2 overflow-x-auto rounded-lg border border-[#D8E2EA] bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-black text-[#667085] outline-none transition data-hover:bg-[#FFFCFB] data-selected:bg-[#ED3500] data-selected:text-white data-focus:ring-2 data-focus:ring-[#ED3500]"
          >
            {tab.label}
            {tab.badge !== undefined ? <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{tab.badge}</span> : null}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-5">
        {tabs.map((tab) => (
          <TabPanel key={tab.key}>{tab.panel}</TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}

export function AdminConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep unchanged",
  tone = "danger",
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
