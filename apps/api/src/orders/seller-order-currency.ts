type SellerOrderCurrencyItem = {
  id: string;
  sellerId: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  variantSnapshot: unknown;
};

export type SellerOrderCurrencyContext = {
  currency: string;
  baseCurrency: string;
  rate: number;
  source: "ORDER_ITEM_PRICE_SNAPSHOT" | "BASE_CURRENCY_FALLBACK";
  sellerSubtotalMinor: number;
  itemAmounts: Record<string, { unitPriceMinor: number; lineTotalMinor: number }>;
};

function normalizedCurrency(value: unknown) {
  if (typeof value !== "string") return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function nonNegativeSafeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function snapshotRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveSellerOrderCurrency(
  baseCurrencyInput: string,
  sellerId: string,
  items: SellerOrderCurrencyItem[],
): SellerOrderCurrencyContext {
  const baseCurrency = normalizedCurrency(baseCurrencyInput) ?? "INR";
  const sellerItems = items.filter((item) => item.sellerId === sellerId);
  const fallback = (): SellerOrderCurrencyContext => ({
    currency: baseCurrency,
    baseCurrency,
    rate: 1,
    source: "BASE_CURRENCY_FALLBACK",
    sellerSubtotalMinor: sellerItems.reduce((sum, item) => sum + item.lineTotalPaise, 0),
    itemAmounts: Object.fromEntries(
      sellerItems.map((item) => [
        item.id,
        {
          unitPriceMinor: item.unitPricePaise,
          lineTotalMinor: item.lineTotalPaise,
        },
      ]),
    ),
  });

  if (!sellerItems.length) return fallback();

  let sellerCurrency: string | null = null;
  let sellerSubtotalMinor = 0;
  let baseSubtotalMinor = 0;
  const itemAmounts: SellerOrderCurrencyContext["itemAmounts"] = {};

  for (const item of sellerItems) {
    const snapshot = snapshotRecord(item.variantSnapshot);
    const itemSellerCurrency = normalizedCurrency(snapshot?.sellerCurrency);
    const snapshotBaseCurrency = normalizedCurrency(snapshot?.baseCurrency);
    const sellerUnitPriceMinor = nonNegativeSafeInteger(snapshot?.sellerUnitPriceMinor);
    const snapshotBaseUnitMinor = nonNegativeSafeInteger(snapshot?.baseUnitPricePaise);

    if (
      !itemSellerCurrency ||
      snapshotBaseCurrency !== baseCurrency ||
      sellerUnitPriceMinor === null ||
      snapshotBaseUnitMinor === null ||
      snapshotBaseUnitMinor !== item.unitPricePaise ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 0
    ) {
      return fallback();
    }

    if (sellerCurrency && sellerCurrency !== itemSellerCurrency) return fallback();
    sellerCurrency = itemSellerCurrency;

    const sellerLineTotalMinor = sellerUnitPriceMinor * item.quantity;
    if (!Number.isSafeInteger(sellerLineTotalMinor)) return fallback();

    sellerSubtotalMinor += sellerLineTotalMinor;
    baseSubtotalMinor += item.lineTotalPaise;
    if (!Number.isSafeInteger(sellerSubtotalMinor) || !Number.isSafeInteger(baseSubtotalMinor)) {
      return fallback();
    }

    itemAmounts[item.id] = {
      unitPriceMinor: sellerUnitPriceMinor,
      lineTotalMinor: sellerLineTotalMinor,
    };
  }

  if (!sellerCurrency) return fallback();
  if (sellerCurrency === baseCurrency) {
    return {
      currency: sellerCurrency,
      baseCurrency,
      rate: 1,
      source: "ORDER_ITEM_PRICE_SNAPSHOT",
      sellerSubtotalMinor,
      itemAmounts,
    };
  }

  if (baseSubtotalMinor <= 0 || sellerSubtotalMinor <= 0) return fallback();
  const rate = sellerSubtotalMinor / baseSubtotalMinor;
  if (!Number.isFinite(rate) || rate <= 0) return fallback();

  return {
    currency: sellerCurrency,
    baseCurrency,
    rate,
    source: "ORDER_ITEM_PRICE_SNAPSHOT",
    sellerSubtotalMinor,
    itemAmounts,
  };
}

export function convertBaseMinorToSellerMinor(
  baseMinor: number | null | undefined,
  context: SellerOrderCurrencyContext,
) {
  const value = baseMinor ?? 0;
  if (!Number.isSafeInteger(value)) return 0;
  return Math.round(value * context.rate);
}
