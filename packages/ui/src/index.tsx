 "use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[#ED3500] text-white hover:bg-[#C72D00] hover:text-white focus-visible:ring-[#ED3500] [&_svg]:text-white",
        secondary:
          "bg-[#163B5C] text-white hover:bg-[#0f2d46] hover:text-white focus-visible:ring-[#163B5C] [&_svg]:text-white",
        outline:
          "border border-[#E5E7EB] bg-white text-[#1F2933] hover:bg-[#FFFCFB] focus-visible:ring-[#163B5C]",
        ghost: "text-[#1F2933] hover:bg-[#FFFCFB] focus-visible:ring-[#163B5C]"
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const statusClasses: Record<StatusTone, string> = {
  neutral: "bg-[#F8FAFC] text-[#667085] border-[#E5E7EB]",
  success: "bg-[#E9F7F1] text-[#0F8A5F] border-[#BFEAD9]",
  warning: "bg-[#FFF0EC] text-[#ED3500] border-[#FFC7B8]",
  danger: "bg-[#FDECEC] text-[#D64545] border-[#F5B7B7]",
  info: "bg-[#EAF1F7] text-[#163B5C] border-[#C5D8E8]"
};

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        statusClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ED3500]">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-bold tracking-normal text-[#1F2933]">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-[#667085]">{description}</p> : null}
    </div>
  );
}
