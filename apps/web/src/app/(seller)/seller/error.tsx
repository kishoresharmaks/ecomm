"use client";

import { SellerErrorPanel } from "@/components/seller/seller-ui";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SellerErrorPanel error={error} onRetry={reset} />;
}
