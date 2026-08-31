"use client";

import { useEffect } from "react";
import { StorefrontErrorPanel } from "@/components/storefront/storefront-ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront client error caught by boundary:", error);
  }, [error]);

  return (
    <StorefrontFrame>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-6">
        <StorefrontErrorPanel error={error} onRetry={reset} />
      </div>
    </StorefrontFrame>
  );
}
