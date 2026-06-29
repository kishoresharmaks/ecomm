import "dotenv/config";
import {
  ContentStatus,
  EmailRecipientType,
  EmailTemplateCategory,
  NotificationChannel,
  Prisma,
  prisma,
} from "../../packages/database/src/index";
import { emailTriggerCatalog } from "../../apps/api/src/notifications/email-trigger-catalog";

type EmailThemeTokens = {
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonStyle: "SOLID" | "OUTLINE";
  footerText: string;
  borderRadius: number;
  fontFamily: "Arial" | "Inter" | "Georgia" | "Verdana" | "Tahoma";
};

type TemplateSeed = {
  code: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
};

const DEFAULT_EMAIL_SETTING_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_THEME_CODE = "DEFAULT_1HANDINDIA";

const defaultThemeTokens: EmailThemeTokens = {
  logoUrl: "",
  brandColor: "#ED3500",
  accentColor: "#163B5C",
  backgroundColor: "#FFFCFB",
  surfaceColor: "#FFFFFF",
  textColor: "#1F2933",
  mutedTextColor: "#667085",
  buttonBackgroundColor: "#ED3500",
  buttonTextColor: "#FFFFFF",
  buttonStyle: "SOLID",
  footerText: "You received this transactional email from 1HandIndia.",
  borderRadius: 8,
  fontFamily: "Arial",
};

const templates: TemplateSeed[] = [
  {
    code: "CUSTOMER_ACCOUNT_CREATED",
    name: "Customer account created",
    category: EmailTemplateCategory.CUSTOMER,
    subject: "Welcome to 1HandIndia",
    body: [
      "Hello {{customerName}},",
      "",
      "Welcome to 1HandIndia. Your customer account is ready.",
      "",
      "You can now manage your profile, saved addresses, wishlist, cart, orders, service bookings, and support requests from your account.",
    ].join("\n"),
  },
  {
    code: "SELLER_REGISTRATION_RECEIVED",
    name: "Seller registration received",
    category: EmailTemplateCategory.SELLER,
    subject: "We received your seller registration",
    body: [
      "Hello {{contactName}},",
      "",
      "Thank you for registering {{sellerName}} on 1HandIndia.",
      "",
      "Our team will review the submitted business details and documents. We will notify you once the review is complete.",
    ].join("\n"),
  },
  {
    code: "SELLER_REGISTRATION_RECEIVED_ADMIN",
    name: "Seller registration admin alert",
    category: EmailTemplateCategory.SELLER,
    subject: "New seller registration: {{sellerName}}",
    body: [
      "A new seller registration is ready for review.",
      "",
      "Seller: {{sellerName}}",
      "Seller type: {{sellerType}}",
      "Contact email: {{contactEmail}}",
      "",
      "Please review the onboarding details from the admin seller approvals queue.",
    ].join("\n"),
  },
  {
    code: "SELLER_APPROVED",
    name: "Seller approved",
    category: EmailTemplateCategory.SELLER,
    subject: "Your 1HandIndia seller account is approved",
    body: [
      "Hello {{sellerName}},",
      "",
      "Your seller account has been approved.",
      "",
      "You can now access Seller Center, complete your profile, publish eligible products or services, and manage marketplace operations.",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "SELLER_REJECTED",
    name: "Seller rejected or suspended",
    category: EmailTemplateCategory.SELLER,
    subject: "Seller account update for {{sellerName}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "There is an update on your seller account review.",
      "",
      "{{note}}",
      "",
      "Please contact 1HandIndia support if you need clarification or want to submit corrected details.",
    ].join("\n"),
  },
  {
    code: "PRODUCT_SUBMITTED_SELLER",
    name: "Product submitted seller receipt",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Product submitted for approval: {{productName}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "Your product {{productName}} has been submitted for approval.",
      "",
      "We will notify you after the review is complete. You can track the product status from Seller Center.",
    ].join("\n"),
  },
  {
    code: "PRODUCT_SUBMITTED_ADMIN",
    name: "Product submitted admin alert",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Product approval needed: {{productName}}",
    body: [
      "A seller product is waiting for approval.",
      "",
      "Product: {{productName}}",
      "Seller: {{sellerName}}",
      "",
      "Please review catalogue quality, pricing, images, compliance, and category mapping from admin product approvals.",
    ].join("\n"),
  },
  {
    code: "PRODUCT_APPROVED",
    name: "Product approved",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Your product is approved: {{productName}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{productName}} has been approved.",
      "",
      "The product can now appear on the marketplace wherever it meets storefront visibility rules.",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "PRODUCT_REJECTED",
    name: "Product rejected",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Product needs changes: {{productName}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{productName}} could not be approved in its current form.",
      "",
      "{{note}}",
      "",
      "Please update the product details and submit it again from Seller Center.",
    ].join("\n"),
  },
  {
    code: "ORDER_PLACED_CUSTOMER",
    name: "Order placed customer receipt",
    category: EmailTemplateCategory.ORDER,
    subject: "Your 1HandIndia order {{orderNumber}} is placed",
    body: [
      "Your order has been placed successfully.",
      "",
      "Order number: {{orderNumber}}",
      "Order total: {{totalPaise}} paise",
      "",
      "We will notify you as the order moves through confirmation, dispatch, and delivery.",
    ].join("\n"),
  },
  {
    code: "ORDER_RECEIVED_SELLER",
    name: "Order received by seller",
    category: EmailTemplateCategory.ORDER,
    subject: "New order received: {{orderNumber}}",
    body: [
      "A new order is ready for seller action.",
      "",
      "Order number: {{orderNumber}}",
      "Seller amount: {{totalPaise}} paise",
      "",
      "Please open Seller Center to accept, process, pack, and update fulfilment on time.",
    ].join("\n"),
  },
  {
    code: "ORDER_ALERT_ADMIN",
    name: "New order admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "New order alert: {{orderNumber}}",
    body: [
      "A new order has been placed on 1HandIndia.",
      "",
      "Order number: {{orderNumber}}",
      "Order total: {{totalPaise}} paise",
      "",
      "Please monitor payment, seller fulfilment, delivery routing, and support exceptions from admin.",
    ].join("\n"),
  },
  {
    code: "ORDER_CONFIRMED",
    name: "Order confirmed",
    category: EmailTemplateCategory.ORDER,
    subject: "Order {{orderNumber}} is confirmed",
    body: [
      "Your order is confirmed.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "ORDER_PROCESSING",
    name: "Order processing",
    category: EmailTemplateCategory.ORDER,
    subject: "Order {{orderNumber}} is being processed",
    body: [
      "Your order is being prepared.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "ORDER_DISPATCHED",
    name: "Order dispatched",
    category: EmailTemplateCategory.ORDER,
    subject: "Order {{orderNumber}} is on the way",
    body: [
      "Your order has moved to dispatch or transit.",
      "",
      "Order number: {{orderNumber}}",
      "Order status: {{orderStatus}}",
      "Delivery status: {{deliveryStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "ORDER_DELIVERED",
    name: "Order delivered",
    category: EmailTemplateCategory.ORDER,
    subject: "Order {{orderNumber}} is delivered",
    body: [
      "Your order has been marked delivered.",
      "",
      "Order number: {{orderNumber}}",
      "Order status: {{orderStatus}}",
      "Delivery status: {{deliveryStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "ORDER_CANCELLED",
    name: "Order cancelled",
    category: EmailTemplateCategory.ORDER,
    subject: "Order {{orderNumber}} is cancelled",
    body: [
      "Your order has been cancelled.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "PAYMENT_PENDING",
    name: "Payment pending",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment pending for order {{orderNumber}}",
    body: [
      "Payment is pending for your order.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "PAYMENT_SUCCESS",
    name: "Payment successful",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment received for order {{orderNumber}}",
    body: [
      "Your payment has been received.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "PAYMENT_FAILED",
    name: "Payment failed",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment failed for order {{orderNumber}}",
    body: [
      "Payment failed or could not be verified.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "DELIVERY_ASSIGNED_PARTNER",
    name: "Delivery assigned to partner",
    category: EmailTemplateCategory.ORDER,
    subject: "Delivery assigned: order {{orderNumber}}",
    body: [
      "Hello {{partnerName}},",
      "",
      "A delivery task has been assigned to you.",
      "",
      "Order number: {{orderNumber}}",
      "",
      "{{note}}",
      "",
      "Please open the Delivery Partner workspace to accept or update this assignment.",
    ].join("\n"),
  },
  {
    code: "DELIVERY_ASSIGNMENT_ACCEPTED_ADMIN",
    name: "Delivery assignment accepted admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "Delivery accepted: order {{orderNumber}}",
    body: [
      "A delivery partner accepted an assignment.",
      "",
      "Order number: {{orderNumber}}",
      "Partner: {{partnerName}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "DELIVERY_ASSIGNMENT_REJECTED_ADMIN",
    name: "Delivery assignment rejected admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "Delivery rejected: order {{orderNumber}}",
    body: [
      "A delivery partner rejected an assignment.",
      "",
      "Order number: {{orderNumber}}",
      "Partner: {{partnerName}}",
      "",
      "{{note}}",
      "",
      "Please reassign or review delivery operations.",
    ].join("\n"),
  },
  {
    code: "DELIVERY_COD_COLLECTED_ADMIN",
    name: "Delivery COD collected admin alert",
    category: EmailTemplateCategory.PAYMENT,
    subject: "COD collected for order {{orderNumber}}",
    body: [
      "A delivery partner recorded COD cash collection.",
      "",
      "Order number: {{orderNumber}}",
      "Collected amount: {{collectedAmountPaise}} paise",
      "Partner: {{partnerName}}",
      "",
      "Please verify the collection from admin finance/order detail before marking COD paid.",
    ].join("\n"),
  },
  {
    code: "DELIVERY_ROUTING_FAILED_ADMIN",
    name: "Delivery routing failed admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "Delivery routing failed for order {{orderNumber}}",
    body: [
      "Delivery routing failed and needs operations review.",
      "",
      "Order number: {{orderNumber}}",
      "Shipment: {{shipmentNumber}}",
      "Seller: {{sellerName}}",
      "Delivery mode: {{deliveryMode}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "MANUAL_TRANSPORT_REQUIRED_ADMIN",
    name: "Manual transport required admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "Manual transport required for order {{orderNumber}}",
    body: [
      "Manual transport coordination is required.",
      "",
      "Order number: {{orderNumber}}",
      "Shipment: {{shipmentNumber}}",
      "Seller: {{sellerName}}",
      "Package: {{packageDimensions}}",
      "Buyer destination: {{buyerDestination}}",
      "Seller contact: {{sellerContact}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "MANUAL_TRANSPORT_REQUIRED_SELLER",
    name: "Manual transport required seller alert",
    category: EmailTemplateCategory.ORDER,
    subject: "Manual transport coordination for order {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "This order needs manual transport coordination.",
      "",
      "Order number: {{orderNumber}}",
      "Shipment: {{shipmentNumber}}",
      "Package: {{packageDimensions}}",
      "Buyer destination: {{buyerDestination}}",
      "Seller contact: {{sellerContact}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_SUBMITTED",
    name: "B2B enquiry submitted buyer receipt",
    category: EmailTemplateCategory.B2B,
    subject: "B2B enquiry submitted: {{enquiryId}}",
    body: [
      "Hello {{companyName}},",
      "",
      "Your B2B enquiry has been submitted.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Quantity: {{quantity}}",
      "",
      "We will notify you when a quotation or response is available.",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_SUBMITTED_SELLER",
    name: "B2B enquiry submitted seller alert",
    category: EmailTemplateCategory.B2B,
    subject: "New B2B enquiry: {{enquiryId}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{companyName}} submitted a B2B enquiry.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Quantity: {{quantity}}",
      "",
      "Please review and respond from Seller Center.",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_SUBMITTED_ADMIN",
    name: "B2B enquiry submitted admin alert",
    category: EmailTemplateCategory.B2B,
    subject: "New B2B enquiry: {{enquiryId}}",
    body: [
      "A new B2B enquiry has been submitted.",
      "",
      "Company: {{companyName}}",
      "Enquiry ID: {{enquiryId}}",
      "Quantity: {{quantity}}",
      "",
      "Please monitor response and approval workflow from admin.",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_RESPONSE",
    name: "B2B enquiry response buyer update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B enquiry response: {{enquiryId}}",
    body: [
      "Hello {{companyName}},",
      "",
      "A response has been added to your B2B enquiry.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Response from: {{responseSource}}",
      "Quoted price: {{quotedPricePaise}} paise",
      "",
      "Please review the quotation from the B2B portal.",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_CONFIRMED_SELLER",
    name: "B2B quotation confirmed for seller",
    category: EmailTemplateCategory.B2B,
    subject: "B2B quotation confirmed: {{enquiryId}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{companyName}} confirmed your B2B quotation.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Quantity: {{quantity}}",
      "Quoted price: {{quotedPricePaise}} paise",
      "",
      "Admin approval/finalisation may still be required before fulfilment.",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_MESSAGE_BUYER",
    name: "B2B enquiry message buyer update",
    category: EmailTemplateCategory.B2B,
    subject: "New B2B message: {{enquiryId}}",
    body: [
      "Hello {{companyName}},",
      "",
      "{{senderName}} sent a message on your B2B enquiry.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Message: {{messagePreview}}",
    ].join("\n"),
  },
  {
    code: "B2B_ENQUIRY_MESSAGE_SELLER",
    name: "B2B enquiry message seller update",
    category: EmailTemplateCategory.B2B,
    subject: "New B2B message: {{enquiryId}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{senderName}} sent a message on {{companyName}}'s B2B enquiry.",
      "",
      "Enquiry ID: {{enquiryId}}",
      "Message: {{messagePreview}}",
    ].join("\n"),
  },
  {
    code: "B2B_ORDER_PROFORMA_BUYER",
    name: "B2B proforma issued buyer update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B proforma issued: {{orderNumber}}",
    body: [
      "Hello {{companyName}},",
      "",
      "A proforma invoice has been issued for your B2B order.",
      "",
      "Order number: {{orderNumber}}",
      "Proforma invoice: {{proformaInvoiceNumber}}",
      "Payment due: {{paymentDueAt}}",
      "Buyer payable: {{buyerPayableAmountPaise}} paise",
    ].join("\n"),
  },
  {
    code: "B2B_ORDER_PROFORMA_SELLER",
    name: "B2B proforma issued seller update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B proforma issued: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "A B2B proforma has been issued for {{companyName}}.",
      "",
      "Order number: {{orderNumber}}",
      "Proforma invoice: {{proformaInvoiceNumber}}",
      "Estimated seller payout: {{sellerPayoutAmountPaise}} paise",
    ].join("\n"),
  },
  {
    code: "B2B_PURCHASE_ORDER_SUBMITTED_ADMIN",
    name: "B2B purchase order submitted admin alert",
    category: EmailTemplateCategory.B2B,
    subject: "B2B purchase order submitted: {{orderNumber}}",
    body: [
      "{{companyName}} submitted a purchase order.",
      "",
      "Order number: {{orderNumber}}",
      "Purchase order number: {{purchaseOrderNumber}}",
      "",
      "Please review and approve/reject it from admin.",
    ].join("\n"),
  },
  {
    code: "B2B_PURCHASE_ORDER_ACCEPTED_BUYER",
    name: "B2B purchase order accepted buyer update",
    category: EmailTemplateCategory.B2B,
    subject: "Purchase order accepted: {{orderNumber}}",
    body: [
      "Hello {{companyName}},",
      "",
      "Your purchase order has been accepted.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_PURCHASE_ORDER_ACCEPTED_SELLER",
    name: "B2B purchase order accepted seller update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B purchase order accepted: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{companyName}}'s purchase order has been accepted.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_PROOF_SUBMITTED_ADMIN",
    name: "B2B payment proof submitted admin alert",
    category: EmailTemplateCategory.PAYMENT,
    subject: "B2B payment proof submitted: {{orderNumber}}",
    body: [
      "{{companyName}} submitted payment proof.",
      "",
      "Order number: {{orderNumber}}",
      "Amount: {{amountPaise}} paise",
      "Reference: {{referenceNumber}}",
      "Proof ID: {{proofId}}",
      "",
      "Please verify the payment proof from admin finance.",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_OVERPAYMENT_ADMIN",
    name: "B2B overpayment admin alert",
    category: EmailTemplateCategory.PAYMENT,
    subject: "B2B overpayment detected: {{orderNumber}}",
    body: [
      "A B2B payment proof appears to include an overpayment.",
      "",
      "Company: {{companyName}}",
      "Order number: {{orderNumber}}",
      "Paid amount: {{amountPaise}} paise",
      "Overpayment: {{overpaymentAmountPaise}} paise",
      "Reference: {{referenceNumber}}",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_VERIFIED_BUYER",
    name: "B2B payment verified buyer update",
    category: EmailTemplateCategory.PAYMENT,
    subject: "B2B payment verified: {{orderNumber}}",
    body: [
      "Hello {{companyName}},",
      "",
      "Your B2B payment has been verified.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "Buyer payable: {{buyerPayableAmountPaise}} paise",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_VERIFIED_SELLER",
    name: "B2B payment verified seller update",
    category: EmailTemplateCategory.PAYMENT,
    subject: "B2B payment verified: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "{{companyName}}'s B2B payment has been verified.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "Seller payout: {{sellerPayoutAmountPaise}} paise",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_REJECTED_BUYER",
    name: "B2B payment rejected buyer update",
    category: EmailTemplateCategory.PAYMENT,
    subject: "B2B payment proof rejected: {{orderNumber}}",
    body: [
      "Hello {{companyName}},",
      "",
      "Your B2B payment proof could not be verified.",
      "",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_FULFILMENT_UNLOCKED_SELLER",
    name: "B2B fulfilment unlocked seller update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B fulfilment unlocked: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "B2B fulfilment is unlocked for {{companyName}}.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_PAYMENT_NOT_REQUIRED_SELLER",
    name: "B2B payment not required seller alert",
    category: EmailTemplateCategory.B2B,
    subject: "B2B payment not required: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "This B2B order can proceed without payment verification.",
      "",
      "Company: {{companyName}}",
      "Order number: {{orderNumber}}",
      "Payment status: {{paymentStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_ORDER_FULFILLED_BUYER",
    name: "B2B order fulfilled buyer update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B order fulfilled: {{orderNumber}}",
    body: [
      "Hello {{companyName}},",
      "",
      "Your B2B order has been marked fulfilled.",
      "",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  {
    code: "B2B_ORDER_FULFILLED_ADMIN",
    name: "B2B order fulfilled admin alert",
    category: EmailTemplateCategory.B2B,
    subject: "B2B order fulfilled: {{orderNumber}}",
    body: [
      "A B2B order has been marked fulfilled.",
      "",
      "Company: {{companyName}}",
      "Seller: {{sellerName}}",
      "Order number: {{orderNumber}}",
      "Current status: {{orderStatus}}",
      "Buyer payable: {{buyerPayableAmountPaise}} paise",
    ].join("\n"),
  },
  {
    code: "B2B_PAYOUT_ELIGIBLE_SELLER",
    name: "B2B payout eligible seller update",
    category: EmailTemplateCategory.B2B,
    subject: "B2B payout eligible: {{orderNumber}}",
    body: [
      "Hello {{sellerName}},",
      "",
      "A B2B order is now payout eligible.",
      "",
      "Company: {{companyName}}",
      "Order number: {{orderNumber}}",
      "Seller payout: {{sellerPayoutAmountPaise}} paise",
      "Commission: {{commissionAmountPaise}} paise",
    ].join("\n"),
  },
  {
    code: "SERVICE_LISTING_APPROVAL_UPDATED",
    name: "Service listing approval updated",
    category: EmailTemplateCategory.SELLER,
    subject: "Service listing review update: {{serviceTitle}}",
    body: [
      "Your service listing review status has changed.",
      "",
      "Service: {{serviceTitle}}",
      "Approval status: {{approvalStatus}}",
      "",
      "{{note}}",
    ].join("\n"),
  },
  ...serviceBookingTemplates(),
  {
    code: "SUPPORT_REQUEST_RECEIVED",
    name: "Support request received",
    category: EmailTemplateCategory.SUPPORT,
    subject: "Support request received: {{requestId}}",
    body: [
      "Hello {{name}},",
      "",
      "We received your support request.",
      "",
      "Request ID: {{requestId}}",
      "Topic: {{topic}}",
      "Subject: {{subject}}",
      "Order number: {{orderNumber}}",
      "",
      "Our support team will review and respond as soon as possible.",
    ].join("\n"),
  },
  {
    code: "SUPPORT_REQUEST_ALERT",
    name: "Support request admin alert",
    category: EmailTemplateCategory.SUPPORT,
    subject: "New support request: {{subject}}",
    body: [
      "A new support request has been submitted.",
      "",
      "Request ID: {{requestId}}",
      "Name: {{name}}",
      "Email: {{email}}",
      "Requester type: {{requesterType}}",
      "Topic: {{topic}}",
      "Order number: {{orderNumber}}",
      "Subject: {{subject}}",
    ].join("\n"),
  },
  {
    code: "SUPPORT_REQUEST_RESPONDED",
    name: "Support request responded",
    category: EmailTemplateCategory.SUPPORT,
    subject: "Response to support request {{requestId}}",
    body: [
      "Hello {{name}},",
      "",
      "Our team has responded to your support request.",
      "",
      "Request ID: {{requestId}}",
      "Subject: {{subject}}",
      "",
      "{{responseMessage}}",
    ].join("\n"),
  },
];

const templateAliases: Record<string, string> = {
  PRODUCT_SUBMITTED: "PRODUCT_SUBMITTED_SELLER",
  B2B_ENQUIRY_ALERT: "B2B_ENQUIRY_SUBMITTED_ADMIN",
  B2B_ORDER_EVENT: "B2B_ORDER_PROFORMA_BUYER",
  B2B_PAYMENT_EVENT: "B2B_PAYMENT_PROOF_SUBMITTED_ADMIN",
  B2B_PAYOUT_ELIGIBLE: "B2B_PAYOUT_ELIGIBLE_SELLER",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const theme = await seedTheme(dryRun);
  const templateIds = await seedTemplates(theme?.id ?? null, dryRun);
  const triggerCount = await seedTriggerRules(templateIds, dryRun);
  await ensureEmailSetting(dryRun);

  const missingTemplates = emailTriggerCatalog
    .map((item) => item.defaultTemplateCode)
    .filter((code, index, list) => list.indexOf(code) === index)
    .filter((code) => !templateIds.has(code));

  if (missingTemplates.length) {
    throw new Error(`Missing default templates: ${missingTemplates.join(", ")}`);
  }

  console.log(
    [
      dryRun ? "Dry run completed." : "Production email seed completed.",
      `Templates ready: ${templates.length}`,
      `Trigger rules ready: ${triggerCount}`,
      "Email setting preserved. Sending is not enabled by this script.",
    ].join("\n"),
  );
}

async function seedTheme(dryRun: boolean) {
  if (dryRun) {
    return { id: null };
  }

  return prisma.emailTheme.upsert({
    where: { code: DEFAULT_THEME_CODE },
    update: {
      name: "Default 1HandIndia",
      status: ContentStatus.PUBLISHED,
      tokens: defaultThemeTokens as Prisma.InputJsonObject,
    },
    create: {
      code: DEFAULT_THEME_CODE,
      name: "Default 1HandIndia",
      status: ContentStatus.PUBLISHED,
      tokens: defaultThemeTokens as Prisma.InputJsonObject,
    },
    select: { id: true },
  });
}

async function seedTemplates(themeId: string | null, dryRun: boolean) {
  const templateIds = new Map<string, string>();

  for (const template of templates) {
    if (dryRun) {
      templateIds.set(template.code, "dry-run");
      continue;
    }

    const upserted = await prisma.notificationTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        category: template.category,
        channel: NotificationChannel.EMAIL,
        subject: template.subject,
        body: template.body,
        status: ContentStatus.PUBLISHED,
        ...(themeId ? { themeId } : {}),
      },
      create: {
        code: template.code,
        name: template.name,
        category: template.category,
        channel: NotificationChannel.EMAIL,
        subject: template.subject,
        body: template.body,
        status: ContentStatus.PUBLISHED,
        ...(themeId ? { themeId } : {}),
      },
      select: { id: true },
    });
    templateIds.set(template.code, upserted.id);
  }

  if (!dryRun) {
    for (const [alias, target] of Object.entries(templateAliases)) {
      const targetTemplate = templates.find((template) => template.code === target);
      if (!targetTemplate) {
        continue;
      }
      const upserted = await prisma.notificationTemplate.upsert({
        where: { code: alias },
        update: {
          name: `${targetTemplate.name} compatibility`,
          category: targetTemplate.category,
          channel: NotificationChannel.EMAIL,
          subject: targetTemplate.subject,
          body: targetTemplate.body,
          status: ContentStatus.PUBLISHED,
          ...(themeId ? { themeId } : {}),
        },
        create: {
          code: alias,
          name: `${targetTemplate.name} compatibility`,
          category: targetTemplate.category,
          channel: NotificationChannel.EMAIL,
          subject: targetTemplate.subject,
          body: targetTemplate.body,
          status: ContentStatus.PUBLISHED,
          ...(themeId ? { themeId } : {}),
        },
        select: { id: true },
      });
      templateIds.set(alias, upserted.id);
    }
  }

  return templateIds;
}

async function seedTriggerRules(templateIds: Map<string, string>, dryRun: boolean) {
  let count = 0;

  for (const item of emailTriggerCatalog) {
    count += 1;
    if (dryRun) {
      continue;
    }

    const templateId = templateIds.get(item.defaultTemplateCode);
    if (!templateId) {
      throw new Error(`Template ${item.defaultTemplateCode} is missing for ${item.eventCode}`);
    }

    await prisma.emailTriggerRule.upsert({
      where: {
        eventCode_recipientType: {
          eventCode: item.eventCode,
          recipientType: item.recipientType,
        },
      },
      update: {
        category: item.category,
        templateId,
        isEnabled: true,
        delayMinutes: 0,
      },
      create: {
        eventCode: item.eventCode,
        recipientType: item.recipientType,
        category: item.category,
        templateId,
        isEnabled: true,
        delayMinutes: 0,
      },
    });
  }

  return count;
}

async function ensureEmailSetting(dryRun: boolean) {
  if (dryRun) {
    return;
  }

  await prisma.emailSetting.upsert({
    where: { id: DEFAULT_EMAIL_SETTING_ID },
    update: {},
    create: {
      id: DEFAULT_EMAIL_SETTING_ID,
      provider: "smtp",
      senderName: "1HandIndia",
      senderEmail: "no-reply@example.com",
      adminRecipients: null,
      isEnabled: false,
      providerConfig: {},
    },
  });
}

function serviceBookingTemplates(): TemplateSeed[] {
  return [
    serviceTemplate({
      code: "SERVICE_BOOKING_REQUESTED_CUSTOMER",
      name: "Service booking requested customer update",
      recipient: "customer",
      subject: "Service booking requested: {{bookingNumber}}",
      intro: "Your service booking request has been placed.",
      action: "We will notify you when the provider accepts, rejects, or sends a quote.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_REQUESTED_SELLER",
      name: "Service booking requested provider alert",
      recipient: "seller",
      subject: "New service booking request: {{bookingNumber}}",
      intro: "{{customerName}} requested your service.",
      action: "Please review and respond from Seller Center.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_ACCEPTED_CUSTOMER",
      name: "Service booking accepted customer update",
      recipient: "customer",
      subject: "Service booking accepted: {{bookingNumber}}",
      intro: "{{providerName}} accepted your service booking.",
      action: "Please keep the scheduled details ready and follow any provider instructions.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_ACCEPTED_SELLER",
      name: "Service booking accepted provider copy",
      recipient: "seller",
      subject: "Service booking accepted: {{bookingNumber}}",
      intro: "You accepted this service booking.",
      action: "Please keep the schedule and customer requirements updated.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_REJECTED_CUSTOMER",
      name: "Service booking rejected customer update",
      recipient: "customer",
      subject: "Service booking update: {{bookingNumber}}",
      intro: "{{providerName}} could not accept this service booking.",
      action: "You can review the booking details or explore other available providers.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_REJECTED_SELLER",
      name: "Service booking rejected provider copy",
      recipient: "seller",
      subject: "Service booking rejected: {{bookingNumber}}",
      intro: "You rejected this service booking.",
      action: "No further action is required unless the customer contacts support.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_SENT_CUSTOMER",
      name: "Service quote sent customer update",
      recipient: "customer",
      subject: "Service quote received: {{bookingNumber}}",
      intro: "{{providerName}} sent a quote for your service booking.",
      action: "Please review and accept or reject the quote from your account.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_SENT_SELLER",
      name: "Service quote sent provider copy",
      recipient: "seller",
      subject: "Service quote sent: {{bookingNumber}}",
      intro: "Your quote has been sent to {{customerName}}.",
      action: "We will notify you when the customer responds.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_ACCEPTED_CUSTOMER",
      name: "Service quote accepted customer copy",
      recipient: "customer",
      subject: "Service quote accepted: {{bookingNumber}}",
      intro: "You accepted the service quote from {{providerName}}.",
      action: "Please complete any required payment or visit preparation shown in your booking.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_ACCEPTED_SELLER",
      name: "Service quote accepted provider alert",
      recipient: "seller",
      subject: "Service quote accepted: {{bookingNumber}}",
      intro: "{{customerName}} accepted your service quote.",
      action: "Please proceed with the next service workflow step from Seller Center.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_REJECTED_CUSTOMER",
      name: "Service quote rejected customer copy",
      recipient: "customer",
      subject: "Service quote rejected: {{bookingNumber}}",
      intro: "You rejected the service quote from {{providerName}}.",
      action: "The booking status has been updated.",
    }),
    serviceTemplate({
      code: "SERVICE_QUOTE_REJECTED_SELLER",
      name: "Service quote rejected provider alert",
      recipient: "seller",
      subject: "Service quote rejected: {{bookingNumber}}",
      intro: "{{customerName}} rejected your service quote.",
      action: "Please review the booking from Seller Center if follow-up is needed.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_IN_PROGRESS_CUSTOMER",
      name: "Service booking in progress customer update",
      recipient: "customer",
      subject: "Service booking in progress: {{bookingNumber}}",
      intro: "{{providerName}} has started work on your service booking.",
      action: "Please keep communication open until completion is submitted.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_IN_PROGRESS_SELLER",
      name: "Service booking in progress provider copy",
      recipient: "seller",
      subject: "Service booking in progress: {{bookingNumber}}",
      intro: "You marked this service booking in progress.",
      action: "Submit completion once the work is finished.",
    }),
    serviceTemplate({
      code: "SERVICE_COMPLETION_SUBMITTED_CUSTOMER",
      name: "Service completion submitted customer update",
      recipient: "customer",
      subject: "Completion submitted: {{bookingNumber}}",
      intro: "{{providerName}} submitted service completion.",
      action: "Please review and confirm completion or raise a dispute if there is an issue.",
    }),
    serviceTemplate({
      code: "SERVICE_COMPLETION_SUBMITTED_SELLER",
      name: "Service completion submitted provider copy",
      recipient: "seller",
      subject: "Completion submitted: {{bookingNumber}}",
      intro: "You submitted service completion.",
      action: "We will notify you after customer confirmation or dispute resolution.",
    }),
    serviceTemplate({
      code: "SERVICE_COMPLETION_CONFIRMED_CUSTOMER",
      name: "Service completion confirmed customer copy",
      recipient: "customer",
      subject: "Service completed: {{bookingNumber}}",
      intro: "You confirmed service completion.",
      action: "Thank you for using 1HandIndia services.",
    }),
    serviceTemplate({
      code: "SERVICE_COMPLETION_CONFIRMED_SELLER",
      name: "Service completion confirmed provider update",
      recipient: "seller",
      subject: "Service completion confirmed: {{bookingNumber}}",
      intro: "{{customerName}} confirmed service completion.",
      action: "Eligible settlement or payout workflow can now continue based on platform rules.",
    }),
    serviceTemplate({
      code: "SERVICE_DISPUTE_RAISED_CUSTOMER",
      name: "Service dispute raised customer copy",
      recipient: "customer",
      subject: "Service dispute raised: {{bookingNumber}}",
      intro: "Your dispute has been recorded.",
      action: "Our team will review the booking, evidence, and provider response.",
    }),
    serviceTemplate({
      code: "SERVICE_DISPUTE_RAISED_SELLER",
      name: "Service dispute raised provider alert",
      recipient: "seller",
      subject: "Service dispute raised: {{bookingNumber}}",
      intro: "{{customerName}} raised a dispute on this service booking.",
      action: "Please review the issue and cooperate with admin resolution.",
    }),
    serviceTemplate({
      code: "SERVICE_DISPUTE_RESOLVED_CUSTOMER",
      name: "Service dispute resolved customer update",
      recipient: "customer",
      subject: "Service dispute resolved: {{bookingNumber}}",
      intro: "The dispute on your service booking has been resolved.",
      action: "Please review the final booking status in your account.",
    }),
    serviceTemplate({
      code: "SERVICE_DISPUTE_RESOLVED_SELLER",
      name: "Service dispute resolved provider update",
      recipient: "seller",
      subject: "Service dispute resolved: {{bookingNumber}}",
      intro: "The dispute on this service booking has been resolved.",
      action: "Please review the final booking and settlement status from Seller Center.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_CANCELLED_CUSTOMER",
      name: "Service booking cancelled customer update",
      recipient: "customer",
      subject: "Service booking cancelled: {{bookingNumber}}",
      intro: "This service booking has been cancelled.",
      action: "Please review the booking details in your account for any next steps.",
    }),
    serviceTemplate({
      code: "SERVICE_BOOKING_CANCELLED_SELLER",
      name: "Service booking cancelled provider update",
      recipient: "seller",
      subject: "Service booking cancelled: {{bookingNumber}}",
      intro: "This service booking has been cancelled.",
      action: "No further provider action is required unless support contacts you.",
    }),
  ];
}

function serviceTemplate(input: {
  code: string;
  name: string;
  recipient: "customer" | "seller";
  subject: string;
  intro: string;
  action: string;
}): TemplateSeed {
  return {
    code: input.code,
    name: input.name,
    category:
      input.recipient === "customer"
        ? EmailTemplateCategory.CUSTOMER
        : EmailTemplateCategory.SELLER,
    subject: input.subject,
    body: [
      "Service booking update",
      "",
      input.intro,
      "",
      "Booking number: {{bookingNumber}}",
      "Service: {{serviceTitle}}",
      "Provider: {{providerName}}",
      "Customer: {{customerName}}",
      "Status: {{status}}",
      "",
      input.action,
    ].join("\n"),
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
