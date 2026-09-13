import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { MobileOrderDetail } from "../features/storefront/storefront-api";

export async function generateAndShareOrderInvoice(order: MobileOrderDetail) {
  const html = buildInvoiceHtml(order);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Invoice ${order.orderNumber}`,
  });
}

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(paise: number | undefined | null, currency: string | undefined): string {
  const amount = (paise ?? 0) / 100;
  const symbol = currency === "USD" ? "$" : "Rs";
  if (currency === "USD") return `${symbol}${amount.toFixed(2)}`;
  return `${symbol} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildInvoiceHtml(order: MobileOrderDetail): string {
  const buyer = formatCurrency(order.totalPaise, order.currency);
  const subtotal = formatCurrency(order.buyerSubtotalMinor ?? order.subtotalPaise, order.currency);
  const shipping = order.shippingPaise ? formatCurrency(order.buyerShippingMinor ?? order.shippingPaise, order.currency) : "FREE";
  const platformFee = formatCurrency(order.buyerPlatformFeeMinor ?? order.platformFeePaise, order.currency);
  const couponDiscount =
    order.couponMerchandiseDiscountPaise || order.couponShippingDiscountPaise
      ? formatCurrency(
          (order.buyerCouponMerchandiseDiscountMinor ?? order.couponMerchandiseDiscountPaise ?? 0) +
            (order.buyerCouponShippingDiscountMinor ?? order.couponShippingDiscountPaise ?? 0),
          order.currency,
        )
      : null;
  const couponCode = order.couponCode ? ` (${escapeHtml(order.couponCode)})` : "";
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

  const itemsRows = order.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.productNameSnapshot)}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unitPricePaise, item.currency ?? order.currency)}</td>
        <td class="right">${formatCurrency(item.lineTotalPaise, item.currency ?? order.currency)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; padding: 32px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand { font-size: 22px; font-weight: 900; color: #ED3500; }
    .brand-sub { font-size: 12px; color: #6B7280; margin-top: 4px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 20px; font-weight: 900; }
    .invoice-title p { color: #6B7280; font-size: 13px; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .info-block h3 { font-size: 12px; text-transform: uppercase; color: #9AA4B2; letter-spacing: 0.05em; margin-bottom: 8px; }
    .info-block p { font-weight: 700; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #FFF4EF; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #6B7280; font-weight: 800; }
    td { padding: 10px 12px; border-bottom: 1px solid #F3E7E2; }
    td.center { text-align: center; }
    td.right { text-align: right; }
    .totals { display: flex; justify-content: flex-end; }
    .totals table { width: 280px; }
    .totals td { padding: 6px 0; }
    .totals td:last-child { text-align: right; font-weight: 800; }
    .totals tr.grand td { font-size: 16px; color: #ED3500; border-top: 2px solid #ED3500; padding-top: 10px; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #F3E7E2; text-align: center; color: #9AA4B2; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">1HandIndia</div>
      <div class="brand-sub">Your trusted marketplace</div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <p>Order: ${escapeHtml(order.orderNumber)}</p>
      <p>${date}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Order Details</h3>
      <p>${escapeHtml(order.orderNumber)}</p>
    </div>
    <div class="info-block">
      <h3>Order Status</h3>
      <p>${escapeHtml(order.orderStatus)} / ${escapeHtml(order.paymentStatus)} / ${escapeHtml(order.deliveryStatus)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="center">Qty</th>
        <th class="right">Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>${subtotal}</td></tr>
      <tr><td>Shipping</td><td>${shipping}</td></tr>
      <tr><td>Platform fee</td><td>${platformFee}</td></tr>
      ${couponDiscount ? `<tr><td>Coupon${couponCode}</td><td>-${couponDiscount}</td></tr>` : ""}
      <tr class="grand"><td>Total</td><td>${buyer}</td></tr>
    </table>
  </div>

  <div class="footer">
    Thank you for shopping with 1HandIndia. For support, contact us through the app.
  </div>
</body>
</html>`;
}
