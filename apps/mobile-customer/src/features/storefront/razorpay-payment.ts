import * as SecureStore from "expo-secure-store";
import { MobileApiError, type MobileAuthHeaders } from "../../lib/api";
import { colors } from "../../theme";
import {
  createRazorpayProviderOrder,
  getCustomerOrder,
  verifyRazorpayPayment,
  type MobileOrderDetail,
  type MobileRazorpayOrderResponse,
  type MobileRazorpayVerificationResponse,
} from "./storefront-api";

export const RAZORPAY_PROVIDER_ORDER_ERROR =
  "Order placed, but secure payment could not be started. Please retry payment from your order.";
export const RAZORPAY_CHECKOUT_INCOMPLETE_ERROR =
  "Order placed, but online payment was not completed.";
export const RAZORPAY_CHECKOUT_CANCELLED_ERROR =
  "Payment was cancelled. You can retry payment from your order.";
export const RAZORPAY_CHECKOUT_TIMEOUT_ERROR =
  "Order placed, but online payment timed out. Please retry payment from your order.";
export const RAZORPAY_VERIFICATION_ERROR =
  "Order placed, but online payment could not be verified. Please retry payment from your order.";
export const RAZORPAY_PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;
export const RAZORPAY_SESSION_MAX_AGE_MS = 30 * 60 * 1000;
export const RAZORPAY_PROVIDER_ORDER_RETRY_COUNT = 3;
const RAZORPAY_PAYMENT_SESSION_KEY = "indihub:mobile:razorpay-payment-session";
const RAZORPAY_PENDING_ORDER_RETRY_MAX_AGE_MS = 60 * 60 * 1000;
const RAZORPAY_PENDING_PAYMENT_RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type MobileRazorpayPrefill = {
  email?: string;
  phone?: string;
  fullName?: string;
};

export type MobileRazorpayPaymentStage = "provider-order" | "checkout" | "verification";

export type MobileRazorpayPaymentErrorCode =
  | "PROVIDER_ORDER_FAILED"
  | "CHECKOUT_FAILED"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_TIMEOUT"
  | "VERIFICATION_FAILED"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type MobileRazorpayPaymentSessionStatus =
  | "pending"
  | "completed"
  | "timed_out"
  | "cancelled"
  | "verification_failed";

export type MobileRazorpayPaymentSession = {
  orderNumber: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  startTime: number;
  lastUpdated: number;
  status: MobileRazorpayPaymentSessionStatus;
  retryCount: number;
};

type MobileRazorpayPaymentErrorOptions = {
  code?: MobileRazorpayPaymentErrorCode;
  orderNumber?: string;
  originalError?: unknown;
  razorpayOrderId?: string;
};

export type MobileRazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  notes: Record<string, string>;
  theme: {
    color: string;
  };
};

export type MobileRazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

export class MobileRazorpayPaymentError extends Error {
  readonly stage: MobileRazorpayPaymentStage;
  readonly originalError: unknown;
  readonly code: MobileRazorpayPaymentErrorCode;
  readonly orderNumber: string | undefined;
  readonly razorpayOrderId: string | undefined;

  constructor(
    stage: MobileRazorpayPaymentStage,
    message: string,
    optionsOrOriginalError: MobileRazorpayPaymentErrorOptions | unknown = {},
  ) {
    super(message);
    const options = isPaymentErrorOptions(optionsOrOriginalError)
      ? optionsOrOriginalError
      : { originalError: optionsOrOriginalError };
    this.name = "MobileRazorpayPaymentError";
    this.stage = stage;
    this.originalError = options.originalError;
    this.code = options.code ?? "UNKNOWN";
    this.orderNumber = options.orderNumber;
    this.razorpayOrderId = options.razorpayOrderId;
  }

  isUserCancelled() {
    return this.code === "PAYMENT_CANCELLED";
  }

  isNetworkError() {
    return this.code === "NETWORK_ERROR" || (this.originalError instanceof MobileApiError && isTransientRazorpayProviderOrderError(this.originalError));
  }

  isTimeout() {
    return this.code === "PAYMENT_TIMEOUT";
  }
}

export function buildRazorpayCheckoutOptions(
  providerOrder: MobileRazorpayOrderResponse,
  prefill: MobileRazorpayPrefill = {},
): MobileRazorpayCheckoutOptions {
  const normalizedPrefill = razorpayPrefill(prefill);

  return {
    key: providerOrder.keyId,
    amount: providerOrder.amountPaise,
    currency: providerOrder.currency,
    name: "1HandIndia",
    description: `Order ${providerOrder.orderNumber}`,
    order_id: providerOrder.razorpayOrderId,
    ...(normalizedPrefill ? { prefill: normalizedPrefill } : {}),
    notes: {
      orderNumber: providerOrder.orderNumber,
      source: "mobile-customer",
    },
    theme: {
      color: colors.primary,
    },
  };
}

export async function runMobileRazorpayPayment(input: {
  auth: MobileAuthHeaders;
  orderNumber: string;
  prefill?: MobileRazorpayPrefill;
  timeoutMs?: number;
  onStageChange?: (stage: MobileRazorpayPaymentStage) => void;
}): Promise<MobileRazorpayVerificationResponse> {
  let providerOrder: MobileRazorpayOrderResponse;
  try {
    input.onStageChange?.("provider-order");
    providerOrder = await createProviderOrderWithRetry(input.auth, input.orderNumber);
    await saveRazorpayPaymentSession({
      orderNumber: providerOrder.orderNumber,
      razorpayOrderId: providerOrder.razorpayOrderId,
      amountPaise: providerOrder.amountPaise,
      currency: providerOrder.currency,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      status: "pending",
      retryCount: 0,
    });
  } catch (error) {
    throw new MobileRazorpayPaymentError("provider-order", RAZORPAY_PROVIDER_ORDER_ERROR, {
      code: razorpayErrorCode(error, "PROVIDER_ORDER_FAILED"),
      orderNumber: input.orderNumber,
      originalError: error,
    });
  }

  let checkoutResponse: MobileRazorpaySuccessResponse;
  try {
    input.onStageChange?.("checkout");
    checkoutResponse = await runWithRazorpayTimeout(
      openMobileRazorpayCheckout(providerOrder, input.prefill),
      input.timeoutMs ?? RAZORPAY_PAYMENT_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof MobileRazorpayPaymentError) {
      await markRazorpayPaymentSessionStatus(error.isTimeout() ? "timed_out" : error.isUserCancelled() ? "cancelled" : "pending");
      throw error;
    }

    await markRazorpayPaymentSessionStatus("pending");
    throw new MobileRazorpayPaymentError("checkout", RAZORPAY_CHECKOUT_INCOMPLETE_ERROR, {
      code: razorpayErrorCode(error, "CHECKOUT_FAILED"),
      orderNumber: providerOrder.orderNumber,
      originalError: error,
      razorpayOrderId: providerOrder.razorpayOrderId,
    });
  }

  const razorpayOrderId = checkoutResponse.razorpay_order_id ?? providerOrder.razorpayOrderId;
  const razorpayPaymentId = checkoutResponse.razorpay_payment_id;
  const razorpaySignature = checkoutResponse.razorpay_signature;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    await markRazorpayPaymentSessionStatus("verification_failed");
    throw new MobileRazorpayPaymentError("verification", RAZORPAY_VERIFICATION_ERROR, {
      code: "INVALID_RESPONSE",
      orderNumber: providerOrder.orderNumber,
      razorpayOrderId,
    });
  }

  try {
    input.onStageChange?.("verification");
    const verification = await verifyRazorpayPayment(input.auth, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (isPaidRazorpayStatus(verification.status)) {
      await clearRazorpayPaymentSession();
    } else {
      await markRazorpayPaymentSessionStatus("verification_failed");
    }

    return verification;
  } catch (error) {
    await markRazorpayPaymentSessionStatus("verification_failed");
    throw new MobileRazorpayPaymentError("verification", RAZORPAY_VERIFICATION_ERROR, {
      code: razorpayErrorCode(error, "VERIFICATION_FAILED"),
      orderNumber: providerOrder.orderNumber,
      originalError: error,
      razorpayOrderId,
    });
  }
}

export async function createProviderOrderWithRetry(
  auth: MobileAuthHeaders,
  orderNumber: string,
  maxRetries = RAZORPAY_PROVIDER_ORDER_RETRY_COUNT,
): Promise<MobileRazorpayOrderResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await createRazorpayProviderOrder(auth, orderNumber);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isTransientRazorpayProviderOrderError(error)) {
        break;
      }

      await wait(350 * 2 ** (attempt - 1));
    }
  }

  throw new MobileRazorpayPaymentError("provider-order", RAZORPAY_PROVIDER_ORDER_ERROR, {
    code: razorpayErrorCode(lastError, "PROVIDER_ORDER_FAILED"),
    orderNumber,
    originalError: lastError,
  });
}

export async function openMobileRazorpayCheckout(
  providerOrder: MobileRazorpayOrderResponse,
  prefill?: MobileRazorpayPrefill,
): Promise<MobileRazorpaySuccessResponse> {
  const RazorpayCheckout = (await import("react-native-razorpay")).default;
  try {
    return (await RazorpayCheckout.open(buildRazorpayCheckoutOptions(providerOrder, prefill))) as MobileRazorpaySuccessResponse;
  } catch (error) {
    if (isRazorpayUserCancelled(error)) {
      throw new MobileRazorpayPaymentError("checkout", RAZORPAY_CHECKOUT_CANCELLED_ERROR, {
        code: "PAYMENT_CANCELLED",
        orderNumber: providerOrder.orderNumber,
        originalError: error,
        razorpayOrderId: providerOrder.razorpayOrderId,
      });
    }

    throw error;
  }
}

export function runWithRazorpayTimeout<T>(
  paymentPromise: Promise<T>,
  timeoutMs = RAZORPAY_PAYMENT_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  const guardedPaymentPromise = paymentPromise.then(
    (result) => {
      settled = true;
      return result;
    },
    (error: unknown) => {
      settled = true;
      throw error;
    },
  );
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      if (!settled) {
        reject(new MobileRazorpayPaymentError("checkout", RAZORPAY_CHECKOUT_TIMEOUT_ERROR, { code: "PAYMENT_TIMEOUT" }));
      }
    }, timeoutMs);
  });

  return Promise.race([guardedPaymentPromise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export function isPaidRazorpayStatus(status: string | undefined) {
  const normalized = status?.trim().toUpperCase();
  return normalized === "PAID" || normalized === "CAPTURED";
}

export function isRazorpayActionInFlight(placeOrderPending: boolean, retryPaymentPending: boolean) {
  return placeOrderPending || retryPaymentPending;
}

export function razorpayStatusRetryMessage(status: string | undefined) {
  return `Order placed, but online payment is ${status ? formatStatusLabel(status) : "pending"}. Please retry payment from your order.`;
}

export async function saveRazorpayPaymentSession(session: MobileRazorpayPaymentSession) {
  await SecureStore.setItemAsync(
    RAZORPAY_PAYMENT_SESSION_KEY,
    JSON.stringify({
      ...session,
      lastUpdated: Date.now(),
    }),
  );
}

export async function recoverRazorpayPaymentSession(now = Date.now()): Promise<MobileRazorpayPaymentSession | null> {
  const rawSession = await SecureStore.getItemAsync(RAZORPAY_PAYMENT_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  const session = parseRazorpayPaymentSession(rawSession);
  if (!session || now - session.startTime > RAZORPAY_SESSION_MAX_AGE_MS) {
    await clearRazorpayPaymentSession();
    return null;
  }

  return session;
}

export async function clearRazorpayPaymentSession() {
  await SecureStore.deleteItemAsync(RAZORPAY_PAYMENT_SESSION_KEY);
}

export async function markRazorpayPaymentSessionStatus(status: MobileRazorpayPaymentSessionStatus) {
  const session = await recoverRazorpayPaymentSession();
  if (!session) {
    return;
  }

  await saveRazorpayPaymentSession({
    ...session,
    status,
    retryCount: status === "pending" ? session.retryCount : session.retryCount + 1,
  });
}

export async function recoverPendingRazorpayPayment(auth: MobileAuthHeaders) {
  const session = await recoverRazorpayPaymentSession();
  if (!session) {
    return null;
  }

  const order = await getCustomerOrder(auth, session.orderNumber);
  if (isPaidRazorpayStatus(order.paymentStatus)) {
    await clearRazorpayPaymentSession();
  }

  return { order, session };
}

export function isTransientRazorpayProviderOrderError(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}

export function razorpayErrorCode(error: unknown, fallback: MobileRazorpayPaymentErrorCode): MobileRazorpayPaymentErrorCode {
  if (error instanceof MobileRazorpayPaymentError) {
    return error.code;
  }

  if (error instanceof MobileApiError && error.status === 0) {
    return "NETWORK_ERROR";
  }

  return fallback;
}

export function canRetryRazorpayPayment(order: Pick<MobileOrderDetail, "createdAt" | "paymentStatus" | "payments">) {
  if (order.paymentStatus?.trim().toUpperCase() !== "PENDING") {
    return false;
  }

  if (!isRecentTimestamp(order.createdAt, RAZORPAY_PENDING_ORDER_RETRY_MAX_AGE_MS)) {
    return false;
  }

  return Boolean(
    order.payments?.some((payment) => {
      const method = payment.method?.trim().toUpperCase();
      const provider = payment.provider?.trim().toUpperCase();
      const status = payment.status?.trim().toUpperCase();
      return (
        status === "PENDING" &&
        (method === "RAZORPAY" || provider === "RAZORPAY") &&
        isRecentTimestamp(payment.createdAt, RAZORPAY_PENDING_PAYMENT_RETRY_MAX_AGE_MS)
      );
    }),
  );
}

function razorpayPrefill(prefill: MobileRazorpayPrefill) {
  const email = prefill.email?.trim();
  const contact = prefill.phone?.replace(/\D/g, "").trim();
  const name = prefill.fullName?.trim();

  if (!email && !contact && !name) {
    return null;
  }

  return {
    ...(email ? { email } : {}),
    ...(contact ? { contact } : {}),
    ...(name ? { name } : {}),
  };
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseRazorpayPaymentSession(rawSession: string) {
  try {
    const parsed = JSON.parse(rawSession) as Partial<MobileRazorpayPaymentSession>;
    if (
      typeof parsed.orderNumber !== "string" ||
      typeof parsed.razorpayOrderId !== "string" ||
      typeof parsed.amountPaise !== "number" ||
      typeof parsed.currency !== "string" ||
      typeof parsed.startTime !== "number" ||
      typeof parsed.lastUpdated !== "number" ||
      typeof parsed.retryCount !== "number" ||
      !isRazorpaySessionStatus(parsed.status)
    ) {
      return null;
    }

    return parsed as MobileRazorpayPaymentSession;
  } catch {
    return null;
  }
}

function isRazorpaySessionStatus(value: unknown): value is MobileRazorpayPaymentSessionStatus {
  return value === "pending" || value === "completed" || value === "timed_out" || value === "cancelled" || value === "verification_failed";
}

function isRecentTimestamp(value: string | undefined, maxAgeMs: number) {
  if (!value) {
    return true;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function isRazorpayUserCancelled(error: unknown) {
  const code = errorCodeText(error);
  const description = errorDescriptionText(error);
  return code.includes("CANCEL") || description.includes("cancel") || description.includes("dismiss") || description.includes("back button");
}

function errorCodeText(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "").toUpperCase();
  }

  return "";
}

function errorDescriptionText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate =
    "description" in error
      ? (error as { description?: unknown }).description
      : "message" in error
        ? (error as { message?: unknown }).message
        : "";
  return String(candidate ?? "").toLowerCase();
}

function isPaymentErrorOptions(value: unknown): value is MobileRazorpayPaymentErrorOptions {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("code" in value || "orderNumber" in value || "originalError" in value || "razorpayOrderId" in value),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
