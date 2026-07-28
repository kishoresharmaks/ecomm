const sensitiveKey = /(authorization|cookie|token|password|secret|credential|api[-_]?key|bank|account|ifsc|pan|aadhaar|card|cvv|providerconfig)/i;

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactText(value) : value;
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactSensitive(entry, seen),
    ]),
  );
}

export function redactText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password|token|secret|api[_-]?key)=([^\s&]+)/gi, "$1=[REDACTED]");
}
