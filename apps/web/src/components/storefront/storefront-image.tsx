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
  showFallbackLabel?: boolean;
  fallbackImageSrc?: string;
  allowExternalRemote?: boolean;
};

const brandFallbackImageSrc = "/brand/1handindia_hero_mark.png";

export function StorefrontImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
  fallbackLabel,
  showFallbackLabel = true,
  fallbackImageSrc = brandFallbackImageSrc,
  allowExternalRemote = false
}: StorefrontImageProps) {
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
    <div className={cn("relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#FFFFFF_0%,#FFF4EF_46%,#FFE5DB_100%)] p-4 text-center", className)}>
      <img
        src={fallbackImageSrc}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-full max-h-[78%] w-full max-w-[78%] object-contain drop-shadow-[0_12px_24px_rgba(237,53,0,0.16)]"
        onError={() => setFailed(true)}
      />
      {showFallbackLabel && fallbackLabel ? (
        <span className="mt-2 line-clamp-2 max-w-full text-xs font-black leading-4 text-[#163B5C]">
          {fallbackLabel}
        </span>
      ) : !fallbackImageSrc ? (
        <span className="grid h-11 w-11 place-items-center rounded-md bg-white/80 text-[#163B5C] shadow-sm">
          <ImageIcon size={20} />
        </span>
      ) : null}
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
