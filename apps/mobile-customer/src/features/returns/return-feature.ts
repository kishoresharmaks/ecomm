const DEFAULT_ROLLOUT_PERCENT = 100;

export function isMobileReturnsEnabled(stableCustomerKey?: string | null) {
  if (isExplicitlyFalse(process.env.EXPO_PUBLIC_ENABLE_RETURNS)) {
    return false;
  }

  const rolloutPercent = parseRolloutPercent(process.env.EXPO_PUBLIC_RETURNS_ROLLOUT_PERCENT);
  if (rolloutPercent >= 100) {
    return true;
  }

  if (rolloutPercent <= 0) {
    return false;
  }

  return stablePercentBucket(stableCustomerKey ?? "anonymous") < rolloutPercent;
}

export function parseRolloutPercent(value?: string | null) {
  if (!value?.trim()) {
    return DEFAULT_ROLLOUT_PERCENT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROLLOUT_PERCENT;
  }

  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

export function stablePercentBucket(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
}

function isExplicitlyFalse(value?: string | null) {
  return ["0", "false", "no", "off"].includes(value?.trim().toLowerCase() ?? "");
}
