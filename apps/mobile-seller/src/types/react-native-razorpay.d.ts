declare module "react-native-razorpay" {
  export type RazorpayOptions = {
    key: string;
    amount?: number | string;
    currency?: string;
    name?: string;
    description?: string;
    order_id?: string;
    subscription_id?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      hide_topbar?: boolean;
    };
  };

  export type RazorpaySuccessData = {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessData>;
  };

  export default RazorpayCheckout;
}
