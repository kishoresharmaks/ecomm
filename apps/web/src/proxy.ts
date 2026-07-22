import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  buildContentSecurityPolicy,
  buildReportingEndpointsHeader,
  buildReportToHeader,
} from "@/lib/security-headers";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

function securityProxy(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const [hostname = "", port] = hostHeader.split(":");
  const isLocal = hostname === "localhost" || hostname === "192.168.1.2";
  
  if (!isLocal && (hostname.startsWith("www.") || (port && port !== "80" && port !== "443"))) {
    const url = request.nextUrl.clone();
    url.hostname = hostname.replace(/^www\./, "");
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-indihub-pathname", request.nextUrl.pathname);
  const contentSecurityPolicy =
    process.env.NODE_ENV !== "development"
      ? buildContentSecurityPolicy({ nonce, origin: request.nextUrl.origin })
      : null;

  if (contentSecurityPolicy) {
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (contentSecurityPolicy) {
    const origin = request.nextUrl.origin;
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    response.headers.set("Report-To", buildReportToHeader(origin));
    response.headers.set("Reporting-Endpoints", buildReportingEndpointsHeader(origin));
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-XSS-Protection", "0");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Permissions-Policy",
      'camera=(), microphone=(), geolocation=(self), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
    );
  }

  return response;
}

export const proxy = clerkConfigured
  ? clerkMiddleware((_auth, request) => securityProxy(request))
  : securityProxy;

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
