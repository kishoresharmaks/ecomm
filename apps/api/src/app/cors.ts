const DEFAULT_CORS_ORIGINS = "https://1handindia.com,https://www.1handindia.com,https://api.1handindia.com";

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env) {
  const allowedOrigins = parseCorsOrigins(env.API_CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS);
  const productionLike = isProductionLike(env);

  return {
    credentials: true,
    origin(origin: string | undefined, callback: CorsOriginCallback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin) || (!productionLike && isPrivateNetworkOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  };
}

export function parseCorsOrigins(value: string) {
  return new Set(
    value
      .split(",")
      .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean),
  );
}

function isProductionLike(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV === "production" || env.INDIHUB_PRODUCTION === "true" || env.INDIHUB_ENV === "production";
}

function isPrivateNetworkOrigin(origin: string) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    isPrivate172Address(hostname)
  );
}

function isPrivate172Address(hostname: string) {
  const match = /^172\.(\d{1,2})\./.exec(hostname);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}
