declare module "react-native-razorpay" {
  export type RazorpayOptions = {
    key: string;
    amount: number | string;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    order_id?: string;
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
    readonly?: {
      email?: boolean;
      contact?: boolean;
      name?: boolean;
    };
  };

  export type RazorpaySuccessData = {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessData>;
  };

  export default RazorpayCheckout;
}
