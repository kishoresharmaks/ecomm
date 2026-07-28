export function parseDeliveryEstimate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function defaultDeliveryEstimate(now = new Date()) {
  const estimate = new Date(now);
  estimate.setDate(estimate.getDate() + 1);
  estimate.setSeconds(0, 0);
  estimate.setMinutes(Math.ceil(estimate.getMinutes() / 15) * 15);
  return estimate;
}

export function withDeliveryDate(current: Date | null, selectedDate: Date, now = new Date()) {
  const next = new Date(current?.getTime() ?? defaultDeliveryEstimate(now).getTime());
  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  return next;
}

export function withDeliveryTime(current: Date | null, selectedTime: Date, now = new Date()) {
  const next = new Date(current?.getTime() ?? defaultDeliveryEstimate(now).getTime());
  next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
  return next;
}

export function serializeDeliveryEstimate(value: Date | null) {
  if (!value) {
    return undefined;
  }
  if (Number.isNaN(value.getTime())) {
    throw new Error("Select a valid estimated delivery date and time.");
  }
  return value.toISOString();
}

export function deliveryEstimateError(value: Date | null, now = new Date()) {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) return "Select a valid estimated delivery date and time.";
  return value.getTime() < now.getTime() ? "Estimated delivery must be in the future." : null;
}

export function nextAttemptDateError(value: string, now = new Date()) {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return "Use YYYY-MM-DD format.";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "Enter a real calendar date.";
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date < today ? "Next attempt date cannot be in the past." : null;
}

export function formatDeliveryEstimateDate(value: Date | null) {
  if (!value) {
    return "Select date";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(value);
}

export function formatDeliveryEstimateTime(value: Date | null) {
  if (!value) {
    return "Select time";
  }
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function earliestDeliveryDate(now = new Date()) {
  return new Date(now);
}
