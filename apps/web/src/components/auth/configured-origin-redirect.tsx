"use client";

import { useEffect } from "react";

const DEFAULT_WEB_URL = "https://1handindia.com";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function ConfiguredOriginRedirect() {
  useEffect(() => {
    const configuredUrl = parseWebUrl(process.env.NEXT_PUBLIC_WEB_URL ?? DEFAULT_WEB_URL);
    if (!configuredUrl || configuredUrl.origin === window.location.origin) {
      return;
    }

    if (!LOCAL_HOSTNAMES.has(window.location.hostname) || LOCAL_HOSTNAMES.has(configuredUrl.hostname)) {
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.protocol = configuredUrl.protocol;
    nextUrl.host = configuredUrl.host;
    window.location.replace(nextUrl.toString());
  }, []);

  return null;
}

function parseWebUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
