"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@indihub/ui";
import { isPortableImageKey, resolveImageSource } from "@/lib/image-url";

type StorefrontImageProps = {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  fallbackLabel?: string;
  allowExternalRemote?: boolean;
};

export function StorefrontImage({ src, alt, sizes, className, priority = false, fallbackLabel, allowExternalRemote = false }: StorefrontImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveImageSource(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (resolvedSrc && !failed && isPortableImageKey(src)) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("h-full w-full object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  if (resolvedSrc && !failed && isAllowedImageSource(resolvedSrc)) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  if (resolvedSrc && !failed && allowExternalRemote && isSecureRemoteImageSource(resolvedSrc)) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("h-full w-full object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(135deg,#EAF1F7,#FFF0EC)] p-4">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-white/80 text-[#163B5C] shadow-sm">
        <ImageIcon size={20} />
      </span>
      {fallbackLabel ? <span className="text-sm font-black text-[#163B5C]">{fallbackLabel}</span> : null}
    </div>
  );
}

function isAllowedImageSource(src: string) {
  if (src.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(src);

    return (
      (url.protocol === "https:" && url.hostname === "images.unsplash.com") ||
      (url.protocol === "https:" && url.hostname === "ik.imagekit.io") ||
      (url.protocol === "https:" && url.hostname === "example.com" && url.pathname === "/indihub-smoke-product.jpg")
    );
  } catch {
    return false;
  }
}

function isSecureRemoteImageSource(src: string) {
  try {
    const url = new URL(src);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}
