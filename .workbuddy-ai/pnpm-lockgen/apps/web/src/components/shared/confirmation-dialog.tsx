"use client";

import { useState, type ReactNode } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { Button, cn } from "@indihub/ui";

export type ConfirmationTone = "danger" | "warning" | "info";

export type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string | undefined;
  tone?: ConfirmationTone | undefined;
  onConfirm: () => void;
};

const toneStyles: Record<
  ConfirmationTone,
  {
    border: string;
    iconWrap: string;
    button: string;
    icon: ReactNode;
  }
> = {
  danger: {
    border: "border-[#F5B7B7]",
    iconWrap: "bg-[#FDECEC] text-[#B42318]",
    button: "bg-[#B42318] hover:bg-[#8F1D14] focus-visible:ring-[#B42318]",
    icon: <ShieldAlert className="h-5 w-5" aria-hidden="true" />
  },
  warning: {
    border: "border-[#FFC7B8]",
    iconWrap: "bg-[#FFF0EC] text-[#ED3500]",
    button: "bg-[#ED3500] hover:bg-[#C72D00] focus-visible:ring-[#ED3500]",
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />
  },
  info: {
    border: "border-[#C5D8E8]",
    iconWrap: "bg-[#EAF1F7] text-[#163B5C]",
    button: "bg-[#163B5C] hover:bg-[#0F2D46] focus-visible:ring-[#163B5C]",
    icon: <Info className="h-5 w-5" aria-hidden="true" />
  }
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep unchanged",
  tone = "danger",
  onClose,
  onConfirm
}: ConfirmationRequest & {
  open: boolean;
  onClose: () => void;
}) {
  const styles = toneStyles[tone];
  const ConfirmIcon = tone === "danger" ? X : CheckCircle2;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[140]">
      <DialogBackdrop transition className="fixed inset-0 bg-[#101828]/45 transition duration-200 data-closed:opacity-0" />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className={cn(
              "w-full max-w-md rounded-lg border bg-white p-5 shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0",
              styles.border
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md", styles.iconWrap)}>{styles.icon}</span>
              <div>
                <DialogTitle className="text-lg font-black tracking-normal text-[#1F2933]">{title}</DialogTitle>
                <Description className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{description}</Description>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                className={styles.button}
                onClick={() => {
                  onClose();
                  onConfirm();
                }}
              >
                <ConfirmIcon className="h-4 w-4" aria-hidden="true" />
                {confirmLabel}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  return {
    requestConfirmation: setRequest,
    confirmationDialog: request ? (
      <ConfirmationDialog
        open
        title={request.title}
        description={request.description}
        confirmLabel={request.confirmLabel}
        cancelLabel={request.cancelLabel ?? "Keep unchanged"}
        tone={request.tone ?? "danger"}
        onClose={() => setRequest(null)}
        onConfirm={request.onConfirm}
      />
    ) : null
  };
}
