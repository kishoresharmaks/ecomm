export type SecurityHeaderOptions = {
  nonce: string;
  origin: string;
};

const defaultWebOrigin = "https://1handindia.com";
const defaultApiOrigin = "https://api.1handindia.com";
const imageKitUploadOrigin = "https://upload.imagekit.io";

export function buildContentSecurityPolicy({ nonce, origin }: SecurityHeaderOptions) {
  const webOrigin = originFromUrl(process.env.NEXT_PUBLIC_WEB_URL) ?? originFromUrl(origin) ?? defaultWebOrigin;
  const apiOrigin = originFromUrl(process.env.NEXT_PUBLIC_API_URL) ?? defaultApiOrigin;
  const apiWebSocketOrigin = apiOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const clerkFrontendOrigin = originFromUrl(process.env.NEXT_PUBLIC_CLERK_FRONTEND_API);
  const analyticsOrigins = analyticsScriptOrigins();
  const analyticsConnectOrigins = analyticsConnectionOrigins();
  const clerkOrigins = [
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://api.clerk.com",
    "https://cdn.clerk.com",
    clerkFrontendOrigin,
  ];
  const razorpayOrigins = ["https://checkout.razorpay.com", "https://*.razorpay.com"];
  const turnstileOrigins = ["https://challenges.cloudflare.com"];
  const sentryOrigins = [`${webOrigin}/_1hi/relay`];
  const reportDirective = ["report-to", "indihub-csp"];
  const reportUriDirective = ["report-uri", `${webOrigin}/security/csp-report`];

  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...analyticsOrigins, ...razorpayOrigins, ...clerkOrigins, ...turnstileOrigins],
    ["style-src", "'self'", `'nonce-${nonce}'`, "https://fonts.googleapis.com"],
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", "'self'", "https:", "data:", "blob:", ...parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_IMG_SRC)],
    ["font-src", "'self'", "data:", "https://fonts.gstatic.com"],
    [
      "connect-src",
      "'self'",
      apiOrigin,
      apiWebSocketOrigin,
      imageKitUploadOrigin,
      "https://*.amazonaws.com",
      ...analyticsConnectOrigins,
      ...razorpayOrigins,
      ...clerkOrigins,
      ...turnstileOrigins,
      ...sentryOrigins,
      ...parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_CONNECT_SRC),
    ],
    ["frame-src", ...razorpayOrigins, ...clerkOrigins, ...turnstileOrigins, ...parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_FRAME_SRC)],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["form-action", "'self'", ...razorpayOrigins],
    ["frame-ancestors", "'self'"],
    ["upgrade-insecure-requests"],
    reportDirective,
    reportUriDirective,
  ];

  return directives
    .map(([directive, ...sources]) => [directive, ...uniqueNonEmpty(sources)].join(" "))
    .join("; ");
}

export function buildReportToHeader(origin: string) {
  const endpointOrigin = originFromUrl(process.env.NEXT_PUBLIC_WEB_URL) ?? originFromUrl(origin) ?? defaultWebOrigin;

  return JSON.stringify({
    group: "indihub-csp",
    max_age: 10_886_400,
    endpoints: [{ url: `${endpointOrigin}/security/csp-report` }],
    include_subdomains: true,
  });
}

export function buildReportingEndpointsHeader(origin: string) {
  const endpointOrigin = originFromUrl(process.env.NEXT_PUBLIC_WEB_URL) ?? originFromUrl(origin) ?? defaultWebOrigin;
  return `indihub-csp="${endpointOrigin}/security/csp-report"`;
}

export function analyticsIsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_GTM_ID?.trim() ||
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ||
      process.env.NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN?.trim(),
  );
}

function analyticsScriptOrigins() {
  // GA/GTM IDs can be managed in PostgreSQL, which is unavailable to request-time proxy code.
  const origins = ["https://www.googletagmanager.com"];

  if (process.env.NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN?.trim()) {
    origins.push("https://static.cloudflareinsights.com");
  }

  return origins;
}

function analyticsConnectionOrigins() {
  const origins = [...analyticsScriptOrigins()];
  origins.push(
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.google.com",
    "https://google.com",
    "https://*.google.com",
    "https://www.googleadservices.com",
  );

  return origins;
}

function originFromUrl(value?: string | null) {
  const normalizedValue = value?.trim().replace(/^["']|["']$/g, "");
  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue).origin;
  } catch {
    return null;
  }
}

function parseCsvOrigins(value?: string | null) {
  return uniqueNonEmpty(
    value
      ?.split(",")
      .map((item) => originFromUrl(item) ?? item.trim().replace(/^["']|["']$/g, "")) ?? [],
  );
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : value))
        .filter(Boolean) as string[],
    ),
  ];
}
