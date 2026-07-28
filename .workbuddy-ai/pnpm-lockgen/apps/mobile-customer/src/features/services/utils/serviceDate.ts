const SERVICE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseServiceDate(value?: string | null) {
  const match = value?.trim().match(SERVICE_DATE_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function serviceDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatServiceDate(value?: string | null) {
  const date = parseServiceDate(value);
  if (!date) {
    return "Select a date";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(date);
}

export function serviceDatePickerValue(value?: string | null, now = new Date()) {
  return parseServiceDate(value) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

export function earliestServiceDate(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
