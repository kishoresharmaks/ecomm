import { IndihubApiError, requestTimedOutMessage } from "@/lib/api";

export type CouponFeedbackTone = "success" | "danger" | "warning" | "info";

export type CouponFeedback = {
  tone: CouponFeedbackTone;
  message: string;
};

export function normalizeCouponCodeInput(value: string) {
  return value.trim().toUpperCase();
}

export function validateCouponCodeInput(code: string): CouponFeedback | null {
  if (!code) {
    return {
      tone: "warning",
      message: "Enter a coupon code to apply.",
    };
  }

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return {
      tone: "warning",
      message: "Check the coupon code. Use 3-32 letters, numbers, hyphen, or underscore.",
    };
  }

  return null;
}

export function couponApplyErrorMessage(error: unknown): string {
  if (error instanceof IndihubApiError) {
    if (error.status === 429) {
      return "Too many coupon attempts. Please wait a minute and try again.";
    }

    if (error.status === 401 || error.status === 403) {
      return "Please sign in again to apply this coupon.";
    }

    return customerCouponMessage(error.message);
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return requestTimedOutMessage;
    }

    return customerCouponMessage(error.message);
  }

  return "We could not apply this coupon. Please check the code or try another one.";
}

export function couponFeedbackClassName(tone: CouponFeedbackTone) {
  switch (tone) {
    case "success":
      return "text-[#0F8A5F]";
    case "warning":
      return "text-[#8A5A00]";
    case "danger":
      return "text-[#B42318]";
    default:
      return "text-[#163B5C]";
  }
}

function customerCouponMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return "We could not apply this coupon. Please check the code or try another one.";
  }

  if (normalized.includes("3-32") || normalized.includes("a-z") || normalized.includes("0-9")) {
    return "Check the coupon code. Use 3-32 letters, numbers, hyphen, or underscore.";
  }

  if (normalized.includes("wait") || normalized.includes("too many")) {
    return "Too many coupon attempts. Please wait a minute and try again.";
  }

  if (normalized.includes("cannot be applied") || normalized.includes("not found")) {
    return "This coupon is not valid for the items in your cart.";
  }

  if (normalized.includes("busy")) {
    return "Coupon validation is busy right now. Please try again.";
  }

  if (normalized.includes("expired")) {
    return "This coupon has expired.";
  }

  return "We could not apply this coupon. Please check the code or try another one.";
}
