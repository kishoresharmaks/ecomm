import { Prisma, SettingValueType } from "@indihub/database";

const trueStrings = new Set(["true", "1", "yes", "y", "on", "enabled"]);
const falseStrings = new Set(["false", "0", "no", "n", "off", "disabled"]);

export function readBooleanSetting(value: Prisma.JsonValue | undefined, fallback: boolean) {
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

export function readNumberSetting(value: Prisma.JsonValue | undefined, fallback: number) {
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

export function normalizeTypedSettingValue(valueType: SettingValueType | string, value: Prisma.JsonValue) {
  switch (valueType) {
    case SettingValueType.BOOLEAN:
      return readBooleanSetting(value, false);
    case SettingValueType.NUMBER:
      return readNumberSetting(value, 0);
    default:
      return value;
  }
}
