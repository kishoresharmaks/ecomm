export function rupeesToPaise(value: string | number) {
  const normalized = typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }
  return Math.round(normalized * 100);
}

export function paiseToRupees(paise: number) {
  return (paise / 100).toFixed(2);
}

export function formatMoney(paise?: number | null, currency = "INR") {
  const amount = (paise ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
