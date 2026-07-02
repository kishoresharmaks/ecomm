export type RazorpayCheckoutOrder = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
};

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
  };
};

export class RazorpayCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayCheckoutError";
  }
}

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (eventName: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

export async function openRazorpayCheckout(
  providerOrder: RazorpayCheckoutOrder,
  description: string,
) {
  await loadRazorpayScript();
  const Razorpay = window.Razorpay;

  if (!Razorpay) {
    throw new Error("Razorpay Checkout could not be loaded.");
  }

  return new Promise<RazorpaySuccessResponse | null>((resolve, reject) => {
    const checkout = new Razorpay({
      key: providerOrder.keyId,
      amount: providerOrder.amountPaise,
      currency: providerOrder.currency,
      name: "1HandIndia",
      description,
      order_id: providerOrder.razorpayOrderId,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => resolve(null),
      },
      theme: {
        color: "#ED3500",
      },
    });

    checkout.on("payment.failed", (response) => {
      reject(new RazorpayCheckoutError(response.error?.description ?? "Razorpay payment failed. Please retry."));
    });
    checkout.open();
  });
}

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only run in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Unable to load Razorpay Checkout.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay Checkout.")),
        { once: true },
      );
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}
