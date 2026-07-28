export function rupeesToPaise(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}
