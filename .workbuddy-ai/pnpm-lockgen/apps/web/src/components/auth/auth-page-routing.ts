export type AuthAudience = "customer" | "seller" | "b2b";

export function resolveAuthAudience(audience: AuthAudience, redirectUrl: string): AuthAudience {
  if (audience === "seller" || redirectUrl === "/seller/register") return "seller";
  if (audience === "b2b" || redirectUrl.startsWith("/b2b")) return "b2b";
  return "customer";
}

export function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
