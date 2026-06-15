export type MobileEventProperties = Record<string, boolean | number | string | null | undefined>;

const REDACTED_PROPERTY_NAMES = new Set([
  "address",
  "email",
  "fullName",
  "message",
  "name",
  "note",
  "phone",
  "reason",
]);

export function sanitizeMobileEventProperties(properties: MobileEventProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => value !== undefined && !REDACTED_PROPERTY_NAMES.has(key)),
  );
}
