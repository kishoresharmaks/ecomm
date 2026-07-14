import { NextRequest, NextResponse } from "next/server";
import {
  buildContentSecurityPolicy,
  buildReportingEndpointsHeader,
  buildReportToHeader,
} from "@/lib/security-headers";

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (process.env.NODE_ENV !== "development") {
    const origin = request.nextUrl.origin;
    response.headers.set("Content-Security-Policy", buildContentSecurityPolicy({ nonce, origin }));
    response.headers.set(
      "Content-Security-Policy-Report-Only",
      buildContentSecurityPolicy({ nonce, origin, reportOnly: true }),
    );
    response.headers.set("Report-To", buildReportToHeader(origin));
    response.headers.set("Reporting-Endpoints", buildReportingEndpointsHeader(origin));
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Permissions-Policy",
      'camera=(), microphone=(), geolocation=(self), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
    );
  }

  return response;
}

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
