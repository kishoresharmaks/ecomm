"use client";

import type { ReactNode } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { X } from "lucide-react";
import { Button, cn } from "@indihub/ui";

export function SideDrawer({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[150]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/45 transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-5">
            <DialogPanel
              transition
              className={cn(
                "pointer-events-auto w-screen transform overflow-y-auto bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)] transition duration-200 data-closed:translate-x-full",
                widthClassName,
              )}
            >
              <div className="flex min-h-full flex-col">
                <div className="border-b border-[#E5E7EB] px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <DialogTitle className="text-xl font-black text-[#1F2933]">
                        {title}
                      </DialogTitle>
                      {description ? (
                        <Description className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                          {description}
                        </Description>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="rounded-full"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Close
                    </Button>
                  </div>
                </div>
                <div className="flex-1 px-5 py-5 sm:px-6">{children}</div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
