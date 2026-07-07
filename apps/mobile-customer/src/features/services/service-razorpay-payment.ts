import * as SecureStore from "expo-secure-store";
import { MobileApiError, type MobileAuthHeaders } from "../../lib/api";
import { captureMobileException, trackMobileEvent } from "../../lib/mobile-telemetry";
import { colors } from "../../theme";
import {
  createCustomerServiceRazorpayOrder,
  verifyCustomerServiceRazorpayPayment,
} from "./services-api";
import type {
  BackendServiceRazorpayOrderResponse,
  BackendServiceRazorpayVerificationResponse,
  MobileServiceBooking,
  MobileServicePayment,
} from "./types";

export const SERVICE_RAZORPAY_CHECKOUT_CANCELLED_ERROR =
  "Payment was cancelled. You can retry payment from this service booking.";
export const SERVICE_RAZORPAY_CHECKOUT_TIMEOUT_ERROR =
  "Service payment timed out. We will keep checking this booking before starting another payment.";
export const SERVICE_RAZORPAY_VERIFICATION_PENDING_MESSAGE =
  "Payment received. Verifying with 1HandIndia...";
export const SERVICE_RAZORPAY_VERIFICATION_ERROR =
  "Payment received, but verification could not finish. Please tap Verify payment before retrying.";
export const SERVICE_RAZORPAY_PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;
export const SERVICE_RAZORPAY_SESSION_MAX_AGE_MS = 30 * 60 * 1000;
const SERVICE_RAZORPAY_PAYMENT_SESSION_KEY = "indihub.mobile.service-razorpay-payment-session";
const SERVICE_RAZORPAY_PROVIDER_ORDER_RETRY_COUNT = 3;

export type MobileServiceRazorpayPaymentStage = "provider-order" | "checkout" | "verification";

export type MobileServiceRazorpayPrefill = {
  email?: string;
  phone?: string;
  fullName?: string;
};

export type MobileServiceRazorpaySessionStatus =
  | "pending"
  | "checkout_succeeded_verification_pending"
  | "completed"
  | "timed_out"
  | "cancelled"
  | "verification_failed";

export type MobileServiceRazorpayPaymentSession = {
  bookingNumber: string;
  servicePaymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amountPaise: number;
  currency: string;
  startTime: number;
  lastUpdated: number;
  status: MobileServiceRazorpaySessionStatus;
  retryCount: number;
};

export type MobileServiceRazorpayCheckoutOptions = {
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

export type MobileServiceRazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

export class MobileServiceRazorpayPaymentError extends Error {
  readonly stage: MobileServiceRazorpayPaymentStage;
  readonly originalError: unknown;
  readonly bookingNumber: string | undefined;
  readonly servicePaymentId: string | undefined;
  readonly razorpayOrderId: string | undefined;
  readonly userCancelled: boolean;
  readonly timeout: boolean;

  constructor(
    stage: MobileServiceRazorpayPaymentStage,
    message: string,
    options: {
      bookingNumber?: string;
      originalError?: unknown;
      razorpayOrderId?: string;
      servicePaymentId?: string;
      timeout?: boolean;
      userCancelled?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "MobileServiceRazorpayPaymentError";
    this.stage = stage;
    this.originalError = options.originalError;
    this.bookingNumber = options.bookingNumber;
    this.razorpayOrderId = options.razorpayOrderId;
    this.servicePaymentId = options.servicePaymentId;
    this.timeout = Boolean(options.timeout);
    this.userCancelled = Boolean(options.userCancelled);
  }
}

export function buildServiceRazorpayCheckoutOptions(
  providerOrder: BackendServiceRazorpayOrderResponse,
  prefill: MobileServiceRazorpayPrefill = {},
): MobileServiceRazorpayCheckoutOptions {
  const normalizedPrefill = razorpayPrefill(prefill);

  return {
    key: providerOrder.keyId,
    amount: providerOrder.amountPaise,
    currency: providerOrder.currency,
    name: "1HandIndia",
    description: `Service booking ${providerOrder.bookingNumber}`,
    order_id: providerOrder.razorpayOrderId,
    ...(normalizedPrefill ? { prefill: normalizedPrefill } : {}),
    notes: {
      bookingNumber: providerOrder.bookingNumber,
      purpose: providerOrder.purpose,
      servicePaymentId: providerOrder.servicePaymentId,
      source: "mobile-customer",
    },
    theme: {
      color: colors.primary,
    },
  };
}

export async function runMobileServiceRazorpayPayment(input: {
  auth: MobileAuthHeaders;
  bookingNumber: string;
  paymentId: string;
  prefill?: MobileServiceRazorpayPrefill;
  timeoutMs?: number;
  onStageChange?: (stage: MobileServiceRazorpayPaymentStage) => void;
}): Promise<BackendServiceRazorpayVerificationResponse> {
  const recovered = await recoverServiceRazorpayPaymentSession();
  if (recovered?.bookingNumber === input.bookingNumber && recovered.servicePaymentId === input.paymentId && hasCheckoutResponse(recovered)) {
    return verifyStoredServiceRazorpayPayment(input.auth, recovered, input.onStageChange);
  }

  let providerOrder: BackendServiceRazorpayOrderResponse;
  try {
    input.onStageChange?.("provider-order");
    trackMobileEvent("service_razorpay_provider_order_start", {
      bookingNumber: input.bookingNumber,
      servicePaymentId: input.paymentId,
    });
    providerOrder = await createServiceProviderOrderWithRetry(input.auth, input.bookingNumber, input.paymentId);
    await saveServiceRazorpayPaymentSessionBestEffort({
      bookingNumber: providerOrder.bookingNumber,
      servicePaymentId: providerOrder.servicePaymentId,
      razorpayOrderId: providerOrder.razorpayOrderId,
      amountPaise: providerOrder.amountPaise,
      currency: providerOrder.currency,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      status: "pending",
      retryCount: 0,
    });
  } catch (error) {
    captureMobileException(error, "service_razorpay_provider_order_failed", {
      bookingNumber: input.bookingNumber,
      servicePaymentId: input.paymentId,
      stage: "provider-order",
    });
    throw new MobileServiceRazorpayPaymentError(
      "provider-order",
      serviceProviderOrderErrorMessage(error),
      { bookingNumber: input.bookingNumber, originalError: error, servicePaymentId: input.paymentId },
    );
  }

  let checkoutResponse: MobileServiceRazorpaySuccessResponse;
  try {
    input.onStageChange?.("checkout");
    checkoutResponse = await runWithServiceRazorpayTimeout(
      openMobileServiceRazorpayCheckout(providerOrder, input.prefill),
      input.timeoutMs ?? SERVICE_RAZORPAY_PAYMENT_TIMEOUT_MS,
    );
  } catch (error) {
    await markServiceRazorpayPaymentSessionStatus(
      error instanceof MobileServiceRazorpayPaymentError && error.timeout
        ? "timed_out"
        : error instanceof MobileServiceRazorpayPaymentError && error.userCancelled
          ? "cancelled"
          : "pending",
    );
    if (!(error instanceof MobileServiceRazorpayPaymentError && error.userCancelled)) {
      captureMobileException(error, "service_razorpay_checkout_failed", {
        bookingNumber: providerOrder.bookingNumber,
        razorpayOrderId: providerOrder.razorpayOrderId,
        servicePaymentId: providerOrder.servicePaymentId,
        stage: "checkout",
      });
    }
    throw error;
  }

  const razorpayOrderId = checkoutResponse.razorpay_order_id ?? providerOrder.razorpayOrderId;
  const razorpayPaymentId = checkoutResponse.razorpay_payment_id;
  const razorpaySignature = checkoutResponse.razorpay_signature;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    await markServiceRazorpayPaymentSessionStatus("verification_failed");
    throw new MobileServiceRazorpayPaymentError("verification", SERVICE_RAZORPAY_VERIFICATION_ERROR, {
      bookingNumber: providerOrder.bookingNumber,
      razorpayOrderId,
      servicePaymentId: providerOrder.servicePaymentId,
    });
  }

  const session: MobileServiceRazorpayPaymentSession = {
    bookingNumber: providerOrder.bookingNumber,
    servicePaymentId: providerOrder.servicePaymentId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    amountPaise: providerOrder.amountPaise,
    currency: providerOrder.currency,
    startTime: Date.now(),
    lastUpdated: Date.now(),
    status: "checkout_succeeded_verification_pending",
    retryCount: 0,
  };
  await saveServiceRazorpayPaymentSession(session);
  return verifyStoredServiceRazorpayPayment(input.auth, session, input.onStageChange);
}

export async function verifyStoredServiceRazorpayPayment(
  auth: MobileAuthHeaders,
  session: MobileServiceRazorpayPaymentSession,
  onStageChange?: (stage: MobileServiceRazorpayPaymentStage) => void,
): Promise<BackendServiceRazorpayVerificationResponse> {
  if (!hasCheckoutResponse(session)) {
    throw new MobileServiceRazorpayPaymentError("verification", "Payment verification details are not available.", {
      bookingNumber: session.bookingNumber,
      razorpayOrderId: session.razorpayOrderId,
      servicePaymentId: session.servicePaymentId,
    });
  }

  try {
    onStageChange?.("verification");
    const verification = await verifyCustomerServiceRazorpayPayment(auth, session.bookingNumber, {
      razorpayOrderId: session.razorpayOrderId,
      razorpayPaymentId: session.razorpayPaymentId,
      razorpaySignature: session.razorpaySignature,
    });
    if (isPaidServiceRazorpayStatus(verification.status)) {
      await clearServiceRazorpayPaymentSession();
    } else {
      await markServiceRazorpayPaymentSessionStatus("verification_failed");
    }
    return verification;
  } catch (error) {
    await markServiceRazorpayPaymentSessionStatus("checkout_succeeded_verification_pending");
    captureMobileException(error, "service_razorpay_verification_failed", {
      bookingNumber: session.bookingNumber,
      razorpayOrderId: session.razorpayOrderId,
      servicePaymentId: session.servicePaymentId,
      stage: "verification",
    });
    throw new MobileServiceRazorpayPaymentError("verification", SERVICE_RAZORPAY_VERIFICATION_ERROR, {
      bookingNumber: session.bookingNumber,
      originalError: error,
      razorpayOrderId: session.razorpayOrderId,
      servicePaymentId: session.servicePaymentId,
    });
  }
}

export async function createServiceProviderOrderWithRetry(
  auth: MobileAuthHeaders,
  bookingNumber: string,
  paymentId: string,
  maxRetries = SERVICE_RAZORPAY_PROVIDER_ORDER_RETRY_COUNT,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await createCustomerServiceRazorpayOrder(auth, bookingNumber, paymentId);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isTransientServiceRazorpayProviderOrderError(error)) {
        break;
      }
      await wait(350 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

export async function openMobileServiceRazorpayCheckout(
  providerOrder: BackendServiceRazorpayOrderResponse,
  prefill?: MobileServiceRazorpayPrefill,
): Promise<MobileServiceRazorpaySuccessResponse> {
  try {
    const RazorpayCheckout = (await import("react-native-razorpay")).default;
    return (await RazorpayCheckout.open(buildServiceRazorpayCheckoutOptions(providerOrder, prefill))) as MobileServiceRazorpaySuccessResponse;
  } catch (error) {
    if (isRazorpayNativeModuleUnavailable(error)) {
      throw new MobileServiceRazorpayPaymentError(
        "checkout",
        "Razorpay is not available in this app build. Install the latest preview APK and retry payment from this service booking.",
        {
          bookingNumber: providerOrder.bookingNumber,
          originalError: error,
          razorpayOrderId: providerOrder.razorpayOrderId,
          servicePaymentId: providerOrder.servicePaymentId,
        },
      );
    }

    if (isRazorpayUserCancelled(error)) {
      throw new MobileServiceRazorpayPaymentError("checkout", SERVICE_RAZORPAY_CHECKOUT_CANCELLED_ERROR, {
        bookingNumber: providerOrder.bookingNumber,
        originalError: error,
        razorpayOrderId: providerOrder.razorpayOrderId,
        servicePaymentId: providerOrder.servicePaymentId,
        userCancelled: true,
      });
    }

    throw new MobileServiceRazorpayPaymentError("checkout", serviceRazorpayCheckoutErrorMessage(error), {
      bookingNumber: providerOrder.bookingNumber,
      originalError: error,
      razorpayOrderId: providerOrder.razorpayOrderId,
      servicePaymentId: providerOrder.servicePaymentId,
    });
  }
}

export function runWithServiceRazorpayTimeout<T>(
  paymentPromise: Promise<T>,
  timeoutMs = SERVICE_RAZORPAY_PAYMENT_TIMEOUT_MS,
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
        reject(new MobileServiceRazorpayPaymentError("checkout", SERVICE_RAZORPAY_CHECKOUT_TIMEOUT_ERROR, { timeout: true }));
      }
    }, timeoutMs);
  });

  return Promise.race([guardedPaymentPromise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export function isPaidServiceRazorpayStatus(status: string | undefined) {
  const normalized = status?.trim().toUpperCase();
  return normalized === "PAID" || normalized === "CAPTURED";
}

export function serviceRazorpayStatusRetryMessage(status: string | undefined) {
  return `Service payment is ${status ? formatStatusLabel(status) : "pending"}. Please retry from this booking.`;
}

export function canRetryServiceRazorpayPayment(booking: MobileServiceBooking, payment: MobileServicePayment) {
  const provider = payment.provider?.trim().toUpperCase();
  const status = payment.status?.trim().toLowerCase();
  const balanceDuePaise = Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise);
  return provider === "RAZORPAY" && (status === "pending" || status === "failed") && balanceDuePaise > 0 && payment.amountPaise <= balanceDuePaise;
}

export function isServiceRazorpayVerificationPendingForPayment(
  session: MobileServiceRazorpayPaymentSession | null,
  bookingNumber: string,
  paymentId: string,
) {
  return Boolean(
    session &&
      session.bookingNumber === bookingNumber &&
      session.servicePaymentId === paymentId &&
      session.status === "checkout_succeeded_verification_pending" &&
      hasCheckoutResponse(session),
  );
}

export async function saveServiceRazorpayPaymentSession(session: MobileServiceRazorpayPaymentSession) {
  await SecureStore.setItemAsync(
    SERVICE_RAZORPAY_PAYMENT_SESSION_KEY,
    JSON.stringify({
      ...session,
      lastUpdated: Date.now(),
    }),
  );
}

async function saveServiceRazorpayPaymentSessionBestEffort(session: MobileServiceRazorpayPaymentSession) {
  try {
    await saveServiceRazorpayPaymentSession(session);
  } catch (error) {
    captureMobileException(error, "service_razorpay_session_save_failed", {
      bookingNumber: session.bookingNumber,
      razorpayOrderId: session.razorpayOrderId,
      servicePaymentId: session.servicePaymentId,
    });
  }
}

export async function recoverServiceRazorpayPaymentSession(now = Date.now()) {
  const rawSession = await SecureStore.getItemAsync(SERVICE_RAZORPAY_PAYMENT_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  const session = parseServiceRazorpayPaymentSession(rawSession);
  if (!session || now - session.startTime > SERVICE_RAZORPAY_SESSION_MAX_AGE_MS) {
    await clearServiceRazorpayPaymentSession();
    return null;
  }

  return session;
}

export async function clearServiceRazorpayPaymentSession() {
  await SecureStore.deleteItemAsync(SERVICE_RAZORPAY_PAYMENT_SESSION_KEY);
}

export async function markServiceRazorpayPaymentSessionStatus(status: MobileServiceRazorpaySessionStatus) {
  const session = await recoverServiceRazorpayPaymentSession();
  if (!session) {
    return;
  }

  await saveServiceRazorpayPaymentSession({
    ...session,
    status,
    retryCount: status === "pending" || status === "checkout_succeeded_verification_pending" ? session.retryCount : session.retryCount + 1,
  });
}

export function hasCheckoutResponse(
  session: MobileServiceRazorpayPaymentSession,
): session is MobileServiceRazorpayPaymentSession & { razorpayPaymentId: string; razorpaySignature: string } {
  return Boolean(session.razorpayPaymentId && session.razorpaySignature);
}

export function isTransientServiceRazorpayProviderOrderError(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}

function razorpayPrefill(prefill: MobileServiceRazorpayPrefill) {
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

function parseServiceRazorpayPaymentSession(rawSession: string) {
  try {
    const parsed = JSON.parse(rawSession) as Partial<MobileServiceRazorpayPaymentSession>;
    if (
      typeof parsed.bookingNumber !== "string" ||
      typeof parsed.servicePaymentId !== "string" ||
      typeof parsed.razorpayOrderId !== "string" ||
      typeof parsed.amountPaise !== "number" ||
      typeof parsed.currency !== "string" ||
      typeof parsed.startTime !== "number" ||
      typeof parsed.lastUpdated !== "number" ||
      typeof parsed.retryCount !== "number" ||
      !isServiceRazorpaySessionStatus(parsed.status)
    ) {
      return null;
    }

    return parsed as MobileServiceRazorpayPaymentSession;
  } catch {
    return null;
  }
}

function isServiceRazorpaySessionStatus(value: unknown): value is MobileServiceRazorpaySessionStatus {
  return (
    value === "pending" ||
    value === "checkout_succeeded_verification_pending" ||
    value === "completed" ||
    value === "timed_out" ||
    value === "cancelled" ||
    value === "verification_failed"
  );
}

function isRazorpayUserCancelled(error: unknown) {
  const text = `${objectStringValue(error, "code")} ${objectStringValue(error, "description")} ${objectStringValue(error, "message")} ${nestedRazorpayErrorValue(error, "reason")}`.toLowerCase();
  return text.includes("cancel") || text.includes("dismiss") || text.includes("back button") || objectStringValue(error, "code") === "0";
}

function isRazorpayNativeModuleUnavailable(error: unknown) {
  const text = `${objectStringValue(error, "description")} ${objectStringValue(error, "message")} ${objectStringValue(error, "code")}`.toLowerCase();
  return (
    text.includes("rnrazorpaycheckout") ||
    text.includes("razorpayeventemitter") ||
    text.includes("native module") ||
    text.includes("turbomoduleregistry.getenforcing") ||
    text.includes("cannot read property 'open'") ||
    text.includes("undefined is not an object")
  );
}

function serviceRazorpayCheckoutErrorMessage(error: unknown) {
  const description = objectStringValue(error, "description") || nestedRazorpayErrorValue(error, "description");
  if (!description) {
    return "Payment failed in Razorpay. Please retry payment from this service booking.";
  }
  return `Payment failed in Razorpay: ${description}. Please retry payment from this service booking.`;
}

function serviceProviderOrderErrorMessage(error: unknown) {
  if (error instanceof MobileApiError && error.message.trim()) {
    return `Secure service payment could not be started. ${error.message.trim()}`;
  }

  return "Secure service payment could not be started. Please retry from this booking.";
}

function nestedRazorpayErrorValue(error: unknown, key: string) {
  if (!error || typeof error !== "object" || !("error" in error)) {
    return "";
  }

  return objectStringValue((error as { error?: unknown }).error, key);
}

function objectStringValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return "";
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate).trim() : "";
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
