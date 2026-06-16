import { SentryExampleClient } from "./sentry-example-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = {
  title: "Sentry Example | 1HandIndia",
  ...privatePageMetadata
};

export default function SentryExamplePage() {
  const dsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
  const enabled =
    dsnConfigured &&
    (process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SENTRY_EXAMPLE === "true");

  return <SentryExampleClient dsnConfigured={dsnConfigured} enabled={enabled} />;
}
