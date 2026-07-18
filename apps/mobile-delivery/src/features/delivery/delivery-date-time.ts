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
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
