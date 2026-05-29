const trueStrings = new Set(["true", "1", "yes", "y", "on", "enabled"]);
const falseStrings = new Set(["false", "0", "no", "n", "off", "disabled"]);

export function readBooleanSettingValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (trueStrings.has(normalized)) {
      return true;
    }
    if (falseStrings.has(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function readNumberSettingValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}
